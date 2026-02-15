import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, X, Loader2, RotateCcw } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function SupportChat() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [ticketId, setTicketId] = useState<number | null>(() => {
    const stored = localStorage.getItem("dgb_support_ticket_id");
    return stored ? Number(stored) : null;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await apiRequest("POST", "/api/support/chat", { message, history, ticketId });
      return await res.json();
    },
    onSuccess: (data: { reply: string; ticketId?: number }) => {
      if (data.ticketId && !ticketId) {
        setTicketId(data.ticketId);
        localStorage.setItem("dgb_support_ticket_id", String(data.ticketId));
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t('support.errorMessage') },
      ]);
    },
  });

  useEffect(() => {
    if (!isOpen || messages.length > 0) return;
    if (ticketId) {
      fetch(`/api/support/ticket/${ticketId}/messages`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.messages?.length > 0) {
            setMessages(data.messages.map((m: any) => ({ role: m.role, content: m.content })));
          }
        })
        .catch(() => {});
    } else {
      fetch("/api/support/ticket/current", { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.ticket) {
            setTicketId(data.ticket.id);
            localStorage.setItem("dgb_support_ticket_id", String(data.ticket.id));
            if (data.messages?.length > 0) {
              setMessages(data.messages.map((m: any) => ({ role: m.role, content: m.content })));
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    sendMessage.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed bottom-20 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)]"
          data-testid="support-chat-panel"
        >
          <Card className="flex flex-col h-[500px] max-h-[70vh] shadow-xl border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3 px-4 border-b space-y-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                {t('support.title')}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setMessages([]); setTicketId(null); localStorage.removeItem("dgb_support_ticket_id"); }}
                  title={t('support.newConversation')}
                  data-testid="button-new-chat"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  data-testid="button-close-chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-12" data-testid="text-chat-empty">
                  <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p>{t('support.greeting')}</p>
                  <p className="text-xs mt-1">{t('support.greetingSubtitle')}</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`chat-message-${msg.role}-${i}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-black rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {sendMessage.isPending && (
                <div className="flex justify-start" data-testid="chat-typing-indicator">
                  <div className="bg-muted rounded-lg px-3 py-2 rounded-bl-sm">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </CardContent>

            <div className="p-3 border-t flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('support.placeholder')}
                disabled={sendMessage.isPending}
                data-testid="input-chat-message"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || sendMessage.isPending}
                data-testid="button-send-message"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Button
        size="icon"
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-primary text-black"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-open-chat"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </>
  );
}
