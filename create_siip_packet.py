# C:\syncphony\create_siip_packet.py
# Key Changes:
# - Refactored create_siip_packet and main to be async functions.
# - This avoids using the blocking asyncio.run() inside a function, which is bad practice.
# - The __main__ block now properly uses asyncio.run() at the top level.

import os
import json
from datetime import datetime
import argparse
import asyncio
import sys

# Ensure telemetry can be imported if this script is run directly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from telemetry import emit_telemetry_event, _telemetry_flusher_task

# MODIFIED: Default to a more generic path or user's home directory
DEFAULT_ROOT_DIR = os.path.join(os.path.expanduser("~"), "syncphony_analysis_target")

TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.kt', '.dart', '.c', '.cpp', '.h', '.cs', '.go', '.php', '.rb', '.sh', '.yml', '.yaml']

def get_file_summary(file_path, max_bytes=4096):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read(max_bytes)
    except Exception as e:
        return f"Could not read file: {e}"

def analyze_directory(root_dir):
    if not os.path.isdir(root_dir):
        print(f"Error: Directory '{root_dir}' not found. Creating it as an example.")
        os.makedirs(root_dir, exist_ok=True)
        with open(os.path.join(root_dir, "example.txt"), "w") as f:
            f.write("This is an example file in a newly created directory.")
        
    tree = {"path": root_dir, "type": "directory", "children": []}
    dir_map = {root_dir: tree}

    for dir_path, dir_names, file_names in os.walk(root_dir):
        dir_names[:] = [d for d in dir_names if not d.startswith('.')]
        file_names = [f for f in file_names if not f.startswith('.')]

        parent_node = dir_map[dir_path]

        for dir_name in dir_names:
            full_path = os.path.join(dir_path, dir_name)
            dir_node = {"path": full_path, "type": "directory", "children": []}
            parent_node["children"].append(dir_node)
            dir_map[full_path] = dir_node

        for file_name in file_names:
            full_path = os.path.join(dir_path, file_name)
            file_extension = os.path.splitext(file_name)[1].lower()
            try:
                file_size = os.path.getsize(full_path)
            except OSError:
                file_size = -1

            file_node = {
                "path": full_path,
                "type": "file",
                "size": file_size,
                "extension": file_extension
            }
            if file_extension in TEXT_EXTENSIONS and file_size > 0:
                file_node["content_summary"] = get_file_summary(full_path)
            
            parent_node["children"].append(file_node)
            
    return tree

async def create_siip_packet(root_dir):
    """MODIFIED: Creates the SIIP packet asynchronously."""
    analysis_content = analyze_directory(root_dir)
    
    packet = {
        "packet_type": "file_system_analysis",
        "source_path": root_dir,
        "analysis_timestamp": datetime.utcnow().isoformat() + "Z",
        "file_system_tree": analysis_content
    }
    
    await emit_telemetry_event("SIIP_Agent", "siip_analysis", "task_complete",
                               {"method": "create_siip_packet", "status": "success", "description": "SIIP packet created", "root_dir": root_dir})
    
    return packet

async def main(root_dir_arg):
    """MODIFIED: Main function is now async."""
    # Start the background task that flushes telemetry from the buffer
    flusher_task = asyncio.create_task(_telemetry_flusher_task())

    print(f"Analyzing directory: {root_dir_arg}")
    siip_packet = await create_siip_packet(root_dir_arg)
    
    output_filename = "siip_packet.json"
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(siip_packet, f, indent=4)
        
    print(f"\nSuccessfully created SIIP packet: {output_filename}")
    print("Please provide the contents of this file to the main application.")

    # Allow the flusher task a moment to send any buffered events
    await asyncio.sleep(1) 
    flusher_task.cancel()
    try:
        await flusher_task
    except asyncio.CancelledError:
        print("Telemetry flusher shut down.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create SIIP packet for directory analysis.")
    parser.add_argument('--root_dir', type=str, default=DEFAULT_ROOT_DIR, help="Root directory to analyze")
    args = parser.parse_args()

    # MODIFIED: Use asyncio.run() at the top level of the script
    asyncio.run(main(args.root_dir))