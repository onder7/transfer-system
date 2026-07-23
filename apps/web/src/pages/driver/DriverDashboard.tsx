import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Clock, Users, Plane, Phone, Navigation, ChevronDown, ChevronUp,
  CheckCircle2, CircleDot, RefreshCw, Megaphone, Locate,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useDriverLocation, type LocationStatus } from '@/hooks/useDriverLocation';

// ─── Tipler (driver API yanıtına göre) ────────────────────────────────────────
interface Loc { name: string; nameEn: string | null; lat?: number | null; lng?: number | null }
interface FlightInfo {
  status: string; delayMinutes: number;
  scheduledAt: string; estimatedAt: string | null; actualAt: string | null;
  depIata: string | null; depName: string | null;
  arrIata: string | null; arrName: string | null;
}
interface Assignment {
  id: string; status: string; vehiclePlate: string | null; pickedUpAt: string | null;
  vehicleClass: { name: string; capacity: number };
  booking: {
    id: string; bookingRef: string; transferDate: string;
    adultCount: number; childCount: number;
    flightNumber: string | null; returnFlight: boolean;
    fromLocation: Loc; toLocation: Loc;
    flightInfo: FlightInfo | null;
  };
}
interface AssignmentDetail {
  assignment: {
    booking: {
      guestName: string | null; guestPhone: string | null;
      extraRequests: string | null;
      customFromAddress: string | null; customFromLat: number | null; customFromLng: number | null;
      fromLocation: { name: string; lat: number | null; lng: number | null };
      toLocation:   { name: string; lat: number | null; lng: number | null };
    };
  };
}

const STATUS: Record<string, { label: string; cls: string }> = {
  ASSIGNED:  { label: 'Atandı',       cls: 'bg-blue-100 text-blue-700' },
  EN_ROUTE:  { label: 'Yola Çıktım',  cls: 'bg-amber-100 text-amber-700' },
  PICKED_UP: { label: 'Yolcu Alındı', cls: 'bg-emerald-100 text-emerald-700' },
};
const FLIGHT_STATUS: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: 'Planlandı', cls: 'text-blue-600' },
  DELAYED:   { label: 'Rötarlı',   cls: 'text-amber-600' },
  LANDED:    { label: 'İndi',      cls: 'text-emerald-600' },
  CANCELLED: { label: 'İptal',     cls: 'text-red-600' },
};

// Sonraki eylem: her durum için tek ileri buton
const NEXT_ACTION: Record<string, { to: string; label: string; cls: string } | null> = {
  ASSIGNED:  { to: 'EN_ROUTE',  label: '🚗 Yola Çıktım',   cls: 'bg-amber-500 hover:bg-amber-600' },
  EN_ROUTE:  { to: 'PICKED_UP', label: '🧍 Yolcuyu Aldım', cls: 'bg-emerald-500 hover:bg-emerald-600' },
  PICKED_UP: { to: 'COMPLETED', label: '✓ Transferi Tamamladım', cls: 'bg-slate-800 hover:bg-slate-900' },
};

const fmtTime = (s: string) =>
  new Date(s).toLocaleString('tr-TR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtHm = (s: string | null) =>
  s ? new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—';

const mapsUrl = (lat?: number | null, lng?: number | null, q?: string | null) =>
  lat != null && lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q ?? '')}`;

// Konum paylaşım durumu göstergesi
function LocationIndicator({ status }: { status: LocationStatus }) {
  if (status === 'watching') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <Locate size={10} className="animate-pulse" /> GPS
      </span>
    );
  }
  if (status === 'denied') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
        <Locate size={10} /> Konum kapalı
      </span>
    );
  }
  if (status === 'error' || status === 'unavailable') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        <Locate size={10} /> GPS hatası
      </span>
    );
  }
  return null;
}

function AssignmentCard({ a }: { a: Assignment }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [notifySent, setNotifySent] = useState(false);

  const b = a.booking;

  // Detay (yolcu adı/telefon/adres) — yalnızca genişletince çekilir
  const { data: detail } = useQuery({
    queryKey: ['driver-assignment', a.id],
    queryFn: () => api.get<AssignmentDetail>(`/driver/assignments/${a.id}`).then((r) => r.data),
    enabled: open,
    staleTime: 30_000,
  });

  const mut = useMutation({
    mutationFn: (to: string) => api.patch(`/driver/assignments/${a.id}/status`, { status: to }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-assignments'] }),
    onError: (e: any) => setErr(e.response?.data?.error ?? 'İşlem başarısız'),
  });

  // "Yaklaştım" bildirimi (EN_ROUTE durumunda)
  const notifyMut = useMutation({
    mutationFn: () => api.post(`/driver/assignments/${a.id}/notify-approaching`),
    onSuccess: () => setNotifySent(true),
    onError: (e: any) => setErr(e.response?.data?.error ?? 'Bildirim gönderilemedi'),
  });

  const action = NEXT_ACTION[a.status];
  const st = STATUS[a.status];
  const fi = b.flightInfo;

  // Canlı konum paylaşımı — ASSIGNED, EN_ROUTE veya PICKED_UP durumunda aktif
  const isLocationActive = ['ASSIGNED', 'EN_ROUTE', 'PICKED_UP'].includes(a.status);
  const { status: locStatus, sendManualLocation } = useDriverLocation(a.id, isLocationActive);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {/* Üst şerit: saat + durum */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Clock size={15} className="text-emerald-500" /> {fmtTime(b.transferDate)}
        </span>
        {st && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>}
        {isLocationActive && <LocationIndicator status={locStatus} />}
      </div>

      <div className="p-4">
        {/* Güzergah */}
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <MapPin size={15} className="shrink-0 text-emerald-500" /> {b.fromLocation.name}
          </p>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <MapPin size={15} className="shrink-0 text-slate-900" /> {b.toLocation.name}
          </p>
        </div>

        {/* Bilgi rozetleri */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-slate-600">
            <Users size={12} /> {b.adultCount}{b.childCount > 0 ? `+${b.childCount}` : ''} yolcu
          </span>
          {a.vehiclePlate && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-mono text-slate-600">
              {a.vehiclePlate}
            </span>
          )}
          {b.flightNumber && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-slate-600">
              <Plane size={12} className="-rotate-45" /> {b.flightNumber}
              {fi && (
                <span className={`ml-1 font-semibold ${FLIGHT_STATUS[fi.status]?.cls ?? ''}`}>
                  · {FLIGHT_STATUS[fi.status]?.label ?? fi.status}
                  {fi.delayMinutes > 0 ? ` ${fi.delayMinutes}dk` : ''}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Uçuş iniş saati (varsa) */}
        {fi && (
          <p className="mt-2 text-xs text-slate-500">
            ✈️ Tahmini iniş: <strong className="text-slate-700">{fmtHm(fi.estimatedAt ?? fi.scheduledAt)}</strong>
            {fi.actualAt && <> · Gerçekleşen: <strong className="text-emerald-600">{fmtHm(fi.actualAt)}</strong></>}
          </p>
        )}

        {a.pickedUpAt && (
          <p className="mt-2 text-xs text-emerald-600">🧍 Yolcu alındı: {fmtHm(a.pickedUpAt)}</p>
        )}

        {/* Detay (genişleyen) */}
        <button onClick={() => setOpen((o) => !o)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {open ? 'Detayı gizle' : 'Yolcu bilgileri & adres'}
        </button>

        {open && (
          <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            {detail ? (() => {
              const d = detail.assignment.booking;
              return (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Yolcu</span>
                  <span className="font-semibold text-slate-800">{d.guestName ?? '—'}</span>
                </div>
                {d.guestPhone && (
                  <a href={`tel:${d.guestPhone}`}
                    className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 font-semibold text-white hover:bg-emerald-600">
                    <Phone size={16} /> Yolcuyu Ara ({d.guestPhone})
                  </a>
                )}
                {d.customFromAddress && (
                  <p className="text-xs text-slate-600"><strong>Alış adresi:</strong> {d.customFromAddress}</p>
                )}
                {d.extraRequests && (
                  <p className="text-xs text-slate-600"><strong>Not:</strong> {d.extraRequests}</p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a href={mapsUrl(d.customFromLat ?? d.fromLocation.lat, d.customFromLng ?? d.fromLocation.lng, d.fromLocation.name)}
                    target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-700 hover:bg-white">
                    <Navigation size={13} /> Alış konumu
                  </a>
                  <a href={mapsUrl(d.toLocation.lat, d.toLocation.lng, d.toLocation.name)}
                    target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-700 hover:bg-white">
                    <Navigation size={13} /> Varış konumu
                  </a>
                </div>
              </>
              );
            })() : (
              <p className="text-center text-xs text-slate-400">Yükleniyor…</p>
            )}
          </div>
        )}

        {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}

        {/* "Yaklaştım" bildirimi — yalnızca EN_ROUTE durumunda */}
        {a.status === 'EN_ROUTE' && (
          <button
            onClick={() => { setErr(''); notifyMut.mutate(); }}
            disabled={notifyMut.isPending || notifySent}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
              notifySent
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600 cursor-default'
                : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60'
            }`}
          >
            {notifySent ? (
              <><CheckCircle2 size={15} /> Müşteriye bildirildi</>
            ) : notifyMut.isPending ? (
              <><Megaphone size={15} className="animate-pulse" /> Gönderiliyor…</>
            ) : (
              <><Megaphone size={15} /> 📍 Yaklaştım — Müşteriyi bilgilendir</>
            )}
          </button>
        )}

        {/* Manuel Konum Güncelleme (Dev/HTTP ortamı için) */}
        {isLocationActive && (
          <button
            onClick={async () => {
              const lat = b.fromLocation.lat ?? 36.8987;
              const lng = b.fromLocation.lng ?? 30.8005;
              await sendManualLocation(lat, lng);
            }}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <Locate size={14} /> 📍 Konumumu İlet / Güncelle (Canlı Harita)
          </button>
        )}

        {/* Ana eylem butonu */}
        {action && (
          <button
            onClick={() => { setErr(''); mut.mutate(action.to); }}
            disabled={mut.isPending}
            className={`mt-3 w-full rounded-xl py-3.5 text-base font-bold text-white transition-colors disabled:opacity-60 ${action.cls}`}
          >
            {mut.isPending ? 'İşleniyor…' : action.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function DriverDashboard() {
  const [date, setDate] = useState(''); // boş = tüm aktif atamalar

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['driver-assignments', date],
    queryFn: () =>
      api.get<{ assignments: Assignment[] }>('/driver/assignments', {
        params: date ? { date } : {},
      }).then((r) => r.data),
    refetchInterval: 60_000, // dakikada bir tazele (uçuş durumu vb.)
  });

  const assignments = data?.assignments ?? [];
  const active   = assignments.filter((a) => a.status !== 'PICKED_UP');
  const inProgress = assignments.filter((a) => a.status === 'PICKED_UP');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Transferlerim</h1>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /> Yenile
        </button>
      </div>

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
        placeholder="Tarih" />

      {isLoading ? (
        <p className="py-16 text-center text-slate-400">Yükleniyor…</p>
      ) : isError ? (
        <p className="py-16 text-center text-red-500">Atamalar yüklenemedi.</p>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
          <p className="mt-3 font-medium text-slate-700">Aktif transfer yok</p>
          <p className="mt-1 text-sm text-slate-400">Size atanan transferler burada görünür.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inProgress.length > 0 && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-600">
                <CircleDot size={13} /> Devam eden
              </p>
              {inProgress.map((a) => <AssignmentCard key={a.id} a={a} />)}
            </div>
          )}
          {active.length > 0 && (
            <div className="space-y-3">
              {inProgress.length > 0 && (
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Sıradaki</p>
              )}
              {active.map((a) => <AssignmentCard key={a.id} a={a} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
