// frontend/src/services/endorsementService.ts
import apiClient from "./apiClient";
import { Endorsement, GiveEndorsementPayload } from "../types/endorsementTypes";

/**
 * Gives an endorsement to another user.
 * Requires authentication.
 * @param payload - The data for the endorsement.
 * @returns The created Endorsement object.
 */
export const giveEndorsement = async (
  payload: GiveEndorsementPayload
): Promise<Endorsement> => {
  return apiClient<Endorsement>("/endorsements", {
    method: "POST",
    body: payload,
    authenticated: true,
  });
};

/**
 * Fetches endorsements received by a specific user.
 * Requires authentication.
 * @param userId - The ID of the user whose received endorsements are to be fetched.
 * @returns A list of Endorsement objects.
 */
export const getReceivedEndorsements = async (
  userId: string
): Promise<Endorsement[]> => {
  return apiClient<Endorsement[]>(`/users/${userId}/endorsements_received`, {
    method: "GET",
    authenticated: true,
  });
};

/**
 * Fetches endorsements given by a specific user.
 * Requires authentication.
 * @param userId - The ID of the user whose given endorsements are to be fetched.
 * @returns A list of Endorsement objects.
 */
export const getGivenEndorsements = async (
  userId: string
): Promise<Endorsement[]> => {
  // Assuming the API endpoint for given endorsements is /users/<userId>/endorsements_given
  // This might vary based on actual backend implementation.
  return apiClient<Endorsement[]>(`/users/${userId}/endorsements_given`, {
    method: "GET",
    authenticated: true,
  });
};

// Example of how one might manage user context (e.g., current user's ID)
// This is often handled by an AuthContext or similar global state solution.
// For now, these service functions expect userId to be passed where needed.

/*
// --- Potential future enhancements or considerations ---
// If the backend supports pagination for endorsements:
export interface PaginatedEndorsements {
  items: Endorsement[];
  total: number;
  page: number;
  limit: number;
}

export const getReceivedEndorsementsPaginated = async (
  userId: string,
  page: number = 1,
  limit: number = 10
): Promise<PaginatedEndorsements> => {
  return apiClient<PaginatedEndorsements>(
    `/users/${userId}/endorsements_received?page=${page}&limit=${limit}`,
    { method: "GET", authenticated: true }
  );
};
*/
