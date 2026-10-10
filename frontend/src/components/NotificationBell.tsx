import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  CheckCheck,
  FileText,
  FolderOpen,
  Info,
  MessageSquare,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { navItemsFor } from '../utils/navigation';
import { relativeTime } from '../utils/format';
import type { NotificationType } from '../types';

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  consultation: MessageSquare,
  appointment: Calendar,
  case: FolderOpen,
  document: FileText,
  system: Info,
};

/** Which sidebar icon key a notification type belongs to (for the deep link). */
const TYPE_NAV_KEY: Record<NotificationType, string> = {
  consultation: 'consultations',
  appointment: 'appointments',
  case: 'cases',
  document: 'documents',
  system: 'dashboard',
};

/**
 * Navbar notification bell with an unread badge and a dropdown panel.
 *
 * The unread count is polled every 60s while the app is open; opening the panel
 * fetches the latest list, clicking an entry marks it read and deep-links to the
 * matching page for the signed-in role.
 */
export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const role = useAuthStore(state => state.user?.role);
  const items = useNotificationStore(state => state.items);
  const unreadCount = useNotificationStore(state => state.unreadCount);
  const fetchNotifications = useNotificationStore(state => state.fetchNotifications);
  const refreshUnreadCount = useNotificationStore(state => state.refreshUnreadCount);
  const markRead = useNotificationStore(state => state.markRead);
  const markAllRead = useNotificationStore(state => state.markAllRead);
  const remove = useNotificationStore(state => state.remove);
  const navigate = useNavigate();

  // Poll the badge while the app is open.
  useEffect(() => {
    void refreshUnreadCount();
    const id = window.setInterval(() => void refreshUnreadCount(), 60_000);
    return () => window.clearInterval(id);
  }, [refreshUnreadCount]);

  // Fetch the list once the panel is opened.
  useEffect(() => {
    if (open) void fetchNotifications(25);
  }, [open, fetchNotifications]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleOpen = async (id: number, type: NotificationType): Promise<void> => {
    await markRead(id);
    setOpen(false);

    const targetKey = TYPE_NAV_KEY[type];
    const target = navItemsFor(role).find(item => item.icon === targetKey);
    if (target) navigate(target.path);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        className="relative p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-gold text-navy text-[10px] font-bold flex items-center justify-center tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-strong border border-white/10 z-50 animate-scale-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-sm font-semibold text-white">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex items-center gap-1.5 text-[11px] text-gold hover:text-gold-light transition-colors"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">You are all caught up.</p>
            ) : (
              items.map(item => {
                const Icon = TYPE_ICONS[item.type] ?? Info;
                return (
                  <div
                    key={item.id}
                    className={`group flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${
                      item.isRead ? '' : 'bg-gold/[0.04]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleOpen(item.id, item.type)}
                      className="flex items-start gap-3 flex-1 min-w-0 text-left"
                    >
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          item.isRead ? 'bg-white/5 text-text-muted' : 'bg-gold/10 text-gold'
                        }`}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs text-white leading-snug">{item.message}</span>
                        <span className="block text-[10px] text-text-muted mt-1">{relativeTime(item.createdAt)}</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void remove(item.id)}
                      aria-label="Delete notification"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-danger transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
