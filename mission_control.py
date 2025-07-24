# C:\syncphony\mission_control.py
# Key Changes:
# - Added gdc_update_queue to __init__ and main block for receiving GDC state.
# - Updated _check_queues_for_updates to process messages from gdc_update_queue.
# - This allows the GDC instance in Mission Control (and by extension, the WebSocket server)
#   to reflect the live state from the Conductor process.

import tkinter as tk
from tkinter import filedialog, scrolledtext, messagebox, simpledialog, ttk
import multiprocessing
import queue
import os
import json
import asyncio
import threading
import sys
import time
import logging
import logging.handlers

# Configure centralized persistent logging with rotation
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "mission_control.log")

logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "process": "%(processName)s", "level": "%(levelname)s", "message": "%(message)s"}',
    handlers=[
        logging.StreamHandler(),
        logging.handlers.RotatingFileHandler(LOG_FILE, maxBytes=5*1024*1024, backupCount=10)
    ]
)
logger = logging.getLogger(__name__)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from conductor import main as conductor_main
from musician import AVAILABLE_MUSICIANS
import siip_agent
from telemetry import _telemetry_buffer, _buffer_lock
from genome_data_cache import GenomeDataCache
from telemetry_ws_server import TelemetryWebSocketServer
from integrity_check_script_content import analyze_codebase

class MissionControl:
    def __init__(self, root, task_queues, log_queue, input_queue, reporting_queue, gdc_update_queue):
        self.root = root
        self.task_queues = task_queues
        self.log_queue = log_queue
        self.input_queue = input_queue
        self.reporting_queue = reporting_queue
        self.gdc_update_queue = gdc_update_queue # MODIFIED: Added queue for GDC state
        self.symphony_path = None
        self.conductor_process = None
        self.musician_processes = []
        self.siip_data_path = tk.StringVar()

        self.root.title("Syncphony Mission Control v3.8 (Harmonized)")
        self.root.geometry("1200x900")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(2, weight=1)
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

        # This GDC instance will be kept in sync by the Conductor process
        self.gdc = GenomeDataCache()

        # The WS server will now have access to the live-updated GDC
        self.ws_server = TelemetryWebSocketServer(
            self.gdc,
            self.log_queue,
            self.reporting_queue,
            (_telemetry_buffer, _buffer_lock)
        )

        # --- UI Elements ---
        perf_frame = ttk.LabelFrame(self.root, text="Performance Controls", padding=(10, 5))
        perf_frame.grid(row=0, column=0, padx=10, pady=5, sticky="ew")
        perf_frame.columnconfigure(0, weight=1)
        perf_frame.columnconfigure(1, weight=1)
        perf_frame.columnconfigure(2, weight=1)

        self.path_label = ttk.Label(perf_frame, text="No Symphony Selected")
        self.path_label.grid(row=0, column=0, columnspan=3, pady=5, sticky="ew")

        self.select_button = ttk.Button(perf_frame, text="Select Symphony File", command=self.select_symphony)
        self.select_button.grid(row=1, column=0, padx=5, pady=5, sticky="ew")

        self.start_button = ttk.Button(perf_frame, text="Start Performance", command=self.start_performance, state="disabled")
        self.start_button.grid(row=1, column=1, padx=5, pady=5, sticky="ew")

        self.stop_button = ttk.Button(perf_frame, text="Stop Performance", command=self.stop_performance, state="disabled")
        self.stop_button.grid(row=1, column=2, padx=5, pady=5, sticky="ew")

        self.integrity_button = ttk.Button(perf_frame, text="Run Integrity Check", command=self.run_integrity_check)
        self.integrity_button.grid(row=1, column=3, padx=5, pady=5, sticky="ew")

        self.ws_status_label = ttk.Label(perf_frame, text="WS: Disconnected", foreground="red")
        self.ws_status_label.grid(row=2, column=0, columnspan=3, padx=5, pady=2, sticky="ew")

        siip_frame = ttk.LabelFrame(self.root, text="SIIP Tools", padding=(10, 5))
        siip_frame.grid(row=1, column=0, padx=10, pady=5, sticky="ew")
        siip_frame.columnconfigure(0, weight=1)

        siip_path_label = ttk.Label(siip_frame, text="SIIP Data File (e.g., log.txt):")
        siip_path_label.grid(row=0, column=0, padx=5, pady=2, sticky="w")

        self.siip_path_entry = ttk.Entry(siip_frame, textvariable=self.siip_data_path, width=50)
        self.siip_path_entry.grid(row=1, column=0, padx=5, pady=2, sticky="ew")

        self.siip_select_button = ttk.Button(siip_frame, text="Browse SIIP File", command=self.select_siip_file)
        self.siip_select_button.grid(row=1, column=1, padx=5, pady=2, sticky="w")

        self.analyze_button = ttk.Button(siip_frame, text="Analyze File System (SIIP)", command=self.analyze_file_system)
        self.analyze_button.grid(row=2, column=0, padx=5, pady=5, sticky="ew")

        log_frame = ttk.LabelFrame(self.root, text="Performance Log", padding=(10, 5))
        log_frame.grid(row=2, column=0, padx=10, pady=5, sticky="nsew")
        log_frame.rowconfigure(0, weight=1)
        log_frame.columnconfigure(0, weight=1)

        self.log_display = scrolledtext.ScrolledText(log_frame, state="disabled", wrap="word", width=100, height=25, font=("Consolas", 10))
        self.log_display.grid(row=0, column=0, sticky="nsew")

        log_buttons_frame = ttk.Frame(log_frame)
        log_buttons_frame.grid(row=1, column=0, sticky="ew", pady=(5,0))
        log_buttons_frame.columnconfigure(0, weight=1)
        log_buttons_frame.columnconfigure(1, weight=1)

        self.copy_log_button = ttk.Button(log_buttons_frame, text="Copy Log", command=self.copy_log_to_clipboard)
        self.copy_log_button.grid(row=0, column=0, padx=5, pady=5, sticky="ew")

        self.clear_log_button = ttk.Button(log_buttons_frame, text="Clear Log", command=self.clear_log_display)
        self.clear_log_button.grid(row=0, column=1, padx=5, pady=5, sticky="ew")

        self.status_bar = ttk.Label(self.root, text="Ready", relief=tk.SUNKEN, anchor="w")
        self.status_bar.grid(row=3, column=0, sticky="ew")

        self._start_async_backend()
        self.root.after(100, self._check_queues_for_updates)
        logger.info("MissionControl.__init__ - Finished")

    def _start_async_backend(self):
        def run_async_loop(loop):
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.ws_server.start())

        self.async_loop = asyncio.new_event_loop()
        self.async_thread = threading.Thread(target=run_async_loop, args=(self.async_loop,), daemon=True)
        self.async_thread.start()
        logger.info("[MissionControl]: Async backend (WS Server) started in a new thread.")
        self.ws_status_label.config(text="WS: Listening (ws://127.0.0.1:8765)", foreground="green")

    def _check_queues_for_updates(self):
        # Process log messages
        while True:
            try:
                message = self.log_queue.get_nowait()
                self.log_message(message)
            except queue.Empty:
                break
            except Exception as e:
                self.log_message(f"[MissionControl ERROR]: Error reading log queue: {e}")
                break

        # Process reporting messages
        while True:
            try:
                report = self.reporting_queue.get_nowait()
                task_id = report.get('task_id', 'N/A')
                status = report.get('status', 'N/A')
                error = report.get('error', '')
                report_msg = f"[MissionControl Report]: Task '{task_id}' Status: {status}"
                if error:
                    report_msg += f", Error: {error}"
                self.log_message(report_msg)
            except queue.Empty:
                break
            except Exception as e:
                self.log_message(f"[MissionControl ERROR]: Error reading reporting queue: {e}")
                break
        
        # MODIFIED: Process GDC state updates from the Conductor
        while True:
            try:
                gdc_state = self.gdc_update_queue.get_nowait()
                # Overwrite the local GDC's internal cache with the live state
                self.gdc._data_cache = gdc_state
                # Force a Merkle root recalculation on the new data
                self.gdc.get_merkle_root()
                logger.info("[MissionControl GDC]: Applied GDC state update from Conductor.")
            except queue.Empty:
                break
            except Exception as e:
                self.log_message(f"[MissionControl ERROR]: Error reading GDC update queue: {e}")
                break

        self.root.after(100, self._check_queues_for_updates)

    def select_symphony(self):
        symphony_file = filedialog.askopenfilename(
            title="Select Symphony JSON File",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if symphony_file:
            self.symphony_path = symphony_file
            self.path_label.config(text=f"Selected: {os.path.basename(self.symphony_path)}")
            self.start_button.config(state="normal")
            self.status_bar.config(text="Symphony selected. Ready to perform.")

    def start_performance(self):
        if not self.symphony_path:
            messagebox.showwarning("No Symphony", "Please select a Symphony JSON file first.")
            return

        self.log_message("--- New Performance Starting ---")
        self.toggle_controls(True)

        all_queues = [self.log_queue, self.reporting_queue, self.input_queue, self.gdc_update_queue] + list(self.task_queues.values())
        for q in all_queues:
            try:
                while True:
                    q.get_nowait()
            except queue.Empty:
                pass

        self.musician_processes = []
        for name, MusicianClass in AVAILABLE_MUSICIANS.items():
            musician = MusicianClass(name, self.task_queues[name], self.log_queue, self.reporting_queue)
            self.musician_processes.append(musician)
            musician.start()
            self.log_message(f"[Mission Control]: Launched '{name}' musician process.")

        self.conductor_process = multiprocessing.Process(
            target=conductor_main,
            args=(self.symphony_path, self.task_queues, self.reporting_queue, self.input_queue, self.log_queue, self.gdc_update_queue)
        )
        self.conductor_process.start()
        self.log_message(f"[Mission Control]: Launched 'Conductor' process.")
        self.root.after(500, self._monitor_performance)

    def _monitor_performance(self):
        if self.conductor_process and self.conductor_process.is_alive():
            self.root.after(500, self._monitor_performance)
        else:
            self.log_message("--- Performance Finished ---")
            self.toggle_controls(False)
            self.stop_performance()

    def stop_performance(self):
        self.log_message("[Mission Control]: Sending STOP signal to processes...")
        
        if self.input_queue:
            try:
                self.input_queue.put('STOP')
            except Exception as e:
                self.log_message(f"[Mission Control ERROR]: Could not send STOP to Conductor input queue: {e}")

        for q in self.task_queues.values():
            try:
                q.put('STOP')
            except Exception as e:
                self.log_message(f"[Mission Control ERROR]: Could not send STOP to musician task queue: {e}")

        if self.conductor_process:
            self.conductor_process.join(timeout=5)
            if self.conductor_process.is_alive():
                self.conductor_process.terminate()
                self.log_message("[Mission Control]: Conductor terminated forcefully.")
            self.conductor_process = None

        for musician_process in self.musician_processes:
            if musician_process.is_alive():
                musician_process.join(timeout=5)
                if musician_process.is_alive():
                    musician_process.terminate()
                    self.log_message(f"[Mission Control]: Musician {musician_process.name} terminated forcefully.")
        self.musician_processes = []
        
        self.log_message("[Mission Control]: All processes signaled to shut down.")
        self.status_bar.config(text="Performance stopped.")
        self.toggle_controls(False)

    def on_closing(self):
        if messagebox.askokcancel("Quit", "Do you want to quit Syncphony Mission Control?"):
            self.stop_performance()
            
            if hasattr(self, 'async_loop') and self.async_loop.is_running():
                self.async_loop.call_soon_threadsafe(self.async_loop.stop)
                self.async_thread.join(timeout=5)
                if self.async_thread.is_alive():
                    logger.warning("[MissionControl]: Async thread did not stop gracefully.")
            
            self.root.destroy()
            logger.info("[MissionControl]: Application shut down.")


    def select_siip_file(self):
        siip_file = filedialog.askopenfilename(
            title="Select SIIP Data File (e.g., log.txt)",
            filetypes=[("All files", "*.*"), ("Text files", "*.txt"), ("Log files", "*.log")]
        )
        if siip_file:
            self.siip_data_path.set(siip_file)
            self.status_bar.config(text=f"SIIP data file selected: {os.path.basename(siip_file)}")

    def analyze_file_system(self):
        root_dir = simpledialog.askstring("Analyze File System", "Enter root directory to analyze:",
                                          initialvalue="C:\\syncphony\\test_output\\temp_project")
        if root_dir:
            self.log_message(f"[Mission Control]: Initiating SIIP file system analysis for: {root_dir}")
            try:
                from create_siip_packet import main as create_siip_main
                # Run in a separate thread to avoid blocking the GUI
                threading.Thread(target=create_siip_main, args=(root_dir,), daemon=True).start()
                self.log_message(f"[Mission Control]: SIIP File System Analysis started for {root_dir}. See console for output.")
            except Exception as e:
                self.log_message(f"[Mission Control ERROR]: SIIP analysis failed: {e}")
            self.status_bar.config(text="SIIP analysis finished.")

    def run_integrity_check(self):
        directory = os.getcwd()
        self.log_message(f"[Mission Control]: Running integrity check on {directory}")
        analyze_codebase(directory)
        self.log_message("[Mission Control]: Integrity check complete. See console/logs for report.")

    def copy_log_to_clipboard(self):
        log_content = self.log_display.get('1.0', tk.END)
        self.root.clipboard_clear()
        self.root.clipboard_append(log_content)
        self.status_bar.config(text="Log copied to clipboard!")

    def clear_log_display(self):
        self.log_display.config(state="normal")
        self.log_display.delete('1.0', tk.END)
        self.log_display.config(state="disabled")
        self.status_bar.config(text="Log cleared.")

    def log_message(self, message):
        self.log_display.config(state="normal")
        self.log_display.insert(tk.END, str(message) + "\n")
        self.log_display.see(tk.END)
        self.log_display.config(state="disabled")
        logger.info(message)

    def toggle_controls(self, is_running):
        self.start_button.config(state="disabled" if is_running else "normal")
        self.select_button.config(state="disabled" if is_running else "normal")
        self.siip_select_button.config(state="disabled" if is_running else "normal")
        self.analyze_button.config(state="disabled" if is_running else "normal")
        self.integrity_button.config(state="disabled" if is_running else "normal")
        self.stop_button.config(state="normal" if is_running else "disabled")
        self.status_bar.config(text="Running..." if is_running else "Ready")


if __name__ == "__main__":
    multiprocessing.freeze_support()

    logger.info("mission_control.py - Initializing queues...")

    task_queues = {role: multiprocessing.Queue() for role in AVAILABLE_MUSICIANS}
    log_queue = multiprocessing.Queue()
    input_queue = multiprocessing.Queue()
    reporting_queue = multiprocessing.Queue()
    gdc_update_queue = multiprocessing.Queue() # MODIFIED: Create the new queue

    logger.info("mission_control.py - Creating Tkinter root...")
    root = tk.Tk()
    app = MissionControl(root, task_queues, log_queue, input_queue, reporting_queue, gdc_update_queue)
    logger.info("mission_control.py - Starting mainloop...")
    root.mainloop()
    logger.info("mission_control.py - Mainloop finished.")

    logger.info("[Main]: Mission Control GUI closed. Initiating final process cleanup.")
    
    # Graceful shutdown logic remains largely the same
    try:
        input_queue.put('STOP')
        for q in task_queues.values():
            q.put('STOP')
    except Exception as e:
        logger.error(f"[Main Cleanup ERROR]: Could not send STOP signals: {e}")

    time.sleep(1)
    
    # Terminate any lingering processes
    active_children = multiprocessing.active_children()
    if active_children:
        logger.info(f"[Main Cleanup]: Force terminating {len(active_children)} remaining child processes.")
        for child in active_children:
            child.terminate()
            child.join(timeout=1)

    logger.info("[Main]: Final cleanup complete. Exiting.")