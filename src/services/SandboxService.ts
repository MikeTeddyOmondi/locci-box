import { nanoid } from "nanoid";
import {
  SandboxExecutionParams,
  SandboxResult,
  SandboxInfo,
  SandboxStatus,
} from "../types";
import { logger } from "../utils/logger";

/**
 * SandboxService wraps the microsandbox SDK with error handling,
 * logging, and resource management.
 */
export class SandboxService {
  // Track active sandboxes
  private activeSandboxes: Map<string, SandboxInfo> = new Map();

  /**
   * Execute code in a new microVM
   */
  async execute(
    params: SandboxExecutionParams,
    tenantId: string,
  ): Promise<SandboxResult> {
    const sandboxId = `sbox_${nanoid(12)}`;
    const startTime = Date.now();

    logger.info(
      {
        sandbox_id: sandboxId,
        tenant_id: tenantId,
        language: params.language,
        timeout: params.timeout || 30,
      },
      "Creating sandbox",
    );

    // Track sandbox info
    const sandboxInfo: SandboxInfo = {
      sandbox_id: sandboxId,
      tenant_id: tenantId,
      language: params.language,
      status: "running",
      created_at: new Date().toISOString(),
    };
    this.activeSandboxes.set(sandboxId, sandboxInfo);

    try {
      // TODO: Replace with actual microsandbox SDK call
      // For now, simulate execution
      const result = await this.simulateExecution(params, sandboxId);

      const duration = Date.now() - startTime;

      logger.info(
        {
          sandbox_id: sandboxId,
          tenant_id: tenantId,
          status: result.status,
          duration_ms: duration,
          exit_code: result.exit_code,
        },
        "Sandbox execution completed",
      );

      // Remove from active sandboxes
      this.activeSandboxes.delete(sandboxId);

      return {
        ...result,
        sandbox_id: sandboxId,
        duration_ms: duration,
        created_at: sandboxInfo.created_at,
        completed_at: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        {
          sandbox_id: sandboxId,
          tenant_id: tenantId,
          error: error instanceof Error ? error.message : "Unknown error",
          duration_ms: duration,
        },
        "Sandbox execution failed",
      );

      // Remove from active sandboxes
      this.activeSandboxes.delete(sandboxId);

      return {
        sandbox_id: sandboxId,
        status: "failed",
        stdout: "",
        stderr: error instanceof Error ? error.message : "Unknown error",
        exit_code: 1,
        duration_ms: duration,
        created_at: sandboxInfo.created_at,
        completed_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Simulate sandbox execution (replace with actual microsandbox SDK)
   * TODO: Integrate real microsandbox SDK
   */
  private async simulateExecution(
    params: SandboxExecutionParams,
    sandboxId: string,
  ): Promise<
    Omit<
      SandboxResult,
      "sandbox_id" | "duration_ms" | "created_at" | "completed_at"
    >
  > {
    // Simulate execution delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate different language outputs
    const outputs: Record<string, string> = {
      python: "Hello from Python microVM!\n",
      node: "Hello from Node.js microVM!\n",
      bash: "Hello from Bash microVM!\n",
      ruby: "Hello from Ruby microVM!\n",
    };

    return {
      status: "completed",
      stdout: outputs[params.language] || "Execution completed\n",
      stderr: "",
      exit_code: 0,
    };
  }

  /**
   * Get status of a running sandbox
   */
  async getStatus(sandboxId: string): Promise<SandboxInfo | null> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      return null;
    }

    // Calculate uptime
    const createdAt = new Date(sandbox.created_at).getTime();
    const uptime = Date.now() - createdAt;

    return {
      ...sandbox,
      uptime_ms: uptime,
    };
  }

  /**
   * Stop a running sandbox
   */
  async stop(sandboxId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error("Sandbox not found or already stopped");
    }

    logger.info({ sandbox_id: sandboxId }, "Stopping sandbox");

    // TODO: Call microsandbox SDK to stop the VM
    this.activeSandboxes.delete(sandboxId);

    logger.info({ sandbox_id: sandboxId }, "Sandbox stopped");
  }

  /**
   * List all active sandboxes for a tenant
   */
  async listActive(tenantId: string): Promise<SandboxInfo[]> {
    const sandboxes: SandboxInfo[] = [];
    for (const sandbox of this.activeSandboxes.values()) {
      if (sandbox.tenant_id === tenantId) {
        sandboxes.push(sandbox);
      }
    }
    return sandboxes;
  }

  /**
   * Clean up stale sandboxes (called by cron or manually)
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [sandboxId, sandbox] of this.activeSandboxes.entries()) {
      const createdAt = new Date(sandbox.created_at).getTime();
      if (now - createdAt > maxAge) {
        logger.warn({ sandbox_id: sandboxId }, "Cleaning up stale sandbox");
        this.activeSandboxes.delete(sandboxId);
      }
    }
  }
}

// Singleton instance
export const sandboxService = new SandboxService();

// Made with Bob
