import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Sparkles,
  Users,
  CalendarDays,
  ListChecks,
  Stethoscope,
  Pill,
  FlaskConical,
  Receipt,
  Boxes,
  Truck,
  Bell,
  BarChart3,
  ScrollText,
  Building2,
  UserCog,
  BadgeCheck,
  ClipboardList,
} from 'lucide-react';
import type { Role } from '../../lib/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[]; // undefined => everyone
  section: string;
}

const ALL: Role[] = [
  'HOSPITAL_ADMIN',
  'DOCTOR',
  'RECEPTIONIST',
  'NURSE',
  'PHARMACIST',
  'LABORATORY_TECHNICIAN',
  'ACCOUNTANT',
];

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, section: 'Overview', roles: ['HOSPITAL_ADMIN'] },
  { to: '/ai', label: 'AI Assistant', icon: Sparkles, section: 'Overview', roles: ALL },
  { to: '/reports', label: 'Reports', icon: BarChart3, section: 'Overview', roles: ['HOSPITAL_ADMIN', 'ACCOUNTANT', 'DOCTOR', 'NURSE'] },

  { to: '/patients', label: 'Patients', icon: Users, section: 'Clinical', roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'] },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays, section: 'Clinical', roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'] },
  { to: '/queue', label: 'Live Queue', icon: ListChecks, section: 'Clinical', roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'] },
  { to: '/consultations', label: 'Consultations', icon: Stethoscope, section: 'Clinical', roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'] },
  { to: '/prescriptions', label: 'Prescriptions', icon: ClipboardList, section: 'Clinical', roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST'] },
  { to: '/lab-tests', label: 'Laboratory', icon: FlaskConical, section: 'Clinical', roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'LABORATORY_TECHNICIAN', 'RECEPTIONIST'] },

  { to: '/pharmacy', label: 'Pharmacy', icon: Pill, section: 'Operations', roles: ['HOSPITAL_ADMIN', 'PHARMACIST', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
  { to: '/invoices', label: 'Billing', icon: Receipt, section: 'Operations', roles: ['HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST', 'DOCTOR', 'NURSE'] },
  { to: '/inventory', label: 'Inventory', icon: Boxes, section: 'Operations', roles: ['HOSPITAL_ADMIN', 'PHARMACIST', 'NURSE'] },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, section: 'Operations', roles: ['HOSPITAL_ADMIN', 'PHARMACIST'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, section: 'Operations', roles: ALL },

  { to: '/doctors', label: 'Doctors', icon: BadgeCheck, section: 'Administration', roles: ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'NURSE'] },
  { to: '/departments', label: 'Departments', icon: Building2, section: 'Administration', roles: ['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'] },
  { to: '/employees', label: 'Staff / HR', icon: UserCog, section: 'Administration', roles: ['HOSPITAL_ADMIN'] },
  { to: '/users', label: 'Users & Roles', icon: UserCog, section: 'Administration', roles: ['HOSPITAL_ADMIN'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, section: 'Administration', roles: ['HOSPITAL_ADMIN'] },
];

export function navFor(role: Role | undefined): NavItem[] {
  if (!role) return [];
  if (role === 'SUPER_ADMIN') return NAV;
  return NAV.filter((n) => !n.roles || n.roles.includes(role));
}

export const SECTION_ORDER = ['Overview', 'Clinical', 'Operations', 'Administration'];
