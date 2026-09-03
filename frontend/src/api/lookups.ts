import { useQuery } from '@tanstack/react-query';
import { apiList } from '../lib/apiClient';
import { qk } from './keys';
import { fullName } from '../lib/format';
import type { Department, Doctor, Patient } from '../lib/types';

/** Lightweight lists used to populate <select> controls across forms. */

export function usePatientOptions(search?: string) {
  const query = useQuery({
    queryKey: qk.patients({ picker: true, search }),
    queryFn: () => apiList<Patient>('/patients', { limit: 50, search: search || undefined }),
    staleTime: 20_000,
  });
  const options = (query.data?.items ?? []).map((p) => ({
    value: p.id,
    label: `${fullName(p)} · ${p.medicalRecordNumber}`,
  }));
  return { ...query, options };
}

export function useDoctorOptions() {
  const query = useQuery({
    queryKey: qk.doctors({ picker: true }),
    queryFn: () => apiList<Doctor>('/doctors', { limit: 100 }),
    staleTime: 60_000,
  });
  const options = (query.data?.items ?? []).map((d) => ({
    value: d.id,
    label: d.user ? `${fullName(d.user)} · ${d.specialization}` : d.specialization,
  }));
  return { ...query, options };
}

export function useDepartmentOptions() {
  const query = useQuery({
    queryKey: qk.departments({ picker: true }),
    queryFn: () => apiList<Department>('/departments', { limit: 100 }),
    staleTime: 60_000,
  });
  const options = (query.data?.items ?? []).map((d) => ({ value: d.id, label: d.name }));
  return { ...query, options };
}
