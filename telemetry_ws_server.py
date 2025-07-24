# C:\syncphony\telemetry_ws_server.py

import asyncio
import websockets
import json
import collections
import time
from datetime import datetime
import sys
import os
import queue # For multiprocessing.Queue.Empty exception

# Add the current directory to sys.path so it can find telemetry and genome_data_cache
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Assuming these are available from the main application context (MissionControl passes references)
# We don't import them directly here to avoid circular dependencies if this were a true microservice
# but assume they are accessible via the references passed during initialization.

class TelemetryWebSocketServer:
    """
    Manages WebSocket connections for real-time telemetry and control.
    """
    def __init__(self, gdc_instance, log_queue, reporting_queue, telemetry_buffer_ref):
        self.connected_clients = set() # Store connected WebSocket clients
        self.gdc = gdc_instance # Reference to the main GDC instance
        self.log_queue = log_queue # Reference to the system log queue (multiprocessing.Queue)
        self.reporting_queue = reporting_queue # Reference to the task reporting queue (multiprocessing.Queue)
        self.telemetry_buffer_ref = telemetry_buffer_ref # Tuple: (_telemetry_buffer_deque, _buffer_lock_asyncio) from telemetry.py

        self._last_gdc_root = None # To detect GDC changes for pushing snapshots

    async def register_client(self, websocket):
        """Registers a new connected WebSocket client."""
        self.connected_clients.add(websocket)
        print(f"[WS Server]: Client connected: {websocket.remote_address}. Total clients: {len(self.connected_clients)}")
        # Send initial state to new client
        await self._send_initial_state(websocket)

    async def unregister_client(self, websocket):
        """Unregisters a disconnected WebSocket client."""
        self.connected_clients.remove(websocket)
        print(f"[WS Server]: Client disconnected: {websocket.remote_address}. Total clients: {len(self.connected_clients)}")

    async def _send_initial_state(self, websocket):
        """Sends current GDC and recent logs to a newly connected client."""
        if self.gdc:
            current_gdc_root = self.gdc.get_merkle_root()
            try:
                # Send the Merkle root and possibly a summary of the GDC state
                await websocket.send(json.dumps({
                    "type": "gdc_snapshot",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "merkle_root": current_gdc_root,
                    "full_gdc_state_summary": self.gdc.get_all_data() # Send full data for initial sync, or a subset
                }))
            except websockets.exceptions.ConnectionClosed:
                print(f"[WS Server WARN]: Connection closed while sending initial GDC state to {websocket.remote_address}.")
            except Exception as e:
                print(f"[WS Server ERROR]: Failed to send initial GDC state to {websocket.remote_address}: {e}")

        # TODO: Implement sending a batch of recent log messages and task reports
        # For a full UI, you'd fetch recent logs from your persistence layer (e.g., Whoosh index)
        # and push them here. For now, we only push new incoming logs via _push_updates.

    async def _process_incoming_message(self, websocket, message):
        """Processes messages received from a connected client."""
        try:
            data = json.loads(message)
            msg_type = data.get("type")

            print(f"[WS Server]: Received '{msg_type}' command from client.")

            if msg_type == "query_gdc_node":
                category = data.get("category")
                key = data.get("key")
                node_data = self.gdc.get_data(category, key)
                await websocket.send(json.dumps({
                    "type": "gdc_node_response",
                    "category": category,
                    "key": key,
                    "data": node_data
                }))
            elif msg_type == "start_symphony":
                symphony_path = data.get("symphony_path")
                # This would feed into the Conductor's input queue or trigger MissionControl's start method
                # The MissionControl GUI itself handles starting Symphonies via button clicks.
                # This example is if an external client (e.g., a CLI tool) connects to WS.
                # For now, we'll just log and acknowledge.
                print(f"[WS Server]: Received 'start_symphony' command for: {symphony_path}")
                # You'd typically put this onto the input_queue for MissionControl to handle
                # self.input_queue.put({"command": "start_symphony", "path": symphony_path})
                await websocket.send(json.dumps({"type": "command_ack", "status": "received", "command": "start_symphony"}))
            elif msg_type == "search_logs":
                query = data.get("query")
                # This would interface with the Whoosh search index
                print(f"[WS Server]: Received log search query: {query}. (Whoosh integration pending)")
                await websocket.send(json.dumps({"type": "search_results", "query": query, "results": ["Simulated log result for: " + query]}))
            else:
                print(f"[WS Server]: Unknown message type received: {msg_type}")
                await websocket.send(json.dumps({"type": "error", "message": f"Unknown command: {msg_type}"}))

        except json.JSONDecodeError:
            print(f"[WS Server ERROR]: Invalid JSON received: {message}")
            try:
                await websocket.send(json.dumps({"type": "error", "message": "Invalid JSON format."}))
            except websockets.exceptions.ConnectionClosed:
                pass
        except Exception as e:
            print(f"[WS Server ERROR]: Error processing message: {e}")
            try:
                await websocket.send(json.dumps({"type": "error", "message": f"Server error: {e}"}))
            except websockets.exceptions.ConnectionClosed:
                pass

    async def websocket_handler(self, websocket, path):
        """Main handler for new WebSocket connections."""
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self._process_incoming_message(websocket, message)
        except websockets.exceptions.ConnectionClosedOK:
            # Client disconnected gracefully
            print(f"[WS Server]: Client {websocket.remote_address} disconnected gracefully.")
        except websockets.exceptions.ConnectionClosed as e:
            # Client disconnected unexpectedly
            print(f"[WS Server WARNING]: Client {websocket.remote_address} disconnected unexpectedly: {e}")
        except Exception as e:
            print(f"[WS Server ERROR]: Unhandled WebSocket error with {websocket.remote_address}: {e}")
        finally:
            await self.unregister_client(websocket)

    async def _push_telemetry_updates(self):
        """Periodically checks various queues/GDC and pushes new events to clients."""
        # This task runs continuously in the async loop once the WS server starts.
        # It's responsible for broadcasting updates.

        while True:
            # 1. Efficiently consume the telemetry buffer (from telemetry.py)
            telemetry_events = []
            telemetry_buffer_deque, buffer_lock_asyncio = self.telemetry_buffer_ref
            async with buffer_lock_asyncio:
                if telemetry_buffer_deque:
                    telemetry_events = list(telemetry_buffer_deque)
                    telemetry_buffer_deque.clear()

            if telemetry_events:
                message = json.dumps({"type": "telemetry_batch", "events": telemetry_events})
                await self._broadcast(message)

            # 2. Check for GDC changes and push snapshots
            if self.gdc:
                current_root = self.gdc.get_merkle_root()
                if current_root != self._last_gdc_root:
                    gdc_update_message = json.dumps({
                        "type": "gdc_snapshot",
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "merkle_root": current_root,
                        "previous_root": self._last_gdc_root, # Include previous root for client-side diffing
                        "full_gdc_state_summary": self.gdc.get_all_data() # Send full state on change for simplicity
                    })
                    await self._broadcast(gdc_update_message)
                    self._last_gdc_root = current_root # Update last known root

            # 3. Check for new log messages from multiprocessing.Queue
            new_logs = []
            while True:
                try:
                    # Use get_nowait for non-blocking access to multiprocessing.Queue
                    log_entry = self.log_queue.get_nowait()
                    new_logs.append(log_entry)
                except queue.Empty: # Catch queue.Empty for multiprocessing.Queue
                    break
                except Exception as e:
                    print(f"[WS Server ERROR]: Error getting from log_queue: {e}")
                    break
            if new_logs:
                log_message = json.dumps({"type": "log_batch", "logs": new_logs})
                await self._broadcast(log_message)

            # 4. Check for new reporting messages from multiprocessing.Queue
            new_reports = []
            while True:
                try:
                    report_entry = self.reporting_queue.get_nowait()
                    new_reports.append(report_entry)
                except queue.Empty: # Catch queue.Empty for multiprocessing.Queue
                    break
                except Exception as e:
                    print(f"[WS Server ERROR]: Error getting from reporting_queue: {e}")
                    break
            if new_reports:
                report_message = json.dumps({"type": "report_batch", "reports": new_reports})
                await self._broadcast(report_message)

            await asyncio.sleep(0.1) # Controls polling frequency for updates

    async def _broadcast(self, message):
        """Sends a message to all connected clients."""
        if not self.connected_clients:
            return

        # Use asyncio.gather to send to all clients concurrently
        # and handle potential connection errors gracefully
        pending_sends = [client.send(message) for client in list(self.connected_clients)]
        
        if not pending_sends: # No active sends if clients disconnected
            return

        # Use return_when=asyncio.ALL_COMPLETED or FIRST_EXCEPTION
        # ALL_COMPLETED ensures all tasks are run; FIRST_EXCEPTION stops on first error.
        # For broadcasting, ALL_COMPLETED is generally preferred to attempt delivery to all.
        done, pending = await asyncio.wait(pending_sends, timeout=5, return_when=asyncio.ALL_COMPLETED)
        
        for task in done:
            if task.exception():
                # Client likely disconnected; errors will be caught by websocket_handler
                print(f"[WS Server WARN]: Error sending to client (connection might be closed): {task.exception()}")
                # Clients with persistent errors could be explicitly removed if they consistently fail.


    async def start(self, host="127.0.0.1", port=8765):
        """Starts the WebSocket server."""
        print(f"[WS Server]: Starting WebSocket server on ws://{host}:{port}")
        # The `serve` context manager runs the server
        async with websockets.serve(self.websocket_handler, host, port):
            # Start the background task for pushing updates
            asyncio.create_task(self._push_telemetry_updates())
            # This Future keeps the server running indefinitely
            await asyncio.Future()