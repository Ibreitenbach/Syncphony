// frontend/src/services/exchangeService.ts
import apiClient from "./apiClient";
import {
  ExchangeOffer,
  CreateExchangeOfferPayload,
  UpdateExchangeOfferPayload,
  ExchangeOfferFilters,
} from "../types/exchangeTypes";

const API_BASE_PATH = "/exchange_offers"; // Common base path for these APIs

/**
 * Creates a new exchange offer.
 * Requires authentication.
 */
export const createExchangeOffer = async (
  payload: CreateExchangeOfferPayload
): Promise<ExchangeOffer> => {
  return apiClient<ExchangeOffer>(API_BASE_PATH, {
    method: "POST",
    body: payload,
    authenticated: true,
  });
};

/**
 * Fetches exchange offers, optionally filtered.
 * Publicly accessible, but some filters might imply user context.
 */
export const getExchangeOffers = async (
  filters?: ExchangeOfferFilters
): Promise<ExchangeOffer[]> => {
  const queryParams = new URLSearchParams();
  if (filters) {
    if (filters.offered_skill_id) queryParams.append("offered_skill_id", filters.offered_skill_id);
    if (filters.desired_skill_id) queryParams.append("desired_skill_id", filters.desired_skill_id);
    if (filters.search_text) queryParams.append("search_text", filters.search_text);
    if (filters.user_id) queryParams.append("user_id", filters.user_id);
    if (typeof filters.is_active === 'boolean') queryParams.append("is_active", String(filters.is_active));
  }

  const endpoint = `${API_BASE_PATH}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  // Assuming public board is not authenticated, but if it is, set authenticated: true
  return apiClient<ExchangeOffer[]>(endpoint, { method: "GET" });
};

/**
 * Fetches a single exchange offer by its ID.
 */
export const getExchangeOfferById = async (
  offerId: string
): Promise<ExchangeOffer> => {
  return apiClient<ExchangeOffer>(`${API_BASE_PATH}/${offerId}`, { method: "GET" });
};

/**
 * Updates an existing exchange offer.
 * Requires authentication and user must be the owner of the offer (backend enforces this).
 */
export const updateExchangeOffer = async (
  offerId: string,
  payload: UpdateExchangeOfferPayload
): Promise<ExchangeOffer> => {
  return apiClient<ExchangeOffer>(`${API_BASE_PATH}/${offerId}`, {
    method: "PATCH", // Or PUT, depending on API design for updates
    body: payload,
    authenticated: true,
  });
};

/**
 * Deletes an exchange offer.
 * Requires authentication and user must be the owner.
 */
export const deleteExchangeOffer = async (
  offerId: string
): Promise<void> => {
  return apiClient<void>(`${API_BASE_PATH}/${offerId}`, {
    method: "DELETE",
    authenticated: true,
  });
};

/**
 * Fetches all exchange offers created by the currently authenticated user.
 * Requires authentication.
 */
export const getMyExchangeOffers = async (): Promise<ExchangeOffer[]> => {
  // Assuming endpoint like '/users/me/exchange_offers' or a filter on the main collection
  // For this example, let's use a dedicated endpoint as it's common.
  return apiClient<ExchangeOffer[]>("/users/me/exchange_offers", {
    method: "GET",
    authenticated: true,
  });
};
