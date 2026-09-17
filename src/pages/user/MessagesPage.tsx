import React, { useEffect, useState } from 'react';
import { useInboxStore } from '../../stores/appStores';
import { PageHeader, GlassCard } from '../../components/UI';
import { MessageSquare, Send } from 'lucide-react';

export const MessagesPage: React.FC = () => {
  const { messages, fetchMessages, sendMessage } = useInboxStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState('');

  useEffect(() => { fetchMessages(); }, []);

  const selected = messages.find(m => m.id === selectedId);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Messages" subtitle="Chat with your attorney" />

      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-220px)]">
        {/* Messages List */}
        <GlassCard className="p-0 overflow-hidden lg:col-span-1">
          <div className="p-4 border-b border-white/8">
            <h3 className="text-sm font-semibold text-white">Conversations</h3>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-310px)]">
            {messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => setSelectedId(msg.id)}
                className={`p-4 border-b border-white/5 cursor-pointer transition-colors ${
                  selectedId === msg.id ? 'bg-gold/5 border-l-2 border-l-gold' : 'hover:bg-white/3'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-royal flex items-center justify-center text-xs font-bold text-gold">
                    {msg.from.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!msg.read ? 'font-semibold text-white' : 'text-text-secondary'}`}>{msg.from}</p>
                    <p className="text-xs text-text-muted truncate">{msg.subject}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Chat View */}
        <GlassCard className="lg:col-span-2 p-0 overflow-hidden flex flex-col">
          {selected ? (
            <>
              <div className="p-4 border-b border-white/8">
                <h3 className="text-base font-semibold text-white">{selected.subject}</h3>
                <p className="text-xs text-text-muted">{selected.from} · {selected.date}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Received */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-royal flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                    {selected.from.charAt(0)}
                  </div>
                  <div className="glass-light p-3 max-w-md">
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{selected.body}</p>
                    <p className="text-[10px] text-text-muted mt-2">{selected.date}</p>
                  </div>
                </div>
              </div>

              {/* Reply */}
              <div className="p-4 border-t border-white/8">
                <div className="flex gap-2">
                  <input
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Type a message..."
                    className="glass-input flex-1 px-4 py-2.5 text-sm"
                    onKeyDown={e => { if (e.key === 'Enter' && reply.trim()) { sendMessage({ subject: 'RE: ' + selected.subject, body: reply, to: selected.from, toEmail: selected.fromEmail }); setReply(''); } }}
                  />
                  <button onClick={() => { if (reply.trim()) { sendMessage({ subject: 'RE: ' + selected.subject, body: reply, to: selected.from, toEmail: selected.fromEmail }); setReply(''); } }} className="btn-primary px-4 flex items-center gap-2">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <MessageSquare size={40} className="text-text-muted mb-3" />
              <p className="text-text-muted">Select a conversation</p>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};
