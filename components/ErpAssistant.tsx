'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Trash2, Sparkles } from 'lucide-react';
import { ensureSessionId } from '@/utils/session';

const STORAGE_KEY = 'erp-assistant-messages';

/** Indigo AI accent (matches reference FAB) */
const AI_BTN =
  'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/35';
const AI_BTN_RING = 'focus:ring-indigo-500/40';
const AI_TEXT = 'text-indigo-600';
const AI_SURFACE = 'bg-indigo-50 dark:bg-indigo-950/40';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { module: string; path: string; count?: number }[];
}

const SUGGESTED_PROMPTS = [
  'My pending delegations',
  'Open helpdesk tickets',
  'Export FMS pending at step 5',
  'Job work overdue items',
];

const LOADING_HINTS = [
  'Reading your question…',
  'Querying ERP data…',
  'Preparing answer…',
];

export default function ErpAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState(LOADING_HINTS[0]);
  const [configured, setConfigured] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/erp-assistant');
        const data = await res.json();
        setConfigured(Boolean(data.configured));
      } catch {
        setConfigured(false);
      }
    };
    check();
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('erp-assistant:open', onOpen);
    return () => window.removeEventListener('erp-assistant:open', onOpen);
  }, []);

  useEffect(() => {
    if (open) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, open, loading]);

  useEffect(() => {
    if (!open) return;
    const sessionId = ensureSessionId();
    fetch('/api/erp-assistant/warmup', {
      headers: { 'x-session-id': sessionId },
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!loading) return;
    let i = 0;
    setLoadingHint(LOADING_HINTS[0]);
    const t = setInterval(() => {
      i = (i + 1) % LOADING_HINTS.length;
      setLoadingHint(LOADING_HINTS[i]);
    }, 4000);
    return () => clearInterval(t);
  }, [loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = { role: 'user', content: trimmed };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput('');
      setLoading(true);

      try {
        const sessionId = ensureSessionId();
        const res = await fetch('/api/erp-assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
          },
          body: JSON.stringify({ messages: nextMessages.slice(-8) }),
        });
        const data = await res.json();
        const reply =
          data.reply ||
          data.error ||
          'Sorry, I could not answer that.';
        setMessages([
          ...nextMessages,
          {
            role: 'assistant',
            content: reply,
            sources: data.sources,
          },
        ]);
      } catch {
        setMessages([
          ...nextMessages,
          { role: 'assistant', content: 'Network error. Please try again.' },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages]
  );

  const clearChat = () => {
    setMessages([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-[60] lg:bg-black/20"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[400px] z-[70] flex flex-col bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700"
            >
              <header className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-600 to-indigo-500">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white">AI Assistant</h2>
                    <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-wider">
                      ERP read-only
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={clearChat}
                    className="p-2 rounded-lg text-white/80 hover:bg-white/15"
                    title="Clear conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-lg text-white/80 hover:bg-white/15"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </header>

              {!configured && (
                <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-xs font-medium border border-amber-200 dark:border-amber-800">
                  Set GEMINI_API_KEY in .env.local to enable answers.
                </div>
              )}

              <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div
                      className={`w-12 h-12 mx-auto mb-3 rounded-full ${AI_BTN} flex items-center justify-center`}
                    >
                      <Sparkles className="w-6 h-6" strokeWidth={2.2} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                      Ask anything about tasks, FMS steps, helpdesk, and more.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                      {SUGGESTED_PROMPTS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => sendMessage(p)}
                          className="text-[11px] px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 hover:border-indigo-500 hover:text-indigo-600 font-semibold transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.role === 'user'
                          ? `${AI_BTN} font-medium`
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                      }`}
                    >
                      {m.content}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-600/50 space-y-1">
                          {m.sources.map((s) => (
                            <Link
                              key={`${s.path}-${s.module}`}
                              href={s.path}
                              className={`block text-[11px] font-bold ${AI_TEXT} hover:underline`}
                            >
                              Open {s.module}
                              {s.count != null ? ` (${s.count})` : ''}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div
                    className={`flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-xl ${AI_SURFACE}`}
                  >
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{loadingHint}</span>
                  </div>
                )}
              </div>

              <form
                className="p-3 border-t border-gray-100 dark:border-gray-800 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  rows={2}
                  placeholder="Ask about pending tasks, FMS steps…"
                  className={`flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 ${AI_BTN_RING}`}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className={`self-end w-11 h-11 rounded-xl ${AI_BTN} flex items-center justify-center disabled:opacity-40`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className={`fixed bottom-6 right-6 z-[55] w-14 h-14 rounded-full ${AI_BTN} flex items-center justify-center border-2 border-white dark:border-gray-800`}
        aria-label="Open AI Assistant"
      >
        {open ? (
          <X className="w-6 h-6" strokeWidth={2.5} />
        ) : (
          <Sparkles className="w-7 h-7" strokeWidth={2.2} />
        )}
      </motion.button>
    </>
  );
}

export function openErpAssistant() {
  window.dispatchEvent(new CustomEvent('erp-assistant:open'));
}
