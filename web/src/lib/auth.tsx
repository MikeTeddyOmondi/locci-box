import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  org: string;
  isDemo?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5757"}/api`;

async function apiAuth(path: string, body: object): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Request failed");
  }
  return json.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("locci_jwt");
    const storedUser = localStorage.getItem("locci_user");
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem("locci_jwt");
        localStorage.removeItem("locci_user");
      }
    }
  }, []);

  function persist(t: string, u: User) {
    localStorage.setItem("locci_jwt", t);
    localStorage.setItem("locci_user", JSON.stringify(u));
    setToken(t);
    setUser(u);
    setIsAuthenticated(true);
  }

  const login = async (email: string, password: string) => {
    const { token: t, user: u } = await apiAuth("login", { email, password });
    persist(t, u);
  };

  const register = async (email: string, password: string) => {
    const { token: t, user: u } = await apiAuth("register", { email, password });
    persist(t, u);
  };

  const loginDemo = async () => {
    const { token: t, user: u } = await apiAuth("login", {
      email: "box@locci.cloud",
      password: "demo1234",
    });
    persist(t, { ...u, isDemo: true });
  };

  const logout = async () => {
    const storedToken = localStorage.getItem("locci_jwt");
    if (storedToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${storedToken}` },
        });
      } catch {
        // Best-effort — always clear locally even if the request fails
      }
    }
    localStorage.removeItem("locci_jwt");
    localStorage.removeItem("locci_user");
    // Legacy keys
    localStorage.removeItem("locci_email");
    localStorage.removeItem("locci_api_key");
    localStorage.removeItem("locci_is_demo");
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, login, register, loginDemo, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Legacy compat
export type Session = { user: { email: string } };
