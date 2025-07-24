// frontend/src/services/mindContentService.ts
import apiClient from "./apiClient";
import {
  MindContent,
  MindContentCategory,
  NewMindContentData,
  UpdateMindContentData,
} from "../types/mindContentTypes";

interface GetMindContentFilters {
  category_id?: number;
  search?: string;
  // Potentially other filters like content_type, author_name etc.
}

/**
 * Fetches all mind content categories.
 */
export const getMindContentCategories = async (): Promise<MindContentCategory[]> => {
  return apiClient<MindContentCategory[]>("/mind_content/categories", { authenticated: true });
};

/**
 * Fetches mind content items, with optional filters.
 */
export const getMindContent = async (
  filters?: GetMindContentFilters
): Promise<MindContent[]> => {
  let endpoint = "/mind_content";
  const queryParams = new URLSearchParams();

  if (filters?.category_id) {
    queryParams.append("category_id", String(filters.category_id));
  }
  if (filters?.search && filters.search.trim() !== "") {
    queryParams.append("search", filters.search.trim());
  }
  // Add other filters here if needed

  if (queryParams.toString()) {
    endpoint += `?${queryParams.toString()}`;
  }

  return apiClient<MindContent[]>(endpoint, { authenticated: true });
};

/**
 * Fetches a single mind content item by its ID.
 */
export const getMindContentById = async (id: number): Promise<MindContent> => {
  return apiClient<MindContent>(`/mind_content/${id}`, { authenticated: true });
};

/**
 * Adds a new mind content item.
 */
export const addMindContent = async (
  contentData: NewMindContentData
): Promise<MindContent> => {
  return apiClient<MindContent>("/mind_content", {
    method: "POST",
    body: contentData,
    authenticated: true,
  });
};

/**
 * Updates an existing mind content item by its ID.
 */
export const updateMindContent = async (
  id: number,
  contentData: UpdateMindContentData
): Promise<MindContent> => {
  return apiClient<MindContent>(`/mind_content/${id}`, {
    method: "PUT",
    body: contentData,
    authenticated: true,
  });
};

/**
 * Deletes a mind content item by its ID.
 */
export const deleteMindContent = async (id: number): Promise<void> => {
  // Typically a DELETE request might return 204 No Content, or the deleted object.
  // Adjust T in apiClient if a specific response structure is expected other than default.
  // For void, we expect apiClient to handle non-JSON responses gracefully (e.g., return null)
  // or for the API to return an empty JSON object {} for success.
  await apiClient<any>(`/mind_content/${id}`, { // Using <any> as response might be empty
    method: "DELETE",
    authenticated: true,
  });
  // No explicit return needed for void, promise resolves if apiClient doesn't throw.
};
