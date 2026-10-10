/* ==========================================================================
   Authentication API (Flask `/api/auth`)
   --------------------------------------------------------------------------
   Thin wrapper over `apiClient`. Logging in/out also maintains the bearer
   token in `localStorage`, so every other service is automatically
   authenticated without having to know about sessions.
   ========================================================================== */

import { apiClient, getAuthToken, setAuthToken } from './apiClient';
import type {
  AuthCredentials,
  AuthResponse,
  NotificationSettings,
  RegisterCredentials,
  User,
} from '../types';

/** Reads the persisted token (used by the auth store on boot). */
export { getAuthToken };

/** `POST /auth/login` — returns the user and stores the bearer token. */
export async function login(credentials: AuthCredentials): Promise<AuthResponse> {
  const result = await apiClient.post<AuthResponse>('/auth/login', credentials);
  setAuthToken(result?.token ?? null);
  return result;
}

/** `POST /auth/register` — self-service sign-up; always creates a client. */
export async function register(payload: RegisterCredentials): Promise<AuthResponse> {
  const result = await apiClient.post<AuthResponse>('/auth/register', payload);
  setAuthToken(result?.token ?? null);
  return result;
}

/** `POST /auth/logout` — clears the token even if the server call fails. */
export async function logout(): Promise<void> {
  try {
    await apiClient.post<void>('/auth/logout');
  } finally {
    setAuthToken(null);
  }
}

/** `GET /auth/me` — the current user, used to rehydrate the session. */
export function me(): Promise<User> {
  return apiClient.get<User>('/auth/me');
}

/** `PUT /auth/profile` — the signed-in user edits their own details. */
export function updateProfile(payload: Partial<User>): Promise<User> {
  return apiClient.put<User>('/auth/profile', payload);
}

/** `POST /auth/password` — change password (old one is verified server-side). */
export function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  return apiClient.post<void>('/auth/password', payload);
}

/** `GET /auth/settings` — in-app / e-mail notification preferences. */
export function getSettings(): Promise<NotificationSettings> {
  return apiClient.get<NotificationSettings>('/auth/settings');
}

/** `PUT /auth/settings` */
export function saveSettings(settings: NotificationSettings): Promise<NotificationSettings> {
  return apiClient.put<NotificationSettings>('/auth/settings', settings);
}

export const authService = {
  login,
  register,
  logout,
  me,
  updateProfile,
  changePassword,
  getSettings,
  saveSettings,
  getAuthToken,
};
