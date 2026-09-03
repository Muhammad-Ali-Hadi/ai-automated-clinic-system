import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Stethoscope, Pill, Activity } from 'lucide-react';
import { apiGet, apiList } from '../lib/apiClient';
import { qk } from '../api/keys';
import { CenteredSpinner, ErrorState, Badge, SectionTitle } from '../components/ui/primitives';
import { PageHeader } from '../components/ui/PageHeader';
import { SubResource } from './patient-detail/SubResource';
import { ageFrom, fmtDate, fmtDateTime, fullName } from '../lib/format';
import type { Consultation, Patient, Prescription } from '../lib/types';
import { ApiError } from '../lib/apiError';

const TABS = ['Overview', 'Clinical history', 'Timeline'] as const;
type Tab = (typeof TABS)[number];

export function PatientDetailPage() {
  const { patientId = '' } = useParams();
  const [tab, setTab] = useState<Tab>('Overview');

  const patient = useQuery({
    queryKey: qk.patient(patientId),
    queryFn: () => apiGet<Patient>(`/patients/${patientId}`),
    enabled: !!patientId,
  });

  if (patient.isLoading) return <CenteredSpinner label="Loading patient…" />;
  if (patient.error)
    return <ErrorState message={(patient.error as ApiError).message} onRetry={() => patient.refetch()} />;

  const p = patient.data!;

  return (
    <>
      <Link to="/patients" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All patients
      </Link>

      <PageHeader
        title={fullName(p)}
        subtitle={`MRN ${p.medicalRecordNumber} · ${fmtDate(p.dateOfBirth)} (${ageFrom(p.dateOfBirth)})`}
        actions={<Badge value={p.status ?? 'ACTIVE'} />}
      />

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === t
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="card p-5">
            <SectionTitle>Demographics</SectionTitle>
            <dl className="space-y-2 text-sm">
              <Row label="Full name" value={fullName(p)} />
              <Row label="Date of birth" value={`${fmtDate(p.dateOfBirth)} · ${ageFrom(p.dateOfBirth)}`} />
              <Row label="Phone" value={p.phone || '—'} />
              <Row label="Email" value={p.email || '—'} />
              <Row label="Registered" value={fmtDate(p.createdAt)} />
            </dl>
          </div>

          <SubResource
            patientId={patientId}
            sub="allergies"
            title="Allergies"
            path="allergies"
            list={false}
            rowKey={(r) => String(r.id)}
            columns={[
              { header: 'substance', render: (r) => String(r.substance ?? '') },
              { header: 'severity', render: (r) => <Badge value={String(r.severity ?? '')} /> },
              { header: 'reaction', render: (r) => (r.reaction ? String(r.reaction) : '') },
            ]}
            addFields={[
              { name: 'substance', label: 'Substance', required: true },
              {
                name: 'severity',
                label: 'Severity',
                type: 'select',
                options: ['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'].map((v) => ({ value: v, label: v })),
              },
              { name: 'reaction', label: 'Reaction', type: 'textarea' },
            ]}
          />

          <SubResource
            patientId={patientId}
            sub="chronic-diseases"
            title="Chronic diseases"
            path="chronic-diseases"
            list={false}
            rowKey={(r) => String(r.id)}
            columns={[
              { header: 'name', render: (r) => String(r.name ?? '') },
              { header: 'diagnosed', render: (r) => (r.diagnosedAt ? fmtDate(String(r.diagnosedAt)) : '') },
            ]}
            addFields={[
              { name: 'name', label: 'Condition', required: true },
              { name: 'diagnosedAt', label: 'Diagnosed on', type: 'date' },
              { name: 'notes', label: 'Notes', type: 'textarea' },
            ]}
          />

          <SubResource
            patientId={patientId}
            sub="insurance"
            title="Insurance"
            path="insurance"
            list={false}
            rowKey={(r) => String(r.id)}
            columns={[
              { header: 'provider', render: (r) => String(r.provider ?? '') },
              { header: 'policy', render: (r) => String(r.policyNumber ?? '') },
            ]}
            addFields={[
              { name: 'provider', label: 'Provider', required: true },
              { name: 'policyNumber', label: 'Policy number', required: true },
            ]}
          />

          <SubResource
            patientId={patientId}
            sub="emergency-contacts"
            title="Emergency contacts"
            path="emergency-contacts"
            list={false}
            rowKey={(r) => String(r.id)}
            columns={[
              { header: 'name', render: (r) => String(r.name ?? '') },
              { header: 'relationship', render: (r) => String(r.relationship ?? '') },
              { header: 'phone', render: (r) => String(r.phone ?? '') },
            ]}
            addFields={[
              { name: 'name', label: 'Name', required: true },
              { name: 'relationship', label: 'Relationship', required: true },
              { name: 'phone', label: 'Phone', required: true },
            ]}
          />

          <SubResource
            patientId={patientId}
            sub="vitals"
            title="Vitals"
            path="vitals"
            rowKey={(r) => String(r.id)}
            deletable={false}
            columns={[
              { header: 'when', render: (r) => fmtDateTime(String(r.createdAt ?? r.recordedAt ?? '')) },
              { header: 'temp', render: (r) => (r.temperature ? `${r.temperature}°C` : '') },
              {
                header: 'bp',
                render: (r) => (r.systolicBp ? `${r.systolicBp}/${r.diastolicBp} mmHg` : ''),
              },
              { header: 'pulse', render: (r) => (r.pulse ? `${r.pulse} bpm` : '') },
              { header: 'weight', render: (r) => (r.weightKg ? `${r.weightKg} kg` : '') },
            ]}
            addFields={[
              { name: 'temperature', label: 'Temperature (°C)', type: 'number' },
              { name: 'systolicBp', label: 'Systolic BP', type: 'number' },
              { name: 'diastolicBp', label: 'Diastolic BP', type: 'number' },
              { name: 'pulse', label: 'Pulse (bpm)', type: 'number' },
              { name: 'weightKg', label: 'Weight (kg)', type: 'number' },
            ]}
          />

          <SubResource
            patientId={patientId}
            sub="notes"
            title="Clinical notes"
            path="notes"
            rowKey={(r) => String(r.id)}
            deletable={false}
            columns={[
              { header: 'when', render: (r) => fmtDateTime(String(r.createdAt ?? '')) },
              { header: 'content', render: (r) => String(r.content ?? '') },
            ]}
            addFields={[{ name: 'content', label: 'Note', type: 'textarea', required: true }]}
          />
        </div>
      )}

      {tab === 'Clinical history' && <ClinicalHistory patientId={patientId} />}
      {tab === 'Timeline' && <Timeline patientId={patientId} />}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function ClinicalHistory({ patientId }: { patientId: string }) {
  const consultations = useQuery({
    queryKey: qk.patientSub(patientId, 'consultations'),
    queryFn: () => apiList<Consultation>(`/patients/${patientId}/consultations`, { limit: 25 }),
  });
  const prescriptions = useQuery({
    queryKey: qk.patientSub(patientId, 'prescriptions'),
    queryFn: () => apiList<Prescription>(`/patients/${patientId}/prescriptions`, { limit: 25 }),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-5">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Stethoscope className="h-4 w-4" /> Consultations
          </span>
        </SectionTitle>
        {consultations.isLoading ? (
          <CenteredSpinner />
        ) : (consultations.data?.items.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No consultations recorded.</p>
        ) : (
          <ul className="space-y-3">
            {consultations.data!.items.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">{c.diagnosis || 'Consultation'}</span>
                  <span className="text-xs text-slate-400">{fmtDate(c.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-3 text-slate-500">{c.clinicalNotes}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-5">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Pill className="h-4 w-4" /> Prescriptions
          </span>
        </SectionTitle>
        {prescriptions.isLoading ? (
          <CenteredSpinner />
        ) : (prescriptions.data?.items.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No prescriptions issued.</p>
        ) : (
          <ul className="space-y-2">
            {prescriptions.data!.items.map((rx) => (
              <li key={rx.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-700">{rx.medicineName}</p>
                  <p className="text-xs text-slate-400">
                    {rx.dosage} · {rx.frequency} · {rx.durationDays}d
                  </p>
                </div>
                <Badge value={rx.status ?? 'ACTIVE'} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Timeline({ patientId }: { patientId: string }) {
  const query = useQuery({
    queryKey: qk.patientSub(patientId, 'timeline'),
    queryFn: () => apiGet<{ events?: TimelineEvent[] } | TimelineEvent[]>(`/patients/${patientId}/timeline`),
  });

  if (query.isLoading) return <CenteredSpinner />;
  if (query.error) return <ErrorState message={(query.error as ApiError).message} onRetry={() => query.refetch()} />;

  const raw = query.data;
  const events: TimelineEvent[] = Array.isArray(raw) ? raw : (raw?.events ?? []);

  if (events.length === 0)
    return <p className="py-10 text-center text-sm text-slate-400">No timeline events yet.</p>;

  return (
    <div className="card p-6">
      <ol className="relative space-y-6 border-l border-slate-200 pl-6">
        {events.map((e, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full bg-brand-100">
              <Activity className="h-2.5 w-2.5 text-brand-700" />
            </span>
            <p className="text-sm font-semibold text-slate-700">{e.title ?? e.type ?? 'Event'}</p>
            {e.description && <p className="text-sm text-slate-500">{e.description}</p>}
            <p className="text-xs text-slate-400">{fmtDateTime(e.at ?? e.date ?? e.createdAt)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface TimelineEvent {
  title?: string;
  type?: string;
  description?: string;
  at?: string;
  date?: string;
  createdAt?: string;
}
