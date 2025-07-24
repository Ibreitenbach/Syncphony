// frontend/src/services/apiClient.ts

// TODO: Move to a config file or environment variable
const API_BASE_URL = "http://localhost:5000/api"; // Assuming backend runs on 5000

interface RequestOptions extends RequestInit {
  body?: any; // To allow for JSON.stringify
  authenticated?: boolean; // To indicate if token should be included
}

// Placeholder for where token might be stored/retrieved
// In a real app, this would come from secure storage or an auth context/service
let currentAuthToken: string | null = null; // "dummy-test-token"; // Replace with actual token management

export const setAuthToken = (token: string | null) => {
  currentAuthToken = token;
};

export const getAuthToken = (): string | null => {
  // In a real app, this would retrieve the token from secure storage
  // For now, just returning the currentAuthToken variable
  return currentAuthToken;
};


const apiClient = async <T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> => {
  const { method = "GET", body, headers = {}, authenticated = false, ...customConfig } = options;

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...customConfig,
  };

  if (authenticated) {
    const token = getAuthToken(); // Retrieve the token
    if (token) {
      (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    } else {
      // Handle missing token for authenticated request:
      // Could redirect to login, refresh token, or throw specific error
      console.warn("API Client: Authenticated request made without a token.");
      // For now, we'll proceed without, but backend should reject if token is required.
    }
  }

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // Not a JSON error response or empty body
        errorData = { message: response.statusText || "Network response was not ok" };
      }
      // Throw an error object that includes status and potential message from backend
      const error: any = new Error(errorData?.message || `HTTP error! status: ${response.status}`);
      error.status = response.status;
      error.data = errorData; // Attach full error data if available
      throw error;
    }

    // Handle cases where response might be empty (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return response.json() as Promise<T>;
    } else {
      // If not JSON, resolve with null or handle as text. For now, null for non-JSON.
      return null as unknown as T;
    }

  } catch (error) {
    console.error("API call failed:", error);
    // Re-throw the error so UI can catch and handle it
    // Or handle specific errors centrally here if needed
    throw error;
  }
};

export default apiClient;
