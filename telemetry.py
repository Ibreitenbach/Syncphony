# C:\syncphony\telemetry.py
# Key Changes:
# - SCHEMA_ROOT_DIR now defaults to a relative path, making the application
#   more portable and less dependent on a specific C:\ drive structure.

import asyncio
import collections
import hashlib
import json
import time
import os
import random
from datetime import datetime
from functools import wraps
from jsonschema import validate, ValidationError, RefResolver
import traceback
import sys
import aiohttp
import logging
import logging.handlers
import queue
import threading
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# --- Configuration ---
TELEMETRY_BUFFER_SIZE = 100
TELEMETRY_FLUSH_INTERVAL_SECONDS = 5
TELEMETRY_API_ENDPOINT = "http://localhost:8080/telemetry_events"
HASH_ALGORITHM = "SHA256"

# MODIFIED: Use a relative path for portability
DEFAULT_SCHEMA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'syncphony_schemas', 'events')
SCHEMA_ROOT_DIR = os.environ.get('SCHEMA_ROOT_DIR', DEFAULT_SCHEMA_DIR)

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "telemetry.log")

logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}',
    handlers=[
        logging.StreamHandler(),
        logging.handlers.RotatingFileHandler(LOG_FILE, maxBytes=5*1024*1024, backupCount=10)
    ]
)
logger = logging.getLogger(__name__)

_telemetry_buffer = collections.deque()
_buffer_lock = asyncio.Lock()
_last_flush_time = time.time()
_schemas_cache = {}
_resolver = None

def _load_schema(schema_filename: str):
    full_path = os.path.join(SCHEMA_ROOT_DIR, schema_filename)
    if not os.path.exists(full_path):
        logger.error(f"Schema file not found: {full_path}")
        return {} # Return empty schema to prevent crashes
    if full_path not in _schemas_cache:
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)
            _schemas_cache[full_path] = schema
            logger.info(f"Loaded schema: {full_path}")
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.error(f"Failed to load schema {full_path}: {e}")
            _schemas_cache[full_path] = {}
    return _schemas_cache[full_path]

def _get_schema_resolver():
    global _resolver
    if _resolver is None:
        base_uri = "http://syncphony.com/schemas/events/"
        handlers = {
            base_uri: lambda uri: _load_schema(uri.split(base_uri)[1])
        }
        _resolver = RefResolver(base_uri=base_uri, referrer={}, handlers=handlers)
        try:
            base_schema_content = _load_schema("event_base.json")
            if base_schema_content:
                 _resolver.store[f"{base_uri}event_base.json"] = base_schema_content
        except Exception as e:
            logger.error(f"Failed to pre-load event_base.json into resolver: {e}")
    return _resolver

try:
    TASK_LIFECYCLE_EVENT_SCHEMA = _load_schema("task_lifecycle_event.json")
    GDC_SNAPSHOT_EVENT_SCHEMA = _load_schema("gdc_snapshot_event.json")
    SUB_LOG_ENTRY_SCHEMA = _load_schema("sub_log_entry.json")
    _resolver_instance = _get_schema_resolver()
except Exception as e:
    logger.error(f"CRITICAL ERROR: Failed to load core schemas: {e}")
    TASK_LIFECYCLE_EVENT_SCHEMA = {}
    GDC_SNAPSHOT_EVENT_SCHEMA = {}
    SUB_LOG_ENTRY_SCHEMA = {}

def _generate_event_id():
    return f"event-{os.urandom(8).hex()}-{int(time.time() * 1000)}"

def _calculate_payload_hash(payload):
    payload_str = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(payload_str.encode('utf-8')).hexdigest()

def _mask_sensitive_data(data, sensitive_keys=["password", "api_key", "secret", "token", "credential", "auth"]):
    masked = False
    if isinstance(data, dict):
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                data[key] = "[MASKED]"
                masked = True
            elif isinstance(value, (dict, list)):
                nested_masked = _mask_sensitive_data(value, sensitive_keys)
                if nested_masked:
                    masked = True
    elif isinstance(data, list):
        for i, item in enumerate(data):
            nested_masked = _mask_sensitive_data(item, sensitive_keys)
            if nested_masked:
                masked = True
    return masked

async def _flush_telemetry_buffer():
    global _last_flush_time
    async with _buffer_lock:
        if not _telemetry_buffer:
            return
        events_to_flush = list(_telemetry_buffer)
        _telemetry_buffer.clear()
        _last_flush_time = time.time()

    logger.info(f"Attempting to flush {len(events_to_flush)} events...")
    retries = 3
    for attempt in range(retries):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(TELEMETRY_API_ENDPOINT, json=events_to_flush, timeout=10) as response:
                    response.raise_for_status()
            logger.info(f"Successfully flushed {len(events_to_flush)} events.")
            return
        except Exception as e:
            logger.error(f"Failed to flush events (attempt {attempt+1}/{retries}): {e}")
            await asyncio.sleep(2 ** attempt + random.uniform(0, 0.1))

    fallback_file = os.path.join(LOG_DIR, f"telemetry_failed_flush_{int(time.time())}.json")
    try:
        with open(fallback_file, 'w', encoding='utf-8') as f:
            json.dump(events_to_flush, f, indent=4)
        logger.warning(f"Telemetry flush failed. Dumped events to {fallback_file}.")
    except Exception as e:
        logger.critical(f"Failed to dump failed telemetry events to file: {e}")

async def _telemetry_flusher_task():
    while True:
        await asyncio.sleep(TELEMETRY_FLUSH_INTERVAL_SECONDS)
        async with _buffer_lock:
            should_flush = len(_telemetry_buffer) > 0 and (
                len(_telemetry_buffer) >= TELEMETRY_BUFFER_SIZE or
                (time.time() - _last_flush_time) >= TELEMETRY_FLUSH_INTERVAL_SECONDS
            )
        if should_flush:
            await _flush_telemetry_buffer()

async def emit_telemetry_event(musician_name, task_id, event_type, payload, parent_event_id=None, mask_sensitive=True):
    processed_payload = payload.copy()
    was_masked = False
    if mask_sensitive:
        was_masked = _mask_sensitive_data(processed_payload)

    try:
        json.dumps(processed_payload)
    except TypeError as e:
        logger.error(f"Payload for task {task_id} is not JSON serializable: {e}")
        processed_payload = {"error": "Non-serializable payload", "summary": str(payload)[:200]}

    event = {
        "event_id": _generate_event_id(),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "schema_version": "1.0.0",
        "musician_name": musician_name,
        "task_id": task_id,
        "event_type": event_type,
        "payload": processed_payload,
        "data_hash": _calculate_payload_hash(processed_payload),
        "parent_event_id": parent_event_id,
        "sensitive_data_masked": was_masked
    }

    schema_map = {
        "task_start": TASK_LIFECYCLE_EVENT_SCHEMA,
        "task_progress": TASK_LIFECYCLE_EVENT_SCHEMA,
        "task_complete": TASK_LIFECYCLE_EVENT_SCHEMA,
        "task_error": TASK_LIFECYCLE_EVENT_SCHEMA,
        "gdc_snapshot": GDC_SNAPSHOT_EVENT_SCHEMA,
        "sub_log_entry": SUB_LOG_ENTRY_SCHEMA
    }
    schema_to_validate = schema_map.get(event_type)

    if schema_to_validate:
        try:
            validate(instance=event, schema=schema_to_validate, resolver=_get_schema_resolver())
        except (ValidationError, Exception) as e:
            logger.error(f"Event validation failed for task {task_id}: {e}")
            return

    async with _buffer_lock:
        _telemetry_buffer.append(event)
        if len(_telemetry_buffer) >= TELEMETRY_BUFFER_SIZE:
            asyncio.create_task(_flush_telemetry_buffer())

def log_task_lifecycle(mask_sensitive_params=True):
    def decorator(func):
        @wraps(func)
        async def wrapper(instance, action_name, parameters, task_id, *args, **kwargs):
            musician_name = instance.name
            start_time = time.time()
            
            start_payload = {
                "method": f"{instance.__class__.__name__}.{action_name}",
                "args": parameters,
                "description": f"Starting execution for task {task_id}.",
                "status": "in_progress"
            }
            await emit_telemetry_event(musician_name, task_id, 'task_start', start_payload, mask_sensitive=mask_sensitive_params)

            try:
                result = await func(instance, action_name, parameters, task_id, *args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000

                complete_payload = {
                    "method": f"{instance.__class__.__name__}.{action_name}",
                    "status": "success",
                    "description": f"Completed execution for task {task_id}.",
                    "result_summary": str(result)[:500] if result is not None else "None",
                    "duration_ms": duration_ms
                }
                await emit_telemetry_event(musician_name, task_id, 'task_complete', complete_payload, mask_sensitive=mask_sensitive_params)
                return result
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                error_payload = {
                    "method": f"{instance.__class__.__name__}.{action_name}",
                    "status": "failure",
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "duration_ms": duration_ms,
                    "stack_trace": traceback.format_exc(),
                    "description": f"Error during execution for task {task_id}."
                }
                await emit_telemetry_event(musician_name, task_id, 'task_error', error_payload, mask_sensitive=mask_sensitive_params)
                raise
        return wrapper
    return decorator