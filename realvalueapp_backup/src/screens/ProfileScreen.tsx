// frontend/src/screens/ProfileScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Endorsement } from '../types/endorsementTypes';
import { getReceivedEndorsements, getGivenEndorsements } from '../services/endorsementService';
// import { SharedUserProfileData, SharedUserProfileUpdatePayload } from '../../../../shared/models/profile'; // If you have this for profile editing
// import { fetchUserProfileById, updateUserProfile } from '../services/profileService'; // Assuming a profile service
import { useAuth } from '../context/AuthContext'; // Import the real useAuth

// Placeholder for a basic user profile structure
interface UserProfile {
  id: string;
  displayName: string;
  bio?: string;
  // other fields...
}

// Placeholder for a service to fetch user profiles
const mockFetchUserProfileById = async (userId: string): Promise<UserProfile> => {
  console.log(`Fetching profile for ${userId}`);
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  if (userId === 'current-user-placeholder-id') {
    return { id: userId, displayName: 'Current User (Me)', bio: 'My awesome bio.' };
  }
  return { id: userId, displayName: `User ${userId.substring(0,5)}`, bio: `Bio for user ${userId.substring(0,5)}.` };
};


type ProfileScreenRouteProp = RouteProp<{ params?: { userId?: string } }, 'params'>;

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ProfileScreenRouteProp>();
  const { user: currentUser } = useAuth();

  const viewingUserId = route.params?.userId || currentUser.id;
  const isOwnProfile = viewingUserId === currentUser.id;

  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [receivedEndorsements, setReceivedEndorsements] = useState<Endorsement[]>([]);
  const [givenEndorsements, setGivenEndorsements] = useState<Endorsement[]>([]); // Only for own profile

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingEndorsements, setIsLoadingEndorsements] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For editing own profile (simplified)
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isEditing, setIsEditing] = useState(false);


  const loadProfileData = useCallback(async () => {
    try {
      setIsLoadingProfile(true);
      setError(null);
      const fetchedProfile = await mockFetchUserProfileById(viewingUserId); // Replace with actual service call
      setProfileData(fetchedProfile);
      if (isOwnProfile) {
        setDisplayName(fetchedProfile.displayName);
        setBio(fetchedProfile.bio || '');
      }
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setError(err.message || 'Failed to load profile data.');
    } finally {
      setIsLoadingProfile(false);
    }
  }, [viewingUserId, isOwnProfile]);

  const loadEndorsements = useCallback(async () => {
    try {
      setIsLoadingEndorsements(true);
      setError(null);
      const received = await getReceivedEndorsements(viewingUserId);
      setReceivedEndorsements(received);

      if (isOwnProfile) {
        const given = await getGivenEndorsements(viewingUserId);
        setGivenEndorsements(given);
      }
    } catch (err: any) {
      console.error('Failed to load endorsements:', err);
      setError(err.message || 'Failed to load endorsements.');
    } finally {
      setIsLoadingEndorsements(false);
    }
  }, [viewingUserId, isOwnProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
      loadEndorsements();
      return () => {
        // Optional: Cleanup if needed when screen loses focus
      };
    }, [loadProfileData, loadEndorsements])
  );

  const handleSaveProfile = async () => {
    if (!isOwnProfile) return;
    setIsLoadingProfile(true); // Or a specific saving state
    // const payload: SharedUserProfileUpdatePayload = { display_name: displayName, bio };
    try {
      // await updateUserProfile(payload); // Replace with actual service call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API
      setProfileData(prev => prev ? { ...prev, displayName, bio } : null);
      Alert.alert('Profile Saved', 'Your profile has been updated.');
      setIsEditing(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const renderEndorsementItem = ({ item }: { item: Endorsement }) => (
    <View style={styles.endorsementItem}>
      <Text style={styles.endorsementText}>
        <Text style={styles.bold}>Type:</Text> {item.endorsement_type}
      </Text>
      {item.skill_name && <Text style={styles.endorsementText}><Text style={styles.bold}>Skill:</Text> {item.skill_name}</Text>}
      {item.comment && <Text style={styles.endorsementText}><Text style={styles.bold}>Comment:</Text> {item.comment}</Text>}
      <Text style={styles.endorsementDetail}>
        By: {item.endorser_display_name || item.endorser_id} on {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </View>
  );

  const renderGivenEndorsementItem = ({ item }: { item: Endorsement }) => (
    <View style={styles.endorsementItem}>
      <Text style={styles.endorsementText}>
        <Text style={styles.bold}>To:</Text> {item.endorsee_display_name || item.endorsee_id}
      </Text>
      <Text style={styles.endorsementText}>
        <Text style={styles.bold}>Type:</Text> {item.endorsement_type}
      </Text>
      {item.skill_name && <Text style={styles.endorsementText}><Text style={styles.bold}>Skill:</Text> {item.skill_name}</Text>}
      {item.comment && <Text style={styles.endorsementText}><Text style={styles.bold}>Comment:</Text> {item.comment}</Text>}
      <Text style={styles.endorsementDetail}>
        On {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </View>
  );


  if (isLoadingProfile) {
    return <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading profile...</Text></View>;
  }

  if (error && !profileData) { // Show critical error if profile fails to load
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }

  if (!profileData) {
     return <View style={styles.centered}><Text>Profile not found.</Text></View>;
  }


  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {isOwnProfile ? "My Profile" : `${profileData.displayName}'s Profile`}
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {isOwnProfile && isEditing ? (
        <View style={styles.profileSection}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />
          <Text style={styles.label}>Bio</Text>
          <TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio} multiline />
          <View style={styles.buttonContainer}>
            <Button title="Save" onPress={handleSaveProfile} />
            <Button title="Cancel" onPress={() => setIsEditing(false)} color="gray" />
          </View>
        </View>
      ) : (
        <View style={styles.profileSection}>
          <Text style={styles.profileInfo}><Text style={styles.bold}>Display Name:</Text> {profileData.displayName}</Text>
          <Text style={styles.profileInfo}><Text style={styles.bold}>Bio:</Text> {profileData.bio || 'No bio set.'}</Text>
          {isOwnProfile && <Button title="Edit Profile" onPress={() => setIsEditing(true)} />}
        </View>
      )}

      {!isOwnProfile && (
        <View style={styles.actionSection}>
          <Button
            title={`Endorse ${profileData.displayName}`}
            onPress={() => navigation.navigate('GiveEndorsement', { endorseeId: viewingUserId, endorseeName: profileData.displayName })}
          />
        </View>
      )}

      <View style={styles.endorsementsSection}>
        <Text style={styles.sectionTitle}>Endorsements Received ({receivedEndorsements.length})</Text>
        {isLoadingEndorsements ? <ActivityIndicator /> : (
          receivedEndorsements.length > 0 ? (
            <FlatList
              data={receivedEndorsements}
              renderItem={renderEndorsementItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false} // If inside ScrollView
            />
          ) : (
            <Text>No endorsements received yet.</Text>
          )
        )}
      </View>

      {isOwnProfile && (
        <View style={styles.endorsementsSection}>
          <Text style={styles.sectionTitle}>Endorsements Given ({givenEndorsements.length})</Text>
          {isLoadingEndorsements ? <ActivityIndicator /> : (
            givenEndorsements.length > 0 ? (
              <FlatList
                data={givenEndorsements}
                renderItem={renderGivenEndorsementItem}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false} // If inside ScrollView
              />
            ) : (
              <Text>You haven't given any endorsements yet.</Text>
            )
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  profileSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  profileInfo: {
    fontSize: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  actionSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  endorsementsSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  endorsementItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  endorsementText: {
    fontSize: 15,
    marginBottom: 3,
  },
  endorsementDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  bold: {
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
});

export default ProfileScreen;
