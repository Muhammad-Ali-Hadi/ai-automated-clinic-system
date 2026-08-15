import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { prisma } from '../lib/prisma.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

const buildDateRange = (from?: string, to?: string) => ({
  ...(from ? { gte: new Date(from) } : {}),
  ...(to ? { lte: new Date(to) } : {}),
});

export const reportService = {
  /**
   * Dashboard summary – headline KPIs for the hospital.
   */
  async getDashboardSummary(auth: TenantAuth) {
    const hospitalId = hid(auth);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [
      totalPatients,
      activePatients,
      todayAppointments,
      pendingInvoices,
      totalRevenue,
      totalLabTests,
    ] = await Promise.all([
      prisma.patient.count({ where: { hospitalId } }),
      prisma.patient.count({ where: { hospitalId, status: 'ACTIVE' } }),
      prisma.appointment.count({
        where: { hospitalId, scheduledAt: { gte: today } },
      }),
      prisma.invoice.count({ where: { hospitalId, status: 'PENDING' } }),
      prisma.invoice.aggregate({
        _sum: { total: true },
        where: { hospitalId, status: 'PAID' },
      }),
      prisma.labTest.count({ where: { hospitalId } }),
    ]);

    return {
      totalPatients,
      activePatients,
      todayAppointments,
      pendingInvoices,
      totalRevenue: Number(totalRevenue._sum.total ?? 0),
      totalLabTests,
    };
  },

  /**
   * Revenue report – daily/monthly breakdown of invoiced and collected amounts.
   */
  async getRevenueReport(
    auth: TenantAuth,
    query: { from?: string; to?: string; groupBy?: 'day' | 'month' }
  ) {
    const hospitalId = hid(auth);
    const dateFilter = buildDateRange(query.from, query.to);

    const invoices = await prisma.invoice.findMany({
      where: {
        hospitalId,
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
      select: {
        total: true,
        discount: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const groupBy = query.groupBy ?? 'day';
    const buckets: Record<string, { invoiced: number; collected: number; refunded: number }> = {};

    for (const inv of invoices) {
      const key =
        groupBy === 'day'
          ? inv.createdAt.toISOString().slice(0, 10)
          : inv.createdAt.toISOString().slice(0, 7);

      if (!buckets[key]) buckets[key] = { invoiced: 0, collected: 0, refunded: 0 };

      const total = Number(inv.total);
      buckets[key]!.invoiced += total;
      if (inv.status === 'PAID') buckets[key]!.collected += total;
      if (inv.status === 'REFUNDED') buckets[key]!.refunded += total;
    }

    return Object.entries(buckets).map(([period, data]) => ({ period, ...data }));
  },

  /**
   * Appointment analytics – status breakdown, doctor utilization.
   */
  async getAppointmentAnalytics(
    auth: TenantAuth,
    query: { from?: string; to?: string; doctorId?: string }
  ) {
    const hospitalId = hid(auth);
    const dateFilter = buildDateRange(query.from, query.to);

    const [statusCounts, byDoctor] = await Promise.all([
      prisma.appointment.groupBy({
        by: ['status'],
        where: {
          hospitalId,
          ...(query.doctorId ? { doctorId: query.doctorId } : {}),
          ...(Object.keys(dateFilter).length > 0 ? { scheduledAt: dateFilter } : {}),
        },
        _count: { status: true },
      }),
      prisma.appointment.groupBy({
        by: ['doctorId'],
        where: {
          hospitalId,
          ...(Object.keys(dateFilter).length > 0 ? { scheduledAt: dateFilter } : {}),
        },
        _count: { doctorId: true },
        orderBy: { _count: { doctorId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      byStatus: statusCounts.map((s) => ({ status: s.status, count: s._count.status })),
      topDoctors: byDoctor.map((d) => ({ doctorId: d.doctorId, count: d._count.doctorId })),
    };
  },

  /**
   * Patient growth report – new registrations over time.
   */
  async getPatientGrowthReport(
    auth: TenantAuth,
    query: { from?: string; to?: string; groupBy?: 'day' | 'month' }
  ) {
    const hospitalId = hid(auth);
    const dateFilter = buildDateRange(query.from, query.to);

    const patients = await prisma.patient.findMany({
      where: {
        hospitalId,
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const groupBy = query.groupBy ?? 'day';
    const buckets: Record<string, number> = {};

    for (const patient of patients) {
      const key =
        groupBy === 'day'
          ? patient.createdAt.toISOString().slice(0, 10)
          : patient.createdAt.toISOString().slice(0, 7);
      buckets[key] = (buckets[key] ?? 0) + 1;
    }

    return Object.entries(buckets).map(([period, count]) => ({ period, count }));
  },

  /**
   * Doctor performance – consultations per doctor.
   */
  async getDoctorPerformance(auth: TenantAuth, query: { from?: string; to?: string }) {
    const hospitalId = hid(auth);
    const dateFilter = buildDateRange(query.from, query.to);

    const rows = await prisma.consultation.groupBy({
      by: ['doctorId'],
      where: {
        hospitalId,
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      _count: { doctorId: true },
      orderBy: { _count: { doctorId: 'desc' } },
      take: 20,
    });

    return rows.map((r) => ({ doctorId: r.doctorId, consultations: r._count.doctorId }));
  },

  /**
   * Laboratory report – test status breakdown.
   */
  async getLabReport(auth: TenantAuth, query: { from?: string; to?: string }) {
    const hospitalId = hid(auth);
    const dateFilter = buildDateRange(query.from, query.to);

    const rows = await prisma.labTest.groupBy({
      by: ['status'],
      where: {
        hospitalId,
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      _count: { status: true },
    });

    return rows.map((r) => ({ status: r.status, count: r._count.status }));
  },

  /**
   * Pharmacy/inventory report – low-stock and expiry summary.
   */
  async getPharmacyReport(auth: TenantAuth) {
    const hospitalId = hid(auth);
    const now = new Date();

    const [lowStock, expiring] = await Promise.all([
      prisma.medicine.findMany({
        where: { hospitalId, quantity: { lte: prisma.medicine.fields.reorderLevel } },
        select: { id: true, name: true, sku: true, quantity: true, reorderLevel: true },
        orderBy: { quantity: 'asc' },
        take: 50,
      }),
      prisma.medicine.findMany({
        where: { hospitalId, expiresAt: { lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
        select: { id: true, name: true, sku: true, expiresAt: true },
        orderBy: { expiresAt: 'asc' },
        take: 50,
      }),
    ]);

    return { lowStock, expiringSoon: expiring };
  },
};
