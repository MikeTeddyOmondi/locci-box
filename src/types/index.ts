// Supported programming languages
export type SupportedLanguage = "python" | "node" | "bash" | "ruby";

// Sandbox execution status
export type SandboxStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "timeout";

// Sandbox execution parameters
export interface SandboxExecutionParams {
  language: SupportedLanguage;
  code: string;
  timeout?: number;
  memory?: number;
  cpu?: number;
  env?: Record<string, string>;
}

// Sandbox execution result
export interface SandboxResult {
  sandbox_id: string;
  status: SandboxStatus;
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  created_at: string;
  completed_at?: string;
}

// Sandbox info for status checks
export interface SandboxInfo {
  sandbox_id: string;
  tenant_id: string;
  language: SupportedLanguage;
  status: SandboxStatus;
  uptime_ms?: number;
  created_at: string;
}

// Tenant configuration
export interface Tenant {
  id: string;
  api_key: string;
  organization: string;
  max_concurrent_sandboxes: number;
  max_execution_time_seconds: number;
  rate_limit_per_minute: number;
  active_sandboxes: number;
  total_executions: number;
  created_at: string;
}

// Tenant usage statistics
export interface UsageStats {
  tenant_id: string;
  organization: string;
  total_runs: number;
  active_sandboxes: number;
  avg_execution_ms: number;
  last_activity: string;
}

// API request types
export interface RunSandboxRequest {
  language: SupportedLanguage;
  code: string;
  timeout?: number;
}

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Made with Bob
