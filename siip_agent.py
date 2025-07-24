import json
import platform
import subprocess
import os
import datetime

def get_tool_version(command):
    """Runs a command and returns its version string."""
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "Not Found"

def get_tempo():
    """Gathers the context: OS, tool versions, etc."""
    return {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "environment": {
            "os": f"{platform.system()} {platform.release()}",
            "python": platform.python_version(),
            "node": get_tool_version("node -v"),
            "npm": get_tool_version("npm -v"),
        },
        "project": {
            "cwd": os.getcwd(),
            "git_branch": get_tool_version("git rev-parse --abbrev-ref HEAD"),
        }
    }

def get_motive(data_file_path):
    """Packages the data from a provided file."""
    if not data_file_path:
        return None
    try:
        with open(data_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {
            "type": "LOG_FILE",
            "source": os.path.basename(data_file_path),
            "payload": content
        }
    except Exception as e:
        return {
            "type": "ERROR",
            "source": "siip_agent",
            "payload": f"Failed to read data file: {e}"
        }

def create_packet(intent, data_file_path=None):
    """Assembles the complete SIIP packet dictionary."""
    return {
        "protocol": "SIIP",
        "version": "1.0",
        "tempo": get_tempo(),
        "crescendo": intent,
        "motive": get_motive(data_file_path)
    }