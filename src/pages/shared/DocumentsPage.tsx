import React, { useEffect, useState } from 'react';
import { useDocumentStore } from '../../stores/appStores';
import { useCaseStore } from '../../stores/caseStore';
import { PageHeader, GlassCard, Modal } from '../../components/UI';
import { FileText, Upload, Trash2, Search, Download } from 'lucide-react';

interface DocumentsPageProps {
  canDelete?: boolean;
  canUpload?: boolean;
}

export const DocumentsPage: React.FC<DocumentsPageProps> = ({ canDelete = false, canUpload = true }) => {
  const { documents, fetchDocuments, uploadDocument, deleteDocument } = useDocumentStore();
  const { cases, fetchCases } = useCaseStore();
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  // A document belongs to a real case: the dataset ships empty, so nothing may be
  // pre-filled with a demo case name (see src/mocks/handlers/cases.ts).
  const emptyDoc = () => ({ name: '', type: 'PDF', size: '1.0 MB', caseId: 0, caseName: '', category: 'Filing' });
  const [newDoc, setNewDoc] = useState(emptyDoc());

  useEffect(() => { fetchDocuments(); fetchCases(); }, []);

  const filtered = documents.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  const canUploadDoc = Boolean(newDoc.name.trim() && newDoc.caseId);

  const handleUpload = () => {
    if (!canUploadDoc) return;
    uploadDocument(newDoc);
    setShowUpload(false);
    setNewDoc(emptyDoc());
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Documents"
        subtitle={`${documents.length} documents`}
        action={canUpload ? (
          <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
            <Upload size={16} /> Upload Document
          </button>
        ) : undefined}
      />

      <div className="flex items-center gap-2 glass-input px-4 py-2 max-w-md mb-6">
        <Search size={16} className="text-text-muted" />
        <input type="text" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-white w-full" />
      </div>

      <div className="grid gap-3">
        {filtered.map(doc => (
          <GlassCard key={doc.id} className="p-4 flex items-center justify-between" hover>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
                <FileText size={22} className="text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{doc.name}</p>
                <p className="text-xs text-text-muted">{doc.size} · {doc.type} · {doc.category}</p>
                <p className="text-xs text-text-muted">Case: {doc.caseName || '—'} · Uploaded by {doc.uploadedByName} on {doc.uploadedAt}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-colors">
                <Download size={14} />
              </button>
              {canDelete && (
                <button onClick={() => deleteDocument(doc.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Upload Document">
        <div className="space-y-4">
          <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-gold/30 transition-colors">
            <Upload size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary">Drag & drop or click to browse</p>
          </div>
          <div>
            <label className="text-sm text-text-secondary block mb-1">Document Name</label>
            <input value={newDoc.name} onChange={e => setNewDoc({...newDoc, name: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Document name" />
          </div>
          <div>
            <label className="text-sm text-text-secondary block mb-1">Case</label>
            <select
              value={newDoc.caseId}
              onChange={e => {
                const linkedCase = cases.find(c => c.id === Number(e.target.value));
                setNewDoc({ ...newDoc, caseId: linkedCase?.id ?? 0, caseName: linkedCase?.title ?? '' });
              }}
              className="glass-input w-full px-4 py-2.5 text-sm"
            >
              <option value={0}>Select a case…</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {cases.length === 0 && (
              <p className="text-[11px] text-text-muted mt-1">No cases yet — open one first in Cases.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Category</label>
              <select value={newDoc.category} onChange={e => setNewDoc({...newDoc, category: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm">
                <option value="Filing">Filing</option>
                <option value="Evidence">Evidence</option>
                <option value="Motion">Motion</option>
                <option value="Agreement">Agreement</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Type</label>
              <select value={newDoc.type} onChange={e => setNewDoc({...newDoc, type: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm">
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
                <option value="XLSX">XLSX</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowUpload(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleUpload} disabled={!canUploadDoc} className="btn-primary disabled:opacity-50">Upload</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
