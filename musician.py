# C:\syncphony\musician.py
# Key Changes:
# - Refactored ShellExecutorMusician's run_command to use shell=False and shlex.split().
# - This is a critical security enhancement to prevent shell injection vulnerabilities.

import multiprocessing
import time
import queue
import shutil
import os
import json
import subprocess
import re
import asyncio
import collections
import sys
import random
import shlex
from a_sync_plus.sync import patch_everywhere
patch_everywhere()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from telemetry import log_task_lifecycle, emit_telemetry_event, _telemetry_flusher_task
from leap_toolkit import get_json_from_url, post_data_to_api

class MusicianProcess(multiprocessing.Process):
    def __init__(self, name, task_queue, log_queue, reporting_queue):
        super().__init__()
        self.name = name
        self.task_queue = task_queue
        self.log_queue = log_queue
        self.reporting_queue = reporting_queue
        self.actions = self._map_actions()
        self._current_task_id = None
        self._loop = None

    def _map_actions(self):
        raise NotImplementedError("Subclasses must implement the _map_actions method.")

    async def _execute_decorated_action(self, action_name, parameters, task_id_for_decorator):
        self._current_task_id = task_id_for_decorator
        action_method_func = self.actions.get(action_name)
        if not action_method_func:
            raise ValueError(f"Action '{action_name}' not found for Musician '{self.name}'.")

        self.log_queue.put(f"[{self.name}]: Executing action '{action_name}' for task '{task_id_for_decorator}'.")

        if asyncio.iscoroutinefunction(action_method_func):
            await action_method_func(self, **parameters)
        else:
            await asyncio.get_running_loop().run_in_executor(
                None,
                getattr(self, action_name),
                **parameters
            )
        self._current_task_id = None

    def run(self):
        self.log_queue.put(f"[{self.name}]: Process started, initializing asyncio loop.")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        self._loop = loop

        try:
            loop.run_until_complete(self._run_musician_loop())
        finally:
            loop.close()
            self.log_queue.put(f"[{self.name}]: Asyncio loop closed. Process shutting down.")

    async def _run_musician_loop(self):
        asyncio.create_task(_telemetry_flusher_task())
        self.log_queue.put(f"[{self.name}]: Telemetry flusher task started.")

        backoff_time = 0.01
        while True:
            try:
                task = await asyncio.to_thread(self.task_queue.get, timeout=1)
                if task == 'STOP':
                    self.log_queue.put(f"[{self.name}]: Received STOP signal. Shutting down.")
                    break

                task_id = task.get('task_id')
                details = task.get('details', {})
                action = details.get('action')
                parameters = details.get('parameters', {})

                self.log_queue.put(f"[{self.name}]: Received task '{task_id}' (Action: {action}).")

                if action in self.actions:
                    try:
                        decorated_action_runner = log_task_lifecycle()(self._execute_decorated_action)
                        await decorated_action_runner(self, action, parameters, task_id)
                        self.reporting_queue.put({"task_id": task_id, "status": "completed"})
                        self.log_queue.put(f"[{self.name}]: Task '{task_id}' completed successfully.")
                    except Exception as e:
                        self.reporting_queue.put({"task_id": task_id, "status": "failed", "error": str(e)})
                        self.log_queue.put(f"[{self.name} ERROR]: Task '{task_id}' failed: {e}")
                else:
                    error_msg = f"Unknown action '{action}' for task '{task_id}'."
                    self.log_queue.put(f"[{self.name} ERROR]: {error_msg}")
                    self.reporting_queue.put({"task_id": task_id, "status": "failed", "error": error_msg})
                backoff_time = 0.01
            except queue.Empty:
                await asyncio.sleep(backoff_time)
                backoff_time = min(backoff_time * 2 + random.uniform(0, 0.1), 1.0)
            except Exception as e:
                self.log_queue.put(f"[{self.name}]: UNHANDLED ERROR in Musician loop: {e}")
                await asyncio.sleep(1)
                backoff_time = 0.01

class FileSystemMusician(MusicianProcess):
    def _map_actions(self):
        return {
            "create_directory": self.create_directory,
            "write_file": self.write_file,
            "read_file": self.read_file,
            "delete_path": self.delete_path
        }
    
    def create_directory(self, path):
        os.makedirs(path, exist_ok=True)
        self.log_queue.put(f"[{self.name}]: Directory '{path}' created.")

    def write_file(self, file_path, content):
        normalized_path = os.path.normpath(file_path.strip())
        os.makedirs(os.path.dirname(normalized_path), exist_ok=True)
        with open(normalized_path, 'w', encoding='utf-8') as f:
            f.write(content)
        self.log_queue.put(f"[{self.name}]: File '{normalized_path}' written.")

    def read_file(self, file_path):
        normalized_path = os.path.normpath(file_path.strip())
        with open(normalized_path, 'r', encoding='utf-8') as f:
            content = f.read()
        self.log_queue.put(f"[{self.name}]: File '{normalized_path}' read.")
        return content

    def delete_path(self, path):
        if os.path.isdir(path):
            shutil.rmtree(path)
            self.log_queue.put(f"[{self.name}]: Directory '{path}' deleted.")
        elif os.path.isfile(path):
            os.remove(path)
            self.log_queue.put(f"[{self.name}]: File '{path}' deleted.")
        else:
            self.log_queue.put(f"[{self.name}]: Path '{path}' not found.")

class ShellExecutorMusician(MusicianProcess):
    def _map_actions(self):
        return {"run_command": self.run_command}

    def run_command(self, command, cwd):
        try:
            # MODIFIED: Use shlex.split for safety and shell=False
            if isinstance(command, str):
                cmd_list = shlex.split(command)
            else:
                cmd_list = command # Assume it's already a list of args

            self.log_queue.put(f"[{self.name}]: Running command: '{cmd_list}' in '{cwd}'")
            result = subprocess.run(
                cmd_list, shell=False, cwd=cwd, check=True,
                capture_output=True, text=True, encoding='utf-8', errors='ignore'
            )
            
            # Use run_coroutine_threadsafe to safely call async functions from this sync method
            if result.stdout:
                stdout_content = result.stdout.strip()
                self.log_queue.put(f"[{self.name} STDOUT]: {stdout_content}")
                asyncio.run_coroutine_threadsafe(
                    emit_telemetry_event(self.name, self._current_task_id, "sub_log_entry",
                                         {"log_type": "stdout", "content": stdout_content}),
                    loop=self._loop
                )

            if result.stderr:
                stderr_content = result.stderr.strip()
                self.log_queue.put(f"[{self.name} STDERR]: {stderr_content}")
                asyncio.run_coroutine_threadsafe(
                    emit_telemetry_event(self.name, self._current_task_id, "sub_log_entry",
                                         {"log_type": "stderr", "content": stderr_content}),
                    loop=self._loop
                )
            return {"stdout": result.stdout, "stderr": result.stderr, "returncode": result.returncode}
        except subprocess.CalledProcessError as e:
            error_details = f"Command '{command}' failed in '{cwd}' with exit code {e.returncode}.\nSTDOUT: {e.stdout}\nSTDERR: {e.stderr}"
            raise Exception(error_details)
        except Exception as e:
            raise Exception(f"An unexpected error occurred running command '{command}': {e}")

class WebMusician(MusicianProcess):
    def _map_actions(self):
        return {
            "get_json": self.get_json,
            "post_data": self.post_data
        }

    async def get_json(self, url): # This action is async
        return await get_json_from_url(url)

    async def post_data(self, url, payload): # This action is async
        return await post_data_to_api(url, payload)

AVAILABLE_MUSICIANS = {
    "FileSystemMusician": FileSystemMusician,
    "ShellExecutorMusician": ShellExecutorMusician,
    "WebMusician": WebMusician,
    "FileSystem": FileSystemMusician,
    "ShellExecutor": ShellExecutorMusician,
    "Web": WebMusician,
}