import { describe, expect, it, vi, beforeEach } from 'vitest';
import { appointmentService } from '../services/appointment.service.js';
import { appointmentRepository } from '../repositories/appointment.repository.js';
import { AppError } from '../utils/app-error.js';
import { prisma } from '../lib/prisma.js';

vi.mock('../repositories/appointment.repository.js', () => ({
  appointmentRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    updateStatus: vi.fn(),
    reschedule: vi.fn(),
    cancel: vi.fn(),
    hasConflict: vi.fn(),
    checkIn: vi.fn(),
    checkOut: vi.fn(),
    walkIn: vi.fn(),
    getQueue: vi.fn(),
    createRecurring: vi.fn(),
  },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    doctorAvailability: {
      findMany: vi.fn(),
    },
  },
}));

describe('Appointment Service', () => {
  const mockAuth = {
    userId: 'user-id-123',
    hospitalId: 'hospital-uuid-abc',
    role: 'HOSPITAL_ADMIN' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('books an appointment successfully if no conflicts and within availability', async () => {
    const input = {
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      scheduledAt: '2026-08-10T10:00:00Z', // Monday (weekday 1)
      durationMinutes: 30,
      reason: 'Checkup',
    };
    vi.mocked(prisma.doctorAvailability.findMany).mockResolvedValue([
      { weekday: 1, startsAt: '09:00', endsAt: '17:00', isAvailable: true },
    ] as any);
    vi.mocked(appointmentRepository.hasConflict).mockResolvedValue(false);
    vi.mocked(appointmentRepository.create).mockResolvedValue({ id: 'appt-1', ...input } as any);

    const result = await appointmentService.create(mockAuth, input);
    expect(result.id).toBe('appt-1');
    expect(appointmentRepository.hasConflict).toHaveBeenCalledWith(
      'hospital-uuid-abc',
      'doctor-1',
      new Date(input.scheduledAt),
      30
    );
  });

  it('throws AppError if doctor has a scheduling conflict', async () => {
    const input = {
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      scheduledAt: '2026-08-10T10:00:00Z',
      durationMinutes: 30,
    };
    vi.mocked(prisma.doctorAvailability.findMany).mockResolvedValue([] as any); // no constraints
    vi.mocked(appointmentRepository.hasConflict).mockResolvedValue(true);

    await expect(appointmentService.create(mockAuth, input)).rejects.toThrow(
      new AppError('Doctor already has an appointment at this time.', 409)
    );
  });

  it('throws AppError if appointment day is not in doctor available days', async () => {
    const input = {
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      scheduledAt: '2026-08-10T10:00:00Z', // Monday (weekday 1)
      durationMinutes: 30,
    };
    vi.mocked(prisma.doctorAvailability.findMany).mockResolvedValue([
      { weekday: 2, startsAt: '09:00', endsAt: '17:00', isAvailable: true }, // Only Tuesday
    ] as any);

    await expect(appointmentService.create(mockAuth, input)).rejects.toThrow(
      new AppError('Doctor is not available on this day of the week.', 409)
    );
  });

  it('throws AppError if appointment time is outside doctor available hours', async () => {
    const input = {
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      scheduledAt: '2026-08-10T08:00:00Z', // Monday 8:00 AM (weekday 1)
      durationMinutes: 30,
    };
    vi.mocked(prisma.doctorAvailability.findMany).mockResolvedValue([
      { weekday: 1, startsAt: '09:00', endsAt: '17:00', isAvailable: true },
    ] as any);

    await expect(appointmentService.create(mockAuth, input)).rejects.toThrow(
      new AppError("Appointment time is outside the doctor's available hours.", 409)
    );
  });

  it('checks in an appointment successfully', async () => {
    const appt = { id: 'appt-1', status: 'BOOKED', hospitalId: 'hospital-uuid-abc' };
    vi.mocked(appointmentRepository.findById).mockResolvedValue(appt as any);
    vi.mocked(appointmentRepository.checkIn).mockResolvedValue({ ...appt, status: 'CHECKED_IN' } as any);

    const result = await appointmentService.checkIn(mockAuth, 'appt-1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('CHECKED_IN');
    expect(appointmentRepository.checkIn).toHaveBeenCalledWith('hospital-uuid-abc', 'appt-1');
  });

  it('enforces status transition rules', async () => {
    const appt = { id: 'appt-1', status: 'COMPLETED', hospitalId: 'hospital-uuid-abc' };
    vi.mocked(appointmentRepository.findById).mockResolvedValue(appt as any);

    await expect(
      appointmentService.updateStatus(mockAuth, 'appt-1', 'CHECKED_IN')
    ).rejects.toThrow(new AppError('Cannot transition from COMPLETED to CHECKED_IN.', 400));
  });
});
