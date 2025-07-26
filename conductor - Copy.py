# C:\syncphony\conductor.py
import multiprocessing
import queue
import json
import time
import asyncio
from logger_config import get_logger
from event_system import EventSystem, event_publisher, GDC_SNAPSHOT_EVENT

# Centralized logger for the Conductor process
logger = get_logger("Conductor")

class Conductor:
    """
    The Conductor is the heart of the Syncphony system. It reads a Symphony file,
    interprets the tasks, and dispatches them to the appropriate Musician processes.
    It manages the overall state of the performance, including task dependencies
    and execution flow.
    """
    def __init__(self, symphony_path, task_queues, reporting_queue, input_queue, log_queue, gdc_update_queue, genome_data_cache):
        self.symphony_path = symphony_path
        self.task_queues = task_queues
        self.reporting_queue = reporting_queue
        self.input_queue = input_queue
        self.log_queue = log_queue
        self.gdc_update_queue = gdc_update_queue
        self.gdc = genome_data_cache
        self.symphony = None
        self.task_status = {}
        self.event_system = EventSystem() # Each process has its own EventSystem instance
        self.stop_event = asyncio.Event()

    def log(self, message, level="info"):
        """Logs a message through the shared logging queue."""
        log_entry = f"[Conductor]: {message}"
        getattr(logger, level.lower(), logger.info)(log_entry)
        self.log_queue.put(log_entry)

    def report_status(self, task_id, status, error=None):
        """Reports the status of a task through the shared reporting queue."""
        report = {"task_id": task_id, "status": status, "error": error}
        self.reporting_queue.put(report)

    def load_symphony(self):
        """Loads and validates the Symphony JSON file."""
        self.log(f"Loading Symphony from '{self.symphony_path}'...")
        try:
            with open(self.symphony_path, 'r') as f:
                # MODIFIED: Use json.load() to parse the file object directly.
                # This corrects the "'str' object has no attribute 'get'" error.
                symphony_data = json.load(f)
            
            # Basic validation
            if "tasks" not in symphony_data or not isinstance(symphony_data["tasks"], list):
                raise ValueError("Symphony file must contain a 'tasks' list.")
            
            self.symphony = symphony_data
            self.log("Symphony loaded successfully.")
            
            # Initialize GDC with symphony structure
            self.gdc.set('symphony_structure', self.symphony)
            self.gdc.set('performance_status', 'loaded')
            return True
        except FileNotFoundError:
            self.log(f"Symphony load failed: File not found at {self.symphony_path}", "error")
            return False
        except json.JSONDecodeError as e:
            self.log(f"Symphony load failed: Invalid JSON format. {e}", "error")
            return False
        except Exception as e:
            self.log(f"An unexpected error occurred loading symphony: {e}", "error")
            self.log("Halting due to error loading symphony.", "error")
            return False

    async def _gdc_heartbeat_task(self):
        """Periodically sends GDC updates to Mission Control."""
        while not self.stop_event.is_set():
            try:
                # Publish the snapshot event locally
                await event_publisher.publish(GDC_SNAPSHOT_EVENT, self.gdc.get_all_data())
                
                # Send the raw state dictionary to the queue for Mission Control
                self.gdc_update_queue.put(self.gdc.get_all_data())
                
                await asyncio.sleep(1) 
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.log(f"Error in GDC heartbeat task: {e}", "error")

    async def _input_listener_task(self):
        """Listens for stop commands from the input queue."""
        loop = asyncio.get_running_loop()
        while not self.stop_event.is_set():
            try:
                # Use run_in_executor for the blocking queue.get() call
                command = await loop.run_in_executor(None, self.input_queue.get)
                if command == 'STOP':
                    self.log("STOP command received. Initiating graceful shutdown.")
                    self.stop_event.set()
                    break
            except queue.Empty:
                await asyncio.sleep(0.1) # Short sleep to prevent busy-waiting
            except Exception as e:
                self.log(f"Error in input listener task: {e}", "error")
                break
                
    async def run_performance(self):
        """Executes the symphony tasks in the correct order."""
        if not self.symphony:
            return

        self.gdc.set('performance_status', 'running')

        # Initialize task statuses in GDC
        for task in self.symphony["tasks"]:
            task_id = task.get("task_id", "unnamed_task")
            self.task_status[task_id] = "pending"
            self.gdc.set(f"task_status.{task_id}", "pending")

        tasks_in_flight = set()
        pending_tasks = self.symphony["tasks"].copy()

        while pending_tasks or tasks_in_flight:
            if self.stop_event.is_set():
                self.log("Stop event detected, terminating performance run.")
                break

            # Dispatch ready tasks
            for task in list(pending_tasks):
                task_id = task.get("task_id")
                dependencies = task.get("depends_on", [])
                
                # Check if all dependencies are met
                deps_met = all(self.task_status.get(dep) == "completed" for dep in dependencies)
                
                if deps_met:
                    self.log(f"Dispatching task '{task_id}' to Musician '{task['musician']}'.")
                    musician_queue = self.task_queues.get(task['musician'])
                    if musician_queue:
                        musician_queue.put(task)
                        self.task_status[task_id] = "dispatched"
                        self.gdc.set(f"task_status.{task_id}", "dispatched")
                        tasks_in_flight.add(task_id)
                        pending_tasks.remove(task)
                    else:
                        self.log(f"No queue found for musician '{task['musician']}'. Task '{task_id}' failed.", "error")
                        self.task_status[task_id] = "failed"
                        self.gdc.set(f"task_status.{task_id}", "failed")
                        self.report_status(task_id, "failed", f"Musician '{task['musician']}' not found.")
                        pending_tasks.remove(task)

            # Check for updates from the reporting queue
            try:
                report = self.reporting_queue.get_nowait()
                task_id = report["task_id"]
                status = report["status"]
                
                self.log(f"Received report for task '{task_id}': {status}")
                self.task_status[task_id] = status
                self.gdc.set(f"task_status.{task_id}", status)
                
                if status in ["completed", "failed"]:
                    tasks_in_flight.remove(task_id)
                    
            except queue.Empty:
                pass # No reports, continue loop

            await asyncio.sleep(0.1) # Polling interval

        self.log("Performance finished.")
        self.gdc.set('performance_status', 'finished')
        self.stop_event.set() # Signal other tasks to stop

    async def start(self):
        """Main entry point for the Conductor's async operations."""
        self.log("Conductor process started, initializing asyncio loop.")
        
        if not self.load_symphony():
            self.log("Conductor shutting down due to symphony load failure.", "error")
            return

        # Create concurrent tasks for background operations and the main performance
        gdc_task = asyncio.create_task(self._gdc_heartbeat_task())
        input_task = asyncio.create_task(self._input_listener_task())
        performance_task = asyncio.create_task(self.run_performance())

        # Wait for all tasks to complete
        await asyncio.gather(gdc_task, input_task, performance_task)

        self.log("Asyncio loop closed. Process shutting down.")


def main(symphony_path, task_queues, reporting_queue, input_queue, log_queue, gdc_update_queue, genome_data_cache):
    """The main function for the Conductor process."""
    conductor = Conductor(symphony_path, task_queues, reporting_queue, input_queue, log_queue, gdc_update_queue, genome_data_cache)
    try:
        asyncio.run(conductor.start())
    except KeyboardInterrupt:
        logger.info("Conductor process interrupted by user.")