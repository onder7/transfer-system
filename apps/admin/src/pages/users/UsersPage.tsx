import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type Role = 'ADMIN' | 'OPERATOR' | 'DRIVER' | 'CUSTOMER';

interface User {
  id: string; email: string; firstName: string; lastName: string;
  phone: string | null; role: Role; isActive: boolean; createdAt: string;
}

const ROLES: Role[] = ['ADMIN', 'OPERATOR', 'DRIVER', 'CUSTOMER'];
const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin', OPERATOR: 'Operatör', DRIVER: 'Şoför', CUSTOMER: 'Müşteri',
};
const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'badge-red', OPERATOR: 'badge-blue', DRIVER: 'badge-yellow', CUSTOMER: 'badge-gray',
};

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'OPERATOR' as Role });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => api.post('/admin/users', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Hata'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Yeni Kullanıcı</h2>
        <div className="space-y-3">
          {[
            { key: 'firstName', label: 'Ad' },
            { key: 'lastName',  label: 'Soyad' },
            { key: 'email',     label: 'E-posta', type: 'email' },
            { key: 'phone',     label: 'Telefon',  type: 'tel' },
            { key: 'password',  label: 'Şifre',    type: 'password' },
          ].map(({ key, label, type = 'text' }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input type={type} className="input" value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="label">Rol</label>
            <select className="input" value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', roleFilter],
    queryFn:  () =>
      api.get<{ users: User[] }>('/admin/users', {
        params: roleFilter ? { role: roleFilter } : undefined,
      }).then((r) => r.data),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/users/${id}/active`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const users = data?.users ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Kullanıcılar</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Yeni Kullanıcı</button>
      </div>

      {/* Rol filtresi */}
      <div className="flex gap-2">
        {[{ value: '', label: 'Tümü' }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))].map(({ value, label }) => (
          <button key={value} onClick={() => setRoleFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              roleFilter === value ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
              {['Ad Soyad', 'E-posta', 'Rol', 'Durum', 'Kayıt', 'İşlem'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Yükleniyor…</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  {me?.role === 'ADMIN' && u.id !== me.id ? (
                    <select
                      className="rounded border border-gray-200 px-2 py-0.5 text-xs"
                      value={u.role}
                      onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value as Role })}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  ) : (
                    <span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={u.isActive ? 'badge badge-green' : 'badge badge-gray'}>
                    {u.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                </td>
                <td className="px-4 py-3">
                  {u.id !== me?.id && (
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                      className={`text-xs hover:underline ${u.isActive ? 'text-red-500' : 'text-green-600'}`}
                    >
                      {u.isActive ? 'Deaktive' : 'Aktive'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
