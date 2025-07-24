// frontend/src/screens/MyExchangeOffersScreen.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, Button, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ExchangeOffer } from '../types/exchangeTypes';
import { getMyExchangeOffers, deleteExchangeOffer } from '../services/exchangeService';
// import { useAuth } from '../context/AuthContext'; // Not strictly needed if service uses auth token

const MyExchangeOffersScreen: React.FC = () => {
  const navigation = useNavigation();
  // const { user } = useAuth(); // Get user if needed for display, though service handles auth

  const [myOffers, setMyOffers] = useState<ExchangeOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMyOffers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedOffers = await getMyExchangeOffers();
      setMyOffers(fetchedOffers);
    } catch (err: any) {
      console.error('Failed to load my exchange offers:', err);
      setError(err.message || 'Failed to load your exchange offers.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyOffers();
    }, [loadMyOffers])
  );

  const handleEditOffer = (offerId: string) => {
    navigation.navigate('ExchangeOfferForm', { offerId: offerId } as never);
  };

  const handleDeleteOffer = (offerId: string, offerName?: string) => {
    Alert.alert(
      'Delete Offer',
      `Are you sure you want to delete this offer${offerName ? ` for "${offerName}"` : ''}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true); // Can use a specific deleting state if preferred
            try {
              await deleteExchangeOffer(offerId);
              Alert.alert('Success', 'Offer deleted successfully.');
              // Refresh the list
              loadMyOffers();
            } catch (err: any) {
              console.error('Failed to delete offer:', err);
              Alert.alert('Error', err.data?.message || err.message || 'Failed to delete offer.');
              setError(err.data?.message || err.message || 'Failed to delete offer.');
              setIsLoading(false); // Reset loading on error
            }
            // setIsLoading(false) will be called in loadMyOffers's finally block on success
          },
        },
      ]
    );
  };

  const renderOfferItem = ({ item }: { item: ExchangeOffer }) => (
    <View style={styles.offerItem}>
      <Text style={styles.offerTitle}>Offering: {item.offered_skill?.name || item.offered_skill_id}</Text>
      <Text style={styles.offerDetail}>Wants: {item.desired_skill?.name || item.desired_skill_id || 'N/A (see description)'}</Text>
      <Text style={styles.offerDetail}>Desired Details: {item.desired_description || "Not specified"}</Text>
      <Text style={styles.offerDescription}>Description: {item.description}</Text>
      <Text style={styles.offerStatus}>Status: {item.is_active ? 'Active' : 'Inactive'}</Text>
      <Text style={styles.offerDate}>Last Updated: {new Date(item.updated_at).toLocaleDateString()}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, styles.editButton]} onPress={() => handleEditOffer(item.id)}>
            <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={() => handleDeleteOffer(item.id, item.offered_skill?.name)}>
            <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading && myOffers.length === 0) { // Show main loader only if list is empty
    return <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading your offers...</Text></View>;
  }

  if (error && myOffers.length === 0) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text><Button title="Retry" onPress={loadMyOffers}/></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>My Exchange Offers</Text>
        <Button
            title="+ Create New Offer"
            onPress={() => navigation.navigate('ExchangeOfferForm' as never)}
        />
      </View>

      {error && <Text style={styles.errorTextSmall}>{error}</Text>}
      {isLoading && myOffers.length > 0 && <ActivityIndicator style={styles.inlineLoader}/>}


      {myOffers.length === 0 && !isLoading ? (
        <View style={styles.centered}>
          <Text>You haven't created any exchange offers yet.</Text>
        </View>
      ) : (
        <FlatList
          data={myOffers}
          renderItem={renderOfferItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          refreshing={isLoading} // Show refresh indicator if list is already populated
          onRefresh={loadMyOffers} // Pull to refresh
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  headerContainer: {
    padding: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  offerItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.00,
  },
  offerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  offerDetail: {
    fontSize: 15,
    marginBottom: 3,
  },
  offerDescription: {
    fontSize: 14,
    color: '#333',
    marginTop: 5,
    marginBottom: 5,
  },
  offerStatus: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#555',
    marginBottom: 3,
  },
  offerDate: {
    fontSize: 12,
    color: '#777',
    textAlign: 'right',
    marginTop: 5,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginLeft: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#007bff',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 10,
  },
  errorTextSmall: {
    color: 'red',
    textAlign: 'center',
    paddingVertical: 5,
  },
  inlineLoader: {
    marginVertical: 10,
  }
});

export default MyExchangeOffersScreen;
