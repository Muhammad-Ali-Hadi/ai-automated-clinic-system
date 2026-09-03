import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Headset,
  BookOpen,
  Mic,
  Wand2,
  Stethoscope,
  HeartHandshake,
  Wallet,
  Pill,
  FileText,
  LineChart,
  FlaskConical,
  ClipboardList,
  Sparkles,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/cn';
import { useAuth } from '../features/auth/AuthProvider';
import { useAiStatus } from '../api/ai';
import { FORM_TOOLS } from './ai/toolConfig';
import { FormToolPanel } from './ai/FormToolPanel';
import { ChatPanel } from './ai/ChatPanel';
import { KnowledgePanel } from './ai/KnowledgePanel';
import { VoicePanel } from './ai/VoicePanel';
import { SmartSearchPanel } from './ai/SmartSearchPanel';
import type { Role } from '../lib/types';

interface Entry {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  roles?: Role[];
  render: () => JSX.Element;
}

const FORM_ICONS: Record<string, LucideIcon> = {
  'discharge-summary': ClipboardList,
  'prescription-draft': Pill,
  'lab-interpretation': FlaskConical,
  'lab-analysis': FlaskConical,
  'patient-explainer': HeartHandshake,
  billing: Wallet,
  pharmacy: Pill,
  document: FileText,
  analytics: LineChart,
};

export function AiAssistantPage() {
  const { user } = useAuth();
  const status = useAiStatus();
  const [params, setParams] = useSearchParams();

  const entries = useMemo<Entry[]>(() => {
    const base: Entry[] = [
      { id: 'clinical-chat', label: 'Clinical assistant', icon: MessageSquare, group: 'Conversational', render: () => <ChatPanel mode="clinical" /> },
      { id: 'receptionist', label: 'AI receptionist', icon: Headset, group: 'Conversational', render: () => <ChatPanel mode="receptionist" /> },
      { id: 'knowledge', label: 'Knowledge base', icon: BookOpen, group: 'Conversational', render: () => <KnowledgePanel /> },
      { id: 'smart-search', label: 'Smart search', icon: Wand2, group: 'Conversational', render: () => <SmartSearchPanel /> },
      { id: 'voice', label: 'Voice transcription', icon: Mic, group: 'Conversational', render: () => <VoicePanel /> },
    ];
    const forms: Entry[] = FORM_TOOLS.map((t) => ({
      id: t.id,
      label: t.title,
      icon: FORM_ICONS[t.id] ?? Stethoscope,
      group: t.group,
      roles: t.roles,
      render: () => <FormToolPanel tool={t} />,
    }));
    return [...base, ...forms].filter(
      (e) => !e.roles || user?.role === 'SUPER_ADMIN' || e.roles.includes(user!.role),
    );
  }, [user]);

  const activeId = params.get('tool') && entries.some((e) => e.id === params.get('tool')) ? params.get('tool')! : entries[0]?.id;
  const [fallback, setFallback] = useState(entries[0]?.id);
  const current = entries.find((e) => e.id === activeId) ?? entries.find((e) => e.id === fallback) ?? entries[0];

  const select = (id: string) => {
    setFallback(id);
    setParams((p) => {
      const sp = new URLSearchParams(p);
      sp.set('tool', id);
      return sp;
    }, { replace: true });
  };

  const groups = ['Conversational', 'Doctor tools', 'Patient', 'Operations'].filter((g) =>
    entries.some((e) => e.group === g),
  );

  return (
    <>
      <PageHeader
        title="AI Assistant"
        subtitle="The Rizocare AI modules, wired to your hospital data."
        actions={
          status.data && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                status.data.openai.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
              )}
            >
              {status.data.openai.configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {status.data.openai.configured
                ? `OpenAI ready · ${status.data.openai.chatModel}`
                : 'OPENAI_API_KEY not set'}
            </span>
          )
        }
      />

      {status.data && !status.data.openai.configured && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Add an OpenAI API key to enable live responses.</p>
            <p className="mt-1 text-amber-700">
              Put <code className="rounded bg-amber-100 px-1">OPENAI_API_KEY=sk-…</code> in the project&apos;s root{' '}
              <code className="rounded bg-amber-100 px-1">.env</code> and restart the API. Conversation memory is currently{' '}
              <b>{status.data.memory.mode === 'redis' ? 'Redis-backed' : 'in-process'}</b>; knowledge-base retrieval also
              needs Qdrant at <code className="rounded bg-amber-100 px-1">{status.data.vectorStore.url}</code>.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-4">
          {groups.map((g) => (
            <div key={g}>
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{g}</p>
              <div className="space-y-0.5">
                {entries
                  .filter((e) => e.group === g)
                  .map((e) => (
                    <button
                      key={e.id}
                      onClick={() => select(e.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition',
                        current?.id === e.id
                          ? 'bg-brand-50 text-brand-800'
                          : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      <e.icon className="h-4 w-4 shrink-0" />
                      {e.label}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="min-w-0">{current?.render()}</div>
      </div>
    </>
  );
}
