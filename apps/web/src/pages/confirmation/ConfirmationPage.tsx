import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

interface Booking {
  bookingRef: string;
  status:     string;
  guestEmail: string;
  fromLocation: { name: string };
  toLocation:   { name: string };
  transferDate: string;
  price:        number;
}

export function ConfirmationPage() {
  const { t }  = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/bookings/${id}`).then(({ data }) => setBooking(data.booking));
  }, [id]);

  if (!booking) return (
    <div className="flex min-h-64 items-center justify-center text-gray-500">
      {t('common.loading')}
    </div>
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="text-6xl">✅</div>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">{t('confirmation.success')}</h1>

      <div className="mt-6 card p-6 text-left space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">{t('confirmation.bookingRef')}</span>
          <span className="font-mono font-semibold text-brand-600">{booking.bookingRef}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">{t('booking.route')}</span>
          <span className="font-medium">{booking.fromLocation.name} → {booking.toLocation.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">{t('booking.date')}</span>
          <span className="font-medium">
            {new Date(booking.transferDate).toLocaleString('tr-TR', {
              day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">{t('booking.total')}</span>
          <span className="font-bold text-brand-600">{Number(booking.price).toLocaleString('tr-TR')} ₺</span>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-500">
        📧 {t('confirmation.emailSent')}
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to="/" className="btn-primary">{t('confirmation.newBooking')}</Link>
        <Link to="/my-bookings" className="btn-outline">{t('confirmation.trackBooking')}</Link>
      </div>
    </div>
  );
}
