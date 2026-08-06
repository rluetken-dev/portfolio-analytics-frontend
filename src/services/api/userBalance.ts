import { fetchJson } from "./client";

export interface BalanceResponse {
  username: string;
  newBalance: number;
}

function validateAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number.");
  }
}

export async function deposit(amount: number): Promise<BalanceResponse> {
  validateAmount(amount);

  return fetchJson<BalanceResponse, number>({
    method: "POST",
    path: "/api/User/deposit",
    body: amount,
  });
}

export async function withdraw(amount: number): Promise<BalanceResponse> {
  validateAmount(amount);

  return fetchJson<BalanceResponse, number>({
    method: "POST",
    path: "/api/User/withdraw",
    body: amount,
  });
}