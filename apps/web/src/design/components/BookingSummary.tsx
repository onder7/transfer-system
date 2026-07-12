import { MapPin, Clock, Users, CheckCircle, CreditCard, Phone, ArrowRight, Plane } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BookingState, TransferResult, Location } from '@/design/types';
import { useLanguage } from '@/design/context/LanguageContext';

interface Props {
  booking: BookingState;
  results: TransferResult[];
  onProceed: () => void;
  searchParams: BookingState | null;
}

function formatDate(date: string, lang: string) {
  if (!date) return '—';
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  return new Date(date + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function BookingSummary({ booking, results, onProceed, searchParams }: Props) {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const selectedResult = results.find((r) => r.vehicleClass.id === booking.selectedVehicleId);
  const vc = selectedResult?.vehicleClass;

  // Konum isimleri için lokasyonları çek (BookingEngine ile aynı cache key → ekstra istek yok)
  const { data: locData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<{ locations: Location[] }>('/locations').then((r) => r.data),
    staleTime: 60_000,
  });
  const locations = locData?.locations ?? [];
  const locName = (id?: string) => {
    const l = locations.find((x) => x.id === id);
    return l ? (isEn && l.nameEn ? l.nameEn : l.name) : null;
  };

  // Arama yapıldıysa aranan anlık değerleri, aksi halde formdaki canlı seçimleri göster
  const trip = searchParams ?? booking;

  let basePrice = null;
  if (selectedResult) {
    basePrice = selectedResult.price;
    if (booking.tripType === 'round-trip' && selectedResult.returnPrice) {
      basePrice += selectedResult.returnPrice;
    } else if (booking.tripType === 'round-trip') {
      basePrice *= 1.8;
    }
  }

  const currentStep = selectedResult ? 2 : (searchParams ? 1 : 0);
  const isReady = !!(selectedResult && searchParams);
  const steps = [t.stepDetails, t.stepVehicle, t.stepPay];
  const inclusions = [t.inclusion1, t.inclusion2, t.inclusion3, t.inclusion4];

  // We don't have the location names in BookingState anymore, but we could fetch them or just show "Selected Location".
  // For simplicity, we just use the IDs or a placeholder. 
  // Ideally, we would look up the location name from the same cache.
  const fromName = locName(trip.fromLocationId) ?? t.pickupLocationPlaceholder;
  const toName = locName(trip.toLocationId) ?? t.dropoffLocationPlaceholder;

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/8 overflow-hidden sticky top-24">
      <div className="bg-slate-900 px-6 py-5">
        <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">{t.bookingSummary}</p>
        <h3 className="text-white font-bold text-lg">{t.yourTransfer}</h3>
        <div className="flex items-center gap-1 mt-4">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= currentStep ? 'bg-emerald-400' : 'bg-white/20'}`} />
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          {steps.map((step, i) => (
            <p key={step} className={`text-xs font-medium ${i <= currentStep ? 'text-emerald-400' : 'text-white/30'}`}>
              {step}
            </p>
          ))}
        </div>
      </div>

      <div className="p-6 flex flex-col gap-5">
        <div className="relative bg-gray-50 rounded-2xl overflow-hidden h-32 border border-gray-100">
          <img
            src="https://images.pexels.com/photos/1036657/pexels-photo-1036657.jpeg?auto=compress&cs=tinysrgb&w=600"
            alt="Route map"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-4">
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur rounded-xl px-3 py-1.5 shadow-sm w-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
              <p className="text-slate-700 text-xs font-medium truncate">{fromName}</p>
            </div>
            <div className="w-0.5 h-3 bg-gray-300" />
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur rounded-xl px-3 py-1.5 shadow-sm w-full">
              <div className="w-2 h-2 bg-slate-900 rounded-full shrink-0" />
              <p className="text-slate-700 text-xs font-medium truncate">{toName}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SummaryRow
            icon={<Clock size={14} className="text-emerald-500" />}
            label={t.departure}
            value={trip.date ? `${formatDate(trip.date, lang)}${trip.time ? ` · ${trip.time}` : ''}` : '—'}
          />
          {trip.tripType === 'round-trip' && (
            <SummaryRow
              icon={<Clock size={14} className="text-slate-400" />}
              label={t.return}
              value={trip.returnDate ? `${formatDate(trip.returnDate, lang)}${trip.returnTime ? ` · ${trip.returnTime}` : ''}` : '—'}
            />
          )}
          <SummaryRow
            icon={<Users size={14} className="text-emerald-500" />}
            label={t.passengers}
            value={`${trip.adultCount} ${isEn ? (trip.adultCount > 1 ? 'Adults' : 'Adult') : 'Yetişkin'}${trip.childCount > 0 ? `, ${trip.childCount} ${isEn ? 'Child' : 'Çocuk'}` : ''}`}
          />
          <SummaryRow
            icon={<MapPin size={14} className="text-emerald-500" />}
            label={t.tripType}
            value={trip.tripType === 'round-trip' ? t.roundTripLabel : t.oneWayLabel}
          />
          {trip.flightNo && (
            <SummaryRow
              icon={<Plane size={14} className="text-emerald-500 -rotate-45" />}
              label={isEn ? 'Flight No' : 'Uçuş No'}
              value={trip.flightNo}
            />
          )}
        </div>

        {selectedResult && vc ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-2">{t.selectedVehicle}</p>
            <div className="flex items-center gap-3">
              <img src={vc.imageUrl || 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=800'} alt={vc.name} className="w-14 h-10 object-cover rounded-xl" />
              <div>
                <p className="text-slate-900 font-bold text-sm">{lang === 'en' && vc.nameEn ? vc.nameEn : vc.name}</p>
                <p className="text-slate-500 text-xs">Max {vc.capacity} {t.pax}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-4 text-center">
            <p className="text-slate-400 text-sm">{t.noVehicle}</p>
            <a href="#fleet" className="text-emerald-500 text-sm font-semibold hover:underline mt-1 block">{t.browseFleet}</a>
          </div>
        )}

        {basePrice !== null && selectedResult && (
          <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t.baseFare}</span>
              <span className="text-slate-700 font-medium">{selectedResult.price.toLocaleString('tr-TR')} ₺</span>
            </div>
            {booking.tripType === 'round-trip' && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t.returnTrip}</span>
                <span className="text-slate-700 font-medium">{selectedResult.returnPrice ? selectedResult.returnPrice.toLocaleString('tr-TR') : '—'} ₺</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t.meetGreet}</span>
              <span className="text-emerald-600 font-medium">{t.included}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-1">
              <span className="text-slate-900 font-bold">{t.total}</span>
              <span className="text-2xl font-extrabold text-slate-900">{basePrice.toLocaleString('tr-TR')} ₺</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {inclusions.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500 shrink-0" />
              <p className="text-slate-500 text-xs">{item}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onProceed}
          disabled={!isReady}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 group ${
            isReady
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <CreditCard size={18} />
          {isReady ? t.proceedPayment : t.completeDetails}
          {isReady && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
        </button>

        <a href="tel:+902525551234" className="flex items-center justify-center gap-2 text-slate-500 hover:text-emerald-600 text-sm transition-colors">
          <Phone size={14} />
          {t.preferCall}
        </a>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-slate-500 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-slate-800 text-sm font-semibold">{value}</p>
    </div>
  );
}
