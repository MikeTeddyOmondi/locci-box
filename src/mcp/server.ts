#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { sandboxService } from "../services/SandboxService.js";
import { tenantService } from "../services/TenantService.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * MCP Server for Locci Box
 * Exposes sandbox execution tools to AI agents
 */

// Tool definitions
const tools = [
  {
    name: "run_sandbox",
    description:
      "Execute code in an isolated microVM. Returns stdout, stderr, and exit code.",
    inputSchema: {
      type: "object",
      properties: {
        language: {
          type: "string",
          enum: ["python", "node", "bash", "ruby"],
          description: "Programming language to execute",
        },
        code: {
          type: "string",
          description: "Code to execute in the sandbox",
        },
        timeout: {
          type: "number",
          description: "Maximum execution time in seconds (default: 30)",
          default: 30,
        },
        api_key: {
          type: "string",
          description: "API key for authentication",
        },
      },
      required: ["language", "code", "api_key"],
    },
  },
  {
    name: "get_sandbox_status",
    description: "Check the status of a running sandbox",
    inputSchema: {
      type: "object",
      properties: {
        sandbox_id: {
          type: "string",
          description: "Sandbox ID to check",
        },
        api_key: {
          type: "string",
          description: "API key for authentication",
        },
      },
      required: ["sandbox_id", "api_key"],
    },
  },
  {
    name: "stop_sandbox",
    description: "Stop and destroy a running sandbox",
    inputSchema: {
      type: "object",
      properties: {
        sandbox_id: {
          type: "string",
          description: "Sandbox ID to stop",
        },
        api_key: {
          type: "string",
          description: "API key for authentication",
        },
      },
      required: ["sandbox_id", "api_key"],
    },
  },
];

/**
 * Handle run_sandbox tool call
 */
async function handleRunSandbox(args: any) {
  const { language, code, timeout, api_key } = args;

  // Authenticate
  const tenant = await tenantService.getByApiKey(api_key);
  if (!tenant) {
    throw new Error("Invalid API key");
  }

  // Check if tenant can create sandbox
  const canCreate = await tenantService.canCreateSandbox(tenant.id);
  if (!canCreate) {
    throw new Error("Maximum concurrent sandboxes reached");
  }

  // Increment active count
  await tenantService.incrementActive(tenant.id);

  try {
    // Execute sandbox
    const result = await sandboxService.execute(
      { language, code, timeout: timeout || 30 },
      tenant.id,
    );

    // Record execution
    await tenantService.recordExecution(tenant.id, result.duration_ms);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } finally {
    // Always decrement
    await tenantService.decrementActive(tenant.id);
  }
}

/**
 * Handle get_sandbox_status tool call
 */
async function handleGetStatus(args: any) {
  const { sandbox_id, api_key } = args;

  // Authenticate
  const tenant = await tenantService.getByApiKey(api_key);
  if (!tenant) {
    throw new Error("Invalid API key");
  }

  const status = await sandboxService.getStatus(sandbox_id);
  if (!status) {
    throw new Error("Sandbox not found or already completed");
  }

  // Verify ownership
  if (status.tenant_id !== tenant.id) {
    throw new Error("Forbidden: You do not own this sandbox");
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(status, null, 2),
      },
    ],
  };
}

/**
 * Handle stop_sandbox tool call
 */
async function handleStopSandbox(args: any) {
  const { sandbox_id, api_key } = args;

  // Authenticate
  const tenant = await tenantService.getByApiKey(api_key);
  if (!tenant) {
    throw new Error("Invalid API key");
  }

  // Get status to verify ownership
  const status = await sandboxService.getStatus(sandbox_id);
  if (!status) {
    throw new Error("Sandbox not found or already stopped");
  }

  if (status.tenant_id !== tenant.id) {
    throw new Error("Forbidden: You do not own this sandbox");
  }

  // Stop sandbox
  await sandboxService.stop(sandbox_id);
  await tenantService.decrementActive(tenant.id);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            sandbox_id,
            status: "stopped",
            message: "Sandbox terminated successfully",
          },
          null,
          2,
        ),
      },
    ],
  };
}

/**
 * Start MCP server
 */
async function startMCPServer() {
  const server = new Server(
    {
      name: "locci-box-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info({ tool: name, args }, "MCP tool called");

    try {
      switch (name) {
        case "run_sandbox":
          return await handleRunSandbox(args);
        case "get_sandbox_status":
          return await handleGetStatus(args);
        case "stop_sandbox":
          return await handleStopSandbox(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error({ error, tool: name }, "MCP tool error");
      throw error;
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("Locci Box MCP server started");
}

// Start the MCP server
if (env.MCP_ENABLED) {
  startMCPServer().catch((error) => {
    logger.error({ error }, "Failed to start MCP server");
    process.exit(1);
  });
}

// Made with Bob
