import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '../../stores/caseStore';
import { PageHeader, StatusBadge, Modal, GlassCard } from '../../components/UI';
import { Plus, Search, Trash2, Edit, Eye, Filter } from 'lucide-react';

interface CasesListProps {
  basePath: string;
  canCreate?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
}

export const CasesList: React.FC<CasesListProps> = ({ basePath, canCreate = false, canDelete = false, canEdit = false }) => {
  const { cases, fetchCases, deleteCase, createCase } = useCaseStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCase, setNewCase] = useState({ title: '', caseNumber: '', type: '', priority: 'medium', status: 'pending', assignedToId: 2, clientId: 5, assignedToName: 'John Smith', clientName: 'Client A' });
  const navigate = useNavigate();

  useEffect(() => { fetchCases(); }, []);

  const filtered = cases.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.caseNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = () => {
    createCase(newCase);
    setShowCreateModal(false);
    setNewCase({ title: '', caseNumber: '', type: '', priority: 'medium', status: 'pending', assignedToId: 2, clientId: 5, assignedToName: 'John Smith', clientName: 'Client A' });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Cases"
        subtitle={`${cases.length} total cases`}
        action={canCreate ? (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Case
          </button>
        ) : undefined}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 glass-input px-4 py-2 flex-1 min-w-[250px] max-w-md">
          <Search size={16} className="text-text-muted" />
          <input
            type="text"
            placeholder="Search cases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-white w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          {['all', 'active', 'pending', 'discovery', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                statusFilter === s ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-white/5 text-text-secondary hover:bg-white/10 border border-transparent'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <GlassCard className="p-0 overflow-hidden">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Type</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned To</th>
              <th>Client</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td>
                  <div>
                    <p className="text-sm font-medium text-white">{c.title}</p>
                    <p className="text-xs text-text-muted">{c.caseNumber}</p>
                  </div>
                </td>
                <td className="text-sm text-text-secondary">{c.type}</td>
                <td><StatusBadge status={c.status} size="sm" /></td>
                <td><StatusBadge status={c.priority} size="sm" /></td>
                <td className="text-sm text-text-secondary">{c.assignedToName}</td>
                <td className="text-sm text-text-secondary">{c.clientName}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => navigate(`${basePath}/${c.id}`)} className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-colors" title="View">
                      <Eye size={14} />
                    </button>
                    {canDelete && (
                      <button onClick={() => deleteCase(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted text-sm">No cases found</div>
        )}
      </GlassCard>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Case" size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary block mb-1">Case Title</label>
            <input value={newCase.title} onChange={e => setNewCase({...newCase, title: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Enter case title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Case Number</label>
              <input value={newCase.caseNumber} onChange={e => setNewCase({...newCase, caseNumber: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="2026-CV-XXXXX" />
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Type</label>
              <input value={newCase.type} onChange={e => setNewCase({...newCase, type: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="e.g., Patent Infringement" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Priority</label>
              <select value={newCase.priority} onChange={e => setNewCase({...newCase, priority: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Status</label>
              <select value={newCase.status} onChange={e => setNewCase({...newCase, status: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm">
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="discovery">Discovery</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary">Create Case</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
