import { useCallback, useEffect, useState } from "react";

import {
  deleteUserCompany,
  getUserCompanies,
  type UserCompany,
} from "../services/api/user/companies";

interface ApiError {
  detail?: string;
  message?: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const apiError = error as ApiError;
  return apiError.detail ?? apiError.message ?? fallback;
}

export function useUserCompanies() {
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getUserCompanies();
      setCompanies(data);
      setError(null);
    } catch (error) {
      setError(getErrorMessage(error, "Failed to load companies."));
    } finally {
      setLoading(false);
    }
  }, []);

  const removeCompany = useCallback(async (id: number) => {
    try {
      await deleteUserCompany(id);
      setCompanies((previous) => previous.filter((company) => company.id !== id));
      setError(null);
    } catch (error) {
      setError(getErrorMessage(error, "Failed to delete company."));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { companies, loading, error, refresh, removeCompany };
}