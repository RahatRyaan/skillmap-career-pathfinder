/**
 * Floating AI assistant.
 *
 * Answers are grounded in the student's own SkillMap data on the server. Every
 * answer carries its source tags so the student can see whether it came from
 * their profile, the career database, or a suggestion.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Send, Sparkles, X } from 'lucide-react';
import { appApi } from '@/lib/endpoints';
import { toUserMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'student' | 'assistant';
  text: string;
  sourceTags?: { tag: string; reason: string }[];
  notice?: string | null;
  failed?: boolean;
}

const DEFAULT_CHIPS = [
  'What should I learn next?',
  'How close am I to my target career?',
  'Why is this skill important?',
  'Suggest a project for me',
];

const SOURCE_LABELS: Record<string, string> = {
  profile: 'From your profile',
  career_database: 'From career database',
  ai_suggestion: 'AI suggestion',
};

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [chips, setChips] = useState(DEFAULT_CHIPS);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const studentMessage: Message = {
      id: `s-${Date.now()}`,
      role: 'student',
      text: trimmed,
    };
    setMessages((prev) => [...prev, studentMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await appApi.askAssistant(trimmed, conversationId);
      setConversationId(response.conversationId);
      setChips(response.suggestedChips.length > 0 ? response.suggestedChips : DEFAULT_CHIPS);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: response.answer,
          sourceTags: response.sourceTags,
          notice: response.notice,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: toUserMessage(error, 'The assistant could not respond. Please try again.'),
          failed: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="AI career assistant"
    >
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[rgb(var(--surface))] shadow-2xl sm:h-[min(640px,90vh)] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Career assistant</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close assistant">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Ask me about your skill map. I answer from your own recorded skills and the career
                requirements, and I will tell you which of those a reply came from.
              </p>
            </div>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex flex-col gap-1',
                message.role === 'student' ? 'items-end' : 'items-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                  message.role === 'student'
                    ? 'bg-brand text-white'
                    : message.failed
                      ? 'border border-critical/40 bg-critical/5 text-critical'
                      : 'bg-[rgb(var(--surface-raised))]',
                )}
              >
                {message.role === 'assistant' && message.failed ? (
                  <span className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {message.text}
                  </span>
                ) : (
                  message.text
                )}
              </div>

              {message.sourceTags && message.sourceTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {message.sourceTags.map((tag, i) => (
                    <span
                      key={`${tag.tag}-${i}`}
                      className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand"
                      title={tag.reason}
                    >
                      {SOURCE_LABELS[tag.tag] ?? tag.tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {message.notice ? (
                <p className="max-w-[85%] text-[10px] text-muted">{message.notice}</p>
              ) : null}
            </div>
          ))}

          {isSending ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
              Thinking…
            </div>
          ) : null}

          <div ref={endRef} />
        </div>

        {chips.length > 0 && messages.length < 6 ? (
          <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] px-4 py-2.5">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void send(chip)}
                className="rounded-full border border-[rgb(var(--border))] px-3 py-1.5 text-xs hover:bg-[rgb(var(--surface-raised))]"
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="flex items-center gap-2 border-t border-[rgb(var(--border))] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('common.search')}
            aria-label="Message the assistant"
            maxLength={2000}
            className="h-11 flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm"
          />
          <Button type="submit" disabled={!input.trim() || isSending} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
