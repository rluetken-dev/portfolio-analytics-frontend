// src/services/api/userBalance.ts
import { getAccessToken } from "../../utils/token";

export interface BalanceResponse {
  username: string;
  newBalance: number;
}

export async function deposit(amount: number): Promise<BalanceResponse> {
  const token = getAccessToken();
  if (!token) throw new Error("No access token available");

  const res = await fetch("/api/User/deposit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: JSON.stringify(amount),
  });

  if (!res.ok) throw new Error(`Deposit failed: ${res.status}`);
  return res.json();
}

export async function withdraw(amount: number): Promise<BalanceResponse> {
  const token = getAccessToken();
  if (!token) throw new Error("No access token available");

  const res = await fetch("/api/User/withdraw", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: JSON.stringify(amount),
  });

  if (!res.ok) throw new Error(`Withdraw failed: ${res.status}`);
  return res.json();
}
