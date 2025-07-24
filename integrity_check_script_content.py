# C:\syncphony\integrity_check_script_content.py
# Key Changes:
# - Updated the list of known third-party/standard library modules to be more
#   accurate, reducing false-positive warnings.

import os
import ast
import glob
import logging
import importlib.util

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def analyze_codebase(directory):
    logging.info("--- Starting Orchestral Integrity Check ---")
    py_files = glob.glob(os.path.join(directory, '*.py'))
    if not py_files:
        logging.error(f"No Python files found in '{directory}'.")
        return

    definitions = {}
    issues = []
    
    # MODIFIED: Expanded list of known good modules
    known_modules = {
        'asyncio', 'collections', 'datetime', 'functools', 'glob', 'hashlib', 'json', 
        'multiprocessing', 'os', 'platform', 'queue', 're', 'requests', 'shutil', 
        'subprocess', 'sys', 'threading', 'time', 'tkinter', 'traceback', 'websockets', 
        'jsonschema', 'ast', 'random', 'logging', 'argparse', 'shlex', 'aiohttp', 
        'importlib'
    }

    for filepath in py_files:
        filename = os.path.basename(filepath)
        logging.info(f"\n[ANALYZING]: {filename}")
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                source = f.read()
                tree = ast.parse(source, filename=filename)
                definitions[filename] = {
                    'classes': {node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)},
                    'functions': {f.name for f in ast.walk(tree) if isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef))},
                    'from_imports': {}
                }

                for node in ast.walk(tree):
                    if isinstance(node, ast.ImportFrom):
                        module_name = node.module.split('.')[0] if node.module else 'local'
                        if module_name not in definitions[filename]['from_imports']:
                            definitions[filename]['from_imports'][module_name] = set()
                        for alias in node.names:
                            definitions[filename]['from_imports'][module_name].add(alias.name)
                logging.info(f"  - OK: Syntax is valid.")
        except SyntaxError as e:
            issues.append(f"CRITICAL SYNTAX ERROR in {filename} on line {e.lineno}: {e.msg}")
        except Exception as e:
            issues.append(f"CRITICAL ERROR analyzing {filename}: {e}")

    for filename, data in definitions.items():
        for module, names in data['from_imports'].items():
            local_module_file = f"{module}.py"
            if local_module_file in definitions:
                provided_defs = definitions[local_module_file]['functions'].union(definitions[local_module_file]['classes'])
                for name in names:
                    if name not in provided_defs:
                        issues.append(f"Dissonance in {filename}: Tries to import '{name}' from '{local_module_file}', but it is not defined there.")
            elif module != 'local' and module not in known_modules:
                 issues.append(f"Warning in {filename}: Imports from '{module}', which is not a known standard library or Syncphony core file.")

    logging.info("\n--- Integrity Check Report ---")
    if not issues:
        logging.info("SUCCESS: No major dissonances or synchronization issues found.")
    else:
        logging.warning(f"FOUND {len(issues)} ISSUES:")
        for i, issue in enumerate(issues, 1):
            logging.warning(f"  {i}. {issue}")
    logging.info("\n--- End of Report ---")

if __name__ == "__main__":
    analyze_codebase(os.getcwd())