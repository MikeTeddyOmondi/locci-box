import type {
  RunParams,
  SandboxResult,
  SandboxInfo,
  MetricsData,
  ApiResponse,
  ApiKey,
} from "../types/index.js";

/**
 * Locci Box API Client
 */
export class LocciBoxAPI {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {
    // Remove trailing slash from baseUrl
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Run code in a sandbox
   */
  async runSandbox(params: RunParams): Promise<SandboxResult> {
    const response = await this.request<SandboxResult>("/api/sandbox/run", {
      method: "POST",
      body: JSON.stringify(params),
    });

    return response;
  }

  /**
   * Get sandbox status
   */
  async getSandboxStatus(sandboxId: string): Promise<SandboxInfo> {
    const response = await this.request<SandboxInfo>(
      `/api/sandbox/${sandboxId}/status`,
    );

    return response;
  }

  /**
   * Stop a sandbox
   */
  async stopSandbox(sandboxId: string): Promise<void> {
    await this.request(`/api/sandbox/${sandboxId}`, {
      method: "DELETE",
    });
  }

  /**
   * Get metrics (requires admin key)
   */
  async getMetrics(): Promise<MetricsData> {
    return await this.request<MetricsData>("/api/metrics");
  }

  /**
   * Log in with email + password, returns JWT token
   */
  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: { id: string; email: string; role: string } }> {
    const url = `${this.baseUrl}/api/auth/login`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json()) as ApiResponse<{
      token: string;
      user: { id: string; email: string; role: string };
    }>;
    if (!response.ok || !data.success || !data.data) {
      throw new Error(data.error || "Login failed");
    }
    return data.data;
  }

  /** List API keys (requires JWT) */
  async listKeys(jwtToken: string): Promise<ApiKey[]> {
    return this.request<ApiKey[]>("/api/keys", {}, jwtToken);
  }

  /** Create a new API key (requires JWT) — returns the full key once */
  async createKey(name: string, jwtToken: string): Promise<ApiKey> {
    return this.request<ApiKey>("/api/keys", { method: "POST", body: JSON.stringify({ name }) }, jwtToken);
  }

  /** Revoke an API key (requires JWT) */
  async revokeKey(id: string, jwtToken: string): Promise<void> {
    await this.request<void>(`/api/keys/${id}/revoke`, { method: "PATCH" }, jwtToken);
  }

  /** Delete an API key permanently (requires JWT) */
  async deleteKey(id: string, jwtToken: string): Promise<void> {
    await this.request<void>(`/api/keys/${id}`, { method: "DELETE" }, jwtToken);
  }

  /**
   * Test connection to the API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Make an HTTP request to the API.
   * Pass `overrideAuth` to use a JWT token instead of the configured API key.
   */
  private async request<T>(
    path: string,
    options: RequestInit = {},
    overrideAuth?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${overrideAuth ?? this.apiKey}`,
      ...(options.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = (await response.json()) as ApiResponse<T>;

      if (!response.ok) {
        this.handleError(response.status, data);
      }

      if (!data.success) {
        throw new Error(data.error || "Unknown error occurred");
      }

      return data.data as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error: Unable to connect to Locci Box API");
    }
  }

  /**
   * Handle API errors
   */
  private handleError(status: number, data: ApiResponse): never {
    switch (status) {
      case 400:
        throw new Error(data.error || "Bad request");
      case 401:
        throw new Error("Authentication failed. Please check your API key.");
      case 403:
        throw new Error("Access forbidden. You don't have permission.");
      case 404:
        throw new Error(data.error || "Resource not found");
      case 429:
        const retryAfter = data.retry_after
          ? ` Try again in ${data.retry_after} seconds.`
          : "";
        throw new Error(`Rate limit exceeded.${retryAfter}`);
      case 503:
        throw new Error(
          data.error ||
            "Service unavailable. Maximum concurrent sandboxes reached.",
        );
      case 500:
      default:
        throw new Error(data.error || "Internal server error");
    }
  }
}

/**
 * Create an API client from a profile
 */
export function createAPIClient(apiUrl: string, apiKey: string): LocciBoxAPI {
  return new LocciBoxAPI(apiUrl, apiKey);
}

// Made with Bob
