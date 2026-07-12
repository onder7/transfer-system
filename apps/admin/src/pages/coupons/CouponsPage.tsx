import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Coupon {
  id: string; code: string; discountType: 'percent' | 'fixed';
  amount: number; maxUses: number | null; isActive: boolean;
  validFrom: string | null; validUntil: string | null;
  createdAt: string;
  _count: { bookings: number };
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: '', discountType: 'percent' as 'percent' | 'fixed',
    amount: 10, maxUses: '', validFrom: '', validUntil: '', isActive: true,
  });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => api.post('/admin/coupons', {
      ...form,
      code:      form.code.toUpperCase(),
      maxUses:   form.maxUses   ? Number(form.maxUses)   : undefined,
      validFrom: form.validFrom || undefined,
      validUntil:form.validUntil|| undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Hata'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Yeni Kupon Oluştur</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Kupon Kodu</label>
            <input className="input font-mono uppercase" value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="HOSGELDIN10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">İndirim Tipi</label>
              <select className="input" value={form.discountType}
                onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as any }))}>
                <option value="percent">Yüzde (%)</option>
                <option value="fixed">Sabit (₺)</option>
              </select>
            </div>
            <div>
              <label className="label">Miktar</label>
              <input type="number" className="input" value={form.amount} min={1}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="label">Maksimum Kullanım (boş = sınırsız)</label>
            <input type="number" className="input" value={form.maxUses} min={1}
              onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Başlangıç</label>
              <input type="date" className="input" value={form.validFrom}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
            </div>
            <div>
              <label className="label">Bitiş</label>
              <input type="date" className="input" value={form.validUntil}
                onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending || !form.code}>
            {mut.isPending ? 'Kaydediliyor…' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CouponsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn:  () => api.get<{ coupons: Coupon[] }>('/admin/coupons').then((r) => r.data),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/coupons/${id}/toggle`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });

  const coupons = data?.coupons ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Kuponlar</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Yeni Kupon</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
              {['Kod', 'İndirim', 'Kullanım', 'Geçerlilik', 'Durum', ''].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Yükleniyor…</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Henüz kupon yok</td></tr>
            ) : coupons.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-semibold text-brand-600">{c.code}</td>
                <td className="px-4 py-3">
                  {c.discountType === 'percent' ? `%${c.amount}` : `${c.amount} ₺`}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {c._count.bookings} / {c.maxUses ?? '∞'}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {c.validFrom  ? new Date(c.validFrom).toLocaleDateString('tr-TR')  : '—'}
                  {' → '}
                  {c.validUntil ? new Date(c.validUntil).toLocaleDateString('tr-TR') : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={c.isActive ? 'badge badge-green' : 'badge badge-gray'}>
                    {c.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggle.mutate({ id: c.id, isActive: !c.isActive })}
                    className={`text-xs hover:underline ${c.isActive ? 'text-red-500' : 'text-green-600'}`}
                  >
                    {c.isActive ? 'Deaktive et' : 'Aktive et'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
