import { Router, Request, Response, NextFunction } from "express";
import { boxService, BoxError, type BoxOwner } from "../services/BoxService.js";
import { logger } from "../utils/logger.js";

/**
 * Agent boxes over REST, the same operations as the box_* MCP tools, for
 * server-side callers (the locci-ai-inference chat API). See BoxService.
 */
const router: Router = Router();

/** Boxes belong to the user behind a user key or JWT, or to the tenant for a tenant key. */
function ownerOf(req: Request): BoxOwner {
  const tenantId = (req as any).tenantId as string;
  return { tenantId, ownerId: ((req as any).userId as string | undefined) ?? tenantId };
}

type Handler = (req: Request, res: Response) => Promise<unknown>;

/** Send the handler's result as `{success, data}`; a BoxError keeps its status. */
const handle =
  (fn: Handler) =>
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const data = await fn(req, res);
      if (!res.headersSent) res.json({ success: true, data });
    } catch (error) {
      if (error instanceof BoxError) {
        res.status(error.status).json({ success: false, error: error.message });
        return;
      }
      logger.error({ error: String(error), path: req.path }, "Box request failed");
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  };

/** POST /api/boxes  {language?, box_id?}: create a box, or reattach to one. */
router.post(
  "/",
  handle(async (req, res) => {
    const box = await boxService.create(ownerOf(req), req.body?.box_id, req.body?.language);
    res.status(req.body?.box_id ? 200 : 201);
    return box;
  }),
);

/** GET /api/boxes: the caller's boxes. */
router.get("/", handle(async (req) => boxService.list(ownerOf(req))));

/** GET /api/boxes/:id */
router.get("/:id", handle(async (req) => boxService.get(ownerOf(req), req.params.id as string)));

/** POST /api/boxes/:id/exec  {command, timeout?} */
router.post(
  "/:id/exec",
  handle(async (req) =>
    boxService.exec(ownerOf(req), req.params.id as string, req.body?.command, req.body?.timeout),
  ),
);

/** PUT /api/boxes/:id/files  {path, content, encoding?} */
router.put(
  "/:id/files",
  handle(async (req) =>
    boxService.writeFile(
      ownerOf(req),
      req.params.id as string,
      req.body?.path,
      req.body?.content,
      req.body?.encoding === "base64" ? "base64" : "utf8",
    ),
  ),
);

/** GET /api/boxes/:id/files?path=... */
router.get(
  "/:id/files",
  handle(async (req) => boxService.readFile(ownerOf(req), req.params.id as string, String(req.query.path ?? ""))),
);

/** POST /api/boxes/:id/stop: stop, keeping its disk and files. */
router.post("/:id/stop", handle(async (req) => boxService.stop(ownerOf(req), req.params.id as string)));

/** DELETE /api/boxes/:id: stop and delete the box and its /workspace. */
router.delete(
  "/:id",
  handle(async (req) => {
    await boxService.stop(ownerOf(req), req.params.id as string, true);
    return { box_id: req.params.id, status: "removed" };
  }),
);

export default router;
