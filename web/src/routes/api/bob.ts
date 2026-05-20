import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { jwtVerify } from "jose";

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

export const Route = createFileRoute("/api/bob")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) return new Response("Server misconfigured", { status: 500 });

        try {
          await jwtVerify(token, new TextEncoder().encode(jwtSecret));
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json()) as { messages?: UIMessage[]; threadId?: string };
        const messages = body.messages ?? [];
        const threadId = body.threadId;
        if (!threadId) return new Response("Missing threadId", { status: 400 });

        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) return new Response("Missing GROQ_API_KEY", { status: 500 });

        const groq = createGroq({ apiKey: groqApiKey });
        const model = groq("llama-3.3-70b-versatile");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            console.log("[bob] conversation completed", {
              threadId,
              messageCount: finalMessages.length,
            });
          },
        });
      },
    },
  },
});
