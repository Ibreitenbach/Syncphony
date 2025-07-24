// frontend/src/services/__tests__/mindContentService.test.ts
import apiClient from '../apiClient';
import * as mindContentService from '../mindContentService';
import { MindContentType, MindContent, MindContentCategory, NewMindContentData, UpdateMindContentData } from '../../types/mindContentTypes';

jest.mock('../apiClient');
const mockedApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

describe('mindContentService', () => {
  beforeEach(() => {
    mockedApiClient.mockClear();
  });

  const mockCategory: MindContentCategory = { id: 1, name: 'Meditation' };
  const mockContentItem: MindContent = {
    id: 1, title: 'Intro to Meditation', description: 'A beginner guide.', url: 'http://example.com/meditation',
    content_type: MindContentType.ARTICLE, category_id: 1, category: mockCategory,
    author_name: 'Monk Dude', read_time_minutes: 10,
  };

  describe('getMindContentCategories', () => {
    it('should fetch mind content categories', async () => {
      const mockCategories: MindContentCategory[] = [mockCategory];
      mockedApiClient.mockResolvedValueOnce(mockCategories);
      const result = await mindContentService.getMindContentCategories();
      expect(result).toEqual(mockCategories);
      expect(mockedApiClient).toHaveBeenCalledWith('/mind_content/categories', { authenticated: true });
    });
  });

  describe('getMindContent', () => {
    it('should fetch mind content without filters', async () => {
      const mockItems: MindContent[] = [mockContentItem];
      mockedApiClient.mockResolvedValueOnce(mockItems);
      const result = await mindContentService.getMindContent();
      expect(result).toEqual(mockItems);
      expect(mockedApiClient).toHaveBeenCalledWith('/mind_content', { authenticated: true });
    });

    it('should fetch mind content with category_id filter', async () => {
      mockedApiClient.mockResolvedValueOnce([]);
      await mindContentService.getMindContent({ category_id: 1 });
      expect(mockedApiClient).toHaveBeenCalledWith('/mind_content?category_id=1', { authenticated: true });
    });

    it('should fetch mind content with search filter', async () => {
      mockedApiClient.mockResolvedValueOnce([]);
      await mindContentService.getMindContent({ search: 'mindfulness' });
      expect(mockedApiClient).toHaveBeenCalledWith('/mind_content?search=mindfulness', { authenticated: true });
    });

    it('should fetch mind content with both filters', async () => {
      mockedApiClient.mockResolvedValueOnce([]);
      await mindContentService.getMindContent({ category_id: 1, search: 'guide' });
      expect(mockedApiClient).toHaveBeenCalledWith('/mind_content?category_id=1&search=guide', { authenticated: true });
    });
     it('should trim search filter string', async () => {
      mockedApiClient.mockResolvedValueOnce([]);
      await mindContentService.getMindContent({ search: '  spaced out search  ' });
      expect(mockedApiClient).toHaveBeenCalledWith('/mind_content?search=spaced+out+search', { authenticated: true });
    });
  });

  describe('getMindContentById', () => {
    it('should fetch a single mind content item by ID', async () => {
      mockedApiClient.mockResolvedValueOnce(mockContentItem);
      const result = await mindContentService.getMindContentById(1);
      expect(result).toEqual(mockContentItem);
      expect(mockedApiClient).toHaveBeenCalledWith('/mind_content/1', { authenticated: true });
    });
  });

  describe('addMindContent', () => {
    it('should add new mind content', async () => {
      const newContentData: NewMindContentData = {
        title: 'New Video', description: 'Watch this.', url: 'http://example.com/newvideo',
        content_type: MindContentType.VIDEO, category_id: 1, author_name: 'Videographer', duration_minutes: 5,
      };
      const createdContent: MindContent = { ...newContentData, id: 2, category: mockCategory };
      mockedApiClient.mockResolvedValueOnce(createdContent);

      const result = await mindContentService.addMindContent(newContentData);
      expect(result).toEqual(createdContent);
      expect(mockedApiClient).toHaveBeenCalledWith('/mind_content', {
        method: 'POST',
        body: newContentData,
        authenticated: true,
      });
    });
  });

  describe('updateMindContent', () => {
    it('should update existing mind content', async () => {
      const updatedData: UpdateMindContentData = { title: 'Updated Article Title' };
      const updatedContent: MindContent = { ...mockContentItem, ...updatedData };
      mockedApiClient.mockResolvedValueOnce(updatedContent);

      const result = await mindContentService.updateMindContent(1, updatedData);
      expect(result).toEqual(updatedContent);
      expect(mockedApiClient).toHaveBeenCalledWith('/mind_content/1', {
        method: 'PUT',
        body: updatedData,
        authenticated: true,
      });
    });
  });

  describe('deleteMindContent', () => {
    it('should delete mind content by ID', async () => {
      // apiClient for a DELETE might return null or an empty object for success with no content
      mockedApiClient.mockResolvedValueOnce(null);
      await mindContentService.deleteMindContent(1);
      expect(mockedApiClient).toHaveBeenCalledWith('/mind_content/1', {
        method: 'DELETE',
        authenticated: true,
      });
    });
  });
});
