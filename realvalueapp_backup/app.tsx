// frontend/App.tsx
import React from 'react';
import AppNavigator from './src/navigation/AppNavigator'; // Assuming AppNavigator is in src/navigation
import { AuthProvider } from './src/context/AuthContext'; // Adjust path as needed

// Example: Mock a login function that might be called from a LoginScreen
// In a real app, LoginScreen would use useAuth().login(...)
const performMockLogin = (loginFunction: Function) => {
  console.log("Performing mock login in App.tsx for demonstration...");
  setTimeout(() => {
    const mockUserData = {
      id: 'logged-in-user-123',
      display_name: 'Jules The Dev',
      email: 'jules@example.com',
    };
    const mockToken = 'mock-jwt-token-from-login';
    loginFunction(mockUserData, mockToken);
    console.log("Mock login complete. User should be set in AuthContext.");
  }, 2000); // Simulate network delay
};


export default function App() {
  // This is a bit of a hack for the demo to call login.
  // In a real app, you'd have a LoginScreen that calls useAuth().login
  // This `AuthContextConsumer` is only to trigger the login for the example.
  const AuthContextConsumerForLoginTrigger = () => {
    const { login, user, isLoading } = useAuth(); // Get login from useAuth
    React.useEffect(() => {
      if (!user && !isLoading) { // Only attempt login if no user and not loading
        // performMockLogin(login); // Temporarily removed to avoid automatic login during tests
                                // In a real app, a Login Screen would handle this.
                                // For now, you'd manually call login via a test button or a login screen.
         console.log("App.tsx: AuthProvider loaded. User not logged in. A LoginScreen would typically handle the login process.");
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isLoading]); // Removed login from deps to avoid re-trigger if login fn reference changes
    return null; // This component doesn't render anything
  };


  return (
    <AuthProvider>
      {/* AuthContextConsumerForLoginTrigger is for demo auto-login, remove in real app */}
      {/* <AuthContextConsumerForLoginTrigger />  */}
      <AppNavigator />
      {/*
        Inside AppNavigator, or screens, you can now use useAuth().
        If isLoading from useAuth() is true, you might show a loading spinner
        instead of AppNavigator.
        If !isAuthenticated and !isLoading, you might show a LoginNavigator.
      */}
    </AuthProvider>
  );
}

// Minimal useAuth hook directly in App.tsx for the consumer component
// In real components, they'd import useAuth from AuthContext.tsx
const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};