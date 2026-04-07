'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Building2, Plus, X, Loader2, AlertCircle, CheckCircle2,
  Edit2, Trash2, Users, FileText, Search, UserPlus
} from 'lucide-react';

type Department = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
  members: DepartmentMember[];
  _count: { documents: number };
};

type DepartmentMember = {
  id: string;
  userId: string;
  role: 'MEMBER' | 'MANAGER';
  joinedAt: string;
  user: { id: string; email: string };
};

export default function DepartmentsAdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Create department form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });
  const [creating, setCreating] = useState(false);

  // Edit department
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });
  const [updating, setUpdating] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Expanded department
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add member form
  const [memberDeptId, setMemberDeptId] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState<'MEMBER' | 'MANAGER'>('MEMBER');
  const [addingMember, setAddingMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; email: string }[]>([]);

  // Load departments
  useEffect(() => {
    if (authLoading || !user) return;

    // Check authorization - only admins
    if (user.globalRole !== 'SUPER_ADMIN' && (user as any).tenantRole !== 'TENANT_ADMIN') {
      setError('Admin access required');
      setTimeout(() => router.push('/dashboard'), 2000);
      return;
    }

    loadDepartments();
  }, [authLoading, user, router]);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ departments: any[] }>('/departments');
      setDepartments(res.departments || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Department name is required');
      return;
    }

    try {
      setCreating(true);
      setError('');
      const body = JSON.stringify(formData);
      const res = await apiFetch<{ department: any }>('/departments', { method: 'POST', json: body });
      setDepartments([...departments, res.department]);
      setFormData({ name: '', description: '', color: '#3B82F6' });
      setShowCreateForm(false);
      setSuccess('Department created successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create department');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (dept: Department) => {
    setEditingId(dept.id);
    setEditFormData({
      name: dept.name,
      description: dept.description || '',
      color: dept.color,
    });
  };

  const handleSaveEdit = async (deptId: string) => {
    if (!editFormData.name.trim()) {
      setError('Department name is required');
      return;
    }

    try {
      setUpdating(true);
      setError('');
      const res = await apiFetch<{ department: any }>(`/departments/${deptId}`, {
        method: 'PUT',
        body: JSON.stringify(editFormData),
      });
      setDepartments(departments.map(d => d.id === deptId ? res.department : d));
      setEditingId(null);
      setSuccess('Department updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update department');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (deptId: string) => {
    try {
      setDeleting(true);
      setError('');
      const body = JSON.stringify({ deleted: true });
      const res = await apiFetch<{ department: any }>(`/departments/${editingId}`, { method: 'PATCH', json: body });
      setDepartments(departments.map(d => d.id === editingId ? res.department : d));
      setDeleteId(null);
      setSuccess('Department deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete department');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberDeptId || !memberUserId) {
      setError('Please select a user');
      return;
    }

    try {
      setAddingMember(true);
      setError('');
      const res = await apiFetch<{ member: any }>(`/departments/${memberDeptId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: memberUserId, role: memberRole }),
      });

      // Update the department
      setDepartments(departments.map(d =>
        d.id === memberDeptId
          ? { ...d, members: [...d.members, res.member] }
          : d
      ));

      setMemberDeptId(null);
      setMemberUserId('');
      setMemberRole('MEMBER');
      setSuccess('Member added successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (deptId: string, userId: string) => {
    try {
      setError('');
      await apiFetch(`/departments/${deptId}/members/${userId}`, { method: 'DELETE' });
      setDepartments(departments.map(d =>
        d.id === deptId
          ? { ...d, members: d.members.filter(m => m.userId !== userId) }
          : d
      ));
      setSuccess('Member removed successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const filteredDepartments = departments.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Department Management</h1>
                <p className="text-gray-600">Create and manage organizational departments</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              New Department
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-red-700">{error}</div>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-green-700">{success}</div>
            <button
              onClick={() => setSuccess('')}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Create New Department</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Human Resources"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the department"
                  rows={3}
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    disabled={creating}
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    placeholder="#3B82F6"
                    disabled={creating}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                >
                  {creating ? 'Creating...' : 'Create Department'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search departments..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Departments List */}
        <div className="grid gap-6">
          {filteredDepartments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No departments found. Create one to get started.</p>
            </div>
          ) : (
            filteredDepartments.map(dept => (
              <div key={dept.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Department Header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedId(expandedId === dept.id ? null : dept.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className="w-4 h-12 rounded"
                      style={{ backgroundColor: dept.color }}
                    />
                    <div className="flex-1">
                      {editingId === dept.id ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editFormData.name}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            className="w-full px-3 py-1 border border-gray-300 rounded font-semibold focus:ring-2 focus:ring-blue-500"
                            disabled={updating}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <textarea
                            value={editFormData.description}
                            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                            className="w-full px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            disabled={updating}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit(dept.id);
                              }}
                              disabled={updating}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-400"
                            >
                              Save
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(null);
                              }}
                              disabled={updating}
                              className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-semibold text-gray-900 text-lg">{dept.name}</h3>
                          {dept.description && (
                            <p className="text-gray-600 text-sm mt-1">{dept.description}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {editingId !== dept.id && (
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-4">
                        <div className="flex gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {dept.members.length}
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {dept._count.documents}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(dept);
                        }}
                        className="p-2 hover:bg-gray-100 rounded transition"
                      >
                        <Edit2 className="w-5 h-5 text-gray-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(dept.id);
                        }}
                        className="p-2 hover:bg-red-50 rounded transition"
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedId === dept.id && editingId !== dept.id && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="space-y-6">
                      {/* Members Section */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Members ({dept.members.length})
                        </h4>
                        {dept.members.length === 0 ? (
                          <p className="text-gray-600 text-sm">No members yet</p>
                        ) : (
                          <div className="space-y-2">
                            {dept.members.map(member => (
                              <div key={member.id} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{member.user.email}</p>
                                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    {member.role === 'MANAGER' ? '👨‍💼 Manager' : '👤 Member'}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleRemoveMember(dept.id, member.userId)}
                                  className="p-1 hover:bg-red-50 rounded transition"
                                >
                                  <X className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add Member Form */}
                      {memberDeptId !== dept.id ? (
                        <button
                          onClick={() => setMemberDeptId(dept.id)}
                          className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition flex items-center justify-center gap-2"
                        >
                          <UserPlus className="w-4 h-4" />
                          Add Member
                        </button>
                      ) : (
                        <form onSubmit={handleAddMember} className="space-y-3 p-4 bg-white border border-blue-200 rounded-lg">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              User (ID)
                            </label>
                            <input
                              type="text"
                              value={memberUserId}
                              onChange={(e) => setMemberUserId(e.target.value)}
                              placeholder="Enter user ID (UUID)"
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={addingMember}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Note: Use the user's UUID from tenant membership
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Role
                            </label>
                            <select
                              value={memberRole}
                              onChange={(e) => setMemberRole(e.target.value as 'MEMBER' | 'MANAGER')}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={addingMember}
                            >
                              <option value="MEMBER">Member</option>
                              <option value="MANAGER">Manager</option>
                            </select>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              type="submit"
                              disabled={addingMember}
                              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
                            >
                              {addingMember ? 'Adding...' : 'Add'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMemberDeptId(null);
                                setMemberUserId('');
                              }}
                              disabled={addingMember}
                              className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Department?</h3>
            <p className="text-gray-600 mb-6">
              This action cannot be undone. Documents will be unassigned from this department.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
