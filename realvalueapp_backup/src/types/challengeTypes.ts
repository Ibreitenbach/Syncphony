// frontend/src/types/challengeTypes.ts

// Mirrored from backend ChallengeType enum
export enum ChallengeType {
  TEXT_RESPONSE = "text_response",
  PHOTO_UPLOAD = "photo_upload",
  CHECKBOX_COMPLETION = "checkbox_completion",
}

// Mirrored from backend DifficultyLevel enum
export enum DifficultyLevel {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

// Mirrored from backend CompletionStatus enum
export enum CompletionStatus {
  PENDING_REVIEW = "pending_review",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface PracticeChallengeTemplate {
  id: number;
  title: string;
  description: string;
  associated_skill_id: number | null; // Assuming skill ID is a number if present
  challenge_type: ChallengeType;
  difficulty: DifficultyLevel;
  is_active: boolean;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface UserChallengeCompletion {
  id: number;
  user_id: number; // Assuming user ID is stored/needed on frontend
  challenge_template_id: number;
  challenge_title?: string; // Optional: from to_dict on backend, useful for display
  completed_at: string | null; // ISO date string or null
  user_response: string | null;
  status: CompletionStatus;
}

// For submitting a challenge completion
export interface ChallengeCompletionSubmission {
  challenge_template_id: number;
  user_response?: string; // Optional, depends on challenge type
  // status will be set by backend or defaults there
}
