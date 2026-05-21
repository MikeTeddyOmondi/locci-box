/**
 * CLI Configuration Types
 */
export interface Config {
  default: string;
  profiles: Record<string, Profile>;
}

export interface Profile {
  apiUrl: string;
  apiKey: string;
  jwtToken?: string;
}

/**
 * Sandbox Types
 */
export type SupportedLanguage = "python" | "node" | "bash" | "ruby";

export interface RunParams {
  language: SupportedLanguage;
  code: string;
  timeout?: number;
}

export interface SandboxResult {
  sandbox_id: string;
  status: "completed" | "failed" | "timeout";
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  created_at: string;
  completed_at?: string;
}

export interface SandboxInfo {
  sandbox_id: string;
  tenant_id: string;
  language: SupportedLanguage;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
  uptime_ms?: number;
  created_at: string;
}

/**
 * Metrics Types
 */
export interface MetricsData {
  system: {
    total_tenants: number;
    total_sandboxes_today: number;
    active_sandboxes: number;
    avg_execution_ms: number;
  };
  tenants: TenantUsage[];
}

export interface TenantUsage {
  tenant_id: string;
  organization: string;
  total_runs: number;
  active_sandboxes: number;
  avg_execution_ms: number;
  last_activity: string;
}

export interface RecentRun {
  sandbox_id: string;
  language: string;
  status: string;
  exit_code: number;
  duration_ms: number;
  created_at: string;
}

export interface StatsData {
  tenant_id: string;
  organization: string;
  total_runs: number;
  active_sandboxes: number;
  avg_execution_ms: number;
  success_runs: number;
  recent_runs: RecentRun[];
  last_activity: string;
}

/**
 * API Response Types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  retry_after?: number;
}

/**
 * API Key Types (for future implementation)
 */
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt?: string | null;
  status: "active" | "revoked";
}

// Made with Bob
