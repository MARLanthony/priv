import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCaseStore } from '../../stores/caseStore';
import { useDocumentStore } from '../../stores/appStores';
import { PageHeader, GlassCard, StatusBadge, Tabs, LoadingSpinner } from '../../components/UI';
import { ArrowLeft, Calendar, User, Scale, FileText, Clock, MessageSquare } from 'lucide-react';

export const CaseDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCase, fetchCase, isLoading } = useCaseStore();
  const { documents, fetchDocuments } = useDocumentStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) { fetchCase(Number(id)); fetchDocuments(); }
  }, [id]);

  if (isLoading || !currentCase) return <LoadingSpinner />;

  const caseDocs = documents.filter(d => d.caseId === currentCase.id);
  const tabs = [
    { label: 'Overview', value: 'overview' },
    { label: 'Documents', value: 'documents' },
    { label: 'Timeline', value: 'timeline' },
    { label: 'Messages', value: 'messages' },
  ];

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-sm mb-4">
        <ArrowLeft size={16} /> Back to Cases
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{currentCase.title}</h1>
          <p className="text-sm text-text-secondary mt-1">{currentCase.caseNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={currentCase.priority} />
          <StatusBadge status={currentCase.status} />
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <GlassCard className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-white mb-4">Case Details</h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-6">{currentCase.description || 'No description provided.'}</p>
            {currentCase.notes && (
              <div className="p-4 rounded-xl bg-gold/5 border border-gold/10">
                <p className="text-xs font-semibold text-gold mb-1">Notes</p>
                <p className="text-sm text-text-secondary">{currentCase.notes}</p>
              </div>
            )}
          </GlassCard>

          <div className="space-y-4">
            <GlassCard>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Scale size={16} className="text-gold" />
                  <div>
                    <p className="text-xs text-text-muted">Case Type</p>
                    <p className="text-sm text-white font-medium">{currentCase.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User size={16} className="text-gold" />
                  <div>
                    <p className="text-xs text-text-muted">Assigned Attorney</p>
                    <p className="text-sm text-white font-medium">{currentCase.assignedToName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User size={16} className="text-info" />
                  <div>
                    <p className="text-xs text-text-muted">Client</p>
                    <p className="text-sm text-white font-medium">{currentCase.clientName}</p>
                  </div>
                </div>
                {currentCase.nextHearing && (
                  <div className="flex items-center gap-3">
                    <Calendar size={16} className="text-warning" />
                    <div>
                      <p className="text-xs text-text-muted">Next Hearing</p>
                      <p className="text-sm text-white font-medium">{currentCase.nextHearing}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-text-muted" />
                  <div>
                    <p className="text-xs text-text-muted">Last Updated</p>
                    <p className="text-sm text-white font-medium">{currentCase.updatedAt}</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-white mb-4">Case Documents ({caseDocs.length})</h3>
          {caseDocs.length === 0 ? (
            <p className="text-text-muted text-sm py-4">No documents uploaded for this case.</p>
          ) : (
            <div className="space-y-2">
              {caseDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                      <FileText size={18} className="text-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{doc.name}</p>
                      <p className="text-xs text-text-muted">{doc.size} · {doc.category} · Uploaded by {doc.uploadedByName}</p>
                    </div>
                  </div>
                  <span className="text-xs text-text-muted">{doc.uploadedAt}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {activeTab === 'timeline' && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-white mb-4">Case Timeline</h3>
          <div className="space-y-4">
            {[
              { date: currentCase.createdAt, event: 'Case filed', type: 'created' },
              ...(caseDocs.map(d => ({ date: d.uploadedAt, event: `Document uploaded: ${d.name}`, type: 'document' }))),
              { date: currentCase.updatedAt, event: 'Case updated', type: 'updated' },
              ...(currentCase.nextHearing ? [{ date: currentCase.nextHearing, event: 'Next hearing scheduled', type: 'hearing' }] : []),
            ].sort((a, b) => a.date.localeCompare(b.date)).map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-gold/50 border-2 border-gold" />
                  {i < 3 && <div className="w-0.5 h-8 bg-white/8" />}
                </div>
                <div>
                  <p className="text-sm text-white">{item.event}</p>
                  <p className="text-xs text-text-muted">{item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {activeTab === 'messages' && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-white mb-4">Case Messages</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-gold" />
                <span className="text-sm font-medium text-white">{currentCase.assignedToName}</span>
                <span className="text-xs text-text-muted">· {currentCase.updatedAt}</span>
              </div>
              <p className="text-sm text-text-secondary">Case update: {currentCase.notes || 'Working on this case. Will provide updates soon.'}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <input placeholder="Type a message..." className="glass-input flex-1 px-4 py-2.5 text-sm" />
            <button className="btn-primary px-4">Send</button>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
