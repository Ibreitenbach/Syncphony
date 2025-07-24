// frontend/src/screens/GiveEndorsementScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Assuming this package is available
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { EndorsementType, GiveEndorsementPayload } from '../types/endorsementTypes';
import { giveEndorsement } from '../services/endorsementService';
import { useAuth } from '../context/AuthContext'; // Import the real useAuth

// Define screen parameters - adjust if your navigation setup is different
type GiveEndorsementScreenRouteProp = RouteProp<{ params: { endorseeId: string, endorseeName?: string } }, 'params'>;

const GiveEndorsementScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<GiveEndorsementScreenRouteProp>();
  const { endorseeId, endorseeName } = route.params;

  const { user: currentUser } = useAuth(); // Get current user's ID

  const [endorsementType, setEndorsementType] = useState<EndorsementType>(EndorsementType.GENERAL);
  const [skillId, setSkillId] = useState<string>(''); // For 'skill_related'
  const [comment, setComment] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && endorseeId === currentUser.id) {
      Alert.alert("Validation Error", "You cannot endorse yourself.");
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
      // Potentially disable the form or redirect earlier
    }
  }, [currentUser, endorseeId, navigation]);

  // Placeholder for skills - in a real app, this would come from an API or state
  const availableSkills = [
    { id: 'skill_1', name: 'React Native Development' },
    { id: 'skill_2', name: 'Backend API Design' },
    { id: 'skill_3', name: 'Project Management' },
  ];

  const handleSubmitEndorsement = async () => {
    if (currentUser && endorseeId === currentUser.id) {
      Alert.alert("Validation Error", "You cannot endorse yourself.");
      return;
    }

    if (!endorsementType) {
      setError("Please select an endorsement type.");
      return;
    }

    if (endorsementType === EndorsementType.SKILL_RELATED && !skillId) {
      setError("Please select a skill for a skill-related endorsement.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const payload: GiveEndorsementPayload = {
      endorsee_id: endorseeId,
      endorsement_type: endorsementType,
      comment: comment.trim() || null, // Send null if empty
    };

    if (endorsementType === EndorsementType.SKILL_RELATED) {
      payload.skill_id = skillId;
    }

    try {
      console.log('Submitting endorsement:', payload);
      // Ensure apiClient has the token (e.g., via setAuthToken from useAuth or login flow)
      // For this example, assuming token is set elsewhere if needed by apiClient
      await giveEndorsement(payload);
      Alert.alert('Success', 'Endorsement submitted successfully!');
      // Navigate back or to a confirmation screen
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (err: any) {
      console.error('Failed to submit endorsement:', err);
      setError(err.data?.message || err.message || 'Failed to submit endorsement. Please try again.');
      Alert.alert('Error', err.data?.message || err.message || 'Failed to submit endorsement.');
    } finally {
      setIsLoading(false);
    }
  };

  if (currentUser && endorseeId === currentUser.id) {
    // This state should ideally be caught by useEffect, but as a fallback
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>You cannot endorse yourself.</Text>
        <Button title="Go Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Endorse {endorseeName || `User (ID: ${endorseeId})`}</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Endorsement Type</Text>
        <Picker
          selectedValue={endorsementType}
          onValueChange={(itemValue) => setEndorsementType(itemValue as EndorsementType)}
          style={styles.picker}
          enabled={!isLoading}
        >
          <Picker.Item label="General Endorsement" value={EndorsementType.GENERAL} />
          <Picker.Item label="Skill-Related" value={EndorsementType.SKILL_RELATED} />
          <Picker.Item label="Feedback on a Favor" value={EndorsementType.FAVOR_FEEDBACK} />
        </Picker>
      </View>

      {endorsementType === EndorsementType.SKILL_RELATED && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Select Skill</Text>
          <Picker
            selectedValue={skillId}
            onValueChange={(itemValue) => setSkillId(itemValue)}
            style={styles.picker}
            enabled={!isLoading && availableSkills.length > 0}
          >
            <Picker.Item label="-- Select a Skill --" value="" />
            {availableSkills.map(skill => (
              <Picker.Item key={skill.id} label={skill.name} value={skill.id} />
            ))}
          </Picker>
          {availableSkills.length === 0 && <Text>No skills available to select.</Text>}
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Comment (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={comment}
          onChangeText={setComment}
          placeholder="Add a personal comment..."
          multiline
          numberOfLines={4}
          editable={!isLoading}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      ) : (
        <Button
          title="Submit Endorsement"
          onPress={handleSubmitEndorsement}
          disabled={isLoading || (endorsementType === EndorsementType.SKILL_RELATED && !skillId)}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top', // For Android
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    backgroundColor: '#fff',
    // Height might be needed for Android picker visibility
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  loader: {
    marginTop: 20,
  }
});

export default GiveEndorsementScreen;
