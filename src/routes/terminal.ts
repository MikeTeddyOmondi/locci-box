import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { boxService, BoxError, type BoxOwner, type BoxShell } from "../services/BoxService.js";
import { terminalService } from "../services/TerminalService.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Box terminals over a websocket: GET /api/boxes/:id/terminal?ticket=...,
 * with a ticket from POST /api/boxes/:id/terminal. The protocol is the one
 * iaas-service's VM shell speaks, so the same client works for both:
 *
 *   server -> client  {"type":"stdout","data":<base64 bytes>}
 *                     {"type":"exit","code":n}            (then the socket closes)
 *   client -> server  {"type":"stdin","data":<base64 bytes>}
 *                     {"type":"resize","width":cols,"height":rows}
 */

const PATH = /^\/api\/boxes\/([^/]+)\/terminal$/;
/** Under Cloudflare's 100 s idle cut for proxied websockets. */
const PING_MS = 30_000;

function refuse(socket: Duplex, status: number, reason: string): void {
  socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/** Answer terminal upgrades on the API's HTTP server; other upgrades are refused. */
export function attachTerminals(server: Server): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const match = PATH.exec(url.pathname);
    if (!match) return refuse(socket, 404, "Not Found");
    const boxId = decodeURIComponent(match[1]);
    const owner = terminalService.redeem(url.searchParams.get("ticket") ?? "", boxId);
    if (!owner) return refuse(socket, 401, "Unauthorized");
    wss.handleUpgrade(req, socket, head, (ws) => session(ws, owner, boxId));
  });
}

function session(ws: WebSocket, owner: BoxOwner, boxId: string): void {
  terminalService.opened(owner);
  let shell: BoxShell | null = null;
  let ended = false;
  /** Typed and sized before the shell is up (a stopped box takes a moment to start). */
  const early: Uint8Array[] = [];
  let size: { rows: number; cols: number } | null = null;

  const send = (message: object) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  };
  const say = (text: string) => send({ type: "stdout", data: Buffer.from(text).toString("base64") });

  // A session nobody types in ends after the same idle time as a box.
  let idle: NodeJS.Timeout;
  const touch = () => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      say(`\r\n\x1b[90m[closed after ${env.BOX_IDLE_MINUTES} idle minutes]\x1b[0m\r\n`);
      void shell?.kill().catch(() => {});
      ws.close(1000);
    }, env.BOX_IDLE_MINUTES * 60_000);
  };
  touch();
  const ping = setInterval(() => ws.ping(), PING_MS);

  ws.on("message", (raw) => {
    let msg: { type?: string; data?: string; width?: number; height?: number };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === "stdin" && typeof msg.data === "string") {
      touch();
      const bytes = Buffer.from(msg.data, "base64");
      if (shell) void shell.write(bytes).catch(() => {});
      else early.push(bytes);
    } else if (msg.type === "resize" && Number(msg.width) > 0 && Number(msg.height) > 0) {
      size = { rows: Math.min(Number(msg.height), 1000), cols: Math.min(Number(msg.width), 1000) };
      if (shell) void shell.resize(size.rows, size.cols).catch(() => {});
    }
  });

  ws.on("close", () => {
    ended = true;
    void shell?.kill().catch(() => {});
  });

  boxService
    .terminal(owner, boxId, {
      attach(s) {
        shell = s;
        if (ended) return void s.kill().catch(() => {});
        if (size) void s.resize(size.rows, size.cols).catch(() => {});
        for (const bytes of early.splice(0)) void s.write(bytes).catch(() => {});
      },
      output(data) {
        send({ type: "stdout", data: Buffer.from(data).toString("base64") });
      },
    })
    .then((code) => {
      send({ type: "exit", code });
      ws.close(1000);
    })
    .catch((error) => {
      if (!(error instanceof BoxError)) logger.error({ error: String(error), box_id: boxId }, "Box terminal failed");
      say(`\r\n\x1b[31m${error instanceof BoxError ? error.message : "The terminal failed"}\x1b[0m\r\n`);
      ws.close(1011);
    })
    .finally(() => {
      clearTimeout(idle);
      clearInterval(ping);
      terminalService.closed(owner);
    });
}
