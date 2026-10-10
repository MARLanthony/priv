/* ==========================================================================
   MSW seed data
   --------------------------------------------------------------------------
   The in-memory database behind the mock API. It ships the four demo accounts
   (one per role, password `password123`) plus enough records for every screen
   to look alive. Everything lives only in the browser session: reloading the
   page restores this exact state.

   Set `VITE_USE_MOCKS=false` to hit the real Flask + Supabase backend.
   ========================================================================== */

import type {
  ActivityLog,
  Appointment,
  Article,
  Availability,
  Case,
  Client,
  Consultation,
  Document,
  FAQ,
  LegalService,
  NLPResult,
  Notification,
  NotificationSettings,
  RolePermission,
  User,
  UserRole,
} from '../types';
import { ROLE_PERMISSIONS } from '../utils/rbac';
import { DEMO_PASSWORD } from '../utils/demo';

/** A user plus the password the mock auth handler checks against. */
export interface MockUser extends User {
  password: string;
}

/*
 * The demo password lives in `utils/demo.ts`, which the sign-in screen also
 * reads, so the seeded accounts and the one-click sign-in tiles can never
 * disagree. Re-exported here to keep the mock database's public API unchanged.
 */
export { DEMO_PASSWORD };

let nextId = 1000;
/** Monotonic ids, mirroring a Postgres identity column. */
export function newId(): number {
  nextId += 1;
  return nextId;
}

export function nowIso(daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

/** `YYYY-MM-DD`, N days from today (negative = in the past). */
export function isoDay(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ users */

export const users: MockUser[] = [
  {
    id: 1,
    name: 'Amara Okafor',
    email: 'admin@jurisflow.com',
    password: DEMO_PASSWORD,
    role: 'admin',
    phone: '+233 24 000 1001',
    address: '12 Ridge Road, Accra',
    isActive: true,
    createdAt: nowIso(420),
    updatedAt: nowIso(30),
  },
  {
    id: 2,
    name: 'Daniel Mensah',
    email: 'lawyer@jurisflow.com',
    password: DEMO_PASSWORD,
    role: 'lawyer',
    phone: '+233 24 000 1002',
    address: '12 Ridge Road, Accra',
    specialization: 'Family Law',
    barNumber: 'BAR-2016-4471',
    isActive: true,
    createdAt: nowIso(400),
    updatedAt: nowIso(21),
  },
  {
    id: 3,
    name: 'Nadia Bello',
    email: 'staff@jurisflow.com',
    password: DEMO_PASSWORD,
    role: 'staff',
    phone: '+233 24 000 1003',
    address: '12 Ridge Road, Accra',
    isActive: true,
    createdAt: nowIso(300),
    updatedAt: nowIso(15),
  },
  {
    id: 4,
    name: 'Chidi Eze',
    email: 'client@jurisflow.com',
    password: DEMO_PASSWORD,
    role: 'client',
    phone: '+233 20 555 7788',
    address: '48 Airport Residential, Accra',
    isActive: true,
    createdAt: nowIso(120),
    updatedAt: nowIso(4),
  },
  {
    id: 5,
    name: 'Grace Adeyemi',
    email: 'grace.adeyemi@jurisflow.com',
    password: DEMO_PASSWORD,
    role: 'lawyer',
    phone: '+233 24 000 1005',
    specialization: 'Corporate Law',
    barNumber: 'BAR-2014-2210',
    isActive: true,
    createdAt: nowIso(360),
    updatedAt: nowIso(12),
  },
  {
    id: 6,
    name: 'Ibrahim Sule',
    email: 'ibrahim.sule@jurisflow.com',
    password: DEMO_PASSWORD,
    role: 'lawyer',
    phone: '+233 24 000 1006',
    specialization: 'Land & Property',
    barNumber: 'BAR-2018-8813',
    isActive: true,
    createdAt: nowIso(240),
    updatedAt: nowIso(9),
  },
  {
    id: 7,
    name: 'Efua Danso',
    email: 'efua.danso@jurisflow.com',
    password: DEMO_PASSWORD,
    role: 'staff',
    phone: '+233 24 000 1007',
    isActive: true,
    createdAt: nowIso(200),
    updatedAt: nowIso(6),
  },
  {
    id: 8,
    name: 'Samuel Boateng',
    email: 'samuel.boateng@example.com',
    password: DEMO_PASSWORD,
    role: 'client',
    phone: '+233 27 414 2200',
    address: '9 Labone Crescent, Accra',
    isActive: true,
    createdAt: nowIso(90),
    updatedAt: nowIso(2),
  },
  {
    id: 9,
    name: 'Ama Nyarko',
    email: 'ama.nyarko@example.com',
    password: DEMO_PASSWORD,
    role: 'client',
    phone: '+233 26 903 5511',
    address: '31 Cantonments Road, Accra',
    isActive: false,
    createdAt: nowIso(60),
    updatedAt: nowIso(18),
  },
];

/* ---------------------------------------------------------------- clients */

export const clients: Client[] = [
  {
    id: 1,
    userId: 4,
    fullName: 'Chidi Eze',
    email: 'client@jurisflow.com',
    contact: '+233 20 555 7788',
    address: '48 Airport Residential, Accra',
    createdAt: nowIso(120),
  },
  {
    id: 2,
    userId: 8,
    fullName: 'Samuel Boateng',
    email: 'samuel.boateng@example.com',
    contact: '+233 27 414 2200',
    address: '9 Labone Crescent, Accra',
    createdAt: nowIso(90),
  },
  {
    id: 3,
    userId: 9,
    fullName: 'Ama Nyarko',
    email: 'ama.nyarko@example.com',
    contact: '+233 26 903 5511',
    address: '31 Cantonments Road, Accra',
    createdAt: nowIso(60),
  },
];

/* -------------------------------------------------------- legal services */

export const legalServices: LegalService[] = [
  { id: 1, name: 'Family Law Consultation', description: 'Divorce, custody, maintenance and adoption matters.', isActive: true, createdAt: nowIso(400) },
  { id: 2, name: 'Corporate Advisory', description: 'Incorporation, compliance and commercial contracts.', isActive: true, createdAt: nowIso(400) },
  { id: 3, name: 'Land & Property', description: 'Title searches, conveyancing and landlord/tenant disputes.', isActive: true, createdAt: nowIso(380) },
  { id: 4, name: 'Employment & Labour', description: 'Wrongful dismissal, contracts and workplace disputes.', isActive: true, createdAt: nowIso(360) },
  { id: 5, name: 'Criminal Defence', description: 'Arrest, bail and criminal proceedings representation.', isActive: true, createdAt: nowIso(300) },
  { id: 6, name: 'Immigration', description: 'Residency, work permits and citizenship applications.', isActive: false, createdAt: nowIso(200) },
];

/* ------------------------------------------------------------------ cases */

export const cases: Case[] = [
  {
    id: 1,
    clientId: 1,
    clientName: 'Chidi Eze',
    caseNumber: 'JF-2026-0001',
    title: 'Eze v. Eze — contested divorce',
    type: 'Family Law',
    status: 'active',
    priority: 'high',
    assignedLawyerId: 2,
    assignedLawyerName: 'Daniel Mensah',
    description: 'Contested divorce with a custody dispute over two minor children.',
    createdAt: nowIso(95),
    updatedAt: nowIso(3),
  },
  {
    id: 2,
    clientId: 2,
    clientName: 'Samuel Boateng',
    caseNumber: 'JF-2026-0002',
    title: 'Boateng Holdings — shareholders agreement',
    type: 'Corporate Law',
    status: 'discovery',
    priority: 'medium',
    assignedLawyerId: 5,
    assignedLawyerName: 'Grace Adeyemi',
    description: 'Drafting and negotiating a shareholders agreement ahead of a funding round.',
    createdAt: nowIso(70),
    updatedAt: nowIso(8),
  },
  {
    id: 3,
    clientId: 1,
    clientName: 'Chidi Eze',
    caseNumber: 'JF-2026-0003',
    title: 'Airport Residential — title perfection',
    type: 'Land & Property',
    status: 'open',
    priority: 'medium',
    assignedLawyerId: 6,
    assignedLawyerName: 'Ibrahim Sule',
    description: 'Land title search and registration of the client’s residential property.',
    createdAt: nowIso(40),
    updatedAt: nowIso(5),
  },
  {
    id: 4,
    clientId: 3,
    clientName: 'Ama Nyarko',
    caseNumber: 'JF-2026-0004',
    title: 'Nyarko v. Bluewave Ltd — wrongful dismissal',
    type: 'Employment & Labour',
    status: 'pending',
    priority: 'high',
    assignedLawyerId: null,
    description: 'Client alleges dismissal without notice or terminal benefits.',
    createdAt: nowIso(22),
    updatedAt: nowIso(2),
  },
  {
    id: 5,
    clientId: 2,
    clientName: 'Samuel Boateng',
    caseNumber: 'JF-2026-0005',
    title: 'Labone tenancy dispute',
    type: 'Land & Property',
    status: 'closed',
    priority: 'low',
    assignedLawyerId: 6,
    assignedLawyerName: 'Ibrahim Sule',
    description: 'Recovery of rent arrears; settled out of court.',
    createdAt: nowIso(180),
    updatedAt: nowIso(45),
  },
];

/* ---------------------------------------------------------- consultations */

export const consultations: Consultation[] = [
  {
    id: 1,
    clientId: 1,
    clientName: 'Chidi Eze',
    serviceId: 1,
    serviceName: 'Family Law Consultation',
    concern: 'My spouse and I have separated and she has moved the children. I need advice on custody and maintenance.',
    status: 'approved',
    reviewedBy: 2,
    reviewedByName: 'Daniel Mensah',
    createdAt: nowIso(30),
    updatedAt: nowIso(27),
  },
  {
    id: 2,
    clientId: 2,
    clientName: 'Samuel Boateng',
    serviceId: 2,
    serviceName: 'Corporate Advisory',
    concern: 'We are raising seed funding and must sign a shareholders agreement next month.',
    status: 'pending',
    reviewedBy: null,
    createdAt: nowIso(6),
    updatedAt: nowIso(6),
  },
  {
    id: 3,
    clientId: 3,
    clientName: 'Ama Nyarko',
    serviceId: 4,
    serviceName: 'Employment & Labour',
    concern: 'I was dismissed without notice; I want to know whether I have a claim.',
    status: 'pending',
    reviewedBy: null,
    createdAt: nowIso(4),
    updatedAt: nowIso(4),
  },
  {
    id: 4,
    clientId: 1,
    clientName: 'Chidi Eze',
    serviceId: 3,
    serviceName: 'Land & Property',
    concern: 'I need a title search on a plot before I complete payment.',
    status: 'completed',
    reviewedBy: 3,
    reviewedByName: 'Nadia Bello',
    createdAt: nowIso(60),
    updatedAt: nowIso(52),
  },
  {
    id: 5,
    clientId: 2,
    clientName: 'Samuel Boateng',
    serviceId: 6,
    serviceName: 'Immigration',
    concern: 'Query about a work permit renewal — later withdrawn.',
    status: 'declined',
    reviewedBy: 3,
    reviewedByName: 'Nadia Bello',
    createdAt: nowIso(75),
    updatedAt: nowIso(70),
  },
];

/* ----------------------------------------------------------- appointments */

export const appointments: Appointment[] = [
  {
    id: 1,
    clientId: 1,
    clientName: 'Chidi Eze',
    consultationId: 1,
    lawyerId: 2,
    lawyerName: 'Daniel Mensah',
    date: isoDay(2),
    startTime: '09:00',
    endTime: '10:00',
    status: 'confirmed',
    notes: 'Bring the marriage certificate and the children’s birth certificates.',
    createdAt: nowIso(20),
    updatedAt: nowIso(6),
  },
  {
    id: 2,
    clientId: 2,
    clientName: 'Samuel Boateng',
    consultationId: 2,
    lawyerId: 5,
    lawyerName: 'Grace Adeyemi',
    date: isoDay(1),
    startTime: '13:30',
    endTime: '14:30',
    status: 'scheduled',
    notes: 'First review of the draft shareholders agreement.',
    createdAt: nowIso(5),
    updatedAt: nowIso(5),
  },
  {
    id: 3,
    clientId: 1,
    clientName: 'Chidi Eze',
    consultationId: null,
    lawyerId: 6,
    lawyerName: 'Ibrahim Sule',
    date: isoDay(7),
    startTime: '11:00',
    endTime: '12:00',
    status: 'scheduled',
    notes: 'Title search follow-up.',
    createdAt: nowIso(3),
    updatedAt: nowIso(3),
  },
  {
    id: 4,
    clientId: 3,
    clientName: 'Ama Nyarko',
    consultationId: 3,
    lawyerId: 2,
    lawyerName: 'Daniel Mensah',
    date: isoDay(-6),
    startTime: '15:00',
    endTime: '16:00',
    status: 'completed',
    notes: 'Employment claim discussed; documents requested.',
    createdAt: nowIso(18),
    updatedAt: nowIso(6),
  },
  {
    id: 5,
    clientId: 2,
    clientName: 'Samuel Boateng',
    consultationId: null,
    lawyerId: 6,
    lawyerName: 'Ibrahim Sule',
    date: isoDay(-12),
    startTime: '10:00',
    endTime: '10:45',
    status: 'cancelled',
    notes: 'Client asked to reschedule after the settlement.',
    createdAt: nowIso(28),
    updatedAt: nowIso(14),
  },
];

/* ----------------------------------------------------------- availability */

export const availability: Availability[] = [
  { id: 1, lawyerId: 2, lawyerName: 'Daniel Mensah', dayOfWeek: 'Monday', startTime: '09:00', endTime: '13:00', isAvailable: true },
  { id: 2, lawyerId: 2, lawyerName: 'Daniel Mensah', dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '16:00', isAvailable: true },
  { id: 3, lawyerId: 2, lawyerName: 'Daniel Mensah', dayOfWeek: 'Friday', startTime: '09:00', endTime: '12:00', isAvailable: true },
  { id: 4, lawyerId: 5, lawyerName: 'Grace Adeyemi', dayOfWeek: 'Tuesday', startTime: '10:00', endTime: '17:00', isAvailable: true },
  { id: 5, lawyerId: 5, lawyerName: 'Grace Adeyemi', dayOfWeek: 'Thursday', startTime: '10:00', endTime: '17:00', isAvailable: true },
  { id: 6, lawyerId: 6, lawyerName: 'Ibrahim Sule', dayOfWeek: 'Monday', startTime: '11:00', endTime: '15:00', isAvailable: true },
  { id: 7, lawyerId: 6, lawyerName: 'Ibrahim Sule', dayOfWeek: 'Friday', startTime: '13:00', endTime: '17:00', isAvailable: false },
];

/* -------------------------------------------------------------- documents */

export const documents: Document[] = [
  {
    id: 1,
    clientId: 1,
    clientName: 'Chidi Eze',
    caseId: 1,
    caseName: 'Eze v. Eze — contested divorce',
    name: 'marriage-certificate.pdf',
    fileUrl: '/uploads/marriage-certificate.pdf',
    uploadedBy: 4,
    uploadedByName: 'Chidi Eze',
    status: 'processed',
    createdAt: nowIso(28),
  },
  {
    id: 2,
    clientId: 1,
    clientName: 'Chidi Eze',
    caseId: 1,
    caseName: 'Eze v. Eze — contested divorce',
    name: 'custody-affidavit.docx',
    fileUrl: '/uploads/custody-affidavit.docx',
    uploadedBy: 3,
    uploadedByName: 'Nadia Bello',
    status: 'reviewing',
    createdAt: nowIso(12),
  },
  {
    id: 3,
    clientId: 2,
    clientName: 'Samuel Boateng',
    caseId: 2,
    caseName: 'Boateng Holdings — shareholders agreement',
    name: 'draft-shareholders-agreement-v2.pdf',
    fileUrl: '/uploads/draft-shareholders-agreement-v2.pdf',
    uploadedBy: 2,
    uploadedByName: 'Daniel Mensah',
    status: 'reviewing',
    createdAt: nowIso(7),
  },
  {
    id: 4,
    clientId: 1,
    clientName: 'Chidi Eze',
    caseId: 3,
    caseName: 'Airport Residential — title perfection',
    name: 'land-title-indenture.pdf',
    fileUrl: '/uploads/land-title-indenture.pdf',
    uploadedBy: 4,
    uploadedByName: 'Chidi Eze',
    status: 'received',
    createdAt: nowIso(4),
  },
  {
    id: 5,
    clientId: 3,
    clientName: 'Ama Nyarko',
    caseId: 4,
    caseName: 'Nyarko v. Bluewave Ltd — wrongful dismissal',
    name: 'employment-contract.pdf',
    fileUrl: '/uploads/employment-contract.pdf',
    uploadedBy: 3,
    uploadedByName: 'Nadia Bello',
    status: 'rejected',
    createdAt: nowIso(15),
  },
];

/* ------------------------------------------------------- NLP results (AI) */

export const nlpResults: NLPResult[] = [
  {
    id: 1,
    documentId: 1,
    documentName: 'marriage-certificate.pdf',
    classification: 'Family Law Evidence',
    extractedInfo: {
      documentType: 'Marriage Certificate',
      parties: ['Chidi Eze', 'Adaeze Eze'],
      jurisdiction: 'Ghana',
      dateOfMarriage: '2017-06-24',
    },
    summary:
      'Registry-issued marriage certificate confirming the marriage of the parties on 24 June 2017. Establishes the marital status essential to the divorce petition.',
    createdAt: nowIso(28),
  },
  {
    id: 2,
    documentId: 3,
    documentName: 'draft-shareholders-agreement-v2.pdf',
    classification: 'Corporate Contract',
    extractedInfo: {
      documentType: 'Shareholders Agreement',
      parties: ['Boateng Holdings Ltd', 'Samuel Boateng', 'Northgate Capital'],
      jurisdiction: 'Ghana',
      governingLaw: 'Laws of the Republic of Ghana',
    },
    summary:
      'Second draft of the shareholders agreement. Adds drag-along and tag-along rights and a reserved-matters list; the vesting schedule remains unagreed.',
    createdAt: nowIso(7),
  },
];

/* ------------------------------------------------- knowledge base articles */

export const articles: Article[] = [
  {
    id: 1,
    title: 'Filing for divorce in Ghana: what the court expects',
    category: 'Family Law',
    keywords: ['divorce', 'custody', 'maintenance', 'marriage', 'family'],
    summary:
      'A plain-language walkthrough of divorce grounds, the petition bundle and how custody and maintenance are decided.',
    content:
      'A divorce petition must state the ground relied upon and the facts supporting it. In practice the court looks for evidence of the marriage, evidence of the breakdown, and a proposed arrangement for any children. Custody is decided on the welfare of the child, not on parental preference, and maintenance is assessed against the means of both parties.',
    attorneySpecialist: 'Family Law',
    servicesNeeded: ['Petition drafting', 'Court representation'],
    status: 'published',
    matchCount: 42,
    createdAt: nowIso(210),
    updatedAt: nowIso(20),
  },
  {
    id: 2,
    title: 'Shareholders agreements: the clauses that prevent deadlock',
    category: 'Corporate Law',
    keywords: ['shareholders', 'agreement', 'deadlock', 'shares', 'company', 'directors'],
    summary:
      'Reserved matters, deadlock resolution and drag-along/tag-along rights are the clauses that keep a company from stalling.',
    content:
      'A shareholders agreement should say what the company cannot do without unanimous or supermajority consent, how a deadlock is broken, how shares are valued when a shareholder exits, and who may be forced to sell alongside the founders.',
    attorneySpecialist: 'Corporate Law',
    servicesNeeded: ['Contract drafting', 'Negotiation'],
    status: 'published',
    matchCount: 31,
    createdAt: nowIso(160),
    updatedAt: nowIso(11),
  },
  {
    id: 3,
    title: 'Before you buy land: a title search checklist',
    category: 'Land & Property',
    keywords: ['land', 'title', 'search', 'deed', 'property', 'registration', 'indenture'],
    summary:
      'Six checks to run at the Lands Commission before any money changes hands.',
    content:
      'Search the title at the Lands Commission, confirm the identity of the vendor against the deed, inspect the site for occupiers, check for existing mortgages or caveats, obtain the site plan, and never pay in full before the transfer is executed and stamped.',
    attorneySpecialist: 'Land & Property',
    servicesNeeded: ['Title search', 'Conveyancing'],
    status: 'published',
    matchCount: 57,
    createdAt: nowIso(240),
    updatedAt: nowIso(35),
  },
  {
    id: 4,
    title: 'Dismissed without notice? Your employment remedies',
    category: 'Employment & Labour',
    keywords: ['dismissal', 'termination', 'employment', 'notice', 'labour', 'benefits'],
    summary:
      'Notice periods, terminal benefits and the forum in which a wrongful dismissal claim is brought.',
    content:
      'Where an employer terminates without the contractual or statutory notice period, the employee may claim the notice pay plus terminal benefits. Claims are usually mediated first; unresolved matters proceed to the National Labour Commission and then the High Court.',
    attorneySpecialist: 'Employment & Labour',
    servicesNeeded: ['Demand letter', 'NLC representation'],
    status: 'published',
    matchCount: 18,
    createdAt: nowIso(90),
    updatedAt: nowIso(9),
  },
  {
    id: 5,
    title: 'What happens at a first consultation',
    category: 'General',
    keywords: ['consultation', 'intake', 'fees', 'process'],
    summary: 'How intake works, what to bring, and how the engagement letter follows.',
    content:
      'The first consultation covers the facts, the documents you already hold and the realistic outcomes. If the firm can act, an engagement letter setting out fees and scope follows; if there is a conflict, the firm will refer you onward.',
    attorneySpecialist: 'General',
    servicesNeeded: ['Intake review'],
    status: 'published',
    matchCount: 12,
    createdAt: nowIso(300),
    updatedAt: nowIso(60),
  },
  {
    id: 6,
    title: 'Residence permits: dependants and renewals (draft)',
    category: 'Immigration',
    keywords: ['immigration', 'residence', 'permit', 'renewal', 'dependants'],
    summary: 'Draft note on adding dependants to a residence permit and the renewal timeline.',
    content:
      'Draft — pending review by the immigration desk. Covers the documents required to add a spouse or child and the window in which a renewal application should be filed.',
    attorneySpecialist: 'Immigration',
    servicesNeeded: ['Application filing'],
    status: 'draft',
    matchCount: 0,
    createdAt: nowIso(25),
    updatedAt: nowIso(25),
  },
];

/* -------------------------------------------------------------------- FAQs */

export const faqs: FAQ[] = [
  {
    id: 1,
    question: 'How do I book a consultation with a lawyer?',
    answer:
      'Submit a consultation request from your dashboard describing your issue. Our staff review it, and once approved you can book a slot with the assigned lawyer from the Appointments page.',
    category: 'Consultations',
    createdBy: 3,
    createdByName: 'Nadia Bello',
    createdAt: nowIso(180),
    updatedAt: nowIso(40),
  },
  {
    id: 2,
    question: 'Which documents may I upload, and how large can they be?',
    answer:
      'PDF, DOCX, JPG and PNG files up to 10 MB each. Uploads are attached to a case so the lawyer handling the matter sees them immediately.',
    category: 'Documents',
    createdBy: 3,
    createdByName: 'Nadia Bello',
    createdAt: nowIso(170),
    updatedAt: nowIso(38),
  },
  {
    id: 3,
    question: 'Can I reschedule an appointment?',
    answer:
      'Yes. Open the appointment and choose Reschedule; the lawyer is notified automatically. Cancellations made less than 24 hours before the slot may be treated as a missed appointment.',
    category: 'Appointments',
    createdBy: 2,
    createdByName: 'Daniel Mensah',
    createdAt: nowIso(150),
    updatedAt: nowIso(30),
  },
  {
    id: 4,
    question: 'Who can see my case information?',
    answer:
      'Only the lawyers and staff working on your matter, plus the firm administrator. Access is enforced per role by the backend on every request.',
    category: 'Privacy',
    createdBy: 1,
    createdByName: 'Amara Okafor',
    createdAt: nowIso(140),
    updatedAt: nowIso(22),
  },
  {
    id: 5,
    question: 'What is the AI case analysis for?',
    answer:
      'It reads the description or document you provide and suggests the area of law, related guidance and the most suitable lawyer. It is an aid, not legal advice, and a lawyer always reviews the matter.',
    category: 'AI Assistance',
    createdBy: 1,
    createdByName: 'Amara Okafor',
    createdAt: nowIso(120),
    updatedAt: nowIso(16),
  },
];

/* ----------------------------------------------------------- notifications */

export const notifications: Notification[] = [
  {
    id: 1,
    userId: 1,
    type: 'consultation',
    message: 'Two consultation requests are awaiting review.',
    isRead: false,
    createdAt: nowIso(0),
  },
  {
    id: 2,
    userId: 1,
    type: 'system',
    message: 'Weekly activity report for the firm is ready.',
    isRead: false,
    createdAt: nowIso(1),
  },
  {
    id: 3,
    userId: 2,
    type: 'appointment',
    message: 'Chidi Eze confirmed the appointment on ' + isoDay(2) + ' at 09:00.',
    isRead: false,
    createdAt: nowIso(0),
  },
  {
    id: 4,
    userId: 2,
    type: 'document',
    message: 'custody-affidavit.docx is ready for your review.',
    isRead: false,
    createdAt: nowIso(2),
  },
  {
    id: 5,
    userId: 3,
    type: 'consultation',
    message: 'Ama Nyarko submitted a new consultation request.',
    isRead: false,
    createdAt: nowIso(0),
  },
  {
    id: 6,
    userId: 3,
    type: 'case',
    message: 'Case JF-2026-0004 still has no assigned lawyer.',
    isRead: true,
    createdAt: nowIso(3),
  },
  {
    id: 7,
    userId: 4,
    type: 'appointment',
    message: 'Your appointment with Daniel Mensah is confirmed for ' + isoDay(2) + ' at 09:00.',
    isRead: false,
    createdAt: nowIso(0),
  },
  {
    id: 8,
    userId: 4,
    type: 'case',
    message: 'Case JF-2026-0003 moved to Open.',
    isRead: true,
    createdAt: nowIso(5),
  },
  {
    id: 9,
    userId: 2,
    type: 'case',
    message: 'Case JF-2026-0001 was reassigned to you.',
    isRead: true,
    createdAt: nowIso(20),
  },
  {
    id: 10,
    userId: 1,
    type: 'system',
    message: 'Ama Nyarko’s account was deactivated.',
    isRead: true,
    createdAt: nowIso(18),
  },
];

export const defaultNotificationSettings: NotificationSettings = {
  email: true,
  inApp: true,
  consultations: true,
  appointments: true,
  documents: false,
};

/* ----------------------------------------------------------- activity logs */

export const activityLogs: ActivityLog[] = [
  { id: 1, userId: 1, userName: 'Amara Okafor', action: 'role.update', details: 'Granted the staff role access to documents.write.', createdAt: nowIso(1) },
  { id: 2, userId: 3, userName: 'Nadia Bello', action: 'consultation.create', details: 'Logged an intake call with Ama Nyarko.', createdAt: nowIso(4) },
  { id: 3, userId: 2, userName: 'Daniel Mensah', action: 'case.update', details: 'Moved JF-2026-0001 to Active and filed the petition.', createdAt: nowIso(3) },
  { id: 4, userId: 4, userName: 'Chidi Eze', action: 'document.upload', details: 'Uploaded land-title-indenture.pdf.', createdAt: nowIso(4) },
  { id: 5, userId: 3, userName: 'Nadia Bello', action: 'appointment.confirm', details: 'Confirmed the 09:00 slot for Chidi Eze.', createdAt: nowIso(6) },
  { id: 6, userId: 1, userName: 'Amara Okafor', action: 'user.deactivate', details: 'Deactivated the account of Ama Nyarko.', createdAt: nowIso(18) },
];

/* ------------------------------------------------------------ permissions */

/** Mirrors `ROLE_PERMISSIONS` as rows, the way the `role_permissions` table stores them. */
export const rolePermissions: RolePermission[] = Object.entries(ROLE_PERMISSIONS).flatMap(
  ([role, permissions], groupIndex) =>
    permissions.map((permission, index) => ({
      id: groupIndex * 100 + index + 1,
      role: role as UserRole,
      permission,
      createdAt: nowIso(400),
    })),
);

/* ---------------------------------------------------------------- the database */

/**
 * Everything above, grouped so handlers can import a single object.
 * Mutation is in place — the arrays are the "tables".
 */
export const db = {
  users,
  clients,
  legalServices,
  cases,
  consultations,
  appointments,
  availability,
  documents,
  nlpResults,
  articles,
  faqs,
  notifications,
  activityLogs,
  rolePermissions,
};

/** Resets the id counter (used when handlers create records in a fresh session). */
export function resetIds(to = 1000): void {
  nextId = to;
}

/* --------------------------------------------------- per-user preferences */

/**
 * Notification preferences per user. Mutable, so a client can change the
 * toggles on the settings screen and see them persisted for the session.
 */
export const notificationSettings = new Map<number, NotificationSettings>();

export function settingsFor(userId: number): NotificationSettings {
  const existing = notificationSettings.get(userId);
  if (existing) return existing;

  const created: NotificationSettings = { ...defaultNotificationSettings };
  notificationSettings.set(userId, created);
  return created;
}

export type Database = typeof db;







