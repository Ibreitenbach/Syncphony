# C:\syncphony\logger_config.py
import logging
import os
import sys

def get_logger(name):
    """
    Configures and returns a logger with a standardized format.
    This ensures all components of Syncphony log messages consistently.
    """
    # Create logs directory if it doesn't exist
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    log_file = os.path.join(log_dir, f"{name.lower()}.log")

    logger = logging.getLogger(name)
    
    # Prevent duplicate handlers if logger is already configured
    if logger.hasHandlers():
        return logger
        
    logger.setLevel(logging.INFO)

    # Use a consistent format
    formatter = logging.Formatter(
        '{"timestamp": "%(asctime)s", "process": "%(processName)s", "name": "%(name)s", "level": "%(levelname)s", "message": "%(message)s"}'
    )

    # Stream handler for console output
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    # File handler for persistent logs
    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    return logger