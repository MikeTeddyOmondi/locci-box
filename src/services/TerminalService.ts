import { randomBytes } from "node:crypto";
import { BoxError, type BoxOwner } from "./BoxService.js";

/**
 * One-time tickets for box terminals. A browser cannot set an Authorization
 * header on a WebSocket, and the console keeps its token in an httpOnly
 * cookie, so the client first asks for a ticket with its usual credentials
 * (POST /api/boxes/:id/terminal) and opens the socket with that instead. A
 * ticket is good for one connection to one box, for TICKET_TTL_MS. Kept in
 * memory: one API process per host.
 */

const TICKET_TTL_MS = 30_000;
/** Open terminals per owner, across their boxes. */
const MAX_SESSIONS = 4;

interface Ticket {
  owner: BoxOwner;
  boxId: string;
  expires: number;
}

export class TerminalService {
  private tickets = new Map<string, Ticket>();
  private sessions = new Map<string, number>();

  issue(owner: BoxOwner, boxId: string): { ticket: string; expires_in: number } {
    if ((this.sessions.get(owner.ownerId) ?? 0) >= MAX_SESSIONS) {
      throw new BoxError(`At most ${MAX_SESSIONS} terminals at once; close one first`, 429);
    }
    this.prune();
    const ticket = randomBytes(32).toString("base64url");
    this.tickets.set(ticket, { owner, boxId, expires: Date.now() + TICKET_TTL_MS });
    return { ticket, expires_in: TICKET_TTL_MS / 1000 };
  }

  /** The owner a ticket was issued to, if it is for this box and unused; it is spent either way. */
  redeem(ticket: string, boxId: string): BoxOwner | null {
    const found = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!found || found.boxId !== boxId || found.expires < Date.now()) return null;
    return found.owner;
  }

  opened(owner: BoxOwner): void {
    this.sessions.set(owner.ownerId, (this.sessions.get(owner.ownerId) ?? 0) + 1);
  }

  closed(owner: BoxOwner): void {
    const n = (this.sessions.get(owner.ownerId) ?? 1) - 1;
    if (n > 0) this.sessions.set(owner.ownerId, n);
    else this.sessions.delete(owner.ownerId);
  }

  private prune(at = Date.now()): void {
    for (const [ticket, t] of this.tickets) if (t.expires < at) this.tickets.delete(ticket);
  }
}

export const terminalService = new TerminalService();
