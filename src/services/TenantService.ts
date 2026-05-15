import { nanoid } from "nanoid";
import { Tenant, UsageStats } from "../types";
import { logger } from "../utils/logger";
import { env } from "../config/env";

/**
 * TenantService manages multi-tenancy, usage tracking, and quota enforcement.
 * Uses in-memory storage for now with TODO comments for production database.
 */
export class TenantService {
  // TODO: Replace with PostgreSQL/Redis in production
  private tenants: Map<string, Tenant> = new Map();
  private apiKeyIndex: Map<string, string> = new Map(); // api_key -> tenant_id
  private executionMetrics: Map<string, { total_ms: number; count: number }> =
    new Map();

  constructor() {
    // Seed with a default tenant for development
    this.createDefaultTenant();
  }

  /**
   * Create a default tenant for local development
   */
  private createDefaultTenant(): void {
    const defaultTenant: Tenant = {
      id: "tenant_default",
      api_key: "sk_test_default_key_12345",
      organization: "Default Organization",
      max_concurrent_sandboxes: env.DEFAULT_MAX_CONCURRENT_SANDBOXES,
      max_execution_time_seconds: env.DEFAULT_SANDBOX_TIMEOUT_SECONDS,
      rate_limit_per_minute: env.DEFAULT_RATE_LIMIT_PER_MINUTE,
      active_sandboxes: 0,
      total_executions: 0,
      created_at: new Date().toISOString(),
    };

    this.tenants.set(defaultTenant.id, defaultTenant);
    this.apiKeyIndex.set(defaultTenant.api_key, defaultTenant.id);

    logger.info(
      { tenant_id: defaultTenant.id },
      "Default tenant created for development",
    );
  }

  /**
   * Get tenant by API key
   */
  async getByApiKey(apiKey: string): Promise<Tenant | null> {
    const tenantId = this.apiKeyIndex.get(apiKey);
    if (!tenantId) {
      return null;
    }
    return this.tenants.get(tenantId) || null;
  }

  /**
   * Get tenant by ID
   */
  async getById(tenantId: string): Promise<Tenant | null> {
    return this.tenants.get(tenantId) || null;
  }

  /**
   * Create a new tenant
   */
  async create(organization: string): Promise<Tenant> {
    const tenant: Tenant = {
      id: `tenant_${nanoid(12)}`,
      api_key: `sk_live_${nanoid(32)}`,
      organization,
      max_concurrent_sandboxes: env.DEFAULT_MAX_CONCURRENT_SANDBOXES,
      max_execution_time_seconds: env.DEFAULT_SANDBOX_TIMEOUT_SECONDS,
      rate_limit_per_minute: env.DEFAULT_RATE_LIMIT_PER_MINUTE,
      active_sandboxes: 0,
      total_executions: 0,
      created_at: new Date().toISOString(),
    };

    this.tenants.set(tenant.id, tenant);
    this.apiKeyIndex.set(tenant.api_key, tenant.id);

    logger.info({ tenant_id: tenant.id, organization }, "New tenant created");

    return tenant;
  }

  /**
   * Check if tenant can create a new sandbox
   */
  async canCreateSandbox(tenantId: string): Promise<boolean> {
    const tenant = await this.getById(tenantId);
    if (!tenant) {
      return false;
    }
    return tenant.active_sandboxes < tenant.max_concurrent_sandboxes;
  }

  /**
   * Increment active sandbox count
   */
  async incrementActive(tenantId: string): Promise<void> {
    const tenant = await this.getById(tenantId);
    if (tenant) {
      tenant.active_sandboxes++;
      logger.debug(
        { tenant_id: tenantId, active: tenant.active_sandboxes },
        "Incremented active sandboxes",
      );
    }
  }

  /**
   * Decrement active sandbox count
   */
  async decrementActive(tenantId: string): Promise<void> {
    const tenant = await this.getById(tenantId);
    if (tenant && tenant.active_sandboxes > 0) {
      tenant.active_sandboxes--;
      logger.debug(
        { tenant_id: tenantId, active: tenant.active_sandboxes },
        "Decremented active sandboxes",
      );
    }
  }

  /**
   * Record a sandbox execution
   */
  async recordExecution(tenantId: string, durationMs: number): Promise<void> {
    const tenant = await this.getById(tenantId);
    if (tenant) {
      tenant.total_executions++;

      // Track metrics for average calculation
      const metrics = this.executionMetrics.get(tenantId) || {
        total_ms: 0,
        count: 0,
      };
      metrics.total_ms += durationMs;
      metrics.count++;
      this.executionMetrics.set(tenantId, metrics);

      logger.debug(
        { tenant_id: tenantId, duration_ms: durationMs },
        "Recorded execution",
      );
    }
  }

  /**
   * Get usage statistics for a tenant
   */
  async getUsageStats(tenantId: string): Promise<UsageStats | null> {
    const tenant = await this.getById(tenantId);
    if (!tenant) {
      return null;
    }

    const metrics = this.executionMetrics.get(tenantId) || {
      total_ms: 0,
      count: 0,
    };
    const avgExecutionMs =
      metrics.count > 0 ? Math.round(metrics.total_ms / metrics.count) : 0;

    return {
      tenant_id: tenant.id,
      organization: tenant.organization,
      total_runs: tenant.total_executions,
      active_sandboxes: tenant.active_sandboxes,
      avg_execution_ms: avgExecutionMs,
      last_activity: new Date().toISOString(),
    };
  }

  /**
   * Get all tenants (for admin metrics)
   */
  async getAllTenants(): Promise<Tenant[]> {
    return Array.from(this.tenants.values());
  }

  /**
   * Get usage stats for all tenants (for admin metrics)
   */
  async getAllUsageStats(): Promise<UsageStats[]> {
    const stats: UsageStats[] = [];
    for (const tenant of this.tenants.values()) {
      const tenantStats = await this.getUsageStats(tenant.id);
      if (tenantStats) {
        stats.push(tenantStats);
      }
    }
    return stats;
  }
}

// Singleton instance
export const tenantService = new TenantService();

// Made with Bob
