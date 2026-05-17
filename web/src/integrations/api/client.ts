// Locci Box API Client
// Replaces Supabase with our Express backend

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  retry_after?: number;
}

export interface SandboxExecutionParams {
  language: "python" | "node" | "bash" | "ruby";
  code: string;
  timeout?: number;
  cpu?: number;
  memory?: number;
  env?: Record<string, string>;
}

export interface SandboxResult {
  sandbox_id: string;
  status: "running" | "completed" | "failed" | "timeout";
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  created_at: string;
  completed_at: string;
}

export interface SandboxInfo {
  sandbox_id: string;
  tenant_id: string;
  language: string;
  status: "running" | "completed" | "failed" | "timeout";
  created_at: string;
  uptime_ms?: number;
}

export interface MetricsData {
  system: {
    total_sandboxes: number;
    active_sandboxes: number;
    total_executions: number;
  };
  tenants: Record<
    string,
    {
      active_sandboxes: number;
      total_executions: number;
    }
  >;
}

class LocciBoxAPIClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    // Use import.meta.env for client-side (Vite build-time replacement)
    // Fall back to process.env for SSR (server-side rendering)
    this.baseUrl = import.meta.env.VITE_API_URL || process.env.API_URL || "http://localhost:5757";

    // Try to get API key from localStorage (set by auth), fallback to env
    const storedApiKey =
      typeof window !== "undefined" ? localStorage.getItem("locci_api_key") : null;
    this.apiKey = storedApiKey || import.meta.env.VITE_API_KEY || process.env.API_KEY || "";

    if (!this.apiKey) {
      console.warn(
        "[API] No API key configured. Please login or set VITE_API_KEY environment variable.",
      );
    }
  }

  // Update API key (called after login)
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      ...(options.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = (await response.json()) as ApiResponse<T>;

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error("[API] Request failed:", error);
      throw error;
    }
  }

  // Sandbox operations
  async runSandbox(params: SandboxExecutionParams): Promise<SandboxResult> {
    const response = await this.request<SandboxResult>("/api/sandbox/run", {
      method: "POST",
      body: JSON.stringify(params),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to run sandbox");
    }

    return response.data;
  }

  async getSandboxStatus(sandboxId: string): Promise<SandboxInfo> {
    const response = await this.request<SandboxInfo>(`/api/sandbox/${sandboxId}/status`);

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get sandbox status");
    }

    return response.data;
  }

  async stopSandbox(sandboxId: string): Promise<void> {
    const response = await this.request(`/api/sandbox/${sandboxId}`, {
      method: "DELETE",
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to stop sandbox");
    }
  }

  async getMetrics(): Promise<MetricsData> {
    const response = await this.request<MetricsData>("/api/metrics");

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get metrics");
    }

    return response.data;
  }

  async healthCheck(): Promise<{ status: string; timestamp: string; uptime: number }> {
    const response = await this.request<{ status: string; timestamp: string; uptime: number }>(
      "/health",
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || "Health check failed");
    }

    return response.data;
  }
}

let _apiClient: LocciBoxAPIClient | undefined;

// Export singleton instance with lazy initialization
export const apiClient = new Proxy({} as LocciBoxAPIClient, {
  get(_, prop, receiver) {
    if (!_apiClient) _apiClient = new LocciBoxAPIClient();
    return Reflect.get(_apiClient, prop, receiver);
  },
});

// Export types
export type { LocciBoxAPIClient };

// Made with Bob
