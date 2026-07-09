import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Booking {
  id:           string;
  bookingRef:   string;
  guestName:    string | null;
  guestPhone:   string | null;
  status:       string;
  transferDate: string;
  fromLocation: { name: string };
  toLocation:   { name: string };
  vehicleClass: { name: string };
  payment:      { status: string; amount: number; currency: string } | null;
  assignment:   { status: string; vehiclePlate: string; driver: { firstName: string; lastName: string } | null } | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: 'PENDING',   label: 'Bekliyor' },
  { value: 'CONFIRMED', label: 'Onaylandı' },
  { value: 'ASSIGNED',  label: 'Şoför Atandı' },
  { value: 'EN_ROUTE',  label: 'Yolda' },
  { value: 'COMPLETED', label: 'Tamamlandı' },
  { value: 'CANCELLED', label: 'İptal' },
];

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-yellow', CONFIRMED: 'badge-blue', ASSIGNED: 'badge-blue',
  EN_ROUTE: 'badge-blue',  COMPLETED: 'badge-green', CANCELLED: 'badge-red',
};

export function BookingsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [date,   setDate]   = useState('');
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'bookings', search, status, date, page],
    queryFn:  () =>
      api.get<{ bookings: Booking[]; total: number; totalPages: number }>('/admin/bookings', {
        params: { search: search || undefined, status: status || undefined,
                  date: date || undefined, page, pageSize: 20 },
      }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Rezervasyonlar</h1>

      {/* Filtreler */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Ref no, isim, uçuş…"
            className="input max-w-xs"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select
            className="input w-40"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="date"
            className="input w-44"
            value={date}
            onChange={(e) => { setDate(e.target.value); setPage(1); }}
          />
          {(search || status || date) && (
            <button
              className="btn-outline"
              onClick={() => { setSearch(''); setStatus(''); setDate(''); setPage(1); }}
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      {/* Tablo */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                {['Ref', 'Misafir', 'Güzergah', 'Araç', 'Transfer', 'Tutar', 'Durum', 'Şoför'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : (data?.bookings ?? []).map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand-600">
                        {b.bookingRef.slice(-8)}
                      </td>
                      <td className="px-4 py-3">
                        <div>{b.guestName ?? '—'}</div>
                        {b.guestPhone && <div className="text-xs text-gray-400">{b.guestPhone}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {b.fromLocation.name} → {b.toLocation.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{b.vehicleClass.name}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(b.transferDate).toLocaleString('tr-TR', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {Number(b.payment?.amount ?? 0).toLocaleString('tr-TR')} ₺
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE[b.status] ?? 'badge-gray'}>
                          {STATUS_OPTIONS.find((o) => o.value === b.status)?.label ?? b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {b.assignment?.driver
                          ? `${b.assignment.driver.firstName} ${b.assignment.driver.lastName}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Sayfalama */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Toplam {data.total} kayıt</p>
            <div className="flex gap-2">
              <button
                className="btn-outline py-1 px-3 text-xs"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Önceki
              </button>
              <span className="flex items-center text-sm text-gray-600">
                {page} / {data.totalPages}
              </span>
              <button
                className="btn-outline py-1 px-3 text-xs"
                disabled={page === data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
