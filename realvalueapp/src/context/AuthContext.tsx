// frontend/src/context/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { setAuthToken as setApiClientAuthToken, getAuthToken as getApiClientAuthToken, default as apiClient } from '../services/apiClient';
// In a real app, you'd use AsyncStorage or SecureStore for token persistence
// import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the shape of the user object
export interface AuthUser {
  id: string;
  display_name: string; // Matching typical backend snake_case
  email?: string;
  // Add other relevant user fields like roles, permissions, etc.
}

// Define the shape of the auth context
interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean; // Derived from user & token presence
  isLoading: boolean; // To handle async token loading/validation
  login: (userData: AuthUser, token: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchAndUpdateUserSession: () => Promise<void>; // For re-validating session or fetching fresh user data
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // This effect runs once on mount to try and load persisted session
  useEffect(() => {
    const bootstrapAuth = async () => {
      setIsLoading(true);
      try {
        // const storedToken = await AsyncStorage.getItem('authToken'); // Real app
        const storedToken = getApiClientAuthToken(); // Simpler: check if apiClient has one (e.g. from previous manual set for testing)

        if (storedToken) {
          setApiClientAuthToken(storedToken); // Ensure apiClient uses it
          // Attempt to fetch user data with the stored token to validate session
          // This assumes you have an endpoint like '/users/me' that returns the current user
          try {
            const currentUser = await apiClient<AuthUser>('/users/me', { authenticated: true });
            setUser(currentUser);
            setToken(storedToken);
          } catch (error) {
            console.warn("Session token found but validation failed or /users/me failed:", error);
            // await AsyncStorage.removeItem('authToken'); // Clear invalid token
            setApiClientAuthToken(null); // Clear from apiClient too
          }
        }
      } catch (e) {
        console.error("Failed to load auth session:", e);
        // Handle error appropriately
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const login = async (userData: AuthUser, accessToken: string) => {
    setUser(userData);
    setToken(accessToken);
    setApiClientAuthToken(accessToken);
    // await AsyncStorage.setItem('authToken', accessToken); // Persist token in real app
    // await AsyncStorage.setItem('authUser', JSON.stringify(userData)); // Persist user data
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    setApiClientAuthToken(null);
    // await AsyncStorage.removeItem('authToken');
    // await AsyncStorage.removeItem('authUser');
    // Potentially notify backend about logout if needed
  };

  const fetchAndUpdateUserSession = async () => {
    setIsLoading(true);
    try {
        const currentToken = getApiClientAuthToken();
        if (!currentToken) {
            setUser(null); // No token, no user
            setToken(null);
            throw new Error("No token available for session refresh.");
        }
        setApiClientAuthToken(currentToken); // Make sure it's set for the call
        const refreshedUser = await apiClient<AuthUser>('/users/me', { authenticated: true });
        setUser(refreshedUser);
        setToken(currentToken); // Token is still the same
        // await AsyncStorage.setItem('authUser', JSON.stringify(refreshedUser));
    } catch (error) {
        console.error("Failed to refresh user session:", error);
        // If fails (e.g. token expired), log out the user
        await logout();
        // Optionally, you could throw the error to be handled by the caller e.g. redirect to login
        // throw error;
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <AuthContext.Provider value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        fetchAndUpdateUserSession
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
