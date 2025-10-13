// src/services/api/user/companies.ts
import { fetchJson } from "../client";

// Shape of a user's company entry returned from /api/UserCompany
export interface Company {
  id: number;
  tickerId: number;
  symbol: string;
  name: string;
  shares: number | null;
  purchasePrice: number | null;
  notes?: string;
}

// Represents one company entry in a user's portfolio
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

// English: for creating a new user-company relation
export interface CreateUserCompanyRequest {
  tickerId: number;
  shares?: number;
  purchasePrice?: number;
  notes?: string;
}

// English: get all companies belonging to the logged-in user
export async function getUserCompanies(): Promise<UserCompany[]> {
  return fetchJson<UserCompany[]>({
    method: "GET",
    path: "/UserCompany",
  });
}

// English: add a company to the user's portfolio
export async function addUserCompany(data: CreateUserCompanyRequest): Promise<UserCompany> {
  return fetchJson<UserCompany, CreateUserCompanyRequest>({
    method: "POST",
    path: "/UserCompany",
    body: data,
  });
}

// English: delete a user-company relation by its ID
export async function deleteUserCompany(id: number): Promise<void> {
  await fetchJson({
    method: "DELETE",
    path: `/UserCompany/${id}`,
  });
}
