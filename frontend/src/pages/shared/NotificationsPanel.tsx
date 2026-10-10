import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Briefcase, CalendarClock, CheckCheck, FileText, Info, MessageSquare, Trash2 } from 'lucide-react';
import {
  Button,
  EmptyState,
  GlassCard,
  KPICard,
  PageHeader,
  PageLoader,
  Tabs,
} from '../../components/UI';
import { toast, useNotificationStore } from '../../stores';
import type { NotificationType } from '../../types';
import { relativeTime } from '../../utils/format';

/**
 * Notification inbox.
 *
 * Shared by every role: the API only ever returns the caller's own rows. The
 * unread counter is kept in the store so the navbar bell and this list agree.
 */

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  consultation: MessageSquare,
  appointment: CalendarClock,
  case: Briefcase,
  document: FileText,
  system: Info,
};

const TYPE_TONES: Record<NotificationType, string> = {
  consultation: 'bg-gold/10 text-gold',
  appointment: 'bg-info/10 text-info',
  case: 'bg-success/10 text-success',
  document: 'bg-warning/10 text-warning',
  system: 'bg-white/5 text-text-secondary',
};

export interface NotificationsPanelProps {
  title?: string;
  subtitle?: string;
  limit?: number;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  title = 'Notifications',
  subtitle = 'Everything the firm has told you about.',
  limit = 50,
}) => {
  const items = useNotificationStore(state => state.items);
  const unreadCount = useNotificationStore(state => state.unreadCount);
  const loading = useNotificationStore(state => state.loading);
  const fetchNotifications = useNotificationStore(state => state.fetchNotifications);
  const markRead = useNotificationStore(state => state.markRead);
  const markAllRead = useNotificationStore(state => state.markAllRead);
  const remove = useNotificationStore(state => state.remove);

  const [tab, setTab] = useState('all');

  useEffect(() => {
    void fetchNotifications(limit);
  }, [fetchNotifications, limit]);

  const visible = useMemo(
    () => (tab === 'unread' ? items.filter(entry => !entry.isRead) : items),
    [items, tab],
  );

  if (loading && items.length === 0) return <PageLoader label="Loading your notifications…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          unreadCount > 0 ? (
            <Button
              variant="secondary"
              onClick={() => {
                void markAllRead();
                toast.success('Everything is marked as read.');
              }}
            >
              <CheckCheck size={16} />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label="Notifications" value={items.length} icon={Bell} />
        <KPICard label="Unread" value={unreadCount} icon={Bell} tone="danger" />
        <KPICard label="Read" value={items.length - unreadCount} icon={CheckCheck} tone="success" />
      </div>

      <GlassCard className="space-y-4">
        <Tabs
          tabs={[
            { id: 'all', label: 'All', count: items.length },
            { id: 'unread', label: 'Unread', count: unreadCount },
          ]}
          active={tab}
          onChange={setTab}
        />

        {visible.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={tab === 'unread' ? 'Nothing unread' : 'No notifications yet'}
            description="Updates about consultations, appointments and documents land here."
          />
        ) : (
          <ul className="space-y-2.5">
            {visible.map(entry => {
              const Icon = TYPE_ICONS[entry.type] ?? Info;
              return (
                <li
                  key={entry.id}
                  className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                    entry.isRead ? 'border-white/10 bg-white/5' : 'border-gold/25 bg-gold/5'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      TYPE_TONES[entry.type] ?? 'bg-white/5 text-text-secondary'
                    }`}
                  >
                    <Icon size={17} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-white">{entry.message}</span>
                    <span className="block text-[11px] text-text-muted mt-0.5">
                      {entry.type} · {relativeTime(entry.createdAt)}
                    </span>
                  </span>

                  <span className="flex items-center gap-1 flex-shrink-0">
                    {!entry.isRead ? (
                      <Button
                        variant="ghost"
                        title="Mark as read"
                        onClick={() => void markRead(entry.id)}
                      >
                        <CheckCheck size={16} />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      title="Delete"
                      onClick={() => void remove(entry.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>
    </div>
  );
};

export default NotificationsPanel;
