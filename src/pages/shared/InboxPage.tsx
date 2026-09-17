import React, { useEffect, useState } from 'react';
import { useInboxStore } from '../../stores/appStores';
import { PageHeader, GlassCard, Modal } from '../../components/UI';
import { Mail, Star, Send, ArrowLeft, Search } from 'lucide-react';

interface InboxPageProps {
  canReply?: boolean;
}

export const InboxPage: React.FC<InboxPageProps> = ({ canReply = true }) => {
  const { messages, fetchMessages, currentMessage, fetchMessage, sendMessage } = useInboxStore();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [newMsg, setNewMsg] = useState({ to: '', toEmail: '', subject: '', body: '', from: '', fromEmail: '' });

  useEffect(() => { fetchMessages(); }, []);

  const filtered = messages.filter(m => m.subject.toLowerCase().includes(search.toLowerCase()) || m.from.toLowerCase().includes(search.toLowerCase()));

  const viewMessage = (id: number) => {
    setSelectedId(id);
    fetchMessage(id);
  };

  if (selectedId && currentMessage) {
    return (
      <div className="animate-fade-in">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-sm mb-4">
          <ArrowLeft size={16} /> Back to Inbox
        </button>
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">{currentMessage.subject}</h2>
            {currentMessage.starred && <Star size={18} className="text-gold fill-gold" />}
          </div>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/8">
            <div className="w-10 h-10 rounded-full bg-royal flex items-center justify-center text-sm font-semibold text-gold">
              {currentMessage.from.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{currentMessage.from}</p>
              <p className="text-xs text-text-muted">{currentMessage.fromEmail} · {currentMessage.date}</p>
            </div>
          </div>
          <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{currentMessage.body}</div>
          {canReply && (
            <div className="mt-6 pt-4 border-t border-white/8">
              <div className="flex gap-2">
                <input placeholder="Type a reply..." className="glass-input flex-1 px-4 py-2.5 text-sm" />
                <button className="btn-primary px-4 flex items-center gap-2"><Send size={14} /> Reply</button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Inbox"
        subtitle={`${messages.filter(m => !m.read).length} unread messages`}
        action={
          <button onClick={() => setShowCompose(true)} className="btn-primary flex items-center gap-2">
            <Send size={16} /> Compose
          </button>
        }
      />

      <div className="flex items-center gap-2 glass-input px-4 py-2 max-w-md mb-6">
        <Search size={16} className="text-text-muted" />
        <input type="text" placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-white w-full" />
      </div>

      <div className="space-y-2">
        {filtered.map(msg => (
          <GlassCard key={msg.id} className={`p-4 cursor-pointer ${!msg.read ? 'border-gold/20 bg-gold/3' : ''}`} hover onClick={() => viewMessage(msg.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-royal flex items-center justify-center flex-shrink-0 text-sm font-semibold text-gold">
                  {msg.from.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${!msg.read ? 'font-semibold text-white' : 'text-text-secondary'}`}>{msg.from}</p>
                    {msg.starred && <Star size={12} className="text-gold fill-gold flex-shrink-0" />}
                  </div>
                  <p className={`text-sm truncate ${!msg.read ? 'text-white' : 'text-text-secondary'}`}>{msg.subject}</p>
                  <p className="text-xs text-text-muted truncate">{msg.body.slice(0, 80)}...</p>
                </div>
              </div>
              <span className="text-xs text-text-muted ml-3 flex-shrink-0">{msg.date}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      <Modal isOpen={showCompose} onClose={() => setShowCompose(false)} title="Compose Message">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary block mb-1">To</label>
            <input value={newMsg.to} onChange={e => setNewMsg({...newMsg, to: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Recipient name" />
          </div>
          <div>
            <label className="text-sm text-text-secondary block mb-1">Subject</label>
            <input value={newMsg.subject} onChange={e => setNewMsg({...newMsg, subject: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Message subject" />
          </div>
          <div>
            <label className="text-sm text-text-secondary block mb-1">Message</label>
            <textarea value={newMsg.body} onChange={e => setNewMsg({...newMsg, body: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm min-h-[120px] resize-none" placeholder="Type your message..." />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCompose(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => { sendMessage(newMsg); setShowCompose(false); }} className="btn-primary flex items-center gap-2"><Send size={14} /> Send</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
