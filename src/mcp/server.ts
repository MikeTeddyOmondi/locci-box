#!/usr/bin/env node

/**
 * Standalone MCP HTTP server — used by `pnpm mcp:dev` and `pnpm mcp:inspect`.
 * In production the HTTP transport is mounted directly on the main API app (src/app.ts).
 * The stdio transport lives in the CLI (`loccibox mcp start`).
 */

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMCPServer } from "./tools.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

const PORT = env.MCP_HTTP_PORT;
const API_BASE = (process.env.LOCCIBOX_API_URL ?? "http://localhost:5757").replace(/\/$/, "");

async function startHttpServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMCPServer();
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error({ error }, "MCP request error");
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({ error: "Use POST /mcp" });
  });

  app.listen(PORT, () => {
    logger.info({ port: PORT, api: API_BASE }, `Locci Box MCP server started on :${PORT}`);
  });
}

if (env.MCP_ENABLED) {
  startHttpServer().catch((error) => {
    logger.error({ error }, "Failed to start MCP server");
    process.exit(1);
  });
}

// Made with Bob
