import { Fragment, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Location {
  id: string; name: string; nameEn: string | null;
  type: string; lat: number | null; lng: number | null;
  address: string | null; isActive: boolean;
  regionId: string | null;
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  airport: { label: 'Havalimanı', icon: '✈️' },
  region:  { label: 'Bölge',      icon: '📍' },
  hotel:   { label: 'Otel',       icon: '🏨' },
  port:    { label: 'Liman',      icon: '⚓' },
};


function LocationForm({
  initial, regions, onSave, onCancel,
}: {
  initial?: Location;
  regions: Location[];
  onSave: (d: Partial<Location> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Location, 'id'>>({
    name:     initial?.name     ?? '',
    nameEn:   initial?.nameEn  ?? '',
    type:     initial?.type     ?? 'region',
    lat:      initial?.lat      ?? null,
    lng:      initial?.lng      ?? null,
    address:  initial?.address  ?? null,
    isActive: initial?.isActive ?? true,
    regionId: initial?.regionId ?? null,
  });

  const set = (k: keyof typeof form, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Lokasyon Adı (TR) *</label>
          <input className="input" value={form.name}
            onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Lokasyon Adı (EN)</label>
          <input className="input" value={form.nameEn ?? ''}
            onChange={(e) => set('nameEn', e.target.value)} />
        </div>
        <div>
          <label className="label">Tür *</label>
          <select className="input" value={form.type}
            onChange={(e) => set('type', e.target.value)}>
            <option value="airport">✈️ Havalimanı</option>
            <option value="region">📍 Bölge</option>
            <option value="hotel">🏨 Otel</option>
            <option value="port">⚓ Liman</option>
          </select>
        </div>
        <div>
          <label className="label">Adres</label>
          <input className="input" value={form.address ?? ''}
            onChange={(e) => set('address', e.target.value || null)} />
        </div>
        <div>
          <label className="label">Enlem (lat)</label>
          <input type="number" step="any" className="input"
            value={form.lat ?? ''}
            onChange={(e) => set('lat', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="label">Boylam (lng)</label>
          <input type="number" step="any" className="input"
            value={form.lng ?? ''}
            onChange={(e) => set('lng', e.target.value ? Number(e.target.value) : null)} />
        </div>
        {form.type !== 'region' && (
          <div className="col-span-2">
            <label className="label">
              Bağlı Bölge <span className="font-normal normal-case text-gray-400">
                (toplu fiyat girişinde bu bölge altında gruplanır)
              </span>
            </label>
            <select className="input" value={form.regionId ?? ''}
              onChange={(e) => set('regionId', e.target.value || null)}>
              <option value="">— Bölge seçilmedi —</option>
              {regions
                .filter((r) => r.id !== initial?.id)
                .map((r) => <option key={r.id} value={r.id}>📍 {r.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="size-4 rounded" checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)} />
        <span className="text-sm text-gray-700">Aktif (arama formunda göster)</span>
      </label>

      <div className="flex gap-2">
        <button type="button" className="btn btn-primary py-1.5 px-4 text-sm"
          onClick={() => onSave({ ...form, ...(initial ? { id: initial.id } : {}) })}>
          Kaydet
        </button>
        <button type="button" className="btn btn-outline py-1.5 px-4 text-sm"
          onClick={onCancel}>
          İptal
        </button>
      </div>
    </div>
  );
}

export function LocationsPage() {
  const qc = useQueryClient();
  const [showNew,  setShowNew]  = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [filter,   setFilter]   = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'locations'],
    queryFn:  () => api.get<{ locations: Location[] }>('/admin/locations').then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d: Partial<Location>) => api.post('/admin/locations', d),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin', 'locations'] }); setShowNew(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<Location> & { id: string }) =>
      api.patch(`/admin/locations/${id}`, d),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin', 'locations'] }); setEditId(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/locations/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'locations'] }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/locations/${id}`, { isActive }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'locations'] }),
  });

  const all        = data?.locations ?? [];
  const regionList = all.filter((l) => l.type === 'region');
  const regionName = (id: string | null) => regionList.find((r) => r.id === id)?.name ?? null;
  const filtered  = filter === 'all' ? all : all.filter((l) => l.type === filter);
  const airports  = all.filter((l) => l.type === 'airport').length;
  const regions   = all.filter((l) => l.type === 'region').length;
  const hotels    = all.filter((l) => l.type === 'hotel').length;
  const ports     = all.filter((l) => l.type === 'port').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Lokasyonlar</h1>
        <button className="btn btn-primary py-1.5 px-4 text-sm"
          onClick={() => { setShowNew(true); setEditId(null); }}>
          + Yeni Lokasyon
        </button>
      </div>

      {/* Özet */}
      <div className="flex gap-3">
        {[
          { key: 'all',     label: `Tümü (${all.length})` },
          { key: 'airport', label: `✈️ Havalimanı (${airports})` },
          { key: 'region',  label: `📍 Bölge (${regions})` },
          { key: 'hotel',   label: `🏨 Otel (${hotels})` },
          ...(ports > 0 ? [{ key: 'port', label: `⚓ Liman (${ports})` }] : []),
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={[
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              filter === key
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400',
            ].join(' ')}>
            {label}
          </button>
        ))}
      </div>

      {showNew && (
        <LocationForm
          regions={regionList}
          onSave={(d) => createMut.mutate(d)}
          onCancel={() => setShowNew(false)}
        />
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <div className="card py-12 text-center text-gray-400">
          Lokasyon bulunamadı
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-4 py-3 font-medium">Lokasyon</th>
                <th className="px-4 py-3 font-medium">Tür</th>
                <th className="px-4 py-3 font-medium">Koordinat</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((loc) => (
                <Fragment key={loc.id}>
                  {editId === loc.id ? (
                    <tr key={loc.id + '-edit'}>
                      <td colSpan={5} className="px-4 py-3">
                        <LocationForm
                          initial={loc}
                          regions={regionList}
                          onSave={(d) => updateMut.mutate(d as Location & { id: string })}
                          onCancel={() => setEditId(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={loc.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{loc.name}</p>
                        {loc.nameEn && <p className="text-xs text-gray-400">{loc.nameEn}</p>}
                        {loc.address && <p className="text-xs text-gray-400">{loc.address}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          {TYPE_LABELS[loc.type]?.icon ?? '📌'}
                          {TYPE_LABELS[loc.type]?.label ?? loc.type}
                        </span>
                        {loc.type !== 'region' && (
                          regionName(loc.regionId)
                            ? <p className="mt-0.5 text-xs text-amber-600">📍 {regionName(loc.regionId)}</p>
                            : <p className="mt-0.5 text-xs text-gray-300">bölge atanmamış</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {loc.lat != null ? `${loc.lat.toFixed(4)}, ${loc.lng?.toFixed(4)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleMut.mutate({ id: loc.id, isActive: !loc.isActive })}
                          className={`badge ${loc.isActive ? 'badge-green' : 'badge-gray'} cursor-pointer`}
                        >
                          {loc.isActive ? 'Aktif' : 'Pasif'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button onClick={() => { setEditId(loc.id); setShowNew(false); }}
                            className="text-sm text-blue-600 hover:underline">
                            Düzenle
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`"${loc.name}" silinsin mi?\nBu lokasyona bağlı fiyat ve rezervasyon varsa silinemez.`))
                                deleteMut.mutate(loc.id);
                            }}
                            className="text-sm text-red-500 hover:underline">
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
