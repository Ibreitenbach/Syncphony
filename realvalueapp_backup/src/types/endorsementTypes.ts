// frontend/src/types/endorsementTypes.ts

// Enum for the different types of endorsements
export enum EndorsementType {
  GENERAL = 'general',
  SKILL_RELATED = 'skill_related',
  FAVOR_FEEDBACK = 'favor_feedback',
}

// Interface for the Endorsement object received from the API
export interface Endorsement {
  id: string; // Or number, depending on backend
  endorser_id: string; // User ID of the person giving the endorsement
  endorsee_id: string; // User ID of the person receiving the endorsement
  endorsement_type: EndorsementType;
  skill_id?: string | null; // Optional: ID of the skill, if type is 'skill_related'
  skill_name?: string | null; // Optional: Name of the skill, for display purposes
  comment?: string | null;
  created_at: string; // ISO date string
  endorser_display_name?: string; // Optional: For displaying who gave the endorsement
  endorsee_display_name?: string; // Optional: For displaying who received it (less common here)
}

// Interface for the payload when giving a new endorsement
export interface GiveEndorsementPayload {
  endorsee_id: string;
  endorsement_type: EndorsementType;
  skill_id?: string | null;
  comment?: string | null;
}

// Example of a user object that might be associated with an endorsement
// This is a simplified version. You might have a more detailed User type.
export interface EndorsementUserReference {
  user_id: string;
  display_name: string;
  // avatar_url?: string;
}

// If endorsements are displayed with more complete user info:
export interface EndorsementWithUser extends Endorsement {
  endorser_profile?: EndorsementUserReference; // Details of the user who gave the endorsement
  // endorsee_profile?: EndorsementUserReference; // Details of the user who received (often the context)
}
