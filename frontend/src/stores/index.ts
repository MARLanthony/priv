/* ==========================================================================
   Zustand stores — single import point.
   ========================================================================== */

export { useAuthStore, ROLE_PERMISSIONS } from './authStore';
export type { AuthState, AuthStatus } from './authStore';

export { useCaseStore, DEFAULT_CASE_FILTERS } from './caseStore';
export type { CaseState, CaseFilters } from './caseStore';

export { useConsultationStore } from './consultationStore';
export type { ConsultationState } from './consultationStore';

export { useAppointmentStore } from './appointmentStore';
export type { AppointmentState } from './appointmentStore';

export { useDocumentStore } from './documentStore';
export type { DocumentState } from './documentStore';

export { useNotificationStore } from './notificationStore';
export type { NotificationState } from './notificationStore';

export { useDirectoryStore } from './directoryStore';
export type { DirectoryState } from './directoryStore';

export { useUIStore, toast } from './uiStore';
export type { UIState, Toast, ToastTone } from './uiStore';

export {
  useThemeStore,
  applyTheme,
  readStoredTheme,
  isThemeMode,
  DEFAULT_THEME,
  THEME_MODES,
  THEME_STORAGE_KEY,
} from './themeStore';
export type { ThemeMode, ThemeState } from './themeStore';
