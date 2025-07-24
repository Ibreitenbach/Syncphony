// frontend/src/screens/ExchangeBoardScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker'; // Assuming this package is available

import { ExchangeOffer, ExchangeOfferFilters, Skill } from '../types/exchangeTypes';
import { getExchangeOffers } from '../services/exchangeService';
// import { getAllSkills } from '../services/skillService'; // Assuming a skill service exists

// Placeholder for fetching skills - replace with actual service call
const mockFetchSkills = async (): Promise<Skill[]> => {
  console.log("Fetching all skills (mock)");
  await new Promise(resolve => setTimeout(resolve, 300));
  return [
    { id: 'skill_1', name: 'Gardening' },
    { id: 'skill_2', name: 'React Native Programming' },
    { id: 'skill_3', name: 'Spanish Language Tutoring' },
    { id: 'skill_4', name: 'Basic Bike Repair' },
    { id: 'skill_5', name: 'Yoga Instruction' },
  ];
};

const ExchangeBoardScreen: React.FC = () => {
  const navigation = useNavigation();
  const [offers, setOffers] = useState<ExchangeOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);

  // Filter states
  const [offeredSkillFilter, setOfferedSkillFilter] = useState<string | undefined>(undefined);
  const [desiredSkillFilter, setDesiredSkillFilter] = useState<string | undefined>(undefined);
  const [searchTextFilter, setSearchTextFilter] = useState<string>('');

  const loadSkills = useCallback(async () => {
    try {
      const skills = await mockFetchSkills(); // Replace with actual skillService.getAllSkills();
      setAvailableSkills(skills);
    } catch (err) {
      console.error("Failed to load skills for filtering:", err);
      // Handle error loading skills, maybe set a specific error message
    }
  }, []);

  const loadExchangeOffers = useCallback(async (currentFilters?: ExchangeOfferFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeFilters: ExchangeOfferFilters = {
        is_active: true, // Always fetch active offers for the board
        ...currentFilters
      };
      // Remove empty filters
      if (!activeFilters.offered_skill_id) delete activeFilters.offered_skill_id;
      if (!activeFilters.desired_skill_id) delete activeFilters.desired_skill_id;
      if (!activeFilters.search_text?.trim()) delete activeFilters.search_text;

      const fetchedOffers = await getExchangeOffers(activeFilters);
      setOffers(fetchedOffers);
    } catch (err: any) {
      console.error('Failed to load exchange offers:', err);
      setError(err.message || 'Failed to load exchange offers.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load skills once on mount
  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Load offers when screen focuses or filters change
  useFocusEffect(
    useCallback(() => {
      const currentFilters: ExchangeOfferFilters = {
        offered_skill_id: offeredSkillFilter,
        desired_skill_id: desiredSkillFilter,
        search_text: searchTextFilter,
      };
      loadExchangeOffers(currentFilters);
    }, [loadExchangeOffers, offeredSkillFilter, desiredSkillFilter, searchTextFilter])
  );

  const handleApplyFilters = () => {
      const currentFilters: ExchangeOfferFilters = {
        offered_skill_id: offeredSkillFilter,
        desired_skill_id: desiredSkillFilter,
        search_text: searchTextFilter,
      };
      loadExchangeOffers(currentFilters);
  };

  const handleClearFilters = () => {
    setOfferedSkillFilter(undefined);
    setDesiredSkillFilter(undefined);
    setSearchTextFilter('');
    // The useFocusEffect/useEffect will re-trigger loadExchangeOffers with cleared filters
    // or call explicitly: loadExchangeOffers({});
  };


  const renderOfferItem = ({ item }: { item: ExchangeOffer }) => (
    <View style={styles.offerItem}>
      <Text style={styles.offerTitle}>Offering: {item.offered_skill?.name || item.offered_skill_id}</Text>
      {item.user && <Text style={styles.offerUser}>By: {item.user.display_name}</Text>}
      <Text style={styles.offerDetail}>Wants: {item.desired_skill?.name || item.desired_skill_id || 'N/A (see description)'}</Text>
      <Text style={styles.offerDetail}>Details for Desired: {item.desired_description || "Not specified"}</Text>
      <Text style={styles.offerDescription}>Description: {item.description}</Text>
      <Text style={styles.offerDate}>Posted: {new Date(item.created_at).toLocaleDateString()}</Text>
      {/* Add a button to view details or contact user if that's part of the flow */}
    </View>
  );

  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Skill Exchange Board</Text>

      <View style={styles.filtersContainer}>
        <Text style={styles.filterTitle}>Filters</Text>
        <Picker
          selectedValue={offeredSkillFilter}
          onValueChange={(itemValue) => setOfferedSkillFilter(itemValue || undefined)}
          style={styles.picker}
        >
          <Picker.Item label="Any Offered Skill" value={undefined} />
          {availableSkills.map(skill => <Picker.Item key={skill.id} label={skill.name} value={skill.id} />)}
        </Picker>

        <Picker
          selectedValue={desiredSkillFilter}
          onValueChange={(itemValue) => setDesiredSkillFilter(itemValue || undefined)}
          style={styles.picker}
        >
          <Picker.Item label="Any Desired Skill" value={undefined} />
          {availableSkills.map(skill => <Picker.Item key={skill.id} label={skill.name} value={skill.id} />)}
        </Picker>

        <TextInput
          style={styles.searchInput}
          placeholder="Search in descriptions..."
          value={searchTextFilter}
          onChangeText={setSearchTextFilter}
          onSubmitEditing={handleApplyFilters} // Apply on submit from keyboard
        />
        <View style={styles.filterButtons}>
            <Button title="Apply Filters" onPress={handleApplyFilters} />
            <Button title="Clear Filters" onPress={handleClearFilters} color="grey"/>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading offers...</Text></View>
      ) : offers.length === 0 ? (
        <View style={styles.centered}><Text>No exchange offers found matching your criteria.</Text></View>
      ) : (
        <FlatList
          data={offers}
          renderItem={renderOfferItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          scrollEnabled={false} // as it's inside a ScrollView
        />
      )}
       {/* Button to navigate to My Offers or Create Offer */}
       <View style={styles.actionsContainer}>
        <Button
            title="My Exchange Offers"
            onPress={() => navigation.navigate('MyExchangeOffers' as never)} // Type assertion if TS complains
        />
        <Button
            title="+ Create New Offer"
            onPress={() => navigation.navigate('ExchangeOfferForm' as never)}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 15,
  },
  filtersContainer: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 15,
    elevation: 2,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  picker: {
    backgroundColor: '#f0f0f0',
    marginBottom: 10,
    borderRadius: 5,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  list: {
    flex: 1,
  },
  offerItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 1,
  },
  offerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  offerUser: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
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
  },
  offerDate: {
    fontSize: 12,
    color: '#777',
    textAlign: 'right',
    marginTop: 5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
  actionsContainer: {
    marginVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
  }
});

export default ExchangeBoardScreen;
