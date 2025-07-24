// frontend/src/screens/ChallengeAttemptScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Button,
  ActivityIndicator,
  Alert,
  // Switch, // Could be used for checkbox type
} from "react-native";
import * as challengeService from "../services/challengeService";
import { PracticeChallengeTemplate, ChallengeType, UserChallengeCompletion } from "../types/challengeTypes";
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from "../../app"; // Adjust path if app.tsx is elsewhere

type ChallengeAttemptScreenRouteProp = RouteProp<RootStackParamList, 'ChallengeAttempt'>;
type ChallengeAttemptScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChallengeAttempt'>;

// No need for separate interface for props when using hooks directly
// interface ChallengeAttemptScreenProps { ... }

const ChallengeAttemptScreen: React.FC = () => { // Props are now derived from hooks
  const route = useRoute<ChallengeAttemptScreenRouteProp>();
  const navigation = useNavigation<ChallengeAttemptScreenNavigationProp>();

  const { challengeId } = route.params; // challengeId is guaranteed by RootStackParamList

  const [challenge, setChallenge] = useState<PracticeChallengeTemplate | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [userResponse, setUserResponse] = useState<string>("");
  const [isCompletedCheckbox, setIsCompletedCheckbox] = useState<boolean>(false);


  const fetchChallengeDetail = useCallback(async (id: number) => {
    // id is guaranteed by route.params now, no need for undefined check here
    setLoading(true);
    setError(null);
    try {
      const data = await challengeService.getChallengeTemplateById(id);
      setChallenge(data);
    } catch (e: any) {
      setError(e.message || "Failed to fetch challenge details.");
      console.error("Fetch challenge detail error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallengeDetail(challengeId);
  }, [fetchChallengeDetail, challengeId]);

  const handleSubmitCompletion = async () => {
    if (!challenge) return;

    setSubmitting(true);
    setError(null);

    const submissionData: challengeService.ChallengeCompletionSubmission = {
      challenge_template_id: challenge.id,
    };

    if (challenge.challenge_type === ChallengeType.TEXT_RESPONSE) {
      if (!userResponse.trim()) {
        Alert.alert("Input Required", "Please enter your response.");
        setSubmitting(false);
        return;
      }
      submissionData.user_response = userResponse;
    } else if (challenge.challenge_type === ChallengeType.PHOTO_UPLOAD) {
      // For photo upload, actual upload is out of scope.
      // We can simulate by setting a placeholder response or just confirming.
      submissionData.user_response = "Photo upload confirmed (simulated)";
    } else if (challenge.challenge_type === ChallengeType.CHECKBOX_COMPLETION) {
      if (!isCompletedCheckbox) {
         Alert.alert("Confirmation Required", "Please check the box to confirm completion.");
         setSubmitting(false);
         return;
      }
      submissionData.user_response = "Completed"; // Or some other marker
    }

    try {
      await challengeService.submitChallengeCompletion(submissionData);
      Alert.alert("Success", "Challenge completion submitted!");
      navigation.goBack(); // Go back after submission
      // Or navigate to MyCompletionsScreen: navigation.navigate('MyCompletions');
      // console.log("Challenge completion submitted successfully.");

    } catch (e: any) {
      setError(e.message || "Failed to submit completion.");
      Alert.alert("Error", e.message || "Failed to submit completion.");
      console.error("Submit completion error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading challenge details...</Text>
      </View>
    );
  }

  if (error || !challenge) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error: {error || "Challenge not found."}</Text>
        {challengeIdToUse !== undefined && <Button title="Retry" onPress={() => fetchChallengeDetail(challengeIdToUse)} />}
      </View>
    );
  }

  const renderSubmissionUI = () => {
    switch (challenge.challenge_type) {
      case ChallengeType.TEXT_RESPONSE:
        return (
          <TextInput
            style={styles.textInput}
            placeholder="Enter your response"
            value={userResponse}
            onChangeText={setUserResponse}
            multiline
          />
        );
      case ChallengeType.PHOTO_UPLOAD:
        return (
          <Text style={styles.infoText}>
            This challenge involves a photo upload. For now, pressing "Submit" will confirm completion.
            (Actual photo upload functionality is not yet implemented).
          </Text>
        );
      case ChallengeType.CHECKBOX_COMPLETION:
        return (
          <View style={styles.checkboxContainer}>
            <Text style={styles.checkboxLabel}>Mark as completed: </Text>
            {/* Using a Button as a simple checkbox for now, can be replaced with a proper Switch or Checkbox component */}
            <Button
              title={isCompletedCheckbox ? "Completed (Undo)" : "Not Completed (Mark)"}
              onPress={() => setIsCompletedCheckbox(!isCompletedCheckbox)}
            />
          </View>
        );
      default:
        return <Text>Unsupported challenge type.</Text>;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>{challenge.title}</Text>
      <Text style={styles.description}>{challenge.description}</Text>
      <Text style={styles.details}>Difficulty: {challenge.difficulty}</Text>
      {challenge.associated_skill_id && (
        <Text style={styles.details}>Associated Skill ID: {challenge.associated_skill_id}</Text>
      )}
      <Text style={styles.details}>Type: {challenge.challenge_type.replace('_', ' ')}</Text>

      <View style={styles.submissionSection}>
        <Text style={styles.submissionTitle}>Your Completion</Text>
        {renderSubmissionUI()}
        <Button
          title={submitting ? "Submitting..." : "Submit Completion"}
          onPress={handleSubmitCompletion}
          disabled={submitting}
        />
        {error && <Text style={[styles.errorText, styles.submissionError]}>Submission Error: {error}</Text>}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
  },
  contentContainer: {
    padding: 20,
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
    textAlign: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#555",
    marginBottom: 15,
  },
  details: {
    fontSize: 14,
    color: "#444",
    marginBottom: 5,
    fontStyle: 'italic',
  },
  submissionSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  submissionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
    color: "#333",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top", // For multiline
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  infoText: {
    fontSize: 15,
    color: "#333",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
    marginBottom: 15,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  checkboxLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  submissionError: {
    marginTop: 10,
  }
});

export default ChallengeAttemptScreen;
