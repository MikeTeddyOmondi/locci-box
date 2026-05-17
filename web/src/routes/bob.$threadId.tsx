import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getThreadMessages } from "@/lib/bob.functions";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation, ConversationContent, ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Bug, Code2, FileSearch } from "lucide-react";

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
  const { user, loading } = useAuth();
  const fetchMessages = useServerFn(getThreadMessages);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const { data: initial, isLoading: msgsLoading } = useQuery({
    queryKey: ["bob-messages", threadId],
    queryFn: () => fetchMessages({ data: { threadId } }),
    enabled: !!user,
  });

  // useChat must remount per thread, but useQuery loads after mount.
  // We render the chat only after initial messages are resolved.
  if (!loading && !user) return <Navigate to="/" />;
  if (msgsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[#64748b]">
        Loading conversation…
      </div>
    );
  }

  return (
    <ChatBody
      key={threadId}
      threadId={threadId}
      initialMessages={(initial ?? []) as UIMessage[]}
      taRef={taRef}
    />
  );
}

function ChatBody({
  threadId, initialMessages, taRef,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  taRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [draft, setDraft] = useState("");
  const transport = new DefaultChatTransport({
    api: "/api/bob",
    body: { threadId },
    fetch: async (input, init) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
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

  // Keep textarea focused
  useEffect(() => { taRef.current?.focus(); }, [threadId]);
  useEffect(() => { if (status === "ready") taRef.current?.focus(); }, [status]);

  const isLoading = status === "submitted" || status === "streaming";
  const empty = messages.length === 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#e0f2fe] flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)" }}>
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
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)" }}>
                <Bug className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-[#1a3a52] mb-1">Hi, I'm BOB.</h2>
              <p className="text-sm text-[#64748b] max-w-md">
                Paste a snippet, file, or stack trace and I'll review it for bugs, security holes, perf issues, and style — with corrected code.
              </p>
              <div className="grid sm:grid-cols-3 gap-2 mt-6 w-full max-w-2xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
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
