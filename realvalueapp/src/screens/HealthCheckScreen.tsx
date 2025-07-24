// frontend/src/screens/HealthCheckScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";

interface HealthStatus {
  status: string;
  timestamp: string;
}

const HealthCheckScreen: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchHealthStatus = async () => {
      try {
        // Assuming backend is running on localhost:5000 during development
        // This URL might need to be configurable for different environments
        const response = await fetch("http://localhost:5000/api/health");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: HealthStatus = await response.json();
        setHealthData(data);
      } catch (e) {
        if (e instanceof Error) {
          setError(`Error fetching status: ${e.message}`);
        } else {
          setError("Error fetching status: An unknown error occurred.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHealthStatus();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Loading Health Status...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={[styles.text, styles.errorText]}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Backend Health Status:</Text>
      {healthData ? (
        <>
          <Text style={styles.text}>Status: {healthData.status}</Text>
          {/* <Text style={styles.text}>Timestamp: {healthData.timestamp}</Text> */}
        </>
      ) : (
        <Text style={styles.text}>No data received.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  text: {
    fontSize: 18,
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  errorText: {
    color: "red",
    fontWeight: "bold",
  },
});

export default HealthCheckScreen;
