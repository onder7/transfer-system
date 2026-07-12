import { useEffect } from 'react';
import {
  X, Users, Briefcase, Star, CheckCircle, CreditCard, ArrowRight, Wifi,
  Tv, Wine, Zap, Wind, ShieldCheck, MapPin
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TransferResult, BookingState, Location } from '@/design/types';
import { useLanguage } from '@/design/context/LanguageContext';
import RouteMap from '@/design/components/RouteMap';

interface Props {
  result: TransferResult;
  booking: BookingState;
  onClose: () => void;
  onBook: (vehicleId: string) => void;
}

const LEGACY_FEATURE_LABELS: Record<string, string> = {
  water: 'Water', wifi: 'Wi-Fi', child_seat: 'Child Seat', luggage: 'Extra Luggage',
};
const featureDisplay = (f: string) => LEGACY_FEATURE_LABELS[f] ?? f;

function FeatureIcon({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower.includes('wi-fi') || lower.includes('wifi')) return <Wifi size={15} className="text-emerald-500" />;
  if (lower.includes('champagne') || lower.includes('şampanya') || lower.includes('water') || lower.includes('su') || lower.includes('bar')) return <Wine size={15} className="text-emerald-500" />;
  if (lower.includes('tv') || lower.includes('television')) return <Tv size={15} className="text-emerald-500" />;
  if (lower.includes('usb') || lower.includes('charging') || lower.includes('şarj')) return <Zap size={15} className="text-emerald-500" />;
  if (lower.includes('air') || lower.includes('klima') || lower.includes('con')) return <Wind size={15} className="text-emerald-500" />;
  if (lower.includes('meet') || lower.includes('karşılama') || lower.includes('greet')) return <MapPin size={15} className="text-emerald-500" />;
  return <CheckCircle size={15} className="text-emerald-500" />;
}

export default function VehicleDetailModal({ result, booking, onClose, onBook }: Props) {
  const { t, lang } = useLanguage();
  const vc = result.vehicleClass;
  const isEn = lang === 'en';
  const name = isEn && vc.nameEn ? vc.nameEn : vc.name;

  // Güzergah haritası için konum koordinatları (BookingEngine ile aynı cache key)
  const { data: locData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<{ locations: Location[] }>('/locations').then((r) => r.data),
    staleTime: 60_000,
  });
  const locations = locData?.locations ?? [];
  const findLoc = (id?: string) => locations.find((l) => l.id === id);
  const fromLoc = findLoc(booking.fromLocationId);
  const toLoc = findLoc(booking.toLocationId);
  const locName = (l: Location) => (isEn && l.nameEn ? l.nameEn : l.name);
  const hasRoute =
    fromLoc?.lat != null && fromLoc?.lng != null &&
    toLoc?.lat != null && toLoc?.lng != null;

  let finalPrice = result.price;
  if (booking.tripType === 'round-trip' && result.returnPrice) {
    finalPrice += result.returnPrice;
  } else if (booking.tripType === 'round-trip') {
    finalPrice *= 1.8; 
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function handleBook() {
    onBook(vc.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }} />

      <div className="relative bg-white w-full sm:max-w-3xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/30 max-h-[95dvh] flex flex-col" style={{ animation: 'slideUp 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 bg-black/40 hover:bg-black/60 backdrop-blur rounded-xl flex items-center justify-center transition-colors"
          aria-label={t.close}
        >
          <X size={18} className="text-white" />
        </button>

        <div className="overflow-y-auto flex-1">
          <div className="relative h-56 sm:h-72 shrink-0">
            <img src={vc.imageUrl || 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=800'} alt={name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
              {vc.isShared && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500 text-white">
                  Shared Shuttle
                </span>
              )}
            </div>
            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5">
              <Star size={13} className="text-amber-400 fill-amber-400" />
              <span className="text-white text-xs font-bold">4.9</span>
              <span className="text-white/60 text-xs">{t.reviewCount}</span>
            </div>
          </div>

          <div className="p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mb-1">{vc.isShared ? 'Shared' : 'Private'}</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{name}</h2>
              </div>
              <div className="text-right shrink-0">
                <p className="text-slate-400 text-xs mb-0.5">{t.from}</p>
                <p className="text-3xl font-extrabold text-slate-900">{finalPrice.toLocaleString('tr-TR')} ₺</p>
                <p className="text-slate-400 text-xs">{t.perTrip}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <Users size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">{t.passengers}</p>
                  <p className="text-slate-900 font-bold">Max {vc.capacity} {t.pax}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <Briefcase size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">{t.bags}</p>
                  <p className="text-slate-900 font-bold">Max {vc.luggageCapacity} {t.bags}</p>
                </div>
              </div>
            </div>

            {hasRoute && fromLoc && toLoc && (
              <RouteMap
                from={{ lat: fromLoc.lat!, lng: fromLoc.lng!, name: locName(fromLoc) }}
                to={{ lat: toLoc.lat!, lng: toLoc.lng!, name: locName(toLoc) }}
              />
            )}

            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck size={16} className="text-emerald-500" />
                <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wide">{t.includedInPrice}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {vc.features.map((f) => (
                  <div key={f} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3.5 py-2.5">
                    <FeatureIcon label={f} />
                    <span className="text-slate-700 text-sm font-medium">{featureDisplay(f)}</span>
                  </div>
                ))}
                {[t.inclusion1, t.inclusion2, t.inclusion3, t.inclusion4].map((inc) => (
                  <div key={inc} className="flex items-center gap-3 bg-emerald-50/60 rounded-xl px-3.5 py-2.5">
                    <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                    <span className="text-slate-600 text-sm">{inc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <div className="flex flex-col gap-2.5 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t.baseFare}</span>
                  <span className="text-slate-700 font-medium">{result.price.toLocaleString('tr-TR')} ₺</span>
                </div>
                {booking.tripType === 'round-trip' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t.returnTrip}</span>
                    <span className="text-slate-700 font-medium">{result.returnPrice ? result.returnPrice.toLocaleString('tr-TR') : '—'} ₺</span>
                  </div>
                )}
                {result.surchargeApplied && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-500">Night/Season Surcharge</span>
                    <span className="text-amber-600 font-medium">Applied (x{result.multiplier})</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t.meetGreet}</span>
                  <span className="text-emerald-600 font-semibold">{t.included}</span>
                </div>
                <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center">
                  <span className="text-slate-900 font-bold">{t.total}</span>
                  <span className="text-2xl font-extrabold text-slate-900">{finalPrice.toLocaleString('tr-TR')} ₺</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 sm:px-8 py-5 border-t border-gray-100 bg-white flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-none px-5 py-3.5 rounded-2xl border border-gray-200 text-slate-600 text-sm font-semibold hover:border-gray-300 hover:bg-gray-50 transition-all"
          >
            {t.close}
          </button>
          <button
            onClick={handleBook}
            className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-bold text-sm sm:text-base rounded-2xl transition-all shadow-lg shadow-emerald-200 hover:shadow-emerald-300 flex items-center justify-center gap-2 group"
          >
            <CreditCard size={17} />
            {t.bookThisVehicle}
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
