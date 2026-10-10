/* ==========================================================================
   JurisFlow API services — single import point.
   --------------------------------------------------------------------------
   Each module maps 1:1 onto a Flask blueprint. Every call goes through
   `apiClient`, which attaches the bearer token and normalises errors.
   ========================================================================== */

export { API_BASE_URL, ApiRequestError, apiClient, apiGet, getAuthToken, setAuthToken } from './apiClient';
export type { QueryValue, RequestOptions } from './apiClient';

export * from './authService';
export * from './userService';
export * from './clientService';
export * from './caseService';
export * from './consultationService';
export * from './appointmentService';
export * from './documentService';
export * from './analysisService';
export * from './notificationService';
export * from './faqService';
export * from './dashboardService';
export * from './permissionService';
