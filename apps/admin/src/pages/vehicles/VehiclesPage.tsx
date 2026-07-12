import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface VehicleClass { id: string; name: string }
interface Driver       { id: string; firstName: string; lastName: string }

interface Vehicle {
  id:              string;
  plate:           string;
  vehicleClass:    VehicleClass;
  defaultDriver:   Driver | null;
  isActive:        boolean;
  notes:           string | null;
  createdAt:       string;
}

interface FormState {
  plate:           string;
  vehicleClassId:  string;
  defaultDriverId: string;
  notes:           string;
  isActive:        boolean;
}

const EMPTY: FormState = { plate: '', vehicleClassId: '', defaultDriverId: '', notes: '', isActive: true };

// ─── Form Modal (kendi query'leriyle ayrı component) ─────────────────────────

function VehicleFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing:  Vehicle | null;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          plate:           editing.plate,
          vehicleClassId:  editing.vehicleClass.id,
          defaultDriverId: editing.defaultDriver?.id ?? '',
          notes:           editing.notes ?? '',
          isActive:        editing.isActive,
        }
      : EMPTY,
  );

  // Her modal açılışında taze veri — staleTime: 0
  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ['admin', 'vehicle-classes'],
    queryFn:  () =>
      api.get<{ vehicleClasses: VehicleClass[] }>('/admin/vehicle-classes').then((r) => r.data),
    staleTime: 0,
  });

  const { data: driverData } = useQuery({
    queryKey: ['admin', 'drivers'],
    queryFn:  () =>
      api
        .get<{ users: (Driver & { role: string; isActive: boolean })[] }>('/admin/users', {
          params: { role: 'DRIVER' },
        })
        .then((r) => r.data),
    staleTime: 0,
  });

  const classes = classData?.vehicleClasses ?? [];
  const drivers = (driverData?.users ?? []).filter((u) => u.role === 'DRIVER' && u.isActive);

  const createMut = useMutation({
    mutationFn: (body: FormState) => api.post('/admin/vehicles', body),
    onSuccess: onSaved,
  });

  const updateMut = useMutation({
    mutationFn: (body: Partial<FormState>) => api.patch(`/admin/vehicles/${editing!.id}`, body),
    onSuccess: onSaved,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, defaultDriverId: form.defaultDriverId || undefined };
    if (editing) {
      updateMut.mutate(body);
    } else {
      createMut.mutate(form);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;
  const mutError  = (createMut.error || updateMut.error) as Error | null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {editing ? 'Araç Düzenle' : 'Yeni Araç Ekle'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label text-gray-700">Plaka *</label>
            <input
              className="input uppercase"
              value={form.plate}
              onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))}
              placeholder="48 ABC 123"
              required
            />
          </div>

          <div>
            <label className="label text-gray-700">Araç Sınıfı *</label>
            <select
              className="input"
              value={form.vehicleClassId}
              onChange={(e) => setForm((f) => ({ ...f, vehicleClassId: e.target.value }))}
              required
            >
              {classLoading ? (
                <option value="" disabled>Yükleniyor…</option>
              ) : (
                <>
                  <option value="">Sınıf seçiniz…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label className="label text-gray-700">Varsayılan Şoför</label>
            <select
              className="input"
              value={form.defaultDriverId}
              onChange={(e) => setForm((f) => ({ ...f, defaultDriverId: e.target.value }))}
            >
              <option value="">Şoför seçilmedi</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-gray-700">Notlar</label>
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Klima arızalı, vb."
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="size-4 rounded"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Aktif (işareti kaldırarak pasife alabilirsiniz)
          </label>

          {mutError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {mutError.message}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>
              İptal
            </button>
            <button type="submit" className="btn btn-primary flex-1" disabled={isPending}>
              {isPending ? 'Kaydediliyor…' : editing ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export function VehiclesPage() {
  const qc = useQueryClient();
  const [editing,      setEditing]      = useState<Vehicle | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'passive'>('all');

  const { data: vehicleData, isLoading } = useQuery({
    queryKey: ['admin', 'vehicles'],
    queryFn:  () => api.get<{ vehicles: Vehicle[] }>('/admin/vehicles').then((r) => r.data),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/vehicles/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'vehicles'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/vehicles/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'vehicles'] }),
  });

  const vehicles = (vehicleData?.vehicles ?? []).filter((v) => {
    if (filterActive === 'active')  return v.isActive;
    if (filterActive === 'passive') return !v.isActive;
    return true;
  });

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(v: Vehicle) { setEditing(v); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['admin', 'vehicles'] });
    closeForm();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Araçlar</h1>
          <p className="mt-0.5 text-sm text-gray-500">Filoya kayıtlı araçlar ve şoför atamaları</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Yeni Araç</button>
      </div>

      {/* Filtre */}
      <div className="flex gap-2">
        {(['all', 'active', 'passive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterActive(f)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              filterActive === f
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400'
            }`}
          >
            {f === 'all' ? 'Tümü' : f === 'active' ? 'Aktif' : 'Pasif'}
          </button>
        ))}
      </div>

      {/* Tablo */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
              {['Plaka', 'Araç Sınıfı', 'Varsayılan Şoför', 'Durum', 'Notlar', 'İşlem'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))
              : vehicles.map((v) => (
                  <tr key={v.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!v.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-900">{v.plate}</td>
                    <td className="px-4 py-3 text-gray-600">{v.vehicleClass.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {v.defaultDriver
                        ? `${v.defaultDriver.firstName} ${v.defaultDriver.lastName}`
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={v.isActive ? 'badge-green' : 'badge-gray'}>
                        {v.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[180px] truncate">
                      {v.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          className="btn-outline py-1 px-3 text-xs"
                          onClick={() => openEdit(v)}
                        >
                          Düzenle
                        </button>
                        <button
                          className={`btn-outline py-1 px-3 text-xs ${v.isActive ? 'text-amber-600 hover:border-amber-400' : 'text-green-600 hover:border-green-400'}`}
                          disabled={toggleMut.isPending}
                          onClick={() => toggleMut.mutate({ id: v.id, isActive: !v.isActive })}
                        >
                          {v.isActive ? 'Pasife Al' : 'Aktife Al'}
                        </button>
                        <button
                          className="btn-outline py-1 px-3 text-xs text-red-500 hover:border-red-300"
                          onClick={() => {
                            if (confirm(`${v.plate} silinsin mi?`)) deleteMut.mutate(v.id);
                          }}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
            }
            {!isLoading && vehicles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Araç bulunamadı
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <VehicleFormModal
          editing={editing}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
