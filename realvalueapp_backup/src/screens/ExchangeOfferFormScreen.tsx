// frontend/src/screens/ExchangeOfferFormScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

import { Skill, CreateExchangeOfferPayload, UpdateExchangeOfferPayload, ExchangeOffer } from '../types/exchangeTypes';
import { createExchangeOffer, getExchangeOfferById, updateExchangeOffer } from '../services/exchangeService';
import { useAuth } from '../context/AuthContext'; // To get current user for their skills

// --- Mock Skill Fetching ---
// In a real app, these would come from a skillService
const mockFetchAllSkills = async (): Promise<Skill[]> => {
  console.log("Fetching all skills (mock for form)");
  await new Promise(resolve => setTimeout(resolve, 200));
  return [
    { id: 'skill_1', name: 'Gardening' },
    { id: 'skill_2', name: 'React Native Programming' },
    { id: 'skill_3', name: 'Spanish Language Tutoring' },
    { id: 'skill_4', name: 'Basic Bike Repair' },
    { id: 'skill_5', name: 'Yoga Instruction' },
    { id: 'skill_6', name: 'Advanced Calculus Tutoring'},
    { id: 'skill_7', name: 'Knitting'},
  ];
};

const mockFetchUserSkills = async (userId: string): Promise<Skill[]> => {
  console.log(`Fetching skills for user ${userId} (mock for form)`);
  await new Promise(resolve => setTimeout(resolve, 200));
  // Simulate user having a subset of skills
  return [
    { id: 'skill_1', name: 'Gardening' },
    { id: 'skill_3', name: 'Spanish Language Tutoring' },
    { id: 'skill_7', name: 'Knitting'},
  ];
};
// --- End Mock Skill Fetching ---

type ExchangeOfferFormScreenRouteProp = RouteProp<{ params?: { offerId?: string } }, 'params'>;

const ExchangeOfferFormScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ExchangeOfferFormScreenRouteProp>();
  const { user: currentUser } = useAuth();

  const offerIdToEdit = route.params?.offerId;
  const isEditing = !!offerIdToEdit;

  const [offeredSkillId, setOfferedSkillId] = useState<string>('');
  const [desiredSkillId, setDesiredSkillId] = useState<string | undefined>(undefined);
  const [desiredDescription, setDesiredDescription] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true); // For editing existing offers

  const [userSkills, setUserSkills] = useState<Skill[]>([]); // Skills the current user possesses
  const [allSkills, setAllSkills] = useState<Skill[]>([]);   // All skills for "desired skill" picker

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false); // For loading offer/skills
  const [error, setError] = useState<string | null>(null);

  // Load skills for pickers
  useEffect(() => {
    const loadSkills = async () => {
      setIsFetchingData(true);
      try {
        if (currentUser) {
          const fetchedUserSkills = await mockFetchUserSkills(currentUser.id);
          setUserSkills(fetchedUserSkills);
          if (!isEditing && fetchedUserSkills.length > 0) {
            setOfferedSkillId(fetchedUserSkills[0].id); // Default to first skill if creating
          }
        }
        const fetchedAllSkills = await mockFetchAllSkills();
        setAllSkills(fetchedAllSkills);
      } catch (err) {
        console.error("Failed to load skills:", err);
        setError("Could not load skills for the form. Please try again later.");
      } finally {
        setIsFetchingData(false);
      }
    };
    loadSkills();
  }, [currentUser, isEditing]);

  // Load existing offer data if editing
  useEffect(() => {
    if (isEditing && offerIdToEdit) {
      setIsFetchingData(true);
      getExchangeOfferById(offerIdToEdit)
        .then(offerData => {
          setOfferedSkillId(offerData.offered_skill_id);
          setDesiredSkillId(offerData.desired_skill_id || undefined);
          setDesiredDescription(offerData.desired_description);
          setDescription(offerData.description);
          setIsActive(offerData.is_active);
          setError(null);
        })
        .catch(err => {
          console.error("Failed to fetch offer for editing:", err);
          setError("Failed to load the offer data. Please try again.");
        })
        .finally(() => setIsFetchingData(false));
    }
  }, [isEditing, offerIdToEdit]);

  const validateForm = (): boolean => {
    if (!offeredSkillId) {
      setError("Please select a skill you are offering.");
      return false;
    }
    if (!desiredDescription.trim() && !desiredSkillId) {
      setError("Please either select a desired skill or provide a description of what you're looking for.");
      return false;
    }
    if (!description.trim()) {
      setError("Please provide a general description for your offer.");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      if (isEditing && offerIdToEdit) {
        const payload: UpdateExchangeOfferPayload = {
          offered_skill_id: offeredSkillId,
          desired_skill_id: desiredSkillId || null,
          desired_description: desiredDescription.trim(),
          description: description.trim(),
          is_active: isActive,
        };
        await updateExchangeOffer(offerIdToEdit, payload);
        Alert.alert('Success', 'Exchange offer updated successfully!');
      } else {
        const payload: CreateExchangeOfferPayload = {
          offered_skill_id: offeredSkillId,
          desired_skill_id: desiredSkillId || null,
          desired_description: desiredDescription.trim(),
          description: description.trim(),
        };
        await createExchangeOffer(payload);
        Alert.alert('Success', 'Exchange offer created successfully!');
      }
      // Navigate to My Offers screen or back
      if (navigation.canGoBack()) navigation.goBack();
      // Consider navigation.replace('MyExchangeOffers') or similar for better UX after creation/update
    } catch (err: any) {
      console.error('Failed to save exchange offer:', err);
      setError(err.data?.message || err.message || 'Failed to save exchange offer.');
      Alert.alert('Error', err.data?.message || err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetchingData && !isLoading) { // Show loading indicator for initial data fetch
    return <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading form data...</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{isEditing ? 'Edit Exchange Offer' : 'Create New Exchange Offer'}</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Skill I'm Offering <Text style={styles.required}>*</Text></Text>
        {userSkills.length > 0 ? (
          <Picker
            selectedValue={offeredSkillId}
            onValueChange={(itemValue) => setOfferedSkillId(itemValue)}
            style={styles.picker}
            enabled={!isLoading}
          >
            <Picker.Item label="-- Select a skill you offer --" value="" />
            {userSkills.map(skill => <Picker.Item key={skill.id} label={skill.name} value={skill.id} />)}
          </Picker>
        ) : (
          <Text style={styles.infoText}>You don't seem to have any skills listed to offer. Please add skills to your profile first.</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Skill I'm Looking For (Optional)</Text>
        <Picker
          selectedValue={desiredSkillId}
          onValueChange={(itemValue) => setDesiredSkillId(itemValue || undefined)}
          style={styles.picker}
          enabled={!isLoading}
        >
          <Picker.Item label="-- Select a desired skill (optional) --" value={undefined} />
          {allSkills.map(skill => <Picker.Item key={skill.id} label={skill.name} value={skill.id} />)}
        </Picker>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Details About What I'm Looking For <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={desiredDescription}
          onChangeText={setDesiredDescription}
          placeholder="e.g., 'Help with beginner Spanish conversation', 'Someone to fix a leaky faucet'"
          multiline
          numberOfLines={3}
          editable={!isLoading}
        />
         <Text style={styles.infoTextSmall}>Required if no specific "Desired Skill" is selected.</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>General Description of Your Offer <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g., 'Available on weekends', 'Willing to meet locally or online', specific terms"
          multiline
          numberOfLines={4}
          editable={!isLoading}
        />
      </View>

      {isEditing && (
        <View style={styles.inputGroupRow}>
          <Text style={styles.label}>Offer Active: </Text>
          <Button
            title={isActive ? "Yes (Deactivate)" : "No (Activate)"}
            onPress={() => setIsActive(!isActive)}
            color={isActive ? "green" : "grey"}
            disabled={isLoading}
          />
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      ) : (
        <Button
          title={isEditing ? 'Update Offer' : 'Create Offer'}
          onPress={handleSubmit}
          disabled={isLoading || (userSkills.length === 0 && !isEditing) } // Disable if no skills to offer when creating
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  inputGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
    fontWeight: '600',
  },
  required: {
      color: 'red',
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
    textAlignVertical: 'top',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 10,
  },
  infoTextSmall: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  loader: {
    marginTop: 20,
  }
});

export default ExchangeOfferFormScreen;
