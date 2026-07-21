import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Extra {
  id: string; key: string | null; name: string; nameEn: string | null;
  description: string | null; price: number;
  priceType: 'FLAT' | 'PER_PERSON' | 'PER_UNIT';
  requiresNote: boolean; maxQuantity: number;
  isActive: boolean; sortOrder: number;
  _count: { bookings: number };
}

const PRICE_TYPE_LABEL: Record<Extra['priceType'], string> = {
  FLAT:       'Sabit (rezervasyon başı)',
  PER_PERSON: 'Kişi başı',
  PER_UNIT:   'Adet başı',
};

type FormState = {
  name: string; nameEn: string; description: string;
  price: number; priceType: Extra['priceType'];
  requiresNote: boolean; maxQuantity: number;
  sortOrder: number; isActive: boolean;
};

function EditorModal({ extra, onClose }: { extra: Extra | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!extra;
  const [form, setForm] = useState<FormState>({
    name:         extra?.name ?? '',
    nameEn:       extra?.nameEn ?? '',
    description:  extra?.description ?? '',
    price:        extra?.price ?? 0,
    priceType:    extra?.priceType ?? 'PER_UNIT',
    requiresNote: extra?.requiresNote ?? false,
    maxQuantity:  extra?.maxQuantity ?? 4,
    sortOrder:    extra?.sortOrder ?? 0,
    isActive:     extra?.isActive ?? true,
  });
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(k: K) => (v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        nameEn:      form.nameEn || undefined,
        description: form.description || undefined,
      };
      return isEdit
        ? api.patch(`/admin/extras/${extra!.id}`, body)
        : api.post('/admin/extras', body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'extras'] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Hata'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isEdit ? 'Ekstra Hizmeti Düzenle' : 'Yeni Ekstra Hizmet'}
        </h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ad (TR)</label>
              <input className="input" value={form.name}
                onChange={(e) => set('name')(e.target.value)} placeholder="İsimle Karşılama" />
            </div>
            <div>
              <label className="label">Ad (EN)</label>
              <input className="input" value={form.nameEn}
                onChange={(e) => set('nameEn')(e.target.value)} placeholder="Name Sign" />
            </div>
          </div>
          <div>
            <label className="label">Açıklama</label>
            <input className="input" value={form.description}
              onChange={(e) => set('description')(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fiyat (₺)</label>
              <input type="number" className="input" min={0} value={form.price}
                onChange={(e) => set('price')(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Fiyat Tipi</label>
              <select className="input" value={form.priceType}
                onChange={(e) => set('priceType')(e.target.value as Extra['priceType'])}>
                <option value="PER_UNIT">Adet başı</option>
                <option value="PER_PERSON">Kişi başı</option>
                <option value="FLAT">Sabit</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Maks. Adet</label>
              <input type="number" className="input" min={1} max={20} value={form.maxQuantity}
                onChange={(e) => set('maxQuantity')(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Sıra</label>
              <input type="number" className="input" value={form.sortOrder}
                onChange={(e) => set('sortOrder')(Number(e.target.value))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="size-4" checked={form.requiresNote}
              onChange={(e) => set('requiresNote')(e.target.checked)} />
            Not gerektirir (ör. karşılama panosuna yazılacak isim)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="size-4" checked={form.isActive}
              onChange={(e) => set('isActive')(e.target.checked)} />
            Aktif
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending || !form.name}>
            {mut.isPending ? 'Kaydediliyor…' : isEdit ? 'Kaydet' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExtrasPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Extra | null | undefined>(undefined); // undefined = kapalı

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'extras'],
    queryFn:  () => api.get<{ extras: Extra[] }>('/admin/extras').then((r) => r.data),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/extras/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'extras'] }),
  });

  const extras = data?.extras ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Ekstra Hizmetler</h1>
        <button className="btn btn-primary" onClick={() => setEditing(null)}>+ Yeni Ekstra</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
              {['Ad', 'Fiyat', 'Tip', 'Kullanım', 'Durum', ''].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Yükleniyor…</td></tr>
            ) : extras.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Henüz ekstra hizmet yok</td></tr>
            ) : extras.map((ex) => (
              <tr key={ex.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{ex.name}</p>
                  {ex.description && <p className="text-xs text-gray-400">{ex.description}</p>}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{Number(ex.price).toLocaleString('tr-TR')} ₺</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{PRICE_TYPE_LABEL[ex.priceType]}</td>
                <td className="px-4 py-3 text-gray-600">{ex._count.bookings}</td>
                <td className="px-4 py-3">
                  <span className={ex.isActive ? 'badge badge-green' : 'badge badge-gray'}>
                    {ex.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => setEditing(ex)} className="text-xs text-brand-600 hover:underline">
                      Düzenle
                    </button>
                    <button
                      onClick={() => { if (confirm(`"${ex.name}" silinsin mi?`)) del.mutate(ex.id); }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== undefined && <EditorModal extra={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
