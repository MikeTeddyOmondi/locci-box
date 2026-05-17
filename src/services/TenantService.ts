import { nanoid } from "nanoid";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { tenants, sandboxRuns } from "../db/schema.js";
import { Tenant, UsageStats } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export interface RecentRun {
  sandbox_id: string;
  language: string;
  status: string;
  exit_code: number;
  duration_ms: number;
  created_at: string;
}

function toTenant(row: typeof tenants.$inferSelect): Tenant {
  return {
    id: row.id,
    api_key: row.apiKey,
    organization: row.organization,
    max_concurrent_sandboxes: row.maxConcurrentSandboxes,
    max_execution_time_seconds: row.maxExecutionTimeSeconds,
    rate_limit_per_minute: row.rateLimitPerMinute,
    active_sandboxes: row.activeSandboxes,
    total_executions: row.totalExecutions,
    created_at: row.createdAt,
  };
}

export class TenantService {
  async getByApiKey(apiKey: string): Promise<Tenant | null> {
    const [row] = await db.select().from(tenants).where(eq(tenants.apiKey, apiKey));
    return row ? toTenant(row) : null;
  }

  async getById(tenantId: string): Promise<Tenant | null> {
    const [row] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    return row ? toTenant(row) : null;
  }

  async create(organization: string): Promise<Tenant> {
    const [row] = await db
      .insert(tenants)
      .values({
        id: `tenant_${nanoid(12)}`,
        apiKey: `sk_live_${nanoid(32)}`,
        organization,
        maxConcurrentSandboxes: env.DEFAULT_MAX_CONCURRENT_SANDBOXES,
        maxExecutionTimeSeconds: env.DEFAULT_SANDBOX_TIMEOUT_SECONDS,
        rateLimitPerMinute: env.DEFAULT_RATE_LIMIT_PER_MINUTE,
        activeSandboxes: 0,
        totalExecutions: 0,
        createdAt: new Date().toISOString(),
      })
      .returning();
    logger.info({ tenant_id: row.id, organization }, "New tenant created");
    return toTenant(row);
  }

  async canCreateSandbox(tenantId: string): Promise<boolean> {
    const tenant = await this.getById(tenantId);
    if (!tenant) return false;
    return tenant.active_sandboxes < tenant.max_concurrent_sandboxes;
  }

  async incrementActive(tenantId: string): Promise<void> {
    await db
      .update(tenants)
      .set({ activeSandboxes: sql`${tenants.activeSandboxes} + 1` })
      .where(eq(tenants.id, tenantId));
  }

  async decrementActive(tenantId: string): Promise<void> {
    await db
      .update(tenants)
      .set({ activeSandboxes: sql`GREATEST(0, ${tenants.activeSandboxes} - 1)` })
      .where(eq(tenants.id, tenantId));
  }

  async recordExecution(
    tenantId: string,
    durationMs: number,
    opts?: {
      sandboxId?: string;
      language?: string;
      status?: "completed" | "failed" | "timeout";
      exitCode?: number;
    },
  ): Promise<void> {
    await db
      .update(tenants)
      .set({ totalExecutions: sql`${tenants.totalExecutions} + 1` })
      .where(eq(tenants.id, tenantId));

    if (opts?.sandboxId) {
      await db.insert(sandboxRuns).values({
        id: opts.sandboxId,
        tenantId,
        language: opts.language ?? "unknown",
        status: opts.status ?? "completed",
        exitCode: opts.exitCode ?? 0,
        durationMs,
        createdAt: new Date().toISOString(),
      });
    }

    logger.debug({ tenant_id: tenantId, duration_ms: durationMs }, "Recorded execution");
  }

  async getUsageStats(tenantId: string): Promise<UsageStats | null> {
    const tenant = await this.getById(tenantId);
    if (!tenant) return null;

    const runs = await db
      .select()
      .from(sandboxRuns)
      .where(eq(sandboxRuns.tenantId, tenantId));

    const count = runs.length;
    const totalMs = runs.reduce((s, r) => s + r.durationMs, 0);
    const avgExecutionMs = count > 0 ? Math.round(totalMs / count) : 0;

    return {
      tenant_id: tenant.id,
      organization: tenant.organization,
      total_runs: tenant.total_executions,
      active_sandboxes: tenant.active_sandboxes,
      avg_execution_ms: avgExecutionMs,
      last_activity: runs[0]?.createdAt ?? tenant.created_at,
    };
  }

  async getRecentRuns(tenantId: string, limit = 20): Promise<RecentRun[]> {
    const rows = await db
      .select()
      .from(sandboxRuns)
      .where(eq(sandboxRuns.tenantId, tenantId))
      .orderBy(sql`created_at DESC`)
      .limit(limit);

    return rows.map((r) => ({
      sandbox_id: r.id,
      language: r.language,
      status: r.status,
      exit_code: r.exitCode,
      duration_ms: r.durationMs,
      created_at: r.createdAt,
    }));
  }

  async getDailyRuns(tenantId: string, days = 7): Promise<{ day: string; runs: number }[]> {
    const rows = await db
      .select()
      .from(sandboxRuns)
      .where(eq(sandboxRuns.tenantId, tenantId));

    const now = new Date();
    const result: { day: string; runs: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
      const count = rows.filter((r) => r.createdAt.startsWith(dateStr)).length;
      result.push({ day: dayLabel, runs: count });
    }

    return result;
  }

  async getSuccessRuns(tenantId: string): Promise<number> {
    const rows = await db
      .select()
      .from(sandboxRuns)
      .where(sql`tenant_id = ${tenantId} AND status = 'completed'`);
    return rows.length;
  }

  async getAllTenants(): Promise<Tenant[]> {
    const rows = await db.select().from(tenants);
    return rows.map(toTenant);
  }

  async getAllUsageStats(): Promise<UsageStats[]> {
    const all = await this.getAllTenants();
    const stats: UsageStats[] = [];
    for (const t of all) {
      const s = await this.getUsageStats(t.id);
      if (s) stats.push(s);
    }
    return stats;
  }
}

export const tenantService = new TenantService();
