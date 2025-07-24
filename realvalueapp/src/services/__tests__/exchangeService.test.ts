// frontend/src/services/__tests__/exchangeService.test.ts
import apiClient from '../apiClient';
import {
  createExchangeOffer,
  getExchangeOffers,
  getExchangeOfferById,
  updateExchangeOffer,
  deleteExchangeOffer,
  getMyExchangeOffers,
} from '../exchangeService';
import { CreateExchangeOfferPayload, UpdateExchangeOfferPayload, ExchangeOffer, ExchangeOfferFilters } from '../../types/exchangeTypes';

jest.mock('../apiClient');

const mockApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

describe('exchangeService', () => {
  const baseOfferPath = "/exchange_offers";

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createExchangeOffer', () => {
    it('should call apiClient.post with correct payload and auth', async () => {
      const payload: CreateExchangeOfferPayload = {
        offered_skill_id: 'skill1',
        desired_description: 'Looking for help',
        description: 'I can offer this skill.',
      };
      const mockResponse: ExchangeOffer = { id: 'offer1', ...payload, user_id: 'user1', is_active: true, created_at: '', updated_at: '' } as ExchangeOffer; // Simplified
      mockApiClient.mockResolvedValueOnce(mockResponse);

      const result = await createExchangeOffer(payload);

      expect(mockApiClient).toHaveBeenCalledWith(baseOfferPath, {
        method: 'POST',
        body: payload,
        authenticated: true,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getExchangeOffers', () => {
    it('should call apiClient.get with correct path and no filters', async () => {
      const mockResponse: ExchangeOffer[] = [];
      mockApiClient.mockResolvedValueOnce(mockResponse);
      await getExchangeOffers();
      expect(mockApiClient).toHaveBeenCalledWith(baseOfferPath, { method: 'GET' });
    });

    it('should call apiClient.get with filters correctly appended', async () => {
      const filters: ExchangeOfferFilters = {
        offered_skill_id: 'skillA',
        desired_skill_id: 'skillB',
        search_text: 'help',
        is_active: true,
      };
      const mockResponse: ExchangeOffer[] = [];
      mockApiClient.mockResolvedValueOnce(mockResponse);

      await getExchangeOffers(filters);

      const expectedPath = `${baseOfferPath}?offered_skill_id=skillA&desired_skill_id=skillB&search_text=help&is_active=true`;
      expect(mockApiClient).toHaveBeenCalledWith(expectedPath, { method: 'GET' });
    });

     it('should handle empty or undefined filters gracefully', async () => {
      const filters: ExchangeOfferFilters = {
        offered_skill_id: undefined,
        search_text: '  ', // whitespace only
        is_active: false, // boolean false should be included
      };
      const mockResponse: ExchangeOffer[] = [];
      mockApiClient.mockResolvedValueOnce(mockResponse);

      await getExchangeOffers(filters);

      // search_text should be included as is if not empty, even if just whitespace, as per current service code.
      // offered_skill_id omitted due to being undefined
      const expectedPath = `${baseOfferPath}?search_text=%20%20&is_active=false`;
      expect(mockApiClient).toHaveBeenCalledWith(expectedPath, { method: 'GET' });
    });
  });

  describe('getExchangeOfferById', () => {
    it('should call apiClient.get with correct ID', async () => {
      const offerId = 'offer123';
      const mockResponse: ExchangeOffer = { id: offerId, offered_skill_id: 's1', desired_description: 'd', description: 'd', user_id:'u1', is_active: true, created_at: '', updated_at: ''} as ExchangeOffer;
      mockApiClient.mockResolvedValueOnce(mockResponse);

      const result = await getExchangeOfferById(offerId);
      expect(mockApiClient).toHaveBeenCalledWith(`${baseOfferPath}/${offerId}`, { method: 'GET' });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateExchangeOffer', () => {
    it('should call apiClient.patch with correct payload, ID, and auth', async () => {
      const offerId = 'offer123';
      const payload: UpdateExchangeOfferPayload = { description: 'Updated description' };
      const mockResponse: ExchangeOffer = { id: offerId, offered_skill_id: 's1', description: 'Updated description', desired_description: 'd', user_id:'u1', is_active: true, created_at: '', updated_at: '' } as ExchangeOffer;
      mockApiClient.mockResolvedValueOnce(mockResponse);

      const result = await updateExchangeOffer(offerId, payload);
      expect(mockApiClient).toHaveBeenCalledWith(`${baseOfferPath}/${offerId}`, {
        method: 'PATCH',
        body: payload,
        authenticated: true,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteExchangeOffer', () => {
    it('should call apiClient.delete with correct ID and auth', async () => {
      const offerId = 'offer123';
      mockApiClient.mockResolvedValueOnce(undefined); // DELETE might return 204 No Content

      await deleteExchangeOffer(offerId);
      expect(mockApiClient).toHaveBeenCalledWith(`${baseOfferPath}/${offerId}`, {
        method: 'DELETE',
        authenticated: true,
      });
    });
  });

  describe('getMyExchangeOffers', () => {
    it('should call apiClient.get for user-specific offers with auth', async () => {
      const mockResponse: ExchangeOffer[] = [];
      mockApiClient.mockResolvedValueOnce(mockResponse);

      await getMyExchangeOffers();
      expect(mockApiClient).toHaveBeenCalledWith('/users/me/exchange_offers', {
        method: 'GET',
        authenticated: true,
      });
    });
  });
});
