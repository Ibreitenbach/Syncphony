// frontend/src/services/__tests__/endorsementService.test.ts
import apiClient from '../apiClient';
import {
  giveEndorsement,
  getReceivedEndorsements,
  getGivenEndorsements,
} from '../endorsementService';
import { EndorsementType, GiveEndorsementPayload, Endorsement } from '../../types/endorsementTypes';

// Mock the apiClient
jest.mock('../apiClient');

const mockApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

describe('endorsementService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('giveEndorsement', () => {
    it('should call apiClient.post with the correct endpoint and payload', async () => {
      const payload: GiveEndorsementPayload = {
        endorsee_id: 'user-2',
        endorsement_type: EndorsementType.GENERAL,
        comment: 'Great work!',
      };
      const mockResponse: Endorsement = {
        id: 'endo-1',
        endorser_id: 'user-1',
        endorsee_id: 'user-2',
        endorsement_type: EndorsementType.GENERAL,
        comment: 'Great work!',
        created_at: new Date().toISOString(),
      };
      mockApiClient.mockResolvedValueOnce(mockResponse);

      const result = await giveEndorsement(payload);

      expect(mockApiClient).toHaveBeenCalledTimes(1);
      expect(mockApiClient).toHaveBeenCalledWith('/endorsements', {
        method: 'POST',
        body: payload,
        authenticated: true,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors for giveEndorsement', async () => {
      const payload: GiveEndorsementPayload = {
        endorsee_id: 'user-2',
        endorsement_type: EndorsementType.GENERAL,
      };
      const mockError = new Error('API Error');
      mockApiClient.mockRejectedValueOnce(mockError);

      await expect(giveEndorsement(payload)).rejects.toThrow('API Error');
      expect(mockApiClient).toHaveBeenCalledWith('/endorsements', {
        method: 'POST',
        body: payload,
        authenticated: true,
      });
    });
  });

  describe('getReceivedEndorsements', () => {
    it('should call apiClient.get with the correct endpoint for a user', async () => {
      const userId = 'user-123';
      const mockResponse: Endorsement[] = [
        {
          id: 'endo-1',
          endorser_id: 'user-other',
          endorsee_id: userId,
          endorsement_type: EndorsementType.SKILL_RELATED,
          skill_id: 'skill-abc',
          skill_name: 'React Testing',
          created_at: new Date().toISOString(),
        },
      ];
      mockApiClient.mockResolvedValueOnce(mockResponse);

      const result = await getReceivedEndorsements(userId);

      expect(mockApiClient).toHaveBeenCalledTimes(1);
      expect(mockApiClient).toHaveBeenCalledWith(`/users/${userId}/endorsements_received`, {
        method: 'GET',
        authenticated: true,
      });
      expect(result).toEqual(mockResponse);
    });

     it('should handle API errors for getReceivedEndorsements', async () => {
      const userId = 'user-123';
      const mockError = new Error('Network Error');
      mockApiClient.mockRejectedValueOnce(mockError);

      await expect(getReceivedEndorsements(userId)).rejects.toThrow('Network Error');
      expect(mockApiClient).toHaveBeenCalledWith(`/users/${userId}/endorsements_received`, {
        method: 'GET',
        authenticated: true,
      });
    });
  });

  describe('getGivenEndorsements', () => {
    it('should call apiClient.get with the correct endpoint for a user', async () => {
      const userId = 'user-xyz';
      const mockResponse: Endorsement[] = [
        {
          id: 'endo-2',
          endorser_id: userId,
          endorsee_id: 'user-other',
          endorsement_type: EndorsementType.FAVOR_FEEDBACK,
          comment: 'Thanks for the help!',
          created_at: new Date().toISOString(),
        },
      ];
      mockApiClient.mockResolvedValueOnce(mockResponse);

      const result = await getGivenEndorsements(userId);

      expect(mockApiClient).toHaveBeenCalledTimes(1);
      expect(mockApiClient).toHaveBeenCalledWith(`/users/${userId}/endorsements_given`, {
        method: 'GET',
        authenticated: true,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors for getGivenEndorsements', async () => {
      const userId = 'user-xyz';
      const mockError = new Error('Server Down');
      mockApiClient.mockRejectedValueOnce(mockError);

      await expect(getGivenEndorsements(userId)).rejects.toThrow('Server Down');
      expect(mockApiClient).toHaveBeenCalledWith(`/users/${userId}/endorsements_given`, {
        method: 'GET',
        authenticated: true,
      });
    });
  });
});
