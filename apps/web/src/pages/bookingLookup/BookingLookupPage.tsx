import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface LookupBooking {
  id:           string;
  bookingRef:   string;
  status:       string;
  guestName:    string | null;
  guestEmail:   string | null;
  adultCount:   number;
  childCount:   number;
  transferDate: string;
  price:        number;
  currency:     string;
  fromLocation: { name: string };
  toLocation:   { name: string };
  vehicleClass: { name: string } | null;
  payment: { status: string; method: string } | null;
  flightInfo:   { status: string; delayMinutes: number | null; estimatedAt: string | null } | null;
  assignment: {
    status:       string;
    vehiclePlate: string | null;
    driver: { firstName: string; lastName: string; phone: string | null } | null;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  PENDING:   { label: 'Onay Bekleniyor',  color: 'text-yellow-700 bg-yellow-50 border-yellow-200',  icon: '⏳' },
  CONFIRMED: { label: 'Onaylandı',        color: 'text-blue-700   bg-blue-50   border-blue-200',    icon: '✅' },
  ASSIGNED:  { label: 'Şoför Atandı',     color: 'text-blue-700   bg-blue-50   border-blue-200',    icon: '🚗' },
  EN_ROUTE:  { label: 'Yolda',            color: 'text-green-700  bg-green-50  border-green-200',   icon: '🛣️' },
  COMPLETED: { label: 'Tamamlandı',       color: 'text-gray-700   bg-gray-50   border-gray-200',    icon: '🏁' },
  CANCELLED: { label: 'İptal Edildi',     color: 'text-red-700    bg-red-50    border-red-200',     icon: '❌' },
};

const METHOD_LABELS: Record<string, string> = {
  ONLINE:           'Online (Kart)',
  BANK_TRANSFER:    'Havale / EFT',
  CASH:             'Araçta Nakit',
  CASH_ON_DELIVERY: 'Araçta Nakit',
};

export function BookingLookupPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ref,     setRef]     = useState(searchParams.get('ref') ?? '');
  const [booking, setBooking] = useState<LookupBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const search = async (refValue: string) => {
    const trimmed = refValue.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setBooking(null);
    try {
      const { data } = await api.get(`/bookings/ref/${trimmed}`);
      setBooking(data.booking);
      setSearchParams({ ref: trimmed }, { replace: true });
    } catch (e: any) {
      const status = e?.response?.status;
      setError(
        status === 404
          ? 'Bu referans numarasına ait rezervasyon bulunamadı.'
          : 'Bir hata oluştu. Lütfen tekrar deneyin.',
      );
    } finally {
      setLoading(false);
    }
  };

  // URL'de ref varsa otomatik ara
  useEffect(() => {
    const urlRef = searchParams.get('ref');
    if (urlRef) search(urlRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const st = booking ? (STATUS_LABELS[booking.status] ?? { label: booking.status, color: 'text-gray-600 bg-gray-50 border-gray-200', icon: '❓' }) : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Rezervasyon Sorgula</h1>
      <p className="mt-1 text-sm text-gray-500">
        Rezervasyon referans numaranızı girerek durumunuzu öğrenin.
      </p>

      {/* Arama kutusu */}
      <div className="mt-6 flex gap-2">
        <input
          className="input flex-1 font-mono uppercase"
          placeholder="Örn: cmri39es80003qz5c9yxqlh3t"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(ref)}
        />
        <button
          className="btn btn-primary px-5 shrink-0"
          onClick={() => search(ref)}
          disabled={loading || !ref.trim()}
        >
          {loading ? '…' : 'Sorgula'}
        </button>
      </div>

      {/* Hata */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Sonuç */}
      {booking && st && (
        <div className="mt-6 space-y-4">
          {/* Durum banner */}
          <div className={`rounded-2xl border p-5 ${st.color}`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{st.icon}</span>
              <div>
                <p className="font-bold text-lg">{st.label}</p>
                <p className="text-xs opacity-75">Rezervasyon No: {booking.bookingRef}</p>
              </div>
            </div>
          </div>

          {/* Detaylar */}
          <div className="card divide-y divide-gray-100">
            <Row label="Yolcu" value={booking.guestName ?? '—'} />
            <Row label="Güzergah" value={`${booking.fromLocation.name} → ${booking.toLocation.name}`} />
            <Row
              label="Transfer Tarihi"
              value={new Date(booking.transferDate).toLocaleString('tr-TR', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            />
            <Row
              label="Kişi Sayısı"
              value={`${booking.adultCount} yetişkin${booking.childCount > 0 ? ` · ${booking.childCount} çocuk` : ''}`}
            />
            {booking.vehicleClass && <Row label="Araç" value={booking.vehicleClass.name} />}
            <Row
              label="Ödeme Yöntemi"
              value={METHOD_LABELS[booking.payment?.method ?? ''] ?? (booking.payment?.method ?? '—')}
            />
            <Row
              label="Tutar"
              value={`${Number(booking.price).toLocaleString('tr-TR')} ${booking.currency}`}
              bold
            />
          </div>

          {/* Şoför bilgisi (ASSIGNED / EN_ROUTE) */}
          {booking.assignment?.driver && (
            <div className="card p-4 bg-blue-50 border-blue-200">
              <p className="text-sm font-semibold text-blue-800 mb-2">🚗 Şoför Bilgisi</p>
              <Row label="Şoför" value={`${booking.assignment.driver.firstName} ${booking.assignment.driver.lastName}`} />
              {booking.assignment.driver.phone && (
                <Row label="Telefon" value={booking.assignment.driver.phone} link={`tel:${booking.assignment.driver.phone}`} />
              )}
              {booking.assignment.vehiclePlate && (
                <Row label="Plaka" value={booking.assignment.vehiclePlate} mono />
              )}
            </div>
          )}

          {/* Uçuş bilgisi */}
          {booking.flightInfo && booking.flightInfo.status !== 'SCHEDULED' && (
            <div className={`card p-4 ${booking.flightInfo.delayMinutes ? 'bg-amber-50 border-amber-200' : 'bg-gray-50'}`}>
              <p className="text-sm font-semibold text-gray-700 mb-2">✈️ Uçuş Durumu</p>
              <Row label="Durum" value={booking.flightInfo.status} />
              {booking.flightInfo.delayMinutes != null && booking.flightInfo.delayMinutes > 0 && (
                <Row label="Gecikme" value={`${booking.flightInfo.delayMinutes} dakika`} />
              )}
              {booking.flightInfo.estimatedAt && (
                <Row
                  label="Tahmini Varış"
                  value={new Date(booking.flightInfo.estimatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                />
              )}
            </div>
          )}

          {/* Canlı takip butonu — şoför yolda veya atanmışsa */}
          {['EN_ROUTE', 'PICKED_UP', 'ASSIGNED'].includes(booking.status) && (
            <Link
              to={`/tracking/${booking.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              🗺️ Canlı Takip — Şoförü Haritada Gör
            </Link>
          )}

          <div className="flex gap-3">
            <Link to="/" className="btn btn-primary flex-1 text-center">Yeni Rezervasyon</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label, value, bold, mono, link,
}: {
  label: string; value: string; bold?: boolean; mono?: boolean; link?: string;
}) {
  return (
    <div className="flex justify-between gap-4 py-2.5 px-1 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      {link ? (
        <a href={link} className="font-medium text-brand-600 hover:underline text-right">{value}</a>
      ) : (
        <span className={`text-right ${bold ? 'font-bold text-brand-600' : 'font-medium text-gray-900'} ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      )}
    </div>
  );
}
