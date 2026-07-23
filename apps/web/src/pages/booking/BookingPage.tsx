import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Users, Luggage, CheckCircle, Minus, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import RouteMap from '@/design/components/RouteMap';

interface VehicleClass {
  id: string; name: string; nameEn: string | null;
  capacity: number; luggageCapacity: number; isShared: boolean;
  features: string[]; imageUrl: string | null;
}
interface TransferResult {
  vehicleClass: VehicleClass;
  price: number;
  returnPrice: number | null;
}
interface Location {
  id: string; name: string; nameEn: string | null;
  type: string; lat?: number | null; lng?: number | null;
}
interface ExtraService {
  id: string; key: string | null; name: string; nameEn: string | null;
  description: string | null; price: number;
  priceType: 'FLAT' | 'PER_PERSON' | 'PER_UNIT';
  requiresNote: boolean; maxQuantity: number;
}

type PayMethod = 'online' | 'bank' | 'cash';

const PAY_METHOD_INFO: Record<PayMethod, { icon: string; title: string; desc: string }> = {
  online: { icon: '💳', title: 'Kredi / Banka Kartı', desc: 'PayTR güvenceli online ödeme' },
  bank:   { icon: '🏦', title: 'Havale / EFT',        desc: 'Banka hesabına transfer yapın' },
  cash:   { icon: '💵', title: 'Araçta Ödeme',        desc: 'Transfer sırasında şoföre ödeyin' },
};

interface BookingForm {
  guestName:     string;
  guestEmail:    string;
  guestPhone:    string;
  flightDate:    string;
  flightNumber:  string;
  flightTime:    string;
  extraRequests: string;
  termsOk:       boolean;
}

// Telefon ülke kodları (bayrak + isim + arama kodu)
const COUNTRIES = [
  { code: 'TR', flag: '🇹🇷', name: 'Türkiye',        dial: '+90' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany',        dial: '+49' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom', dial: '+44' },
  { code: 'RU', flag: '🇷🇺', name: 'Russia',         dial: '+7'  },
  { code: 'US', flag: '🇺🇸', name: 'United States',  dial: '+1'  },
  { code: 'NL', flag: '🇳🇱', name: 'Netherlands',    dial: '+31' },
  { code: 'FR', flag: '🇫🇷', name: 'France',         dial: '+33' },
  { code: 'AF', flag: '🇦🇫', name: 'Afghanistan',    dial: '+93' },
];

// uuid v4 inline (bağımlılık eklemeden)
function genUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function BookingPage() {
  const { t, i18n } = useTranslation();
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const { user }  = useAuthStore();
  const isEn      = i18n.language === 'en';

  const fromId   = params.get('fromLocationId')  ?? '';
  const toId     = params.get('toLocationId')    ?? '';
  const vcId     = params.get('vehicleClassId')  ?? '';
  const dateParam = params.get('transferDate')   ?? '';
  const retFlt   = params.get('returnFlight') === 'true';
  const fltNo    = params.get('flightNumber')    ?? '';

  // Tarih + saat param'dan ayrıştır — YEREL saatle (ana sayfada seçilen saat),
  // toISOString() UTC'ye çevirdiği için slice ile okumak saati kaydırırdı.
  const dateObj = dateParam ? new Date(dateParam) : null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const valid = dateObj && !isNaN(+dateObj);
  const initDate = valid ? `${dateObj!.getFullYear()}-${pad(dateObj!.getMonth() + 1)}-${pad(dateObj!.getDate())}` : '';
  const initTime = valid ? `${pad(dateObj!.getHours())}:${pad(dateObj!.getMinutes())}` : '';

  // Dönüş tarihi/saati — ana sayfadan aktarılır, formda düzenlenebilir
  const retParam = params.get('returnDate') ?? '';
  const retObj   = retParam ? new Date(retParam) : null;
  const retValid = retObj && !isNaN(+retObj);
  const [returnDate, setReturnDate] = useState(
    retValid ? `${retObj!.getFullYear()}-${pad(retObj!.getMonth() + 1)}-${pad(retObj!.getDate())}` : '',
  );
  const [returnTime, setReturnTime] = useState(
    retValid ? `${pad(retObj!.getHours())}:${pad(retObj!.getMinutes())}` : '',
  );

  const [adults, setAdults]     = useState(Number(params.get('adultCount') ?? '1'));
  const [children, setChildren] = useState(Number(params.get('childCount') ?? '0'));
  const [returnWanted, setReturnWanted] = useState(retFlt);
  const [dialCode, setDialCode] = useState('+90');
  const [submitting, setSubmitting]     = useState(false);
  const [serverError, setServerError]   = useState('');

  // Ekstra seçimleri: { [extraId]: { quantity, note } }
  const [extrasState, setExtrasState] = useState<Record<string, { quantity: number; note: string }>>({});

  const { register, handleSubmit, formState: { errors } } = useForm<BookingForm>({
    defaultValues: {
      guestName:  user ? `${user.firstName} ${user.lastName}` : '',
      guestEmail: user ? user.email : '',
      flightDate: initDate,
      flightTime: initTime,
      flightNumber: fltNo,
    },
  });

  // Lokasyonlar (isim + koordinat, harita için)
  const { data: locData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<{ locations: Location[] }>('/locations').then((r) => r.data),
    staleTime: 60_000,
  });
  const locations = locData?.locations ?? [];
  const fromLoc = locations.find((l) => l.id === fromId);
  const toLoc   = locations.find((l) => l.id === toId);
  const locName = (l?: Location) => (l ? (isEn && l.nameEn ? l.nameEn : l.name) : '');
  const fromName = locName(fromLoc);
  const toName   = locName(toLoc);

  // Uçuş bilgileri havalimanı tarafında, adres alanı havalimanı-olmayan tarafta gösterilir.
  const fromIsAirport  = fromLoc?.type === 'airport';
  const nonAirportName = fromIsAirport ? toName : fromName;

  // "Otel adı / tam adres" — havalimanı olmayan konumun adıyla ön-doldurulur (kullanıcı düzenleyebilir)
  const [address, setAddress]       = useState('');
  const [addrTouched, setAddrTouched] = useState(false);
  useEffect(() => {
    if (!addrTouched && nonAirportName) setAddress(nonAirportName);
  }, [nonAirportName, addrTouched]);

  // Ekstra hizmetler (admin panelinden yönetilir)
  const { data: extraData } = useQuery({
    queryKey: ['extras'],
    queryFn: () => api.get<{ extras: ExtraService[] }>('/extras').then((r) => r.data),
    staleTime: 60_000,
  });
  const extras = extraData?.extras ?? [];

  // Aktif ödeme yöntemleri — admin panelinden yönetilir, yalnızca aktif olanlar gösterilir
  const { data: methodData } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.get<{ methods: { online: boolean; bank: boolean; cash: boolean } }>('/payments/methods').then((r) => r.data),
    staleTime: 60_000,
  });
  const availableMethods = useMemo(() => {
    const m = methodData?.methods;
    if (!m) return [] as PayMethod[];
    return (['online', 'bank', 'cash'] as PayMethod[]).filter((k) => m[k]);
  }, [methodData]);

  const [payMethod, setPayMethod] = useState<PayMethod | ''>('');
  // Tek yöntem varsa otomatik seç
  useEffect(() => {
    if (!payMethod && availableMethods.length === 1) setPayMethod(availableMethods[0]);
  }, [availableMethods, payMethod]);

  // Seçilen aracın güncel fiyatı — yolcu sayısı değişince yeniden sorgulanır
  const { data: searchData } = useQuery({
    queryKey: ['transfers', fromId, toId, dateParam, adults, children, returnWanted],
    queryFn: () =>
      api.get<{ results: TransferResult[] }>('/transfers/search', {
        params: {
          fromLocationId: fromId, toLocationId: toId, transferDate: dateParam,
          adultCount: adults, childCount: children, returnFlight: returnWanted,
        },
      }).then((r) => r.data),
    enabled: !!(fromId && toId && dateParam),
    staleTime: 30_000,
  });
  const result = searchData?.results.find((r) => r.vehicleClass.id === vcId) ?? searchData?.results[0];
  const vc = result?.vehicleClass;

  const totalPassengers = adults + children;

  // Bir ekstranın satır tutarı
  const extraLineTotal = (ex: ExtraService, sel?: { quantity: number }) => {
    const qty = sel?.quantity ?? 0;
    if (qty <= 0) return 0;
    if (ex.priceType === 'FLAT')       return ex.price;
    if (ex.priceType === 'PER_PERSON') return ex.price * totalPassengers;
    return ex.price * qty; // PER_UNIT
  };

  const extrasTotal = useMemo(
    () => extras.reduce((sum, ex) => sum + extraLineTotal(ex, extrasState[ex.id]), 0),
    [extras, extrasState, totalPassengers],
  );

  const transferPrice = useMemo(() => {
    if (!result) return null;
    let p = result.price;
    if (returnWanted) p += result.returnPrice ?? result.price;
    return p;
  }, [result, returnWanted]);

  const grandTotal = transferPrice != null ? transferPrice + extrasTotal : null;

  const canAddPax = totalPassengers < (vc?.capacity ?? 99);

  const setExtraQty = (id: string, quantity: number) =>
    setExtrasState((s) => ({ ...s, [id]: { quantity, note: s[id]?.note ?? '' } }));
  const setExtraNote = (id: string, note: string) =>
    setExtrasState((s) => ({ ...s, [id]: { quantity: s[id]?.quantity ?? 1, note } }));

  const onSubmit = async (form: BookingForm) => {
    setSubmitting(true);
    setServerError('');

    // Tarih + saat → ISO
    const iso = form.flightDate
      ? new Date(`${form.flightDate}T${form.flightTime || '00:00'}:00`).toISOString()
      : dateParam;

    // Seçilen ekstralar → payload
    const extrasPayload = extras
      .filter((ex) => (extrasState[ex.id]?.quantity ?? 0) > 0)
      .map((ex) => ({
        extraServiceId: ex.id,
        quantity: extrasState[ex.id].quantity,
        note: extrasState[ex.id]?.note?.trim() || undefined,
      }));

    try {
      const { data } = await api.post('/bookings', {
        idempotencyKey:  genUuid(),
        fromLocationId:  fromId,
        toLocationId:    toId,
        vehicleClassId:  vcId,
        transferDate:    iso,
        adultCount:      adults,
        childCount:      children,
        returnFlight:    returnWanted,
        // Dönüş bacağı ayrı bir rezervasyon olarak oluşturulur → tarih zorunlu
        returnDate:      returnWanted && returnDate
          ? new Date(`${returnDate}T${returnTime || '00:00'}:00`).toISOString()
          : undefined,
        flightNumber:    form.flightNumber || undefined,
        // Adres, havalimanı olmayan tarafa yazılır (alış otel ise customFrom, varış otel ise customTo)
        customFromAddress: !fromIsAirport && address ? address : undefined,
        customToAddress:   fromIsAirport && address ? address : undefined,
        extraRequests:   form.extraRequests || undefined,
        extras:          extrasPayload.length ? extrasPayload : undefined,
        guestName:       user ? `${user.firstName} ${user.lastName}` : form.guestName,
        guestEmail:      user ? user.email : form.guestEmail,
        guestPhone:      form.guestPhone ? `${dialCode} ${form.guestPhone}`.trim() : undefined,
        currency:        'TRY',
      });

      const bookingId = data.booking.id;

      // Seçilen ödeme yöntemini uygula
      if (payMethod === 'cash') {
        await api.post(`/payments/cash/${bookingId}`);
        navigate(`/confirmation/${bookingId}`);
      } else if (payMethod === 'bank') {
        await api.post(`/payments/bank-transfer/${bookingId}`);
        navigate(`/confirmation/${bookingId}`);
      } else {
        // Online ödeme → PayTR iframe sayfası
        navigate(`/payment/${bookingId}`);
      }
    } catch (e: any) {
      setServerError(e.response?.data?.error ?? t('errors.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Rezervasyonunuzu tamamlayın</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]"
      >
        {/* ══════════ SOL KOLON ══════════ */}
        <div className="space-y-6">
          {/* Kişisel Bilgiler */}
          <section className="card p-6">
            <h2 className="mb-5 border-b border-gray-100 pb-3 text-lg font-bold text-gray-900">
              Kişisel Bilgiler
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Adı Soyadı</label>
                <input className="input" disabled={!!user}
                  {...register('guestName', { required: !user && 'Zorunlu alan' })} />
                {errors.guestName && <p className="mt-1 text-xs text-red-500">{errors.guestName.message}</p>}
              </div>
              <div>
                <label className="label">E-Posta</label>
                <input type="email" className="input" disabled={!!user}
                  {...register('guestEmail', { required: !user && 'Zorunlu alan' })} />
                {errors.guestEmail && <p className="mt-1 text-xs text-red-500">{errors.guestEmail.message}</p>}
              </div>
              <div>
                <label className="label">Telefon No</label>
                <div className="flex">
                  <select
                    value={dialCode}
                    onChange={(e) => setDialCode(e.target.value)}
                    className="input w-auto rounded-r-none border-r-0 pr-1"
                    aria-label="Ülke kodu"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.dial}>
                        {c.flag} {c.dial}
                      </option>
                    ))}
                  </select>
                  <input type="tel" placeholder="501 234 56 78"
                    className="input rounded-l-none"
                    {...register('guestPhone', { required: 'Zorunlu alan' })} />
                </div>
                {errors.guestPhone && <p className="mt-1 text-xs text-red-500">{errors.guestPhone.message}</p>}
              </div>
            </div>
          </section>

          {/* Transfer Bilgileri */}
          <section className="card p-6">
            <h2 className="mb-5 border-b border-gray-100 pb-3 text-lg font-bold text-gray-900">
              Transfer Bilgileri
            </h2>

            {(() => {
              const flightFields = (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="label">Uçak İniş Tarihi</label>
                    <input type="date" className="input" {...register('flightDate')} />
                  </div>
                  <div>
                    <label className="label">Uçak Numarası</label>
                    <input className="input" placeholder="TK 2412" {...register('flightNumber')} />
                  </div>
                  <div>
                    <label className="label">Uçak İniş Saati</label>
                    <input type="time" className="input" {...register('flightTime')} />
                  </div>
                </div>
              );
              const addressField = (
                <div>
                  <label className="label">Otel adı / tam adres</label>
                  <input className="input" placeholder="Otel adı / tam adres"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setAddrTouched(true); }} />
                </div>
              );
              return (
                <>
                  <p className="mb-3 text-sm font-medium text-gray-900">
                    {fromName || '—'} <span className="font-normal text-emerald-600">konumunda alınış</span>
                  </p>
                  {fromIsAirport ? flightFields : addressField}

                  <p className="mb-3 mt-6 text-sm font-medium text-gray-900">
                    {toName || '—'} <span className="font-normal text-emerald-600">konumuna gidiş</span>
                  </p>
                  {fromIsAirport ? addressField : flightFields}
                </>
              );
            })()}

            <div className="mt-5">
              <label className="label">Özel Not / Talepler</label>
              <textarea className="input" rows={3} {...register('extraRequests')} />
            </div>

            {/* Ekstralar */}
            <h3 className="mb-4 mt-6 border-b border-gray-100 pb-3 text-base font-bold text-gray-900">
              Ekstralar
            </h3>
            {extras.length === 0 ? (
              <p className="text-sm text-gray-400">Ekstra hizmet bulunmuyor.</p>
            ) : (
              <div className="space-y-4">
                {extras.map((ex) => {
                  const sel = extrasState[ex.id];
                  const active = (sel?.quantity ?? 0) > 0;
                  const name = isEn && ex.nameEn ? ex.nameEn : ex.name;
                  const unitLabel =
                    ex.priceType === 'PER_UNIT'   ? '/ adet'
                    : ex.priceType === 'PER_PERSON' ? '/ kişi'
                    : '';
                  return (
                    <div key={ex.id} className="rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{name}</p>
                          {ex.description && <p className="mt-0.5 text-xs text-gray-500">{ex.description}</p>}
                          <p className="mt-1 text-xs font-medium text-emerald-600">
                            {ex.price.toLocaleString('tr-TR')} ₺ {unitLabel}
                          </p>
                        </div>

                        {ex.priceType === 'PER_UNIT' ? (
                          <select
                            className="input w-24 shrink-0"
                            value={sel?.quantity ?? 0}
                            onChange={(e) => setExtraQty(ex.id, Number(e.target.value))}
                          >
                            {Array.from({ length: ex.maxQuantity + 1 }, (_, i) => (
                              <option key={i} value={i}>{i === 0 ? 'Yok' : i}</option>
                            ))}
                          </select>
                        ) : (
                          <label className="inline-flex shrink-0 cursor-pointer items-center">
                            <input
                              type="checkbox"
                              className="size-5 accent-emerald-600"
                              checked={active}
                              onChange={(e) => setExtraQty(ex.id, e.target.checked ? 1 : 0)}
                            />
                          </label>
                        )}
                      </div>

                      {ex.requiresNote && active && (
                        <input
                          className="input mt-3"
                          placeholder="Karşılama panosuna yazılacak isim"
                          value={sel?.note ?? ''}
                          onChange={(e) => setExtraNote(ex.id, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Dönüş transferi */}
          <section className="card px-6 py-4">
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <input type="checkbox" className="size-4 accent-emerald-600"
                checked={returnWanted}
                onChange={(e) => setReturnWanted(e.target.checked)} />
              Dönüş transferi istiyorum.
            </label>

            {returnWanted && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-3 text-sm font-medium text-gray-900">
                  {toName || '—'} <span className="font-normal text-emerald-600">konumundan dönüş</span>
                  <span className="ml-1 font-normal text-gray-400">→ {fromName || '—'}</span>
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Dönüş Tarihi *</label>
                    <input type="date" className="input" value={returnDate}
                      min={initDate || undefined}
                      onChange={(e) => setReturnDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Dönüş Saati *</label>
                    <input type="time" className="input" value={returnTime}
                      onChange={(e) => setReturnTime(e.target.value)} />
                  </div>
                </div>
                {!returnDate && (
                  <p className="mt-2 text-xs text-amber-600">
                    Dönüş için ayrı bir transfer planlanır — tarih ve saat zorunludur.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Toplam Fiyat + onay + tamamla */}
          <section className="card p-6">
            {extrasTotal > 0 && transferPrice != null && (
              <div className="mb-3 space-y-1 border-b border-gray-100 pb-3 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Transfer ücreti</span>
                  <span>{transferPrice.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Ekstralar</span>
                  <span>{extrasTotal.toLocaleString('tr-TR')} ₺</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-900">Toplam Fiyat</h2>
              <span className="text-2xl font-extrabold text-gray-900">
                {grandTotal != null ? `${grandTotal.toLocaleString('tr-TR')} ₺` : '—'}
              </span>
            </div>

            {/* ── Ödeme Yöntemi (yalnızca admin'de aktif olanlar) ── */}
            <div className="mt-5">
              <h3 className="mb-3 text-base font-bold text-gray-900">Ödeme Yöntemi</h3>
              {availableMethods.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Şu anda aktif bir ödeme yöntemi bulunmuyor. Lütfen bizimle iletişime geçin.
                </p>
              ) : (
                <div className="space-y-2">
                  {availableMethods.map((m) => {
                    const info = PAY_METHOD_INFO[m];
                    const active = payMethod === m;
                    return (
                      <label key={m}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
                          active ? 'border-emerald-500 bg-emerald-50/60' : 'border-gray-200 hover:border-emerald-300'
                        }`}>
                        <input type="radio" name="payMethod" className="size-4 accent-emerald-600"
                          checked={active} onChange={() => setPayMethod(m)} />
                        <span className="text-2xl">{info.icon}</span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-gray-900">{info.title}</span>
                          <span className="block text-xs text-gray-500">{info.desc}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="mt-4 flex items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" className="mt-0.5 size-4 accent-emerald-600"
                {...register('termsOk', { required: true })} />
              <span>
                <a href="#" className="text-emerald-600 hover:underline">Üyelik Şartları ve Koşulları</a>,{' '}
                <a href="#" className="text-emerald-600 hover:underline">Mesafeli Satış Sözleşmesi</a>,{' '}
                <a href="#" className="text-emerald-600 hover:underline">Gizlilik ve Güvenlik Sözleşmesi</a>,{' '}
                <a href="#" className="text-emerald-600 hover:underline">Yolcu Taşıma ve Hizmet Sözleşmesi</a>'ni
                Tıklayarak, kabul etmiş olursunuz.
              </span>
            </label>
            {errors.termsOk && <p className="mt-1 text-xs text-red-500">Sözleşmeleri onaylamanız gerekir.</p>}

            <p className="mt-4 text-sm font-semibold text-gray-800">
              Tek yön Transferin Bedelinin Tamamını, Gidiş-Dönüş Transfer Bedelinin
              Yarısını Araç Şoförüne Nakit Ödeyelim.
            </p>

            {serverError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <button type="submit" disabled={submitting || !payMethod || (returnWanted && !returnDate)}
              title={
                !payMethod ? 'Önce ödeme yöntemi seçin'
                : returnWanted && !returnDate ? 'Dönüş tarihi ve saatini seçin'
                : undefined
              }
              className="mt-5 w-full rounded-xl bg-[#8a7355] py-4 text-base font-bold text-white
                         transition-colors hover:bg-[#75603f] disabled:opacity-60">
              {submitting ? t('common.loading') : 'Rezervasyonu Tamamla'}
            </button>
          </section>
        </div>

        {/* ══════════ SAĞ KOLON (özet) ══════════ */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {/* Araç kartı */}
          <div className="card overflow-hidden">
            {vc?.imageUrl && (
              <img src={vc.imageUrl} alt={vc.name}
                className="h-40 w-full object-cover" />
            )}
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-900">
                {vc ? (isEn && vc.nameEn ? vc.nameEn : vc.name) : 'Araç'}
                {vc && <span className="text-gray-400"> · 1 / {vc.capacity} Pax</span>}
              </h3>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="flex items-center gap-1.5 font-semibold text-gray-800">
                    <Users size={15} className="text-emerald-500" /> Yolcu Kapasitesi
                  </p>
                  <p className="mt-0.5 text-gray-500">Min : 1 - Max : {vc?.capacity ?? '—'}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 font-semibold text-gray-800">
                    <Luggage size={15} className="text-emerald-500" /> Bagaj Kapasitesi
                  </p>
                  <p className="mt-0.5 text-gray-500">{vc?.luggageCapacity ?? '—'} Bagaj</p>
                </div>
                {vc?.features?.length ? (
                  <div>
                    <p className="flex items-center gap-1.5 font-semibold text-gray-800">
                      <CheckCircle size={15} className="text-emerald-500" /> Fiyata Dahil Olanlar
                    </p>
                    <p className="mt-0.5 text-gray-500">{vc.features.join(', ')}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Yolcu sayısı */}
          <div className="card divide-y divide-gray-100 px-5">
            <Counter label="Yetişkin" value={adults}
              onDec={() => setAdults((n) => Math.max(1, n - 1))}
              onInc={() => canAddPax && setAdults((n) => n + 1)}
              canInc={canAddPax} />
            <Counter label="Çocuk" value={children}
              onDec={() => setChildren((n) => Math.max(0, n - 1))}
              onInc={() => canAddPax && setChildren((n) => n + 1)}
              canInc={canAddPax} />
          </div>

          {/* Transfer noktaları */}
          <div className="card p-5">
            <h3 className="mb-3 text-base font-bold text-gray-900">Transfer Bilgileri</h3>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 text-gray-700">
                <MapPin size={15} className="shrink-0 text-emerald-500" /> {fromName || '—'}
              </p>
              <p className="flex items-center gap-2 text-gray-700">
                <MapPin size={15} className="shrink-0 text-slate-900" /> {toName || '—'}
              </p>
            </div>
          </div>

          {/* Harita */}
          <div className="card p-5">
            {fromLoc?.lat != null && fromLoc?.lng != null && toLoc?.lat != null && toLoc?.lng != null ? (
              <RouteMap
                from={{ lat: fromLoc.lat, lng: fromLoc.lng, name: fromName }}
                to={{ lat: toLoc.lat, lng: toLoc.lng, name: toName }}
              />
            ) : (
              <div className="flex h-56 items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-400">
                <span className="flex items-center gap-2"><MapPin size={16} /> Harita için konum bilgisi yok</span>
              </div>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}

function Counter({
  label, value, onDec, onInc, canInc,
}: { label: string; value: number; onDec: () => void; onInc: () => void; canInc: boolean }) {
  return (
    <div className="flex items-center justify-between py-4">
      <span className="text-base font-semibold text-gray-900">{label}: {value}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onDec}
          className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-emerald-600 transition-colors hover:bg-emerald-50">
          <Minus size={16} />
        </button>
        <button type="button" onClick={onInc} disabled={!canInc}
          className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-40">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
