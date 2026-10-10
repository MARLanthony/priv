/* ==========================================================================
   JurisFlow — shared types
   --------------------------------------------------------------------------
   The system follows a four-role flow. Everything else (navigation, RBAC,
   dashboards, API services, MSW mocks) is derived from these types.
   ========================================================================== */

/** The four roles of the new flow. */
export type UserRole = 'admin' | 'lawyer' | 'staff' | 'client';

export const USER_ROLES: UserRole[] = ['admin', 'lawyer', 'staff', 'client'];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin / Owner',
  lawyer: 'Lawyer / Attorney',
  staff: "Staff / Lawyer's Assistant",
  client: 'Client / User',
};

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  address?: string;
  avatar?: string;
  specialization?: string;
  barNumber?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/* ------------------------------------------------------------------ Clients */

export interface Client {
  id: number;
  userId: number;
  fullName: string;
  email?: string;
  contact: string;
  address: string;
  createdAt: string;
}

/* -------------------------------------------------------------------- Cases */

export type CaseStatus = 'open' | 'pending' | 'active' | 'discovery' | 'closed' | 'archived';
export type CasePriority = 'high' | 'medium' | 'low';

export interface Case {
  id: number;
  clientId: number;
  clientName?: string;
  caseNumber: string;
  title: string;
  type: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedLawyerId: number | null;
  assignedLawyerName?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------ Consultations */

export type ConsultationStatus = 'pending' | 'approved' | 'declined' | 'completed';

export interface Consultation {
  id: number;
  clientId: number;
  clientName?: string;
  serviceId: number | null;
  serviceName?: string;
  concern: string;
  status: ConsultationStatus;
  reviewedBy: number | null;
  reviewedByName?: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------- Appointments */

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'rescheduled' | 'completed' | 'cancelled';

export interface Appointment {
  id: number;
  clientId: number;
  clientName?: string;
  consultationId: number | null;
  lawyerId: number | null;
  lawyerName?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** A bookable slot (used by the client booking page and the AI layer). */
export interface AppointmentSlot {
  date: string;
  time: string;
  available: boolean;
}

export interface Availability {
  id: number;
  lawyerId: number;
  lawyerName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

/* ---------------------------------------------------------------- Documents */

export type DocumentStatus = 'received' | 'reviewing' | 'processed' | 'rejected';

export interface Document {
  id: number;
  clientId: number;
  clientName?: string;
  caseId: number | null;
  caseName?: string;
  name: string;
  fileUrl: string;
  uploadedBy: number;
  uploadedByName?: string;
  status: DocumentStatus;
  createdAt: string;
}

/* ------------------------------------------------------------- NLP results */

export interface NLPResult {
  id: number;
  documentId: number;
  documentName?: string;
  classification: string;
  extractedInfo: Record<string, unknown>;
  summary: string;
  createdAt: string;
}

/* ---------------------------------------------------------- Legal services */

export interface LegalService {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

/* --------------------------------------------------------------------- FAQs */

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: string;
  createdBy: number | null;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------ Notifications */

export type NotificationType = 'consultation' | 'appointment' | 'case' | 'document' | 'system';

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  email: boolean;
  inApp: boolean;
  consultations: boolean;
  appointments: boolean;
  documents: boolean;
}

/* ------------------------------------------------------------ Activity logs */

export interface ActivityLog {
  id: number;
  userId: number;
  userName?: string;
  action: string;
  details: string;
  createdAt: string;
}

/* -------------------------------------------------------- Roles/permissions */

export type Permission =
  | 'users.read' | 'users.write'
  | 'roles.manage'
  | 'clients.read' | 'clients.write'
  | 'cases.read' | 'cases.write'
  | 'consultations.read' | 'consultations.review'
  | 'appointments.read' | 'appointments.write'
  | 'documents.read' | 'documents.write'
  | 'nlp.run'
  | 'faqs.read' | 'faqs.write'
  | 'notifications.read' | 'notifications.settings'
  | 'reports.read'
  | 'activity.read'
  | 'settings.manage';

export interface RolePermission {
  id: number;
  role: UserRole;
  permission: Permission;
  createdAt: string;
}

/* ---------------------------------------------------------------- Dashboard */

export interface DashboardStats {
  users?: number;
  clients: number;
  cases: number;
  consultations: number;
  appointments: number;
  documents: number;
  unreadNotifications?: number;
}

/* ------------------------------------------- Articles (used by the AI layer) */

export interface Article {
  id: number;
  title: string;
  category: string;
  keywords: string[];
  summary: string;
  content: string;
  attorneySpecialist: string;
  servicesNeeded: string[];
  status: 'published' | 'draft';
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Shape produced by the AI legal-intake pipeline (kept for the AI module). */
export interface NLPAnalysis {
  query: string;
  extractedKeywords: string[];
  suggestedCaseType: string;
  confidence: number;
  matchedArticles: Article[];
  recommendedAttorney: {
    name: string;
    specialization: string;
    availableSlots: AppointmentSlot[];
  };
  requiredServices: string[];
  nextSteps: string[];
  /** Plain-language assessment written by the model (`LegalAnalysis.summary`). */
  summary?: string;
}

/* -------------------------------------------------------------- Misc / views */

export interface SidebarItem {
  label: string;
  path: string;
  /** Key into `NAV_ICONS` in `components/Sidebar.tsx`. */
  icon: string;
  /** Optional grouping label used by the sidebar; items keep their order. */
  section?: string;
}

export interface ApiError {
  error: string;
  status?: number;
}
