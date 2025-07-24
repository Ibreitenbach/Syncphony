// frontend/src/types/exchangeTypes.ts

// Basic Skill structure - might be imported from a dedicated skillTypes.ts if available
export interface Skill {
  id: string; // Or number
  name: string;
  // category?: string;
  // description?: string;
}

// User making the offer - simplified, might come from AuthUser or a more detailed User type
export interface ExchangeOfferUser {
  id: string;
  display_name: string;
  // avatar_url?: string;
}

// Structure for an Exchange Offer
export interface ExchangeOffer {
  id: string; // Or number, depending on backend
  user_id: string;
  user?: ExchangeOfferUser; // Optional: populated user details for display
  offered_skill_id: string;
  offered_skill?: Skill; // Optional: populated skill details
  desired_skill_id?: string | null;
  desired_skill?: Skill | null; // Optional: populated skill details
  desired_description: string; // Detailed text if specific skill not chosen or to add context
  description: string; // General description of the offer, terms, availability etc.
  is_active: boolean; // Whether the offer is currently active and visible on the board
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Payload for creating a new Exchange Offer
export interface CreateExchangeOfferPayload {
  offered_skill_id: string;
  desired_skill_id?: string | null;
  desired_description: string;
  description: string;
  // is_active is typically true by default on creation, or set by backend
}

// Payload for updating an existing Exchange Offer
// All fields are optional for partial updates.
export interface UpdateExchangeOfferPayload {
  offered_skill_id?: string;
  desired_skill_id?: string | null;
  desired_description?: string;
  description?: string;
  is_active?: boolean; // To deactivate or reactivate an offer
}

// Filters for fetching exchange offers
export interface ExchangeOfferFilters {
  offered_skill_id?: string;
  desired_skill_id?: string;
  search_text?: string; // To search in description and desired_description
  user_id?: string; // To fetch offers by a specific user (not for "my offers")
  is_active?: boolean; // Typically true for the public board
}
