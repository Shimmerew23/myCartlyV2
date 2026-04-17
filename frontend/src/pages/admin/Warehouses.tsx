import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Warehouse, Plus, RefreshCw, MoreVertical, Trash2,
  ToggleLeft, ToggleRight, X, MapPin, User, Pencil
} from 'lucide-react';
import api from '@/api/axios';
import { Warehouse as WarehouseType } from '@/types';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';

interface WarehouseForm {
  name: string;
  code: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  managerName: string;
  managerEmail: string;
  notes: string;
}

const EMPTY_FORM: WarehouseForm = {
  name: '', code: '', street: '', city: '', state: '',
  country: 'US', zipCode: '', managerName: '', managerEmail: '', notes: '',
};

const AdminWarehouses = () => {
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<WarehouseForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<WarehouseType | null>(null);
  const [editForm, setEditForm] = useState<Partial<WarehouseForm>>({});
  const [saving, setSaving] = useState(false);

  // Action menu
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/warehouses');
      setWarehouses(data.data);
    } catch {
      toast.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

  // ── Create ──────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/warehouses', createForm);
      toast.success('Warehouse created! Credentials sent via email.');
      setShowCreateModal(false);
      setCreateForm(EMPTY_FORM);
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create warehouse');
    } finally {
      setCreating(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────
  const openEdit = (w: WarehouseType) => {
    setActionMenuId(null);
    setEditTarget(w);
    setEditForm({
      name: w.name,
      code: w.code,
      street: w.address.street,
      city: w.address.city,
      state: w.address.state,
      country: w.address.country,
      zipCode: w.address.zipCode,
      managerName: typeof w.manager === 'object' ? w.manager.name : '',
      managerEmail: typeof w.manager === 'object' ? w.manager.email : '',
      notes: w.notes ?? '',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      await api.put(`/admin/warehouses/${editTarget._id}`, {
        name: editForm.name,
        code: editForm.code,
        address: {
          street: editForm.street,
          city: editForm.city,
          state: editForm.state,
          country: editForm.country,
          zipCode: editForm.zipCode,
        },
        managerName: editForm.managerName,
        notes: editForm.notes,
      });
      toast.success('Warehouse updated');
      setEditTarget(null);
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle / Delete ───────────────────────────────────────────────────────
  const handleToggleActive = async (w: WarehouseType) => {
    setActionMenuId(null);
    try {
      await api.put(`/admin/warehouses/${w._id}`, { isActive: !w.isActive });
      toast.success(`Warehouse ${w.isActive ? 'deactivated' : 'activated'}`);
      fetchWarehouses();
    } catch {
      toast.error('Update failed');
    }
  };

  const handleDelete = async (w: WarehouseType) => {
    setActionMenuId(null);
    if (!confirm(`Delete warehouse "${w.name}" and its account? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/warehouses/${w._id}`);
      toast.success('Warehouse deleted');
      fetchWarehouses();
    } catch {
      toast.error('Delete failed');
    }
  };

  // ── Field helpers ─────────────────────────────────────────────────────────
  const createField = (key: keyof WarehouseForm, label: string, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-xs font-semibold text-on-surface-variant mb-1">{label}</label>
      <input
        type={type}
        value={createForm[key]}
        onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-surface-low border border-transparent rounded-md focus:outline-none focus:border-outline-variant transition-all"
      />
    </div>
  );

  const editField = (key: keyof WarehouseForm, label: string, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-xs font-semibold text-on-surface-variant mb-1">{label}</label>
      <input
        type={type}
        value={(editForm as any)[key] ?? ''}
        onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-surface-low border border-transparent rounded-md focus:outline-none focus:border-outline-variant transition-all"
      />
    </div>
  );

  return (
    <>
      <Helmet><title>Warehouses | Admin — CartLy</title></Helmet>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-headline text-2xl font-black tracking-tighter">Warehouses</h1>
            <p className="text-sm text-outline mt-0.5">{warehouses.length} warehouse{warehouses.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchWarehouses} className="btn-ghost text-xs">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary text-xs">
              <Plus size={14} /> New Warehouse
            </button>
          </div>
        </div>

        {/* Table — no overflow-hidden so action menus aren't clipped */}
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>Code</th>
                  <th>Location</th>
                  <th>Account (Manager)</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((_, j) => (
                        <td key={j}><div className="h-4 skeleton rounded w-24" /></td>
                      ))}
                    </tr>
                  ))
                ) : warehouses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-outline">
                      No warehouses yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  warehouses.map((w) => (
                    <tr key={w._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md editorial-gradient flex items-center justify-center flex-shrink-0">
                            <Warehouse size={14} className="text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{w.name}</p>
                            {w.notes && <p className="text-xs text-outline truncate max-w-36">{w.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs bg-surface-low px-2 py-0.5 rounded">{w.code}</span>
                      </td>
                      <td>
                        <div className="flex items-start gap-1.5 text-xs text-on-surface-variant">
                          <MapPin size={11} className="flex-shrink-0 mt-0.5 text-outline" />
                          <span>{w.address.city}, {w.address.state}</span>
                        </div>
                      </td>
                      <td>
                        {typeof w.manager === 'object' && (
                          <div className="flex items-start gap-1.5 text-xs">
                            <User size={11} className="flex-shrink-0 mt-0.5 text-outline" />
                            <div>
                              <p className="font-medium">{w.manager.name}</p>
                              <p className="text-outline">{w.manager.email}</p>
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge text-[10px] ${w.isActive ? 'badge-success' : 'badge-error'}`}>
                          {w.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-outline">
                          {typeof w.manager === 'object' && w.manager.lastLoginAt
                            ? new Date(w.manager.lastLoginAt).toLocaleDateString()
                            : 'Never'}
                        </span>
                      </td>
                      <td>
                        {/* Wrapper must be relative + z-index so menu floats above sibling rows */}
                        <div className="relative" ref={actionMenuId === w._id ? menuRef : undefined}>
                          <button
                            onClick={() => setActionMenuId(actionMenuId === w._id ? null : w._id)}
                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface-container transition-colors"
                          >
                            <MoreVertical size={15} />
                          </button>
                          {actionMenuId === w._id && (
                            <div className="absolute right-0 top-9 w-48 bg-white rounded-lg shadow-editorial-lg border border-outline-variant/20 py-1 z-50">
                              <button
                                onClick={() => openEdit(w)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-on-surface-variant hover:bg-surface-low transition-colors"
                              >
                                <Pencil size={13} /> Edit
                              </button>
                              <button
                                onClick={() => handleToggleActive(w)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-on-surface-variant hover:bg-surface-low transition-colors"
                              >
                                {w.isActive ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                                {w.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDelete(w)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-error hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Create Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
                  <div>
                    <h2 className="font-headline font-black text-lg tracking-tight">New Warehouse</h2>
                    <p className="text-xs text-outline mt-0.5">Creates a warehouse record + a login account. Credentials are emailed automatically.</p>
                  </div>
                  <button onClick={() => setShowCreateModal(false)} className="text-outline hover:text-on-surface transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="p-6 space-y-5">
                  <div>
                    <p className="text-xs font-bold text-outline uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Warehouse size={12} /> Warehouse Info
                    </p>
                    <div className="space-y-3">
                      {createField('name', 'Warehouse Name *', 'e.g. East Coast Hub')}
                      {createField('code', 'Warehouse Code *', 'e.g. ECH-01 (unique, uppercase)')}
                      {createField('notes', 'Notes (optional)', 'Any internal notes')}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-outline uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <MapPin size={12} /> Address
                    </p>
                    <div className="space-y-3">
                      {createField('street', 'Street *', '123 Main St')}
                      <div className="grid grid-cols-2 gap-3">
                        {createField('city', 'City *', 'New York')}
                        {createField('state', 'State *', 'NY')}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {createField('zipCode', 'Zip Code *', '10001')}
                        {createField('country', 'Country', 'US')}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-outline uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <User size={12} /> Login Account
                    </p>
                    <div className="space-y-3">
                      {createField('managerName', 'Account Name *', 'e.g. NYC Warehouse')}
                      {createField('managerEmail', 'Account Email *', 'warehouse-nyc@example.com', 'email')}
                    </div>
                    <p className="text-xs text-outline mt-2">A temporary password will be emailed to this address.</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowCreateModal(false)} className="btn-ghost flex-1 text-sm">
                      Cancel
                    </button>
                    <button type="submit" disabled={creating} className="btn-primary flex-1 text-sm disabled:opacity-50">
                      {creating ? 'Creating...' : 'Create Warehouse'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setEditTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
                  <div>
                    <h2 className="font-headline font-black text-lg tracking-tight">Edit Warehouse</h2>
                    <p className="text-xs text-outline mt-0.5">Update warehouse details. To change the account email, delete and recreate.</p>
                  </div>
                  <button onClick={() => setEditTarget(null)} className="text-outline hover:text-on-surface transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-5">
                  <div>
                    <p className="text-xs font-bold text-outline uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Warehouse size={12} /> Warehouse Info
                    </p>
                    <div className="space-y-3">
                      {editField('name', 'Warehouse Name *')}
                      {editField('code', 'Warehouse Code *')}
                      {editField('notes', 'Notes (optional)')}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-outline uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <MapPin size={12} /> Address
                    </p>
                    <div className="space-y-3">
                      {editField('street', 'Street *')}
                      <div className="grid grid-cols-2 gap-3">
                        {editField('city', 'City *')}
                        {editField('state', 'State *')}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {editField('zipCode', 'Zip Code *')}
                        {editField('country', 'Country')}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-outline uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <User size={12} /> Account
                    </p>
                    <div className="space-y-3">
                      {editField('managerName', 'Account Name *')}
                      <div>
                        <label className="block text-xs font-semibold text-on-surface-variant mb-1">Account Email</label>
                        <input
                          type="email"
                          value={editForm.managerEmail ?? ''}
                          disabled
                          className="w-full px-3 py-2 text-sm bg-surface-low border border-transparent rounded-md text-outline cursor-not-allowed"
                        />
                        <p className="text-xs text-outline mt-1">Email cannot be changed. Delete and recreate to use a different email.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setEditTarget(null)} className="btn-ghost flex-1 text-sm">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdminWarehouses;
