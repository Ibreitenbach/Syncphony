// frontend/src/screens/MyCompletionsScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Button,
  RefreshControl,
} from "react-native";
import * as challengeService from "../services/challengeService";
import { UserChallengeCompletion } from "../types/challengeTypes";
import { useNavigation } from '@react-navigation/native'; // Added
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Added
import { RootStackParamList } from "../../app"; // Adjust path if app.tsx is elsewhere

type MyCompletionsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MyCompletions'>; // Changed to 'MyCompletions'

const MyCompletionsScreen: React.FC = () => {
  const navigation = useNavigation<MyCompletionsScreenNavigationProp>(); // Initialized
  const [completions, setCompletions] = useState<UserChallengeCompletion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchCompletions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await challengeService.getMyChallengeCompletions();
      setCompletions(data);
    } catch (e: any) {
      setError(e.message || "Failed to fetch your completions.");
      console.error("Fetch completions error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // TODO: This screen requires authentication.
    // Ensure a token is set in apiClient via an auth flow before this screen is accessible.
    fetchCompletions();
  }, [fetchCompletions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await challengeService.getMyChallengeCompletions();
      setCompletions(data);
    } catch (e: any) {
      setError(e.message || "Failed to refresh completions.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const renderItem = ({ item }: { item: UserChallengeCompletion }) => (
    <View style={styles.completionItem}>
      <Text style={styles.challengeTitle}>{item.challenge_title || `Challenge ID: ${item.challenge_template_id}`}</Text>
      <Text style={styles.detailText}>Status: {item.status}</Text>
      {item.completed_at && (
        <Text style={styles.detailText}>
          Completed: {new Date(item.completed_at).toLocaleDateString()}
        </Text>
      )}
      {item.user_response && (
        <Text style={styles.detailText}>Your Response: {item.user_response}</Text>
      )}
    </View>
  );

  if (loading && !refreshing) { // Don't show main loader if only refreshing
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading your completions...</Text>
      </View>
    );
  }

  if (error && completions.length === 0) { // Show error prominently if no data loaded
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Button title="Retry" onPress={fetchCompletions} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>My Challenge Completions</Text>
      {error && !refreshing && ( // Show non-blocking error if data is already there
         <Text style={[styles.errorText, {textAlign: 'center', marginBottom:10}]}>Update Error: {error}</Text>
      )}
      {completions.length === 0 && !loading ? (
        <View style={styles.centered}>
          <Text>You haven't completed any challenges yet.</Text>
          {/* Optionally, add a button to browse challenges */}
          {/* <Button title="Find Challenges" onPress={() => navigation.navigate('PracticeChallengesScreen')} /> */}
        </View>
      ) : (
        <FlatList
          data={completions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10, // Adjusted padding
    backgroundColor: "#f0f0f0",
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 15,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "red",
    fontSize: 16,
    marginBottom: 10,
  },
  completionItem: {
    backgroundColor: "#fff",
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 10, // Added horizontal margin
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
  listContentContainer: {
    paddingBottom: 20,
  },
});

export default MyCompletionsScreen;
