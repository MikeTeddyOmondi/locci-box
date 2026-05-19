import { Router, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMCPServer } from "./tools.js";
import { logger } from "../utils/logger.js";

const router = Router();

// Stateless streamable HTTP transport — new Server + transport per request
router.post("/", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMCPServer();
  res.on("finish", () => server.close().catch(() => {}));
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error({ error }, "MCP HTTP request error");
    if (!res.headersSent) res.status(500).json({ error: "Internal MCP error" });
  }
});

router.get("/", (_req: Request, res: Response) => {
  res.status(405).json({ error: "SSE not supported in stateless mode. Use POST /mcp." });
});

router.delete("/", (_req: Request, res: Response) => {
  res.status(200).json({ message: "Session closed" });
});

export default router;

// Made with Bob
