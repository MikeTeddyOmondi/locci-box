import type { UIMessage } from "ai";

export type BobThread = { id: string; title: string; updatedAt: string };

const apiBase = () => import.meta.env.VITE_API_URL ?? "http://localhost:5757";

function authHeader(): Record<string, string> {
  try {
    const token = localStorage.getItem("locci_jwt");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/api/bob${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`BOB API error: ${res.status}`);
  const json = await res.json();
  return json.data as T;
}

export async function listThreads(): Promise<BobThread[]> {
  return apiFetch<BobThread[]>("/threads");
}

export async function createThread(title = "New review"): Promise<BobThread> {
  return apiFetch<BobThread>("/threads", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function renameThread(id: string, title: string): Promise<void> {
  await apiFetch(`/threads/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteThread(id: string): Promise<void> {
  await apiFetch(`/threads/${id}`, { method: "DELETE" });
}

export async function getThreadMessages(threadId: string): Promise<UIMessage[]> {
  return apiFetch<UIMessage[]>(`/threads/${threadId}/messages`);
}
