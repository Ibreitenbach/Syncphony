// frontend/src/screens/MindContentFormScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as mindContentService from '../services/mindContentService';
import { MindContentCategory, MindContentType, NewMindContentData, UpdateMindContentData, MindContent } from '../types/mindContentTypes';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app'; // Adjust path as needed

type MindContentFormScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MindContentForm'>;
type MindContentFormScreenRouteProp = RouteProp<RootStackParamList, 'MindContentForm'>;

interface FormData {
  title: string;
  description: string;
  url: string;
  content_type: MindContentType;
  category_id: number | undefined; // Picker needs a way to represent "not selected" if that's desired
  author_name: string;
  read_time_minutes: string; // Keep as string for TextInput, convert on submit
  duration_minutes: string;  // Keep as string for TextInput, convert on submit
}

const MindContentFormScreen: React.FC = () => {
  const navigation = useNavigation<MindContentFormScreenNavigationProp>();
  const route = useRoute<MindContentFormScreenRouteProp>();

  const mode = route.params?.mode || 'add';
  const contentId = route.params?.contentId;

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    url: '',
    content_type: MindContentType.ARTICLE,
    category_id: undefined,
    author_name: '',
    read_time_minutes: '',
    duration_minutes: '',
  });
  const [categories, setCategories] = useState<MindContentCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [pageLoading, setPageLoading] = useState<boolean>(false); // For loading categories or existing content
  const [error, setError] = useState<string | null>(null);

  // Fetch categories for the picker
  useEffect(() => {
    const fetchCategories = async () => {
      setPageLoading(true);
      try {
        const fetchedCategories = await mindContentService.getMindContentCategories();
        setCategories(fetchedCategories);
        if (fetchedCategories.length > 0 && mode === 'add') {
          // Set a default category for new items if categories exist
          setFormData(prev => ({ ...prev, category_id: fetchedCategories[0].id }));
        }
      } catch (e: any) {
        setError('Failed to load categories. Please try again.');
        console.error("Fetch categories error:", e);
      }
      setPageLoading(false);
    };
    fetchCategories();
  }, [mode]);

  // Fetch existing content if in 'edit' mode
  useEffect(() => {
    if (mode === 'edit' && contentId) {
      setPageLoading(true);
      mindContentService.getMindContentById(contentId)
        .then(content => {
          setFormData({
            title: content.title,
            description: content.description,
            url: content.url,
            content_type: content.content_type,
            category_id: content.category_id,
            author_name: content.author_name || '',
            read_time_minutes: content.read_time_minutes?.toString() || '',
            duration_minutes: content.duration_minutes?.toString() || '',
          });
        })
        .catch(e => {
          setError('Failed to load content for editing.');
          console.error("Fetch content for edit error:", e);
        })
        .finally(() => setPageLoading(false));
    }
  }, [mode, contentId]);

  const handleInputChange = (name: keyof FormData, value: string | number | MindContentType) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim() || !formData.description.trim() || !formData.url.trim()) {
      Alert.alert('Validation Error', 'Title, Description, and URL are required.');
      return false;
    }
    if (!formData.category_id) {
      Alert.alert('Validation Error', 'Please select a category.');
      return false;
    }
    // Basic URL validation (can be improved)
    if (!formData.url.startsWith('http://') && !formData.url.startsWith('https://')) {
        Alert.alert('Validation Error', 'URL must start with http:// or https://');
        return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null);

    const submissionData: NewMindContentData | UpdateMindContentData = {
      ...formData,
      category_id: formData.category_id!, // Asserting category_id is defined due to validation
      read_time_minutes: formData.read_time_minutes ? parseInt(formData.read_time_minutes, 10) : null,
      duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes, 10) : null,
    };

    // Remove empty optional fields so they don't overwrite with empty strings if not provided
    if (!submissionData.author_name?.trim()) delete submissionData.author_name;


    try {
      if (mode === 'edit' && contentId) {
        await mindContentService.updateMindContent(contentId, submissionData as UpdateMindContentData);
        Alert.alert('Success', 'Content updated successfully!');
      } else {
        await mindContentService.addMindContent(submissionData as NewMindContentData);
        Alert.alert('Success', 'Content added successfully!');
      }
      navigation.goBack();
    } catch (e: any) {
      setError(e.message || 'Failed to save content.');
      Alert.alert('Error', e.message || 'Failed to save content.');
      console.error("Submit content error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading form...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>{mode === 'edit' ? 'Edit Content' : 'Suggest New Content'}</Text>

      <Text style={styles.label}>Title *</Text>
      <TextInput style={styles.input} value={formData.title} onChangeText={val => handleInputChange('title', val)} placeholder="Enter title" />

      <Text style={styles.label}>Description *</Text>
      <TextInput style={styles.input} value={formData.description} onChangeText={val => handleInputChange('description', val)} placeholder="Enter description" multiline numberOfLines={4} />

      <Text style={styles.label}>URL *</Text>
      <TextInput style={styles.input} value={formData.url} onChangeText={val => handleInputChange('url', val)} placeholder="https://example.com" keyboardType="url" autoCapitalize="none" />

      <Text style={styles.label}>Content Type *</Text>
      <Picker
        selectedValue={formData.content_type}
        onValueChange={itemValue => handleInputChange('content_type', itemValue as MindContentType)}
        style={styles.picker}
      >
        {Object.values(MindContentType).map(type => (
          <Picker.Item key={type} label={type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')} value={type} />
        ))}
      </Picker>

      <Text style={styles.label}>Category *</Text>
      {categories.length === 0 && !pageLoading ? <Text style={styles.errorTextSmall}>No categories loaded. Cannot submit.</Text> : null}
      <Picker
        selectedValue={formData.category_id}
        onValueChange={itemValue => handleInputChange('category_id', itemValue as number)}
        style={styles.picker}
        enabled={categories.length > 0}
      >
        <Picker.Item label="Select a category..." value={undefined} />
        {categories.map(cat => (
          <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
        ))}
      </Picker>

      <Text style={styles.label}>Author Name</Text>
      <TextInput style={styles.input} value={formData.author_name} onChangeText={val => handleInputChange('author_name', val)} placeholder="Optional: Author's name" />

      <Text style={styles.label}>Read Time (minutes)</Text>
      <TextInput style={styles.input} value={formData.read_time_minutes} onChangeText={val => handleInputChange('read_time_minutes', val)} placeholder="Optional: e.g., 15" keyboardType="numeric" />

      <Text style={styles.label}>Duration (minutes)</Text>
      <TextInput style={styles.input} value={formData.duration_minutes} onChangeText={val => handleInputChange('duration_minutes', val)} placeholder="Optional: e.g., 45" keyboardType="numeric" />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Button title={loading ? "Saving..." : (mode === 'edit' ? "Update Content" : "Add Content")} onPress={handleSubmit} disabled={loading || categories.length === 0} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 15,
  },
  picker: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 15,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
  },
   errorTextSmall: {
    color: 'orange',
    textAlign: 'center',
    marginBottom: 5,
    fontSize: 12,
  }
});

export default MindContentFormScreen;
