import { nanoid } from "nanoid";
import { Sandbox } from "microsandbox";
import {
  SandboxExecutionParams,
  SandboxResult,
  SandboxInfo,
  SandboxStatus,
} from "../types/index.js";
import { logger } from "../utils/logger.js";

/**
 * SandboxService wraps the microsandbox SDK with error handling,
 * logging, and resource management.
 */
export class SandboxService {
  // Track active sandboxes with their microsandbox instances
  private activeSandboxes: Map<
    string,
    { info: SandboxInfo; instance: Sandbox }
  > = new Map();

  /**
   * Get image name for each language runtime
   */
  private getImageName(language: string): string {
    const images: Record<string, string> = {
      python: "python:3.11-slim",
      node: "node:20-alpine",
      bash: "bash:5.2",
      ruby: "ruby:3.2-alpine",
    };
    return images[language] || "python:3.11-slim";
  }

  /**
   * Get the execution command and arguments for each language
   * Uses the proper interpreter with -c or -e flags
   */
  private getExecutionCommand(
    language: string,
    code: string,
  ): { cmd: string; args: string[] } {
    switch (language) {
      case "python":
        return { cmd: "python3", args: ["-c", code] };
      case "node":
        return { cmd: "node", args: ["-e", code] };
      case "ruby":
        return { cmd: "ruby", args: ["-e", code] };
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Execute code in a new microVM using microsandbox SDK
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
      "Creating microsandbox",
    );

    // Create sandbox info
    const sandboxInfo: SandboxInfo = {
      sandbox_id: sandboxId,
      tenant_id: tenantId,
      language: params.language,
      status: "running",
      created_at: new Date().toISOString(),
    };

    let sandbox: Sandbox | null = null;

    try {
      // Get image for the language
      const imageName = this.getImageName(params.language);

      logger.debug(
        { sandbox_id: sandboxId, image: imageName },
        "Building microsandbox with image",
      );

      // Build and create the sandbox using the builder pattern
      // Build the sandbox
      let builder = Sandbox.builder(sandboxId)
        .image(imageName)
        .cpus(params.cpu || 1)
        .memory(params.memory || 128); // MB

      // Add environment variables if provided
      if (params.env) {
        for (const [key, value] of Object.entries(params.env)) {
          builder = builder.env(key, value);
        }
      }

      sandbox = await builder.create();

      logger.debug(
        { sandbox_id: sandboxId },
        "Microsandbox created successfully",
      );

      // Track the sandbox
      this.activeSandboxes.set(sandboxId, {
        info: sandboxInfo,
        instance: sandbox,
      });

      // Execute code using the appropriate method for each language
      logger.debug(
        { sandbox_id: sandboxId, language: params.language },
        "Executing code in microsandbox",
      );

      let result;
      if (params.language === "bash") {
        // For bash, use shell() to execute directly
        result = await sandbox.shell(params.code);
      } else {
        // For other languages, use exec() with the appropriate interpreter
        const { cmd, args } = this.getExecutionCommand(
          params.language,
          params.code,
        );
        result = await sandbox.exec(cmd, args);
      }

      const duration = Date.now() - startTime;

      // Determine status based on exit code
      let status: SandboxStatus = "completed";
      if (result.code !== 0) {
        status = "failed";
      }

      logger.info(
        {
          sandbox_id: sandboxId,
          tenant_id: tenantId,
          status,
          duration_ms: duration,
          exit_code: result.code,
        },
        "Microsandbox execution completed",
      );

      // Clean up sandbox
      await this.cleanupSandbox(sandboxId);

      return {
        sandbox_id: sandboxId,
        status,
        stdout: result.stdout(),
        stderr: result.stderr(),
        exit_code: result.code,
        duration_ms: duration,
        created_at: sandboxInfo.created_at,
        completed_at: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Determine if it's a timeout error
      const isTimeout =
        error instanceof Error &&
        (error.message.includes("timeout") ||
          error.message.includes("timed out") ||
          error.message.includes("ExecTimeoutError"));

      const status: SandboxStatus = isTimeout ? "timeout" : "failed";

      logger.error(
        {
          sandbox_id: sandboxId,
          tenant_id: tenantId,
          error: error instanceof Error ? error.message : "Unknown error",
          error_name:
            error instanceof Error ? error.constructor.name : "Unknown",
          stack: error instanceof Error ? error.stack : undefined,
          duration_ms: duration,
          status,
        },
        "Microsandbox execution failed",
      );

      // Clean up sandbox on error
      await this.cleanupSandbox(sandboxId);

      return {
        sandbox_id: sandboxId,
        status,
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
   * Get status of a running sandbox
   */
  async getStatus(sandboxId: string): Promise<SandboxInfo | null> {
    const sandboxData = this.activeSandboxes.get(sandboxId);
    if (!sandboxData) {
      return null;
    }

    // Calculate uptime
    const createdAt = new Date(sandboxData.info.created_at).getTime();
    const uptime = Date.now() - createdAt;

    return {
      ...sandboxData.info,
      uptime_ms: uptime,
    };
  }

  /**
   * Stop a running sandbox
   */
  async stop(sandboxId: string): Promise<void> {
    const sandboxData = this.activeSandboxes.get(sandboxId);
    if (!sandboxData) {
      throw new Error("Sandbox not found or already stopped");
    }

    logger.info({ sandbox_id: sandboxId }, "Stopping microsandbox");

    try {
      // Stop the microsandbox instance gracefully
      await sandboxData.instance.stop();
      logger.debug(
        { sandbox_id: sandboxId },
        "Microsandbox stopped successfully",
      );
    } catch (error) {
      logger.warn(
        {
          sandbox_id: sandboxId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Error stopping microsandbox, attempting to kill",
      );

      // If stop fails, try to kill it
      try {
        await sandboxData.instance.kill();
      } catch (killError) {
        logger.error(
          {
            sandbox_id: sandboxId,
            error:
              killError instanceof Error ? killError.message : "Unknown error",
          },
          "Error killing microsandbox",
        );
      }
    }

    // Remove from tracking
    this.activeSandboxes.delete(sandboxId);

    logger.info({ sandbox_id: sandboxId }, "Microsandbox stopped");
  }

  /**
   * List all active sandboxes for a tenant
   */
  async listActive(tenantId: string): Promise<SandboxInfo[]> {
    const sandboxes: SandboxInfo[] = [];
    for (const sandboxData of Array.from(this.activeSandboxes.values())) {
      if (sandboxData.info.tenant_id === tenantId) {
        sandboxes.push(sandboxData.info);
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

    for (const [sandboxId, sandboxData] of Array.from(
      this.activeSandboxes.entries(),
    )) {
      const createdAt = new Date(sandboxData.info.created_at).getTime();
      if (now - createdAt > maxAge) {
        logger.warn(
          { sandbox_id: sandboxId },
          "Cleaning up stale microsandbox",
        );

        try {
          await sandboxData.instance.kill();
        } catch (error) {
          logger.error(
            {
              sandbox_id: sandboxId,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            "Error killing stale microsandbox",
          );
        }

        this.activeSandboxes.delete(sandboxId);
      }
    }
  }

  /**
   * Clean up a specific sandbox
   */
  private async cleanupSandbox(sandboxId: string): Promise<void> {
    const sandboxData = this.activeSandboxes.get(sandboxId);
    if (!sandboxData) {
      return;
    }

    try {
      // Try graceful stop first
      await sandboxData.instance.stop();
      logger.debug(
        { sandbox_id: sandboxId },
        "Microsandbox cleaned up gracefully",
      );
    } catch (error) {
      // If stop fails, force kill
      try {
        await sandboxData.instance.kill();
        logger.debug(
          { sandbox_id: sandboxId },
          "Microsandbox force killed during cleanup",
        );
      } catch (killError) {
        logger.warn(
          {
            sandbox_id: sandboxId,
            error:
              killError instanceof Error ? killError.message : "Unknown error",
          },
          "Error during microsandbox cleanup",
        );
      }
    }

    this.activeSandboxes.delete(sandboxId);
  }
}

// Singleton instance
export const sandboxService = new SandboxService();

// Made with Bob
