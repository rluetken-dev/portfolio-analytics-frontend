import { fetchJson } from "../client";

export interface UserCompany {
  id: number;
  tickerId: number;
  symbol: string;
  name: string;
  sector?: string | null;
  shares?: number | null;
  purchasePrice?: number | null;
  notes?: string | null;
}

export interface CreateUserCompanyRequest {
  tickerId?: number | null;
  symbol: string;
  shares?: number;
  purchasePrice?: number;
  notes?: string;
}

export async function getUserCompanies(): Promise<UserCompany[]> {
  return fetchJson<UserCompany[]>({
    method: "GET",
    path: "/api/UserCompany",
  });
}

export async function addUserCompany(data: CreateUserCompanyRequest): Promise<UserCompany> {
  return fetchJson<UserCompany, CreateUserCompanyRequest>({
    method: "POST",
    path: "/api/UserCompany",
    body: data,
  });
}

export async function deleteUserCompany(id: number): Promise<void> {
  await fetchJson<void>({
    method: "DELETE",
    path: `/api/UserCompany/${id}`,
  });
}