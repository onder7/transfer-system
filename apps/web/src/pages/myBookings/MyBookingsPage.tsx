import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';

interface Booking {
  id: string; bookingRef: string; status: string;
  transferDate: string; price: number; currency: string;
  flightNumber: string | null; returnFlight: boolean;
  guestName: string | null;
  fromLocation: { name: string }; toLocation: { name: string };
  vehicleClass: { name: string };
  payment: { status: string } | null;
  assignment: { status: string; driver: { firstName: string; lastName: string } | null; vehiclePlate: string | null } | null;
  flightInfo: { status: string; delayMinutes: number | null; estimatedAt: string | null } | null;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:   'badge-yellow',
  CONFIRMED: 'badge-blue',
  ASSIGNED:  'badge-blue',
  EN_ROUTE:  'badge-blue',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-red',
};

function BookingCard({ b, onCancel }: { b: Booking; onCancel: () => void }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const canCancel = ['PENDING', 'CONFIRMED'].includes(b.status);

  return (
    <div className="card overflow-hidden">
      {/* Başlık satırı */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="font-mono text-sm font-semibold text-brand-600">{b.bookingRef.slice(-10)}</p>
            <p className="text-sm text-gray-600">
              {b.fromLocation.name} → {b.toLocation.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {['EN_ROUTE', 'PICKED_UP', 'ASSIGNED'].includes(b.status) && (
            <Link
              to={`/tracking/${b.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600"></span>
              </span>
              Canlı Takip
            </Link>
          )}
          <span className={`badge ${STATUS_COLOR[b.status] ?? 'badge-gray'}`}>
            {t(`myBookings.status.${b.status}`, { defaultValue: b.status })}
          </span>
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Detay */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-gray-500">{t('booking.date')}: </span>
              <span className="font-medium">
                {new Date(b.transferDate).toLocaleString('tr-TR', {
                  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <div>
              <span className="text-gray-500">{t('booking.vehicle')}: </span>
              <span className="font-medium">{b.vehicleClass.name}</span>
            </div>
            <div>
              <span className="text-gray-500">{t('booking.total')}: </span>
              <span className="font-bold text-brand-600">
                {Number(b.price).toLocaleString('tr-TR')} {b.currency}
              </span>
            </div>
            {b.flightNumber && (
              <div>
                <span className="text-gray-500">Uçuş: </span>
                <span className="font-medium font-mono">{b.flightNumber}</span>
              </div>
            )}
            {b.assignment?.driver && (
              <div>
                <span className="text-gray-500">Şoför: </span>
                <span className="font-medium">
                  {b.assignment.driver.firstName} {b.assignment.driver.lastName}
                  {b.assignment.vehiclePlate && ` — ${b.assignment.vehiclePlate}`}
                </span>
              </div>
            )}
            {b.flightInfo?.delayMinutes && b.flightInfo.delayMinutes > 0 && (
              <div className="col-span-2">
                <span className="badge badge-yellow">
                  ⚠ Uçuş {b.flightInfo.delayMinutes} dk gecikmeli
                  {b.flightInfo.estimatedAt && ` — Tahmini: ${new Date(b.flightInfo.estimatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              </div>
            )}
          </div>

          {['EN_ROUTE', 'PICKED_UP', 'ASSIGNED'].includes(b.status) && (
            <div className="pt-2">
              <Link
                to={`/tracking/${b.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                🗺️ Şoförü Haritada Takip Et (Canlı Konum)
              </Link>
            </div>
          )}

          {canCancel && (
            <div className="pt-2">
              <button
                onClick={onCancel}
                className="btn btn-outline border-red-200 text-red-600 hover:bg-red-50 text-sm"
              >
                Rezervasyonu İptal Et
              </button>
              <p className="mt-1 text-xs text-gray-400">
                İptal politikası: 48s+ öncesi %100, 24-48s arası %50, 24s'den az iade yapılmaz.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MyBookingsPage() {
  const { t }    = useTranslation();
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const qc        = useQueryClient();

  if (!user) {
    navigate('/login', { state: { from: '/my-bookings' } });
    return null;
  }

  const { data, isLoading } = useQuery({
    queryKey:                    ['my-bookings'],
    queryFn:                     () => api.get<{ bookings: Booking[] }>('/bookings/my').then((r) => r.data),
    refetchInterval:             30_000,
    refetchIntervalInBackground: true,
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.post(`/bookings/${id}/cancel`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['my-bookings'] }),
  });

  const bookings = data?.bookings ?? [];

  if (isLoading) return (
    <div className="flex min-h-64 items-center justify-center text-gray-400">
      {t('common.loading')}
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('myBookings.title')}</h1>

      {bookings.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-4xl">🧳</p>
          <p className="mt-3 text-gray-500">{t('myBookings.empty')}</p>
          <button onClick={() => navigate('/')} className="btn btn-primary mt-6">
            {t('confirmation.newBooking')}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {bookings.map((b) => (
            <BookingCard key={b.id} b={b} onCancel={() => cancelMut.mutate(b.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
