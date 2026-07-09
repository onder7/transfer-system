import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { v4 as uuidv4 } from 'uuid';

interface BookingForm {
  guestName:     string;
  guestEmail:    string;
  guestPhone:    string;
  extraRequests: string;
  couponCode:    string;
  termsOk:       boolean;
  kvkkOk:        boolean;
}

// uuid v4 inline (bağımlılık eklemeden)
function genUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function BookingPage() {
  const { t }    = useTranslation();
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const { user }  = useAuthStore();

  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const [couponError, setCouponError]       = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [serverError, setServerError]       = useState('');

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<BookingForm>();

  const fromId  = params.get('fromLocationId')  ?? '';
  const toId    = params.get('toLocationId')    ?? '';
  const vcId    = params.get('vehicleClassId')  ?? '';
  const date    = params.get('transferDate')    ?? '';
  const pax     = params.get('passengerCount')  ?? '2';
  const retFlt  = params.get('returnFlight')    ?? 'false';
  const fltNo   = params.get('flightNumber')    ?? '';

  const applyCoupon = async () => {
    const code = getValues('couponCode');
    if (!code) return;
    try {
      const { data } = await api.post('/coupons/validate', { code, bookingAmount: 1600 });
      setCouponDiscount(data.discountAmount);
      setCouponError('');
    } catch (e: any) {
      setCouponError(e.response?.data?.error ?? 'Geçersiz kupon');
      setCouponDiscount(null);
    }
  };

  const onSubmit = async (form: BookingForm) => {
    setSubmitting(true);
    setServerError('');
    try {
      const { data } = await api.post('/bookings', {
        idempotencyKey:  genUuid(),
        fromLocationId:  fromId,
        toLocationId:    toId,
        vehicleClassId:  vcId,
        transferDate:    date,
        passengerCount:  Number(pax),
        returnFlight:    retFlt === 'true',
        flightNumber:    fltNo || undefined,
        guestName:       user ? `${user.firstName} ${user.lastName}` : form.guestName,
        guestEmail:      user ? user.email : form.guestEmail,
        guestPhone:      form.guestPhone,
        extraRequests:   form.extraRequests || undefined,
        couponCode:      form.couponCode    || undefined,
        currency:        'TRY',
      });

      navigate(`/payment/${data.booking.id}`);
    } catch (e: any) {
      setServerError(e.response?.data?.error ?? t('errors.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('booking.title')}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
        {/* Misafir bilgileri — sadece giriş yapmamışsa */}
        {!user && (
          <div className="card p-5 space-y-4">
            <div>
              <label className="label">{t('booking.guestName')}</label>
              <input
                className="input"
                {...register('guestName', { required: t('errors.required') })}
              />
              {errors.guestName && <p className="mt-1 text-xs text-red-500">{errors.guestName.message}</p>}
            </div>
            <div>
              <label className="label">{t('booking.guestEmail')}</label>
              <input
                type="email" className="input"
                {...register('guestEmail', { required: t('errors.required') })}
              />
              {errors.guestEmail && <p className="mt-1 text-xs text-red-500">{errors.guestEmail.message}</p>}
            </div>
            <div>
              <label className="label">{t('booking.guestPhone')}</label>
              <input
                type="tel" className="input" placeholder="+90 5XX XXX XXXX"
                {...register('guestPhone', { required: t('errors.required') })}
              />
              {errors.guestPhone && <p className="mt-1 text-xs text-red-500">{errors.guestPhone.message}</p>}
            </div>
          </div>
        )}

        {/* Özel istekler */}
        <div>
          <label className="label">{t('booking.extraRequests')}</label>
          <textarea className="input" rows={3} {...register('extraRequests')} />
        </div>

        {/* Kupon */}
        <div>
          <label className="label">{t('booking.couponCode')}</label>
          <div className="flex gap-2">
            <input className="input" {...register('couponCode')} />
            <button type="button" onClick={applyCoupon} className="btn-outline shrink-0">
              {t('booking.applyCoupon')}
            </button>
          </div>
          {couponDiscount !== null && (
            <p className="mt-1 text-sm text-green-600">
              {t('booking.couponApplied', { discount: `${couponDiscount} ₺` })}
            </p>
          )}
          {couponError && <p className="mt-1 text-xs text-red-500">{couponError}</p>}
        </div>

        {/* Onaylar */}
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 size-4" {...register('termsOk', { required: true })} />
            {t('booking.termsAgreement')}
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 size-4" {...register('kvkkOk', { required: true })} />
            {t('booking.kvkkAgreement')}
          </label>
        </div>

        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary btn-lg w-full">
          {submitting ? t('common.loading') : t('booking.proceedPayment')}
        </button>
      </form>
    </div>
  );
}
