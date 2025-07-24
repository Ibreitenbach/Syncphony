// frontend/src/screens/PracticeChallengesScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Button, // For simple filter triggers for now
  // Consider using Picker or a custom dropdown for better filter UI later
} from "react-native";
import * as challengeService from "../services/challengeService";
import { PracticeChallengeTemplate, DifficultyLevel } from "../types/challengeTypes";
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from "../../app"; // Adjust path if app.tsx is elsewhere

type PracticeChallengesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PracticeChallenges'>;

interface Filters {
  difficulty?: DifficultyLevel | "";
  associated_skill_id?: number | ""; // Assuming skill IDs are numbers
}

const PracticeChallengesScreen: React.FC = () => {
  const navigation = useNavigation<PracticeChallengesScreenNavigationProp>();
  const [challenges, setChallenges] = useState<PracticeChallengeTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ difficulty: "", associated_skill_id: "" });

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentFilters: challengeService.GetChallengeTemplatesFilters = {};
      if (filters.difficulty) {
        currentFilters.difficulty = filters.difficulty;
      }
      if (filters.associated_skill_id) {
        currentFilters.associated_skill_id = Number(filters.associated_skill_id);
      }
      const data = await challengeService.getChallengeTemplates(currentFilters);
      setChallenges(data);
    } catch (e: any) {
      setError(e.message || "Failed to fetch challenges.");
      console.error("Fetch challenges error:", e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    // TODO: This screen requires authentication.
    // Ensure a token is set in apiClient via an auth flow before this screen is accessible.
    // For now, proceeding with assumption that token might be pre-set for testing.
    // Example: import { setAuthToken } from '../services/apiClient'; setAuthToken('YOUR_TOKEN_HERE');
    fetchChallenges();
  }, [fetchChallenges]);

  const handleAttemptChallenge = (challengeId: number) => {
    // console.log("Attempting challenge:", challengeId); // Keep for debugging if needed
    navigation.navigate('ChallengeAttempt', { challengeId });
  };

  const renderItem = ({ item }: { item: PracticeChallengeTemplate }) => (
    <View style={styles.challengeItem}>
      <Text style={styles.challengeTitle}>{item.title}</Text>
      <Text style={styles.challengeDescription} numberOfLines={3}>{item.description}</Text>
      <View style={styles.detailsRow}>
        <Text style={styles.challengeDifficulty}>Difficulty: {item.difficulty}</Text>
        {item.associated_skill_id && (
          <Text style={styles.challengeSkill}>Skill ID: {item.associated_skill_id}</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.attemptButton}
        onPress={() => handleAttemptChallenge(item.id)}
      >
        <Text style={styles.attemptButtonText}>Attempt Challenge</Text>
      </TouchableOpacity>
    </View>
  );

  // Basic filter controls (can be improved with Picker or custom dropdowns)
  const FilterControls = () => (
    <View style={styles.filterContainer}>
      <Text style={styles.filterTitle}>Filters:</Text>
      <View style={styles.filterButtons}>
        <Button title="All" onPress={() => setFilters({ difficulty: "", associated_skill_id: "" })} />
        <Button title="Easy" onPress={() => setFilters(prev => ({ ...prev, difficulty: DifficultyLevel.EASY }))} />
        <Button title="Medium" onPress={() => setFilters(prev => ({ ...prev, difficulty: DifficultyLevel.MEDIUM }))} />
        <Button title="Hard" onPress={() => setFilters(prev => ({ ...prev, difficulty: DifficultyLevel.HARD }))} />
        {/* Skill ID filter would need a way to input/select skill IDs */}
      </View>
       <Button title="Apply Filters" onPress={fetchChallenges} />
    </View>
  );


  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading challenges...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Button title="Retry" onPress={fetchChallenges} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Practice Challenges</Text>
      <FilterControls />
      {challenges.length === 0 ? (
        <View style={styles.centered}>
          <Text>No challenges found for the selected filters.</Text>
        </View>
      ) : (
        <FlatList
          data={challenges}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContentContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
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
  },
  errorText: {
    color: "red",
    fontSize: 16,
    marginBottom: 10,
  },
  challengeItem: {
    backgroundColor: "#fff",
    padding: 15,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  challengeDescription: {
    fontSize: 14,
    color: "#555",
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  challengeDifficulty: {
    fontSize: 13,
    color: "#333",
    fontStyle: 'italic',
  },
  challengeSkill: {
    fontSize: 13,
    color: "#333",
    fontStyle: 'italic',
  },
  attemptButton: {
    backgroundColor: "#007bff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 5,
  },
  attemptButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  filterContainer: {
    padding: 10,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 5,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  }
});

export default PracticeChallengesScreen;
