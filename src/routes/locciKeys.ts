import { Router, Request, Response } from "express";
import { locciKeysRequest } from "../services/LocciAuth.js";
import { logger } from "../utils/logger.js";

/**
 * Locci API keys, managed at Locci Auth with the caller's own access token (so
 * only a session signed in with Locci can use these). The keys work on every
 * Locci service; this API accepts them as `Authorization: Bearer locci_sk_live_...`.
 */
const router: Router = Router();

async function forward(req: Request, res: Response, path: string, init: RequestInit = {}): Promise<void> {
  const accessToken = (req as any).locciAccessToken as string | undefined;
  if (!accessToken) {
    res.status(403).json({ success: false, error: "Sign in with Locci to manage API keys" });
    return;
  }
  try {
    const upstream = await locciKeysRequest(accessToken, path, init);
    const body = (await upstream.json().catch(() => ({}))) as { error?: string };
    if (!upstream.ok) {
      res.status(upstream.status).json({ success: false, error: body.error ?? `Locci Auth answered ${upstream.status}` });
      return;
    }
    res.status(upstream.status).json({ success: true, data: body });
  } catch (error) {
    logger.error({ error: String(error) }, "Reaching Locci Auth for keys failed");
    res.status(503).json({ success: false, error: "Locci Auth is unreachable" });
  }
}

/** GET /api/locci-keys: {keys: [...]} */
router.get("/", (req, res) => forward(req, res, ""));

/** POST /api/locci-keys {name, expiresInDays}: {key, summary}; the key is shown once. */
router.post("/", (req, res) =>
  forward(req, res, "", {
    method: "POST",
    body: JSON.stringify({ name: req.body?.name, expiresInDays: req.body?.expiresInDays ?? null }),
  }),
);

/** DELETE /api/locci-keys/:id: revoke. */
router.delete("/:id", (req, res) => forward(req, res, `/${encodeURIComponent(String(req.params.id))}`, { method: "DELETE" }));

export default router;
