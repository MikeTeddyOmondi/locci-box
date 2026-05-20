import type { UIMessage } from "ai";

export type BobThread = { id: string; title: string; updatedAt: string };

const THREADS_KEY = "bob_threads";
const threadKey = (id: string) => `bob_msg_${id}`;

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function listThreads(): BobThread[] {
  return load<BobThread[]>(THREADS_KEY, []);
}

export function createThread(title = "New review"): BobThread {
  const thread: BobThread = {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(THREADS_KEY, JSON.stringify([thread, ...listThreads()]));
  return thread;
}

export function renameThread(id: string, title: string): void {
  const threads = listThreads().map((t) =>
    t.id === id ? { ...t, title, updatedAt: new Date().toISOString() } : t,
  );
  localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
}

export function deleteThread(id: string): void {
  localStorage.setItem(
    THREADS_KEY,
    JSON.stringify(listThreads().filter((t) => t.id !== id)),
  );
  localStorage.removeItem(threadKey(id));
}

export function getThreadMessages(threadId: string): UIMessage[] {
  return load<UIMessage[]>(threadKey(threadId), []);
}

export function saveThreadMessages(threadId: string, messages: UIMessage[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(threadKey(threadId), JSON.stringify(messages));
  }
}
