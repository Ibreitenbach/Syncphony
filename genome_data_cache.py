# C:\syncphony\genome_data_cache.py

import hashlib
import json
import collections
from datetime import datetime
import os  # For example usage, might be removed later
import copy  # MODIFIED: Added for deep copy in get_all_data
import logging  # MODIFIED: Added for logging new categories

# MODIFIED: Setup basic logging
logging.basicConfig(level=logging.INFO)

# --- Configuration ---
HASH_ALGORITHM = os.environ.get('GDC_HASH_ALGORITHM', "SHA256")  # MODIFIED: Configurable via env var

class GenomeDataCache:
    """
    Manages the operational genome data and generates Merkle tree roots for integrity.
    This class is intended to be instantiated and managed by the Conductor.
    """
    # Make SNAPSHOT_INTERVAL_SECONDS an instance attribute for robustness
    def __init__(self):
        self.SNAPSHOT_INTERVAL_SECONDS = 5  # Moved here from class level for robustness
        self._data_cache = {
            "tasks": {},
            "musicians": {},
            "symphony_meta": {},
            "environment": {}
        }
        self._last_merkle_root = None
        self._root_history = collections.deque(maxlen=100)  # MODIFIED: Could make maxlen configurable if needed

    def update_data(self, category: str, key: str, value: dict):
        """
        Updates a specific piece of data in the cache.
        Category examples: "tasks", "musicians", "symphony_meta", "environment".
        """
        if category not in self._data_cache:
            logging.info(f"[GDC WARNING]: Adding new category '{category}' to GDC. Consider pre-defining.")  # MODIFIED: Use logging
            self._data_cache[category] = {}
        self._data_cache[category][key] = value

    def get_data(self, category: str, key: str = None):
        """Retrieves data from the cache."""
        if category not in self._data_cache:
            return None if key else {}
        if key:
            return self._data_cache[category].get(key)
        return self._data_cache[category]

    def get_all_data(self) -> dict:  # NEW METHOD for WebSocket server
        """Returns a deep copy of the entire data cache."""
        return copy.deepcopy(self._data_cache)  # MODIFIED: Use deepcopy for efficiency over json round-trip

    # ADDED: Missing methods that Conductor expects
    def set(self, key: str, value):
        """
        Sets a value using dot notation for nested keys.
        Examples:
        - set('symphony_structure', data) 
        - set('performance_status', 'loaded')
        - set('task_status.task_1', 'completed')
        """
        if '.' in key:
            # Handle nested keys like 'task_status.task_1'
            parts = key.split('.')
            category = parts[0]
            sub_key = '.'.join(parts[1:])
            
            if category not in self._data_cache:
                self._data_cache[category] = {}
            
            # Create nested structure if needed
            current = self._data_cache[category]
            nested_parts = sub_key.split('.')
            
            for part in nested_parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]
            
            current[nested_parts[-1]] = value
        else:
            # Simple key, store at root level
            self._data_cache[key] = value

    def get(self, key: str, default=None):
        """
        Gets a value using dot notation for nested keys.
        Examples:
        - get('symphony_structure')
        - get('performance_status') 
        - get('task_status.task_1')
        """
        if '.' in key:
            # Handle nested keys
            parts = key.split('.')
            current = self._data_cache
            
            for part in parts:
                if isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    return default
            
            return current
        else:
            # Simple key
            return self._data_cache.get(key, default)

    def _calculate_hash(self, data: str) -> str:
        """Helper to calculate a hash of string data."""
        if HASH_ALGORITHM == "SHA256":
            return hashlib.sha256(data.encode('utf-8')).hexdigest()
        raise ValueError(f"Unsupported hash algorithm: {HASH_ALGORITHM}")

    def _get_leaf_hashes(self, data_dict: dict) -> list:
        """
        Generates sorted leaf hashes from a flattened dictionary of data.
        Ensures consistent hashing regardless of dictionary insertion order.
        """
        leaf_hashes = []
        sorted_keys = sorted(data_dict.keys())
        for key in sorted_keys:
            value = data_dict[key]
            value_str = json.dumps(value, sort_keys=True)
            leaf_hashes.append(self._calculate_hash(f"{key}:{value_str}"))
        return sorted(leaf_hashes)

    def _build_merkle_tree(self, hashes: list) -> str:
        """
        Recursively builds the Merkle tree from a list of hashes and returns the root.
        Handles odd numbers of leaves by duplicating the last one.
        """
        if not hashes:
            return self._calculate_hash("")  # Empty root for an empty tree
        if len(hashes) == 1:
            return hashes[0]

        new_level_hashes = []
        for i in range(0, len(hashes), 2):
            left = hashes[i]
            right = hashes[i+1] if i + 1 < len(hashes) else left
            combined_hash = self._calculate_hash(left + right)
            new_level_hashes.append(combined_hash)

        return self._build_merkle_tree(new_level_hashes)

    def get_merkle_root(self) -> str:
        """
        Computes and returns the Merkle root of the entire GDC state.
        This represents a snapshot of the current operational genome.
        """
        all_data_for_hashing = {}
        for category, items in self._data_cache.items():
            if isinstance(items, dict):
                for key, value in items.items():
                    all_data_for_hashing[f"{category}.{key}"] = value
            else:
                all_data_for_hashing[category] = items

        leaf_hashes = self._get_leaf_hashes(all_data_for_hashing)
        merkle_root = self._build_merkle_tree(leaf_hashes)
        
        if merkle_root != self._last_merkle_root or self._last_merkle_root is None:
            self._last_merkle_root = merkle_root
            self._root_history.append((merkle_root, datetime.utcnow().isoformat() + "Z"))
            
        return merkle_root

    def detect_gdc_changes(self, old_root: str, new_root: str) -> bool:
        """
        Compares two Merkle roots to quickly detect if any data in the GDC has changed.
        """
        return old_root != new_root

    def get_root_history(self) -> collections.deque:
        """Returns the history of computed Merkle roots."""
        return self._root_history

    # MODIFIED: Added export method for persistence
    def export_to_file(self, filepath: str):
        """Exports the entire cache to a JSON file."""
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(self._data_cache, f, indent=4)
            logging.info(f"[GDC]: Exported cache to '{filepath}'.")
        except Exception as e:
            logging.error(f"[GDC ERROR]: Failed to export cache: {e}")