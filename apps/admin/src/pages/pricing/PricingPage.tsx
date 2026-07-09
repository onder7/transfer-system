import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Location     { id: string; name: string; type: string; }
interface VehicleClass {
  id: string; name: string; nameEn: string | null;
  capacity: number; luggageCapacity: number; isShared: boolean;
  features: string[]; imageUrl: string | null; isActive: boolean;
}
interface PriceMatrix  {
  id: string; basePrice: number; returnDiscount: number; isActive: boolean;
  fromLocation: { id: string; name: string };
  toLocation:   { id: string; name: string };
  vehicleClass: { id: string; name: string };
}
interface Surcharge {
  id: string; name: string; multiplier: number;
  startHour: number | null; endHour: number | null;
  startDate: string | null; endDate: string | null;
}

function PriceRow({ row, locations, vehicleClasses, onSave, onDelete }: {
  row: PriceMatrix | { fromLocationId: string; toLocationId: string; vehicleClassId: string; basePrice: number; returnDiscount: number };
  locations: Location[]; vehicleClasses: VehicleClass[];
  onSave: (data: any) => void; onDelete?: () => void;
}) {
  const isNew = !('id' in row);
  const [edit, setEdit] = useState(isNew);
  const [form, setForm] = useState({
    fromLocationId: 'fromLocation' in row ? row.fromLocation.id : (row as any).fromLocationId,
    toLocationId:   'toLocation'   in row ? row.toLocation.id   : (row as any).toLocationId,
    vehicleClassId: 'vehicleClass' in row ? row.vehicleClass.id : (row as any).vehicleClassId,
    basePrice:      row.basePrice,
    returnDiscount: row.returnDiscount,
    isActive:       'isActive' in row ? row.isActive : true,
  });

  if (!edit && 'id' in row) return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="px-4 py-2.5">{row.fromLocation.name}</td>
      <td className="px-4 py-2.5">{row.toLocation.name}</td>
      <td className="px-4 py-2.5">{row.vehicleClass.name}</td>
      <td className="px-4 py-2.5 font-medium">{Number(row.basePrice).toLocaleString('tr-TR')} ₺</td>
      <td className="px-4 py-2.5">%{row.returnDiscount}</td>
      <td className="px-4 py-2.5">
        <span className={row.isActive ? 'badge badge-green' : 'badge badge-gray'}>
          {row.isActive ? 'Aktif' : 'Pasif'}
        </span>
      </td>
      <td className="px-4 py-2.5 flex gap-2">
        <button onClick={() => setEdit(true)} className="text-xs text-blue-600 hover:underline">Düzenle</button>
        {onDelete && <button onClick={onDelete} className="text-xs text-red-500 hover:underline">Sil</button>}
      </td>
    </tr>
  );

  return (
    <tr className="border-b border-gray-100 bg-blue-50/30">
      <td className="px-2 py-1.5">
        <select className="input py-1 text-xs" value={form.fromLocationId}
          onChange={(e) => setForm((f) => ({ ...f, fromLocationId: e.target.value }))}>
          <option value="">—</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <select className="input py-1 text-xs" value={form.toLocationId}
          onChange={(e) => setForm((f) => ({ ...f, toLocationId: e.target.value }))}>
          <option value="">—</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <select className="input py-1 text-xs" value={form.vehicleClassId}
          onChange={(e) => setForm((f) => ({ ...f, vehicleClassId: e.target.value }))}>
          <option value="">—</option>
          {vehicleClasses.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input type="number" className="input py-1 text-xs w-24" value={form.basePrice}
          onChange={(e) => setForm((f) => ({ ...f, basePrice: Number(e.target.value) }))} />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" className="input py-1 text-xs w-16" value={form.returnDiscount} min={0} max={100}
          onChange={(e) => setForm((f) => ({ ...f, returnDiscount: Number(e.target.value) }))} />
      </td>
      <td className="px-2 py-1.5">
        <input type="checkbox" checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
      </td>
      <td className="px-2 py-1.5 flex gap-2">
        <button onClick={() => { onSave(form); if (!isNew) setEdit(false); }}
          className="text-xs text-green-600 font-medium hover:underline">Kaydet</button>
        {!isNew && <button onClick={() => setEdit(false)} className="text-xs text-gray-400 hover:underline">İptal</button>}
      </td>
    </tr>
  );
}

const FEATURE_LIST = ['water', 'wifi', 'child_seat', 'luggage'] as const;
const FEATURE_LABELS: Record<string, string> = { water: 'Su', wifi: 'Wi-Fi', child_seat: 'Çocuk koltuk', luggage: 'Büyük bagaj' };

function VehicleClassForm({
  initial, onSave, onCancel,
}: { initial?: VehicleClass; onSave: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name:           initial?.name           ?? '',
    nameEn:         initial?.nameEn         ?? '',
    capacity:       initial?.capacity       ?? 4,
    luggageCapacity: initial?.luggageCapacity ?? 2,
    isShared:       initial?.isShared       ?? false,
    features:       initial?.features       ?? [] as string[],
    isActive:       initial?.isActive       ?? true,
  });

  const toggleFeature = (f: string) =>
    setForm((p) => ({ ...p, features: p.features.includes(f) ? p.features.filter((x) => x !== f) : [...p.features, f] }));

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Araç Adı (TR)</label>
          <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Araç Adı (EN)</label>
          <input className="input" value={form.nameEn} onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))} />
        </div>
        <div>
          <label className="label">Maks. Yolcu</label>
          <input type="number" className="input" min={1} max={50} value={form.capacity}
            onChange={(e) => setForm((p) => ({ ...p, capacity: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="label">Bagaj Kapasitesi</label>
          <input type="number" className="input" min={0} max={20} value={form.luggageCapacity}
            onChange={(e) => setForm((p) => ({ ...p, luggageCapacity: Number(e.target.value) }))} />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="size-4 rounded" checked={form.isShared}
            onChange={(e) => setForm((p) => ({ ...p, isShared: e.target.checked }))} />
          <span className="text-sm font-medium text-gray-700">Paylaşımlı (Shuttle) — kişi başı fiyat</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="size-4 rounded" checked={form.isActive}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
          <span className="text-sm text-gray-700">Aktif</span>
        </label>
      </div>

      <div>
        <label className="label">Özellikler</label>
        <div className="flex flex-wrap gap-2">
          {FEATURE_LIST.map((f) => (
            <button
              key={f} type="button"
              onClick={() => toggleFeature(f)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                form.features.includes(f)
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400',
              ].join(' ')}
            >
              {FEATURE_LABELS[f] ?? f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave({ ...form, ...(initial ? { id: initial.id } : {}) })}
          className="btn btn-primary py-1.5 px-4 text-sm"
        >
          Kaydet
        </button>
        <button type="button" onClick={onCancel} className="btn btn-outline py-1.5 px-4 text-sm">İptal</button>
      </div>
    </div>
  );
}

export function PricingPage() {
  const qc = useQueryClient();
  const [showNewRow,  setShowNewRow]  = useState(false);
  const [editingVC,   setEditingVC]   = useState<string | null>(null);
  const [showNewVC,   setShowNewVC]   = useState(false);
  const [activeTab, setActiveTab]     = useState<'matrix' | 'vehicles' | 'surcharges'>('matrix');

  const { data: locData } = useQuery({
    queryKey: ['admin', 'locations'],
    queryFn:  () => api.get<{ locations: Location[] }>('/admin/locations').then((r) => r.data),
  });
  const { data: vcData } = useQuery({
    queryKey: ['admin', 'vehicle-classes'],
    queryFn:  () => api.get<{ vehicleClasses: VehicleClass[] }>('/admin/vehicle-classes').then((r) => r.data),
  });
  const { data: pmData, isLoading: pmLoading } = useQuery({
    queryKey: ['admin', 'price-matrix'],
    queryFn:  () => api.get<{ priceMatrix: PriceMatrix[] }>('/admin/price-matrix').then((r) => r.data),
  });
  const { data: surData } = useQuery({
    queryKey: ['admin', 'surcharges'],
    queryFn:  () => api.get<{ surcharges: Surcharge[] }>('/admin/surcharges').then((r) => r.data),
  });

  const upsertPM = useMutation({
    mutationFn: (data: any) => api.put('/admin/price-matrix', data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin', 'price-matrix'] }); setShowNewRow(false); },
  });
  const deletePM = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/price-matrix/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'price-matrix'] }),
  });
  const deleteSur = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/surcharges/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'surcharges'] }),
  });
  const upsertVC = useMutation({
    mutationFn: (data: any) => data.id
      ? api.patch(`/admin/vehicle-classes/${data.id}`, data)
      : api.post('/admin/vehicle-classes', data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vehicle-classes'] });
      setShowNewVC(false); setEditingVC(null);
    },
  });
  const deleteVC = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/vehicle-classes/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'vehicle-classes'] }),
  });

  const locations     = locData?.locations     ?? [];
  const vehicleClasses = vcData?.vehicleClasses ?? [];
  const priceMatrix   = pmData?.priceMatrix    ?? [];
  const surcharges    = surData?.surcharges    ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Fiyatlandırma</h1>

      {/* Sekme */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['matrix', 'Fiyat Matrisi'], ['vehicles', 'Araç Sınıfları'], ['surcharges', 'Ek Ücretler']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'matrix' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-900">Güzergah Fiyatları ({priceMatrix.length})</h2>
            <button className="btn btn-primary py-1 px-3 text-xs" onClick={() => setShowNewRow(true)}>
              + Yeni Fiyat
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                  {['Nereden', 'Nereye', 'Araç', 'Fiyat (₺)', 'Dönüş İnd.', 'Durum', ''].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {showNewRow && (
                  <PriceRow
                    row={{ fromLocationId: '', toLocationId: '', vehicleClassId: '', basePrice: 0, returnDiscount: 10 }}
                    locations={locations} vehicleClasses={vehicleClasses}
                    onSave={(data) => upsertPM.mutate(data)}
                  />
                )}
                {pmLoading
                  ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Yükleniyor…</td></tr>
                  : priceMatrix.map((row) => (
                      <PriceRow key={row.id} row={row}
                        locations={locations} vehicleClasses={vehicleClasses}
                        onSave={(data) => upsertPM.mutate(data)}
                        onDelete={() => deletePM.mutate(row.id)}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Araç Sınıfları ({vehicleClasses.length})</h2>
            <button className="btn btn-primary py-1.5 px-4 text-sm" onClick={() => setShowNewVC(true)}>
              + Yeni Araç Sınıfı
            </button>
          </div>

          {showNewVC && (
            <VehicleClassForm onSave={(d) => upsertVC.mutate(d)} onCancel={() => setShowNewVC(false)} />
          )}

          <div className="space-y-2">
            {vehicleClasses.map((vc) => (
              <div key={vc.id} className="card p-4">
                {editingVC === vc.id ? (
                  <VehicleClassForm initial={vc} onSave={(d) => upsertVC.mutate(d)} onCancel={() => setEditingVC(null)} />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">{vc.name}</span>
                        {vc.nameEn && <span className="text-sm text-gray-400">/ {vc.nameEn}</span>}
                        {vc.isShared && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Paylaşımlı
                          </span>
                        )}
                        <span className={vc.isActive ? 'badge badge-green' : 'badge badge-gray'}>
                          {vc.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        <span>👥 Max {vc.capacity} kişi</span>
                        <span>🧳 {vc.luggageCapacity} bagaj</span>
                        {vc.features.length > 0 && (
                          <span>{vc.features.map((f) => FEATURE_LABELS[f] ?? f).join(' · ')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setEditingVC(vc.id)} className="text-sm text-blue-600 hover:underline">Düzenle</button>
                      <button
                        onClick={() => { if (confirm(`"${vc.name}" silinsin mi?`)) deleteVC.mutate(vc.id); }}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'surcharges' && (
        <div className="card overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-900">Ek Ücretler</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                {['Ad', 'Çarpan', 'Saat Aralığı', 'Tarih Aralığı', ''].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {surcharges.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">×{s.multiplier}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.startHour != null ? `${s.startHour}:00 – ${s.endHour}:00` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.startDate ? `${s.startDate.slice(0, 10)} – ${s.endDate?.slice(0, 10)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteSur.mutate(s.id)} className="text-xs text-red-500 hover:underline">Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
