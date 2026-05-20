import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getThreadMessages,
  saveThreadMessages,
  renameThread,
} from "@/lib/bob.functions";
import { useAuth } from "@/lib/auth";
import {
  Conversation, ConversationContent, ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Bug, Check, Code2, Copy, FileSearch, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/bob/$threadId")({
  component: ThreadPage,
});

const SUGGESTIONS = [
  { icon: FileSearch, label: "Review a Python function for bugs" },
  { icon: Code2, label: "Find security issues in this JWT handler" },
  { icon: Bug, label: "Why is this React effect looping?" },
];

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { user, token } = useAuth();

  const { data: initialMessages = [] } = useQuery({
    queryKey: ["bob-messages", threadId],
    queryFn: () => getThreadMessages(threadId),
    enabled: !!user,
    staleTime: Infinity,
  });

  if (!user) return <Navigate to="/" />;

  return (
    <ChatBody
      key={threadId}
      threadId={threadId}
      initialMessages={initialMessages}
      token={token}
    />
  );
}

function ChatBody({
  threadId,
  initialMessages,
  token,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  token: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hasRenamed = useRef(false);
  const qc = useQueryClient();

  const transport = new DefaultChatTransport({
    api: "/api/bob",
    body: { threadId },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
  });

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });

  // Persist messages to localStorage after each change
  useEffect(() => {
    if (messages.length > 0) saveThreadMessages(threadId, messages);
  }, [messages, threadId]);

  // Auto-rename thread on first user message
  useEffect(() => {
    if (hasRenamed.current) return;
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return;
    const text = firstUser.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("")
      .slice(0, 60)
      .trim();
    if (text) {
      renameThread(threadId, text);
      hasRenamed.current = true;
      qc.invalidateQueries({ queryKey: ["bob-threads"] });
    }
  }, [messages, threadId, qc]);

  useEffect(() => { taRef.current?.focus(); }, [threadId]);
  useEffect(() => { if (status === "ready") taRef.current?.focus(); }, [status]);

  function retryLast() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const text = lastUser.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    if (text) sendMessage({ text });
  }

  function copyText(id: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const isLoading = status === "submitted" || status === "streaming";
  const empty = messages.length === 0;

  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const lastAssistantId = assistantMessages.at(-1)?.id;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#e0f2fe] flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)" }}
        >
          <Bug className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="font-bold text-[#1a3a52]">BOB</div>
          <div className="text-xs text-[#64748b]">Paste code below and I'll find the bugs.</div>
        </div>
      </div>

      <Conversation className="flex-1 min-h-0 bg-[#f8fbff]">
        <ConversationContent>
          {empty && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 px-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)" }}
              >
                <Bug className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-[#1a3a52] mb-1">Hi, I'm BOB.</h2>
              <p className="text-sm text-[#64748b] max-w-md">
                Paste a snippet, file, or stack trace and I'll review it for bugs, security holes,
                perf issues, and style — with corrected code.
              </p>
              <div className="grid sm:grid-cols-3 gap-2 mt-6 w-full max-w-2xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => { setDraft(s.label); taRef.current?.focus(); }}
                    className="text-left p-3 rounded-xl border border-[#e0f2fe] bg-white hover:bg-[#f0f7ff] transition-colors group"
                  >
                    <s.icon className="w-4 h-4 text-[#3b82f6] mb-2" />
                    <div className="text-xs text-[#1a3a52]">{s.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            if (m.role === "user") {
              return (
                <Message from="user" key={m.id}>
                  <MessageContent style={{ background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)", color: "#fff" }}>
                    <div className="whitespace-pre-wrap">{text}</div>
                  </MessageContent>
                </Message>
              );
            }
            return (
              <Message from="assistant" key={m.id}>
                <MessageContent>
                  <MessageResponse>{text}</MessageResponse>
                </MessageContent>
                <div className="flex gap-1 mt-1 ml-1">
                  <button
                    type="button"
                    onClick={() => copyText(m.id, text)}
                    title="Copy response"
                    className="p-1 rounded hover:bg-[#f0f7ff] text-[#94a3b8] hover:text-[#3b82f6] transition-colors"
                  >
                    {copied === m.id
                      ? <Check className="w-3.5 h-3.5 text-green-500" />
                      : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {m.id === lastAssistantId && !isLoading && (
                    <button
                      type="button"
                      onClick={() => retryLast()}
                      title="Retry"
                      className="p-1 rounded hover:bg-[#f0f7ff] text-[#94a3b8] hover:text-[#3b82f6] transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </Message>
            );
          })}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>BOB is reviewing…</Shimmer>
              </MessageContent>
            </Message>
          )}

          {error && (
            <div className="mx-auto text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              {error.message}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-[#e0f2fe] p-4 bg-white">
        <div className="bg-locci-gradient p-[2px] rounded-xl">
          <PromptInput
            className="bg-white rounded-[10px]"
            onSubmit={(message) => {
              const text = message.text?.trim() ?? draft.trim();
              if (!text || isLoading) return;
              sendMessage({ text });
              setDraft("");
            }}
          >
            <PromptInputTextarea
              ref={taRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Paste code, a stack trace, or ask BOB to review something…"
              className="text-[#1a3a52] placeholder:text-[#94a3b8]"
              autoFocus
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={isLoading || draft.trim().length === 0} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
