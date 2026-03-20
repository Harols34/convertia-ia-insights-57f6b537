import { useState, useCallback } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;

export function useStreamChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (input: string, opts?: { mode?: string; botId?: string; dataSource?: string; webhookUrl?: string }) => {
      const userMsg: Msg = { role: "user", content: input };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const allMsgs = [...messages, userMsg];

      try {
        // If webhook URL is configured, route through n8n
        if (opts?.webhookUrl) {
          try {
            const resp = await fetch(opts.webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: input,
                chatInput: input,
                sessionId: opts.botId || "default",
              }),
            });

            if (!resp.ok) throw new Error(`Webhook error: ${resp.status}`);

            const data = await resp.json();
            // Handle common n8n response formats
            let reply: string;
            if (typeof data === "string") {
              reply = data;
            } else if (Array.isArray(data) && data.length > 0) {
              const first = data[0];
              reply = first.output || first.response || first.message || first.text || JSON.stringify(first);
            } else {
              reply = data.output || data.response || data.message || data.text || JSON.stringify(data);
            }

            setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
            setIsLoading(false);
            return;
          } catch (webhookErr: any) {
            console.error("n8n webhook error, falling back to AI:", webhookErr);
          }
        }

        // Default: use Edge Function with OpenAI streaming
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { session: s } } = await supabase.auth.getSession();

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s?.access_token}`,
          },
          body: JSON.stringify({
            messages: allMsgs,
            mode: opts?.mode,
            botId: opts?.botId,
            dataSource: opts?.dataSource || "leads",
          }),
        });

        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({ error: "Error de conexión" }));
          throw new Error(errorData.error || `Error ${resp.status}`);
        }

        if (!resp.body) throw new Error("No hay stream");

        let assistantSoFar = "";
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantSoFar += content;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                  }
                  return [...prev, { role: "assistant", content: assistantSoFar }];
                });
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      } catch (e: any) {
        console.error("Stream error:", e);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ Error: ${e.message}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearMessages, setMessages };
}
