import { useState } from 'react';
import { BookOpen, Upload, Search } from 'lucide-react';
import { aiApi } from '../../api/ai';
import type { AiResult } from '../../api/ai';
import { useApiMutation } from '../../api/mutations';
import { Button } from '../../components/ui/primitives';
import { TextField, TextAreaField, SelectField } from '../../components/ui/Field';
import { ResultCard } from './ResultCard';
import { useAiStatus } from '../../api/ai';

export function KnowledgePanel() {
  const status = useAiStatus();
  const [doc, setDoc] = useState({ title: '', category: 'guideline', content: '' });
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AiResult>();

  const ingest = useApiMutation<void, AiResult>({
    mutationFn: () => aiApi.knowledgeIngest({ content: doc.content, title: doc.title || undefined, category: doc.category }),
    successMessage: 'Document indexed into the knowledge base.',
    onSuccess: () => setDoc((d) => ({ ...d, content: '' })),
  });

  const query = useApiMutation<void, AiResult>({
    mutationFn: () => aiApi.knowledgeQuery({ question }),
    onSuccess: (data) => setAnswer(data),
  });

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Knowledge base (RAG)</h2>
        <p className="text-sm text-slate-500">
          Index policies and guidelines, then ask questions answered from those documents.
        </p>
      </div>

      {status.data && !status.data.openai.configured && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Embeddings need a valid <b>OPENAI_API_KEY</b>. A running <b>Qdrant</b> at{' '}
          <code>{status.data.vectorStore.url}</code> is also required for retrieval.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600">
            <BookOpen className="h-4 w-4" /> Index a document
          </div>
          <div className="space-y-3">
            <TextField label="Title" value={doc.title} onChange={(e) => setDoc((d) => ({ ...d, title: e.target.value }))} />
            <SelectField
              label="Category"
              options={['policy', 'guideline', 'sop', 'handbook', 'faq'].map((v) => ({ value: v, label: v }))}
              value={doc.category}
              onChange={(e) => setDoc((d) => ({ ...d, category: e.target.value }))}
            />
            <TextAreaField
              label="Content"
              rows={8}
              value={doc.content}
              onChange={(e) => setDoc((d) => ({ ...d, content: e.target.value }))}
              placeholder="Paste the full text of a policy or clinical guideline…"
            />
            <Button
              icon={<Upload className="h-4 w-4" />}
              loading={ingest.isPending}
              disabled={doc.content.trim().length < 20}
              onClick={() => ingest.mutate()}
            >
              Index document
            </Button>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600">
            <Search className="h-4 w-4" /> Ask the knowledge base
          </div>
          <div className="space-y-3">
            <TextAreaField
              label="Question"
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What is our antibiotic stewardship policy for sepsis?"
            />
            <Button
              icon={<Search className="h-4 w-4" />}
              loading={query.isPending}
              disabled={question.trim().length < 3}
              onClick={() => query.mutate()}
            >
              Search
            </Button>
          </div>
          <ResultCard result={answer} />
        </div>
      </div>
    </div>
  );
}
