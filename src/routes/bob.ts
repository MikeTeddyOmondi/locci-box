import { Router, Request, Response } from "express";
import { createGroq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import { authenticate } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { db } from "../db/index.js";
import { bobThreads, bobMessages } from "../db/schema.js";

const router: Router = Router();
router.use(authenticate);

const SYSTEM_PROMPT = `You are BOB — Locci Box's senior code-review assistant.
You help engineers find bugs, security holes, performance issues, and style problems in code they paste.

How to respond:
- If the user pastes code (in any language), do a careful review.
- Group findings under: **Bugs**, **Security**, **Performance**, **Readability**, **Suggestions**.
- For every finding, quote the offending lines in a fenced code block, then explain the fix and show a corrected snippet in a separate fenced code block. Always set the language tag on fenced blocks.
- If you spot none in a category, omit it.
- Be concise. Skip preamble. Never apologise.
- If the user is just chatting (no code yet), invite them to paste a file or snippet.
- Markdown is rendered. Use bold sparingly for the section headers above.`;

function userId(req: Request): string {
  return (req as any).userId as string;
}

// ── Thread CRUD ──────────────────────────────────────────────────────────────

/** GET /api/bob/threads */
router.get("/threads", async (req: Request, res: Response): Promise<void> => {
  const uid = userId(req);
  const rows = await db
    .select()
    .from(bobThreads)
    .where(eq(bobThreads.userId, uid))
    .orderBy(desc(bobThreads.updatedAt));
  res.json({ success: true, data: rows });
});

/** POST /api/bob/threads */
router.post("/threads", async (req: Request, res: Response): Promise<void> => {
  const uid = userId(req);
  const { title = "New review" } = req.body as { title?: string };
  const now = new Date().toISOString();
  const thread = { id: nanoid(), userId: uid, title, createdAt: now, updatedAt: now };
  await db.insert(bobThreads).values(thread);
  res.status(201).json({ success: true, data: thread });
});

/** PATCH /api/bob/threads/:id — rename */
router.patch("/threads/:id", async (req: Request, res: Response): Promise<void> => {
  const uid = userId(req);
  const { id } = req.params;
  const { title } = req.body as { title?: string };
  if (!title?.trim()) {
    res.status(400).json({ success: false, error: "title is required" });
    return;
  }
  await db
    .update(bobThreads)
    .set({ title: title.trim(), updatedAt: new Date().toISOString() })
    .where(eq(bobThreads.id, id));
  // Ownership check is implicit — if the row doesn't belong to uid it simply won't be updated
  logger.debug({ uid, threadId: id, title }, "[bob] thread renamed");
  res.json({ success: true });
});

/** DELETE /api/bob/threads/:id */
router.delete("/threads/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await db.delete(bobMessages).where(eq(bobMessages.threadId, id));
  await db.delete(bobThreads).where(eq(bobThreads.id, id));
  res.json({ success: true });
});

// ── Messages ─────────────────────────────────────────────────────────────────

/** GET /api/bob/threads/:id/messages */
router.get("/threads/:id/messages", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const rows = await db
    .select()
    .from(bobMessages)
    .where(eq(bobMessages.threadId, id))
    .orderBy(bobMessages.createdAt);
  const messages: UIMessage[] = rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant",
    parts: JSON.parse(r.parts),
    createdAt: new Date(r.createdAt),
  }));
  res.json({ success: true, data: messages });
});

// ── AI streaming ──────────────────────────────────────────────────────────────

/** POST /api/bob */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const groqApiKey = env.GROQ_API_KEY;
  if (!groqApiKey) {
    res.status(500).json({ success: false, error: "GROQ_API_KEY not configured" });
    return;
  }

  const { messages, threadId } = req.body as {
    messages?: UIMessage[];
    threadId?: string;
  };

  if (!threadId) {
    res.status(400).json({ success: false, error: "Missing threadId" });
    return;
  }

  try {
    const groq = createGroq({ apiKey: groqApiKey });
    const model = groq("llama-3.3-70b-versatile");

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages ?? []),
      onFinish: async ({ response }) => {
        const now = new Date().toISOString();
        const incoming = messages ?? [];

        // Extract text from response assistant messages
        type TextLike = { type: string; text?: string };
        const assistantText = response.messages
          .filter((m) => m.role === "assistant")
          .flatMap((m) => m.content as unknown as TextLike[])
          .filter((p) => p.type === "text" && typeof p.text === "string")
          .map((p) => p.text as string)
          .join("");

        const assistantRow = {
          id: nanoid(),
          threadId,
          role: "assistant",
          parts: JSON.stringify([{ type: "text", text: assistantText }]),
          createdAt: now,
        };

        const incomingRows = incoming.map((m) => ({
          id: m.id ?? nanoid(),
          threadId,
          role: m.role,
          parts: JSON.stringify((m as any).parts ?? []),
          createdAt: now,
        }));

        await db.delete(bobMessages).where(eq(bobMessages.threadId, threadId));
        await db.insert(bobMessages).values([...incomingRows, assistantRow]);
        await db.update(bobThreads).set({ updatedAt: now }).where(eq(bobThreads.id, threadId));
        logger.info({ threadId, count: incomingRows.length + 1 }, "[bob] messages saved");
      },
    });

    const streamResponse = result.toUIMessageStreamResponse({
      originalMessages: messages ?? [],
    });

    streamResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.status(streamResponse.status);

    if (streamResponse.body) {
      const reader = streamResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (error) {
    logger.error({ error, threadId }, "[bob] stream error");
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "AI request failed" });
    }
  }
});

export default router;
