import { useRef, useState } from 'react';
import { Mic, Square, Upload } from 'lucide-react';
import { aiApi } from '../../api/ai';
import type { AiResult } from '../../api/ai';
import { useApiMutation } from '../../api/mutations';
import { Button } from '../../components/ui/primitives';
import { ResultCard } from './ResultCard';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function VoicePanel() {
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<{ url: string; blob: Blob; name: string } | null>(null);
  const [result, setResult] = useState<AiResult>();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const transcribe = useApiMutation<void, AiResult>({
    mutationFn: async () => {
      const dataUrl = await blobToBase64(clip!.blob);
      return aiApi.transcribe({ audioBase64: dataUrl, filename: clip!.name });
    },
    onSuccess: (data) => setResult(data),
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        setClip({ url: URL.createObjectURL(blob), blob, name: 'recording.webm' });
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      alert('Microphone access was denied. Use the file upload instead.');
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Voice transcription</h2>
        <p className="text-sm text-slate-500">Record a note or upload an audio file — transcribed with Whisper.</p>
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          {!recording ? (
            <Button icon={<Mic className="h-4 w-4" />} onClick={startRecording}>
              Record
            </Button>
          ) : (
            <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={stopRecording}>
              Stop
            </Button>
          )}

          <label className="btn-outline cursor-pointer">
            <Upload className="h-4 w-4" />
            Upload file
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setClip({ url: URL.createObjectURL(file), blob: file, name: file.name });
              }}
            />
          </label>

          {recording && <span className="flex items-center gap-2 text-sm text-rose-600"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" /> recording…</span>}
        </div>

        {clip && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
            <audio src={clip.url} controls className="h-9" />
            <span className="text-xs text-slate-400">{clip.name}</span>
            <Button className="ml-auto" loading={transcribe.isPending} onClick={() => transcribe.mutate()}>
              Transcribe
            </Button>
          </div>
        )}

        <p className="text-xs text-slate-400">Audio is sent as base64 (max ~15 MB) and processed by OpenAI Whisper.</p>
      </div>

      <ResultCard result={result} />
    </div>
  );
}
