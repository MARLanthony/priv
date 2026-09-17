export type UserRole = 'system_admin' | 'attorney' | 'legal_secretary' | 'user';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  specialization?: string;
  barNumber?: string;
  createdAt: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export type CaseStatus = 'active' | 'pending' | 'discovery' | 'closed' | 'archived';
export type CasePriority = 'high' | 'medium' | 'low';

export interface Case {
  id: number;
  title: string;
  caseNumber: string;
  type: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedToId: number;
  assignedToName?: string;
  clientId: number;
  clientName?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  nextHearing?: string;
  notes?: string;
}

export interface Document {
  id: number;
  name: string;
  type: string;
  size: string;
  caseId: number;
  caseName?: string;
  uploadedBy: number;
  uploadedByName?: string;
  uploadedAt: string;
  category: string;
}

export interface InboxMessage {
  id: number;
  from: string;
  fromEmail: string;
  to: string;
  toEmail: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  userId: number;
  replies?: InboxReply[];
}

export interface InboxReply {
  id: number;
  from: string;
  body: string;
  date: string;
}

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
}

export interface Appointment {
  id: number;
  title: string;
  clientId: number;
  clientName: string;
  attorneyId: number;
  attorneyName: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'hearing' | 'meeting' | 'deposition';
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  location?: string;
}

export interface AppointmentSlot {
  date: string;
  time: string;
  available: boolean;
}

export interface Availability {
  id: number;
  attorneyId: number;
  attorneyName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  department: string;
  joinDate: string;
  status: 'active' | 'inactive';
  specialization?: string;
}

export interface DashboardStats {
  totalCases: number;
  activeCases: number;
  pendingCases: number;
  closedCases: number;
  totalClients: number;
  totalDocuments: number;
  upcomingAppointments: number;
  unreadMessages: number;
}

export interface SidebarItem {
  label: string;
  path: string;
  icon: string;
}
