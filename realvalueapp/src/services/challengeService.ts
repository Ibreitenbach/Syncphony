// frontend/src/services/challengeService.ts
import apiClient from "./apiClient";
import {
  PracticeChallengeTemplate,
  UserChallengeCompletion,
  ChallengeCompletionSubmission,
  // Enums like ChallengeType, DifficultyLevel can be imported if needed for request construction
  // but typically responses will already have these as strings from the backend.
} from "../types/challengeTypes";

interface GetChallengeTemplatesFilters {
  associated_skill_id?: number; // Assuming skill ID is a number
  difficulty?: string; // e.g., "easy", "medium", "hard" (from DifficultyLevel enum values)
}

/**
 * Fetches active practice challenge templates.
 * Supports filtering by associated_skill_id or difficulty.
 */
export const getChallengeTemplates = async (
  filters?: GetChallengeTemplatesFilters
): Promise<PracticeChallengeTemplate[]> => {
  let endpoint = "/practice_challenges/templates";
  const queryParams = new URLSearchParams();

  if (filters?.associated_skill_id) {
    queryParams.append("associated_skill_id", String(filters.associated_skill_id));
  }
  if (filters?.difficulty) {
    queryParams.append("difficulty", filters.difficulty);
  }

  if (queryParams.toString()) {
    endpoint += `?${queryParams.toString()}`;
  }

  // This endpoint requires authentication as per backend spec
  return apiClient<PracticeChallengeTemplate[]>(endpoint, { authenticated: true });
};

/**
 * Fetches details for a specific PracticeChallengeTemplate.
 */
export const getChallengeTemplateById = async (
  id: number
): Promise<PracticeChallengeTemplate> => {
  // This endpoint requires authentication
  return apiClient<PracticeChallengeTemplate>(`/practice_challenges/templates/${id}`, { authenticated: true });
};

/**
 * Allows an authenticated user to submit a UserChallengeCompletion
 * for a specific PracticeChallengeTemplate.
 */
export const submitChallengeCompletion = async (
  submissionData: ChallengeCompletionSubmission
): Promise<UserChallengeCompletion> => {
  // This endpoint requires authentication
  return apiClient<UserChallengeCompletion>("/practice_challenges/complete", {
    method: "POST",
    body: submissionData,
    authenticated: true,
  });
};

/**
 * Fetches a list of all UserChallengeCompletion records for the authenticated user.
 */
export const getMyChallengeCompletions = async (): Promise<UserChallengeCompletion[]> => {
  // This endpoint requires authentication
  return apiClient<UserChallengeCompletion[]>("/users/me/challenge_completions", { authenticated: true });
};

// Example of how one might set the token after login for apiClient to use
// import { setAuthToken } from './apiClient';
// login(...).then(response => setAuthToken(response.token));
