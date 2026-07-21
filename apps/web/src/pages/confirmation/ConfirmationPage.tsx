import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

interface Booking {
  bookingRef:   string;
  status:       string;
  guestEmail:   string | null;
  guestName:    string | null;
  adultCount:   number;
  childCount:   number;
  fromLocation: { name: string };
  toLocation:   { name: string };
  transferDate: string;
  price:        number;
  currency:     string;
  payment: {
    status: string;
    method: string;
  } | null;
}

function StatusBanner({ booking }: { booking: Booking }) {
  const method = booking.payment?.method ?? 'ONLINE';
  const payStatus = booking.payment?.status ?? 'PENDING';
  const bStatus = booking.status;

  // İptal
  if (bStatus === 'CANCELLED') {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-center">
        <div className="text-5xl">❌</div>
        <h2 className="mt-3 text-xl font-bold text-red-700">Rezervasyon İptal Edildi</h2>
        <p className="mt-2 text-sm text-red-600">Bu rezervasyon iptal edilmiştir.</p>
      </div>
    );
  }

  // Araçta ödeme (nakit)
  if (method === 'CASH' || method === 'CASH_ON_DELIVERY') {
    return (
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center">
        <div className="text-5xl">🕐</div>
        <h2 className="mt-3 text-xl font-bold text-amber-800">Rezervasyonunuz Alındı</h2>
        <p className="mt-2 text-sm text-amber-700">
          Araçta ödeme talebiniz operatörümüze iletildi. En kısa sürede onaylanacak ve e-posta ile bilgilendirileceksiniz.
        </p>
        <div className="mt-3 rounded-xl bg-amber-100 px-4 py-3 text-xs text-amber-800 text-left">
          💵 Ödeme transfer sırasında şoföre nakit yapılacaktır.
        </div>
      </div>
    );
  }

  // Havale / EFT
  if (method === 'BANK_TRANSFER') {
    return (
      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-6 text-center">
        <div className="text-5xl">🏦</div>
        <h2 className="mt-3 text-xl font-bold text-blue-800">Havale Bilgileri Gönderildi</h2>
        <p className="mt-2 text-sm text-blue-700">
          Banka hesap bilgileri e-posta adresinize gönderildi. Transferin ardından operatörümüz ödemenizi onaylayacak ve rezervasyonunuz kesinleşecektir.
        </p>
        <div className="mt-3 rounded-xl bg-blue-100 px-4 py-3 text-xs text-blue-800 text-left">
          ℹ️ Transfer açıklamasına rezervasyon referansını (<strong>{booking.bookingRef}</strong>) yazmayı unutmayın.
        </div>
      </div>
    );
  }

  // Online ödeme — onaylandı
  if (payStatus === 'PAID' || bStatus === 'CONFIRMED' || bStatus === 'ASSIGNED' || bStatus === 'EN_ROUTE' || bStatus === 'COMPLETED') {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
        <div className="text-5xl">✅</div>
        <h2 className="mt-3 text-xl font-bold text-green-800">Rezervasyonunuz Onaylandı!</h2>
        <p className="mt-2 text-sm text-green-700">
          Ödemeniz alındı, rezervasyonunuz kesinleşti. Onay bilgileri e-posta adresinize gönderildi.
        </p>
      </div>
    );
  }

  // Online ödeme — hâlâ bekleniyor (callback gelmemiş olabilir)
  return (
    <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-6 text-center">
      <div className="text-5xl">⏳</div>
      <h2 className="mt-3 text-xl font-bold text-yellow-800">Ödeme İşleniyor…</h2>
      <p className="mt-2 text-sm text-yellow-700">
        Ödemeniz işleme alındı. Onaylandığında e-posta ile bilgilendirileceksiniz. Bu işlem birkaç dakika sürebilir.
      </p>
    </div>
  );
}

export function ConfirmationPage() {
  const { t }  = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/bookings/${id}`)
      .then(({ data }) => setBooking(data.booking))
      .catch((e) => setError(e.response?.data?.error ?? 'Rezervasyon detayı yüklenemedi.'));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-5xl">⚠️</p>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Detay görüntülenemedi</h2>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
        <Link to="/booking-lookup" className="btn-primary mt-6 inline-block">
          Rezervasyon Sorgula
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-64 items-center justify-center text-gray-500">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <StatusBanner booking={booking} />

      <div className="mt-6 card p-6 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Rezervasyon No</span>
          <span className="font-mono font-semibold text-brand-600">{booking.bookingRef}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Güzergah</span>
          <span className="font-medium text-right">{booking.fromLocation.name} → {booking.toLocation.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Tarih</span>
          <span className="font-medium">
            {new Date(booking.transferDate).toLocaleString('tr-TR', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Yolcu</span>
          <span className="font-medium">
            {booking.adultCount} yetişkin{booking.childCount > 0 ? ` · ${booking.childCount} çocuk` : ''}
          </span>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-3">
          <span className="text-sm text-gray-500">Tutar</span>
          <span className="font-bold text-brand-600">
            {Number(booking.price).toLocaleString('tr-TR')} {booking.currency}
          </span>
        </div>
      </div>

      {booking.guestEmail && (
        <p className="mt-3 text-center text-xs text-gray-400">
          📧 Bilgilendirme e-postası <strong>{booking.guestEmail}</strong> adresine gönderildi.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to="/" className="btn-primary text-center">Yeni Rezervasyon</Link>
        <Link to={`/booking-lookup?ref=${booking.bookingRef}`} className="btn-outline text-center">
          Rezervasyonu Takip Et
        </Link>
      </div>
    </div>
  );
}
