// frontend/src/services/__tests__/challengeService.test.ts
import apiClient from '../apiClient';
import * as challengeService from '../challengeService';
import { ChallengeType, DifficultyLevel, CompletionStatus, PracticeChallengeTemplate, UserChallengeCompletion } from '../../types/challengeTypes';

// Mock the apiClient
jest.mock('../apiClient');
const mockedApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

describe('challengeService', () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    mockedApiClient.mockClear();
  });

  describe('getChallengeTemplates', () => {
    it('should fetch active challenge templates without filters', async () => {
      const mockTemplates: PracticeChallengeTemplate[] = [
        { id: 1, title: 'Test 1', description: 'Desc 1', challenge_type: ChallengeType.TEXT_RESPONSE, difficulty: DifficultyLevel.EASY, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), associated_skill_id: null },
      ];
      mockedApiClient.mockResolvedValueOnce(mockTemplates);

      const result = await challengeService.getChallengeTemplates();
      expect(result).toEqual(mockTemplates);
      expect(mockedApiClient).toHaveBeenCalledWith('/practice_challenges/templates', { authenticated: true });
    });

    it('should fetch active challenge templates with difficulty filter', async () => {
      mockedApiClient.mockResolvedValueOnce([]); // Return empty for simplicity
      await challengeService.getChallengeTemplates({ difficulty: DifficultyLevel.MEDIUM });
      expect(mockedApiClient).toHaveBeenCalledWith('/practice_challenges/templates?difficulty=medium', { authenticated: true });
    });

    it('should fetch active challenge templates with skill_id filter', async () => {
      mockedApiClient.mockResolvedValueOnce([]);
      await challengeService.getChallengeTemplates({ associated_skill_id: 10 });
      expect(mockedApiClient).toHaveBeenCalledWith('/practice_challenges/templates?associated_skill_id=10', { authenticated: true });
    });

    it('should fetch active challenge templates with both filters', async () => {
      mockedApiClient.mockResolvedValueOnce([]);
      await challengeService.getChallengeTemplates({ difficulty: DifficultyLevel.HARD, associated_skill_id: 20 });
      expect(mockedApiClient).toHaveBeenCalledWith('/practice_challenges/templates?associated_skill_id=20&difficulty=hard', { authenticated: true });
    });
  });

  describe('getChallengeTemplateById', () => {
    it('should fetch a specific challenge template by ID', async () => {
      const mockTemplate: PracticeChallengeTemplate = { id: 1, title: 'Test Detail', description: 'Detail Desc', challenge_type: ChallengeType.TEXT_RESPONSE, difficulty: DifficultyLevel.EASY, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), associated_skill_id: null };
      mockedApiClient.mockResolvedValueOnce(mockTemplate);

      const result = await challengeService.getChallengeTemplateById(1);
      expect(result).toEqual(mockTemplate);
      expect(mockedApiClient).toHaveBeenCalledWith('/practice_challenges/templates/1', { authenticated: true });
    });
  });

  describe('submitChallengeCompletion', () => {
    it('should submit challenge completion data', async () => {
      const submissionData = { challenge_template_id: 1, user_response: 'Done!' };
      const mockResponse: UserChallengeCompletion = {
        id: 1,
        user_id: 1,
        challenge_template_id: 1,
        status: CompletionStatus.COMPLETED,
        completed_at: new Date().toISOString(),
        user_response: 'Done!',
      };
      mockedApiClient.mockResolvedValueOnce(mockResponse);

      const result = await challengeService.submitChallengeCompletion(submissionData);
      expect(result).toEqual(mockResponse);
      expect(mockedApiClient).toHaveBeenCalledWith('/practice_challenges/complete', {
        method: 'POST',
        body: submissionData,
        authenticated: true,
      });
    });
  });

  describe('getMyChallengeCompletions', () => {
    it('should fetch completions for the authenticated user', async () => {
      const mockCompletions: UserChallengeCompletion[] = [
        { id: 1, user_id: 1, challenge_template_id: 1, status: CompletionStatus.COMPLETED, completed_at: new Date().toISOString(), user_response: 'Old completion' },
      ];
      mockedApiClient.mockResolvedValueOnce(mockCompletions);

      const result = await challengeService.getMyChallengeCompletions();
      expect(result).toEqual(mockCompletions);
      expect(mockedApiClient).toHaveBeenCalledWith('/users/me/challenge_completions', { authenticated: true });
    });
  });
});
