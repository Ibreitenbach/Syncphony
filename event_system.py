# C:\syncphony\event_system.py
import asyncio
from collections import defaultdict
from logger_config import get_logger

logger = get_logger("EventSystem")

# Define event types as constants
TASK_LIFECYCLE_EVENT = "task_lifecycle"
GDC_SNAPSHOT_EVENT = "gdc_snapshot"
SUB_LOG_ENTRY = "sub_log_entry"

class EventSystem:
    """
    A simple asynchronous publish-subscribe event system.
    """
    def __init__(self):
        self._subscribers = defaultdict(list)

    async def subscribe(self, event_type, callback):
        """Subscribe a callback to an event type."""
        if asyncio.iscoroutinefunction(callback):
            self._subscribers[event_type].append(callback)
        else:
            # Wrap synchronous callbacks to be awaitable
            async def wrapper(*args, **kwargs):
                callback(*args, **kwargs)
            self._subscribers[event_type].append(wrapper)
        logger.info(f"New subscription to event type: {event_type}")

    async def publish(self, event_type, *args, **kwargs):
        """Publish an event to all subscribers of the event type."""
        if event_type in self._subscribers:
            logger.info(f"Publishing event: {event_type} with args: {args}")
            # Create a list of tasks for all subscribers
            tasks = [
                asyncio.create_task(callback(*args, **kwargs))
                for callback in self._subscribers[event_type]
            ]
            # Wait for all subscriber tasks to complete
            if tasks:
                await asyncio.gather(*tasks)

# Global instance of the event publisher
event_publisher = EventSystem()