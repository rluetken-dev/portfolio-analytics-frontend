// src/hooks/useUserCompanies.ts
import { useEffect, useState } from "react";
import type { UserCompany } from "../services/api/user/companies";
import { getUserCompanies, deleteUserCompany } from "../services/api/user/companies";

/**
 * Represents the shape of an API error object, matching the backend ProblemDetails format.
 */
interface ApiError {
  title?: string;
  detail?: string;
  message?: string;
  status?: number;
  traceId?: string;
}

/**
 * Custom React hook to manage the user's company list.
 * Handles data fetching, error handling, and local state updates.
 */
export function useUserCompanies() {
  const [companies, setCompanies] = useState<UserCompany[]>([]); // ✅
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all user-linked companies from the API.
   * Automatically uses the stored access token via fetchJson.
   */
  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const data = await getUserCompanies();
      setCompanies(data);
      setError(null);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail ?? apiError.message ?? "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Delete a company both in the backend and local state.
   * Removes the item locally only if the API call succeeds.
   */
  async function removeCompany(id: number): Promise<void> {
    try {
      await deleteUserCompany(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail ?? apiError.message ?? "Failed to delete company");
    }
  }

  /**
   * Load the user's companies on the first render.
   */
  useEffect(() => {
    void refresh();
  }, []);

  return { companies, loading, error, refresh, removeCompany };
}
