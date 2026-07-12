import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Driver {
  id: string; email: string; firstName: string; lastName: string;
  phone: string | null; role: string; isActive: boolean; createdAt: string;
}

interface Booking {
  id: string; bookingRef: string; guestName: string | null;
  transferDate: string; status: string;
  fromLocation: { name: string }; toLocation: { name: string };
}

interface VehicleClass { id: string; name: string; }

function CreateDriverModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => api.post('/admin/users', { ...form, role: 'DRIVER' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'drivers'] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Hata'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Yeni Şoför Ekle</h2>
        <div className="space-y-3">
          {[
            { key: 'firstName', label: 'Ad' },
            { key: 'lastName',  label: 'Soyad' },
            { key: 'email',     label: 'E-posta', type: 'email' },
            { key: 'phone',     label: 'Telefon', type: 'tel' },
            { key: 'password',  label: 'Şifre',   type: 'password' },
          ].map(({ key, label, type = 'text' }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                type={type} className="input"
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
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

function EditDriverModal({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: driver.firstName,
    lastName:  driver.lastName,
    email:     driver.email,
    phone:     driver.phone ?? '',
  });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => api.patch(`/admin/users/${driver.id}/profile`, {
      firstName: form.firstName,
      lastName:  form.lastName,
      email:     form.email,
      phone:     form.phone || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'drivers'] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Kayıt hatası'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Şoför Düzenle</h2>
        <div className="space-y-3">
          {[
            { key: 'firstName', label: 'Ad' },
            { key: 'lastName',  label: 'Soyad' },
            { key: 'email',     label: 'E-posta', type: 'email' },
            { key: 'phone',     label: 'Telefon', type: 'tel' },
          ].map(({ key, label, type = 'text' }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                type={type} className="input"
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
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

function AssignDriverModal({ booking, drivers, vehicleClasses, onClose }: {
  booking: Booking; drivers: Driver[]; vehicleClasses: VehicleClass[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [driverId, setDriverId] = useState('');
  const [vcId, setVcId]         = useState('');
  const [plate, setPlate]       = useState('');
  const [error, setError]       = useState('');

  const mut = useMutation({
    mutationFn: () => api.post(`/driver/assign/${booking.id}`, {
      driverId, vehicleClassId: vcId, vehiclePlate: plate || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'confirmed-bookings'] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Hata'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Şoför Ata</h2>
        <p className="text-sm text-gray-500 mb-4">
          {booking.bookingRef.slice(-8)} — {booking.fromLocation.name} → {booking.toLocation.name}
        </p>
        <div className="space-y-3">
          <div>
            <label className="label">Şoför</label>
            <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)} required>
              <option value="">Seçiniz…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Araç Sınıfı</label>
            <select className="input" value={vcId} onChange={(e) => setVcId(e.target.value)} required>
              <option value="">Seçiniz…</option>
              {vehicleClasses.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Plaka (opsiyonel)</label>
            <input className="input" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="48 ABC 123" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending || !driverId || !vcId}>
            {mut.isPending ? 'Atanıyor…' : 'Ata'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DriversPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate]       = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [assignBooking, setAssignBooking] = useState<Booking | null>(null);

  const { data: driversData } = useQuery({
    queryKey: ['admin', 'drivers'],
    queryFn: () => api.get<{ users: Driver[] }>('/admin/users?role=DRIVER').then((r) => r.data),
  });

  const { data: bookingsData } = useQuery({
    queryKey: ['admin', 'confirmed-bookings'],
    queryFn: () => api.get<{ bookings: Booking[] }>('/admin/bookings?status=CONFIRMED&pageSize=50').then((r) => r.data),
  });

  const { data: vcData } = useQuery({
    queryKey: ['admin', 'vehicle-classes'],
    queryFn: () => api.get<{ vehicleClasses: VehicleClass[] }>('/admin/vehicle-classes').then((r) => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/users/${id}/active`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'drivers'] }),
  });

  const drivers = driversData?.users ?? [];
  const bookings = bookingsData?.bookings ?? [];
  const vehicleClasses = vcData?.vehicleClasses ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Şoförler</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Yeni Şoför</button>
      </div>

      {/* Şoför listesi */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="font-semibold text-gray-900">Şoför Listesi ({drivers.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
              {['Ad Soyad', 'E-posta', 'Telefon', 'Durum', 'İşlem'].map((h, i) => (
                <th key={i} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Henüz şoför yok</td></tr>
            ) : drivers.map((d) => (
              <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{d.firstName} {d.lastName}</td>
                <td className="px-4 py-3 text-gray-600">{d.email}</td>
                <td className="px-4 py-3 text-gray-600">{d.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={d.isActive ? 'badge badge-green' : 'badge badge-gray'}>
                    {d.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingDriver(d)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => toggleActive.mutate({ id: d.id, isActive: !d.isActive })}
                      className={`text-xs hover:underline ${d.isActive ? 'text-red-500' : 'text-green-600'}`}
                    >
                      {d.isActive ? 'Deaktive et' : 'Aktive et'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Şoför ataması bekleyen rezervasyonlar */}
      {bookings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-900">Şoför Ataması Bekleyen ({bookings.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                {['Ref', 'Misafir', 'Güzergah', 'Transfer Tarihi', 'İşlem'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-brand-600">{b.bookingRef.slice(-8)}</td>
                  <td className="px-4 py-3">{b.guestName ?? '—'}</td>
                  <td className="px-4 py-3">{b.fromLocation.name} → {b.toLocation.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(b.transferDate).toLocaleString('tr-TR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="btn btn-primary py-1 px-3 text-xs"
                      onClick={() => setAssignBooking(b)}
                    >
                      Şoför Ata
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate    && <CreateDriverModal onClose={() => setShowCreate(false)} />}
      {editingDriver && <EditDriverModal driver={editingDriver} onClose={() => setEditingDriver(null)} />}
      {assignBooking && (
        <AssignDriverModal
          booking={assignBooking}
          drivers={drivers.filter((d) => d.isActive)}
          vehicleClasses={vehicleClasses}
          onClose={() => setAssignBooking(null)}
        />
      )}
    </div>
  );
}
