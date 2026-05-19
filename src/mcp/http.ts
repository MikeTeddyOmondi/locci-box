import { Router, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMCPServer } from "./tools.js";
import { logger } from "../utils/logger.js";

const jsonRpcError = (code: number, message: string) => ({
  jsonrpc: "2.0",
  error: { code, message },
  id: null,
});

const router = Router();

// Stateless streamable HTTP — new McpServer + transport per request
router.post("/", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMCPServer();

  // Use 'close' (fires on both normal and abrupt closes) not 'finish'
  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error({ error }, "MCP HTTP request error");
    if (!res.headersSent) {
      res.status(500).json(jsonRpcError(-32603, "Internal server error"));
    }
  }
});

router.get("/", (_req: Request, res: Response) => {
  res.writeHead(405).end(
    JSON.stringify(jsonRpcError(-32000, "Method not allowed. Use POST /mcp.")),
  );
});

router.delete("/", (_req: Request, res: Response) => {
  res.writeHead(405).end(
    JSON.stringify(jsonRpcError(-32000, "Session management not supported in stateless mode.")),
  );
});

export default router;

// Made with Bob
