import { useRef, useState, useEffect, type FormEvent } from 'react';
import { Send, Bot, User, Loader2, RotateCcw } from 'lucide-react';
import { aiApi, primaryText } from '../../api/ai';
import { ApiError } from '../../lib/apiError';
import { Button } from '../../components/ui/primitives';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  meta?: string;
}

export function ChatPanel({ mode }: { mode: 'clinical' | 'receptionist' }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sessionRef = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    sessionRef.current = undefined;
    setError('');
  }, [mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    try {
      const res =
        mode === 'clinical'
          ? await aiApi.chat({ message: text, sessionId: sessionRef.current })
          : await aiApi.receptionist({ patientQuery: text, sessionId: sessionRef.current });
      if (typeof res.requestId === 'string') sessionRef.current = res.requestId;
      else if (typeof res.sessionId === 'string') sessionRef.current = res.sessionId;
      const meta = [res.model, res.latencyMs ? `${res.latencyMs} ms` : null].filter(Boolean).join(' · ');
      setMessages((m) => [...m, { role: 'assistant', text: primaryText(res) || '(empty response)', meta }]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Request failed';
      setError(msg);
      setMessages((m) => [...m, { role: 'assistant', text: `⚠️ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-14rem)] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            {mode === 'clinical' ? 'Clinical assistant' : 'AI receptionist'}
          </h2>
          <p className="text-sm text-slate-500">
            {mode === 'clinical'
              ? 'Multi-turn clinical Q&A with conversation memory.'
              : 'Front-desk assistant for booking, FAQs and routing.'}
          </p>
        </div>
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          onClick={() => {
            setMessages([]);
            sessionRef.current = undefined;
          }}
        >
          New conversation
        </Button>
      </div>

      <div ref={scrollRef} className="card flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-400">
            <Bot className="h-8 w-8" />
            <p className="text-sm">Ask a question to start.</p>
            <p className="max-w-sm text-xs">
              e.g. “Summarise the standard workflow for a new patient with chest pain.”
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`max-w-[75%] ${m.role === 'user' ? 'text-right' : ''}`}>
              <div
                className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.text}
              </div>
              {m.meta && <p className="mt-1 text-[11px] text-slate-400">{m.meta}</p>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> thinking…
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" loading={busy} icon={!busy && <Send className="h-4 w-4" />}>
          Send
        </Button>
      </form>
    </div>
  );
}
