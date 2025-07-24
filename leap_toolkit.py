import requests
import json
import time  # MODIFIED: Added for retry backoff
import random  # MODIFIED: Added for jitter

def get_json_from_url(url, retries=3, backoff_factor=1):
    """
    Fetches and parses JSON data from a given URL.

    Args:
        url (str): The URL to fetch data from.
        retries (int): Number of retries on failure.
        backoff_factor (float): Backoff multiplier for retries.

    Returns:
        dict: The parsed JSON data.

    Raises:
        Exception: If the network request or JSON parsing fails after retries.
    """
    attempt = 0
    while attempt < retries:
        try:
            # A timeout prevents the script from hanging on a non-responsive server
            response = requests.get(url, timeout=10)
            
            # This will raise an HTTPError for bad responses (e.g., 404 Not Found)
            response.raise_for_status()
            
            return response.json()
        except requests.exceptions.RequestException as e:
            attempt += 1
            if attempt >= retries:
                raise Exception(f"LeapToolkit network error fetching '{url}' after {retries} attempts: {e}")
            sleep_time = backoff_factor * (2 ** (attempt - 1)) + random.uniform(0, 0.1)
            time.sleep(sleep_time)
        except json.JSONDecodeError:
            raise Exception(f"LeapToolkit failed to parse JSON from '{url}'. Response was not valid JSON.")


def post_data_to_api(url, data_payload, headers=None, auth=None, retries=3, backoff_factor=1):
    """
    Posts a Python dictionary as JSON to a specified API endpoint.

    Args:
        url (str): The API endpoint URL.
        data_payload (dict): The dictionary to send as JSON.
        headers (dict): Custom headers.
        auth (tuple): (username, password) for basic auth.
        retries (int): Number of retries.
        backoff_factor (float): Backoff multiplier.

    Returns:
        dict: The parsed JSON response from the server.

    Raises:
        Exception: If the network request fails after retries.
    """
    if headers is None:
        headers = {'Content-Type': 'application/json'}
    attempt = 0
    while attempt < retries:
        try:
            response = requests.post(url, json=data_payload, headers=headers, auth=auth, timeout=10)
            
            # Check for HTTP errors
            response.raise_for_status()
            
            return response.json()
        except requests.exceptions.RequestException as e:
            attempt += 1
            if attempt >= retries:
                raise Exception(f"LeapToolkit failed to post data to '{url}' after {retries} attempts: {e}")
            sleep_time = backoff_factor * (2 ** (attempt - 1)) + random.uniform(0, 0.1)
            time.sleep(sleep_time)
        except json.JSONDecodeError:
            raise Exception(f"LeapToolkit failed to parse JSON response from '{url}' after posting.")