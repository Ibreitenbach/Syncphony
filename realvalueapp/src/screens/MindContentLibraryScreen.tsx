// frontend/src/screens/MindContentLibraryScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Linking,
  Button,
  // Platform, // For Picker specific styling if needed
} from "react-native";
// For Picker: Consider using @react-native-picker/picker if not built-in or for better styling
// For now, a simple button-based category filter or text input might be used as placeholder if Picker is complex to set up without seeing existing UI patterns.
// Let's try to use a basic conceptual filter approach first.

import * as mindContentService from "../services/mindContentService";
import { MindContent, MindContentCategory } from "../types/mindContentTypes";
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from "../../app"; // Adjust path as needed

type MindContentLibraryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MindContentLibrary'>;

const MindContentLibraryScreen: React.FC = () => {
  const navigation = useNavigation<MindContentLibraryScreenNavigationProp>();
  const [contentItems, setContentItems] = useState<MindContent[]>([]);
  const [categories, setCategories] = useState<MindContentCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);

  const loadData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setLoading(true);
    setError(null);
    try {
      // Fetch categories only on initial load or if they haven't been fetched
      if (isInitialLoad || categories.length === 0) {
        const fetchedCategories = await mindContentService.getMindContentCategories();
        setCategories(fetchedCategories);
      }
      const filters: Partial<Parameters<typeof mindContentService.getMindContent>[0]> = {};
      if (selectedCategoryId) {
        filters.category_id = selectedCategoryId;
      }
      if (searchTerm.trim()) {
        filters.search = searchTerm.trim();
      }
      const fetchedContent = await mindContentService.getMindContent(filters);
      setContentItems(fetchedContent);
    } catch (e: any) {
      setError(e.message || "Failed to fetch mind content.");
      console.error("MindContentLibraryScreen fetch error:", e);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [selectedCategoryId, searchTerm, categories.length]);

  useEffect(() => {
    // TODO: This screen requires authentication.
    // Ensure a token is set in apiClient via an auth flow.
    loadData(true);
  }, [loadData]); // Initial load

  const handleOpenUrl = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", `Don't know how to open this URL: ${url}`);
    }
  };

  // Placeholder for navigating to Add/Edit screen
  const handleAddContent = () => {
     navigation.navigate('MindContentForm', { mode: 'add' });
  };

  const renderItem = ({ item }: { item: MindContent }) => {
    const categoryName = categories.find(cat => cat.id === item.category_id)?.name || 'Unknown Category';
    return (
      <View style={styles.contentItem}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemDescription} numberOfLines={3}>{item.description}</Text>
        <View style={styles.detailsRow}>
            <Text style={styles.itemDetail}>Type: {item.content_type}</Text>
            <Text style={styles.itemDetail}>Category: {categoryName}</Text>
        </View>
        {item.author_name && <Text style={styles.itemDetail}>Author: {item.author_name}</Text>}
        <TouchableOpacity style={styles.linkButton} onPress={() => handleOpenUrl(item.url)}>
          <Text style={styles.linkButtonText}>Go to Content</Text>
        </TouchableOpacity>
        {/* Add Edit/Delete buttons here if permissions allow */}
      </View>
    );
  };

  // Basic Filter UI
  // A more sophisticated Picker would be better for categories.
  const FilterControls = () => (
    <View style={styles.filterSection}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search title or description..."
        value={searchTerm}
        onChangeText={setSearchTerm}
        onSubmitEditing={() => loadData(false)} // Trigger search on submit
      />
      <Text style={styles.filterLabel}>Filter by Category:</Text>
      <View style={styles.categoryButtonsContainer}>
        <Button title="All" onPress={() => { setSelectedCategoryId(undefined); }} />
        {categories.map(cat => (
          <Button
            key={cat.id}
            title={cat.name}
            onPress={() => { setSelectedCategoryId(cat.id); }}
            color={selectedCategoryId === cat.id ? "#007bff" : undefined} // Highlight selected
          />
        ))}
      </View>
      <Button title="Apply Search & Filters" onPress={() => loadData(false)} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading Content Library...</Text>
      </View>
    );
  }

  if (error && contentItems.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Button title="Retry" onPress={() => loadData(true)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Mind Content Library</Text>
      <Button title="Suggest New Content" onPress={handleAddContent} />
      <FilterControls />
      {error && <Text style={styles.errorTextSmall}>Update error: {error}</Text>}
      {contentItems.length === 0 && !loading ? (
        <View style={styles.centered}>
          <Text>No content found for the selected criteria.</Text>
        </View>
      ) : (
        <FlatList
          data={contentItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f4f4f8",
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 15,
    color: "#333",
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
  errorTextSmall: {
    color: "red",
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 5,
  },
  filterSection: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    height: 40,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 5,
  },
  categoryButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow buttons to wrap
    justifyContent: 'flex-start', // Align to start
    marginBottom: 10,
  },
  // Individual category button styling could be added if not using system Button's color prop
  listContainer: {
    paddingBottom: 20,
  },
  contentItem: {
    backgroundColor: "#fff",
    padding: 15,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  itemDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  itemDetail: {
    fontSize: 12,
    color: "#444",
    fontStyle: 'italic',
    marginBottom: 3,
  },
  linkButton: {
    backgroundColor: "#007bff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignSelf: "flex-start", // Align button to the left
    marginTop: 10,
  },
  linkButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default MindContentLibraryScreen;
