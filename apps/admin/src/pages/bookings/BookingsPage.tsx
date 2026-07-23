import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Booking {
  id:            string;
  bookingRef:    string;
  guestName:     string | null;
  guestPhone:    string | null;
  guestEmail:    string | null;
  flightNumber:  string | null;
  extraRequests: string | null;
  notes:         string | null;
  status:        string;
  transferDate:  string;
  adultCount:    number;
  childCount:    number;
  createdAt:     string;
  fromLocation:  { name: string };
  toLocation:    { name: string };
  vehicleClass:  { id: string; name: string };
  payment:       { status: string; amount: number; currency: string; method: string } | null;
  assignment:    { status: string; vehiclePlate: string | null; pickedUpAt: string | null; driver: { firstName: string; lastName: string } | null } | null;
  flightInfo:    FlightInfo | null;
  returnFlight:  boolean;
  estimatedDurationMin: number | null;
  outboundId:    string | null;
  returnLeg:     { id: string; bookingRef: string; transferDate: string; status: string } | null;
  outbound:      { id: string; bookingRef: string; transferDate: string } | null;
}

const fmtLegDate = (s: string) =>
  new Date(s).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// Atama (takip) durumu — şoför iş akışı
const ASSIGN_STATUS: Record<string, { label: string; badge: string }> = {
  ASSIGNED:  { label: 'Atandı',        badge: 'badge-blue' },
  EN_ROUTE:  { label: 'Yola Çıktı',    badge: 'badge-yellow' },
  PICKED_UP: { label: 'Yolcu Alındı',  badge: 'badge-green' },
  COMPLETED: { label: 'Tamamlandı',    badge: 'badge-gray' },
};

// Harita tahmini süreyi okunur biçime çevir (97 → "1 sa 37 dk")
function fmtDuration(min: number | null): string {
  if (min == null) return '—';
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

// Gidiş / dönüş bacağı rozeti
function LegBadge({ b }: { b: Booking }) {
  if (b.outboundId) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200"
        title={b.outbound ? `Gidiş: ${b.outbound.bookingRef.slice(-8)} · ${fmtLegDate(b.outbound.transferDate)}` : undefined}>
        ↩ DÖNÜŞ
      </span>
    );
  }
  if (b.returnLeg) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
        title={`Dönüş: ${b.returnLeg.bookingRef.slice(-8)} · ${fmtLegDate(b.returnLeg.transferDate)}`}>
        ⇄ GİDİŞ
      </span>
    );
  }
  return null;
}

interface FlightInfo {
  status:        string;
  delayMinutes:  number;
  scheduledAt:   string;
  estimatedAt:   string | null;
  actualAt:      string | null;
  lastCheckedAt: string;
  depIata:       string | null;
  depName:       string | null;
  depUtcOffset:  string | null;
  arrIata:       string | null;
  arrName:       string | null;
  arrUtcOffset:  string | null;
}

// "BFS Belfast (UTC +01:00)" biçiminde havalimanı etiketi
function airportLabel(iata: string | null, name: string | null, offset: string | null) {
  const parts = [iata, name].filter(Boolean).join(' ');
  return offset ? `${parts} (UTC ${offset})` : parts;
}

const FLIGHT_STATUS: Record<string, { label: string; badge: string }> = {
  SCHEDULED: { label: 'Planlandı', badge: 'badge-blue' },
  DELAYED:   { label: 'Rötarlı',   badge: 'badge-yellow' },
  LANDED:    { label: 'İndi',      badge: 'badge-green' },
  CANCELLED: { label: 'İptal',     badge: 'badge-red' },
};

const fmtFlightTime = (s: string | null) =>
  s ? new Date(s).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

interface Driver  { id: string; firstName: string; lastName: string }
interface Vehicle { id: string; plate: string; defaultDriver: Driver | null }

const STATUS_OPTIONS = [
  { value: '',          label: 'Tümü' },
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

const METHOD_LABEL: Record<string, string> = {
  ONLINE:           '💳 Kredi Kartı',
  BANK_TRANSFER:    '🏦 Havale/EFT',
  CASH_ON_DELIVERY: '💵 Araçta Ödeme',
};

function needsConfirm(b: Booking) {
  return b.status === 'PENDING' &&
    (b.payment?.method === 'CASH_ON_DELIVERY' || b.payment?.method === 'BANK_TRANSFER');
}

function canAssign(b: Booking) {
  return b.status === 'CONFIRMED' || b.status === 'ASSIGNED';
}

function canAdvance(b: Booking) {
  if (b.status === 'EN_ROUTE') return true;
  // ASSIGNED durumunda atama kaydı olmadan ilerlemeye izin verme
  return b.status === 'ASSIGNED' && b.assignment !== null;
}

function advanceLabel(status: string) {
  if (status === 'EN_ROUTE') return '✓ Tamamla';
  return '▶ Yolda';
}

function needsAssignment(b: Booking) {
  return b.status === 'CONFIRMED';
}

function canEdit(b: Booking) {
  return !['COMPLETED', 'CANCELLED'].includes(b.status);
}

function canCancel(b: Booking) {
  return !['COMPLETED', 'CANCELLED'].includes(b.status);
}

function canDelete(b: Booking) {
  return b.status === 'CANCELLED' && b.payment?.status !== 'PAID';
}

function isOverdue(b: Booking) {
  return new Date(b.transferDate) < new Date() && !['COMPLETED', 'CANCELLED'].includes(b.status);
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Şoför Atama Modal ────────────────────────────────────────────────────────

function AssignModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const qc = useQueryClient();
  const [driverId,  setDriverId]  = useState('');
  const [vehicleId, setVehicleId] = useState('');

  const { data: driverData } = useQuery({
    queryKey: ['admin', 'drivers-active'],
    queryFn:  () =>
      api.get<{ users: (Driver & { role: string; isActive: boolean })[] }>('/admin/users', {
        params: { role: 'DRIVER' },
      }).then((r) => r.data),
  });

  const { data: vehicleData } = useQuery({
    queryKey: ['admin', 'vehicles-available', booking.vehicleClass.id, booking.transferDate],
    queryFn:  () =>
      api.get<{ vehicles: Vehicle[] }>('/admin/vehicles/available', {
        params: {
          vehicleClassId: booking.vehicleClass.id,
          transferDate: booking.transferDate,
          ...(booking.estimatedDurationMin != null ? { estimatedDurationMin: booking.estimatedDurationMin } : {}),
        },
      }).then((r) => r.data),
  });

  const drivers  = driverData?.users?.filter((u) => u.role === 'DRIVER' && u.isActive) ?? [];
  const vehicles = vehicleData?.vehicles ?? [];

  function handleDriverChange(id: string) {
    setDriverId(id);
    const defaultVehicle = vehicles.find((v) => v.defaultDriver?.id === id);
    if (defaultVehicle) setVehicleId(defaultVehicle.id);
    else setVehicleId('');
  }

  const assignMut = useMutation({
    mutationFn: () =>
      api.post(`/driver/assign/${booking.id}`, {
        driverId,
        vehicleClassId: booking.vehicleClass.id,
        vehicleId:      vehicleId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] });
      onClose();
    },
  });

  const assignError = assignMut.error
    ? getApiError(assignMut.error)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Şoför Ata</h2>
        <p className="text-sm text-gray-500 mb-4">
          {booking.bookingRef.slice(-8)} — {booking.fromLocation.name} → {booking.toLocation.name}
          <br />
          <span className="font-medium">{booking.vehicleClass.name}</span> ·{' '}
          {new Date(booking.transferDate).toLocaleString('tr-TR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </p>

        <div className="space-y-4">
          <div>
            <label className="label text-gray-700">Şoför *</label>
            <select
              className="input"
              value={driverId}
              onChange={(e) => handleDriverChange(e.target.value)}
            >
              <option value="">Şoför seçiniz…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-gray-700">
              Araç
              {vehicles.length === 0 && (
                <span className="ml-2 text-xs text-amber-600">(Bu sınıfta müsait araç yok)</span>
              )}
            </label>
            <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Araç seçilmedi</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate}{v.defaultDriver ? ` — ${v.defaultDriver.firstName} ${v.defaultDriver.lastName}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Listedeki araçlar {booking.vehicleClass.name} sınıfında ve bu saatte müsait.
            </p>
          </div>

          {assignError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{assignError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Kapat</button>
            <button
              className="btn btn-primary flex-1"
              disabled={!driverId || assignMut.isPending}
              onClick={() => assignMut.mutate()}
            >
              {assignMut.isPending ? 'Atanıyor…' : 'Ata'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rezervasyon Düzenleme Modal ─────────────────────────────────────────────

interface EditForm {
  transferDate:  string;
  guestName:     string;
  guestPhone:    string;
  guestEmail:    string;
  flightNumber:  string;
  extraRequests: string;
  notes:         string;
}

function EditBookingModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<EditForm>({
    transferDate:  toDatetimeLocal(booking.transferDate),
    guestName:     booking.guestName     ?? '',
    guestPhone:    booking.guestPhone    ?? '',
    guestEmail:    booking.guestEmail    ?? '',
    flightNumber:  booking.flightNumber  ?? '',
    extraRequests: booking.extraRequests ?? '',
    notes:         booking.notes         ?? '',
  });

  const editMut = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = {};
      if (form.transferDate)  body.transferDate  = new Date(form.transferDate).toISOString();
      if (form.guestName     !== (booking.guestName     ?? '')) body.guestName     = form.guestName;
      if (form.guestPhone    !== (booking.guestPhone    ?? '')) body.guestPhone    = form.guestPhone;
      if (form.guestEmail    !== (booking.guestEmail    ?? '')) body.guestEmail    = form.guestEmail;
      if (form.flightNumber  !== (booking.flightNumber  ?? '')) body.flightNumber  = form.flightNumber;
      if (form.extraRequests !== (booking.extraRequests ?? '')) body.extraRequests = form.extraRequests;
      if (form.notes         !== (booking.notes         ?? '')) body.notes         = form.notes;
      return api.patch(`/admin/bookings/${booking.id}/edit`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] });
      onClose();
    },
  });

  const editError = editMut.error ? getApiError(editMut.error) : null;

  // ── Uçuş takibi ──
  const [flightInfo, setFlightInfo] = useState<FlightInfo | null>(booking.flightInfo);
  const flightMut = useMutation({
    mutationFn: () =>
      api.post<{ flightInfo: FlightInfo }>(`/admin/bookings/${booking.id}/flight`).then((r) => r.data),
    onSuccess: (d) => {
      setFlightInfo(d.flightInfo);
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    },
  });
  const flightError = flightMut.error ? getApiError(flightMut.error) : null;

  function set(field: keyof EditForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Rezervasyon Düzenle</h2>
        <p className="text-sm text-gray-500 mb-4">
          {booking.bookingRef.slice(-8)} · {booking.fromLocation.name} → {booking.toLocation.name} · {booking.vehicleClass.name}
        </p>

        <div className="space-y-4">
          <div>
            <label className="label text-gray-700">Transfer Tarihi / Saati</label>
            <input
              type="datetime-local"
              className="input"
              value={form.transferDate}
              onChange={set('transferDate')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-gray-700">Misafir Adı</label>
              <input className="input" value={form.guestName} onChange={set('guestName')} placeholder="Ad Soyad" />
            </div>
            <div>
              <label className="label text-gray-700">Telefon</label>
              <input className="input" value={form.guestPhone} onChange={set('guestPhone')} placeholder="+90…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-gray-700">E-posta</label>
              <input type="email" className="input" value={form.guestEmail} onChange={set('guestEmail')} />
            </div>
            <div>
              <label className="label text-gray-700">Uçuş No</label>
              <input className="input" value={form.flightNumber} onChange={set('flightNumber')} placeholder="TK123" />
            </div>
          </div>

          {/* ── Uçuş Takibi ── */}
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">✈️ Uçuş Takibi</span>
              <button
                type="button"
                className="btn btn-outline text-xs px-3 py-1"
                disabled={flightMut.isPending || !booking.flightNumber}
                title={!booking.flightNumber ? 'Önce uçuş numarasını kaydedin' : 'AeroDataBox\'tan anlık sorgula'}
                onClick={() => flightMut.mutate()}
              >
                {flightMut.isPending ? 'Sorgulanıyor…' : 'Uçuşu Sorgula'}
              </button>
            </div>

            {flightInfo ? (
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Durum</span>
                  <span className={FLIGHT_STATUS[flightInfo.status]?.badge ?? 'badge-gray'}>
                    {FLIGHT_STATUS[flightInfo.status]?.label ?? flightInfo.status}
                    {flightInfo.delayMinutes > 0 ? ` · ${flightInfo.delayMinutes} dk rötar` : ''}
                  </span>
                </div>
                {(flightInfo.depIata || flightInfo.arrIata) && (
                  <div className="flex flex-col gap-0.5 border-b border-gray-100 pb-1.5">
                    <span className="text-gray-500">Güzergah</span>
                    <span className="font-medium text-gray-800">
                      {airportLabel(flightInfo.depIata, flightInfo.depName, flightInfo.depUtcOffset)}
                    </span>
                    <span className="font-medium text-gray-800">
                      → {airportLabel(flightInfo.arrIata, flightInfo.arrName, flightInfo.arrUtcOffset)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-gray-500">Planlanan iniş</span><span className="font-medium">{fmtFlightTime(flightInfo.scheduledAt)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tahmini iniş</span><span className="font-medium">{fmtFlightTime(flightInfo.estimatedAt)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Gerçekleşen iniş</span><span className="font-medium">{fmtFlightTime(flightInfo.actualAt)}</span></div>
                <div className="flex justify-between text-xs text-gray-400 pt-1"><span>Son kontrol</span><span>{fmtFlightTime(flightInfo.lastCheckedAt)}</span></div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-400">
                {booking.flightNumber
                  ? 'Henüz uçuş verisi yok. "Uçuşu Sorgula" ile güncelleyin.'
                  : 'Uçuş takibi için önce uçuş numarası girip kaydedin.'}
              </p>
            )}
            {flightError && <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">{flightError}</p>}
          </div>

          <div>
            <label className="label text-gray-700">Ekstra Talepler</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.extraRequests}
              onChange={set('extraRequests')}
            />
          </div>

          <div>
            <label className="label text-gray-700">Admin Notu</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.notes}
              onChange={set('notes')}
            />
          </div>

          {editError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{editError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>İptal</button>
            <button
              className="btn btn-primary flex-1"
              disabled={editMut.isPending}
              onClick={() => editMut.mutate()}
            >
              {editMut.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Yardımcı: API hata mesajını çıkar ──────────────────────────────────────

function getApiError(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Bir hata oluştu';
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export function BookingsPage() {
  const [search,       setSearch]      = useState('');
  const [status,       setStatus]      = useState('');
  const [date,         setDate]        = useState('');
  const [page,         setPage]        = useState(1);
  const [assignTarget, setAssignTarget] = useState<Booking | null>(null);
  const [editTarget,   setEditTarget]   = useState<Booking | null>(null);
  const [actionError,  setActionError]  = useState<string | null>(null);
  const qc = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevTotalRef = useRef<number | null>(null);
  const [newCount,    setNewCount]    = useState(0);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'bookings', search, status, date, page],
    queryFn:  () =>
      api.get<{ bookings: Booking[]; total: number; totalPages: number }>('/admin/bookings', {
        params: { search: search || undefined, status: status || undefined,
                  date: date || undefined, page, pageSize: 20 },
      }).then((r) => r.data),
    placeholderData:              (prev) => prev,
    refetchInterval:              20_000,   // 20 saniyede bir otomatik yenile
    refetchIntervalInBackground:  true,     // sekme arka planda olsa da devam et
  });

  // Yeni rezervasyon gelince bildir
  useEffect(() => {
    if (!data) return;
    setLastUpdated(new Date());
    if (prevTotalRef.current !== null && data.total > prevTotalRef.current) {
      setNewCount((n) => n + (data.total - prevTotalRef.current!));
    }
    prevTotalRef.current = data.total;
  }, [data]);

  const confirmMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin/bookings/${id}/confirm`),
    onSuccess: () => { setActionError(null); qc.invalidateQueries({ queryKey: ['admin', 'bookings'] }); },
    onError:   (err) => setActionError(getApiError(err)),
  });

  const advanceMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin/bookings/${id}/advance`),
    onSuccess: () => { setActionError(null); qc.invalidateQueries({ queryKey: ['admin', 'bookings'] }); },
    onError:   (err) => setActionError(getApiError(err)),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin/bookings/${id}/cancel`),
    onSuccess: () => { setActionError(null); qc.invalidateQueries({ queryKey: ['admin', 'bookings'] }); },
    onError:   (err) => setActionError(getApiError(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/bookings/${id}`),
    onSuccess: () => { setActionError(null); qc.invalidateQueries({ queryKey: ['admin', 'bookings'] }); },
    onError:   (err) => setActionError(getApiError(err)),
  });

  function handleCancel(b: Booking) {
    const msg = b.payment?.status === 'PAID'
      ? `Bu rezervasyonun ödemesi alınmış. İptal edilirse iade politikası uygulanacak. Devam edilsin mi?`
      : `${b.bookingRef.slice(-8)} numaralı rezervasyon iptal edilsin mi?`;
    if (confirm(msg)) cancelMut.mutate(b.id);
  }

  function handleDelete(b: Booking) {
    if (confirm(`${b.bookingRef.slice(-8)} silinsin mi? Bu işlem geri alınamaz.`)) {
      deleteMut.mutate(b.id);
    }
  }

  const bookings       = data?.bookings ?? [];
  const overdueCount   = bookings.filter(isOverdue).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          Rezervasyonlar
          {newCount > 0 && (
            <button
              className="ml-3 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white"
              onClick={() => { setNewCount(0); qc.invalidateQueries({ queryKey: ['admin', 'bookings'] }); }}
              title="Yeni rezervasyonları görmek için tıklayın"
            >
              +{newCount} yeni
            </button>
          )}
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {isFetching && !isLoading && (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" title="Güncelleniyor…" />
          )}
          {lastUpdated && (
            <span>Son güncelleme: {lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          )}
          <button
            className="btn-outline py-0.5 px-2 text-xs"
            onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'bookings'] })}
          >
            ↻ Yenile
          </button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>⚠ {actionError}</span>
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setActionError(null)}>✕</button>
        </div>
      )}

      {overdueCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-lg leading-none">⚠️</span>
          <div>
            <p className="font-semibold text-red-700">
              {overdueCount} adet transfer saati geçmiş rezervasyon var
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              Bu rezervasyonların durumu hâlâ aktif — tamamlandıysa ilerletin, gerçekleşmediyse iptal edin.
            </p>
          </div>
        </div>
      )}

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
                {['Ref', 'Misafir', 'Güzergah', 'Araç', 'Transfer', 'Tutar / Yöntem', 'Atama', 'Durum', 'İşlem'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : bookings.map((b) => (
                    <tr
                      key={b.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/80 ${
                        isOverdue(b)    ? 'bg-red-50/70'    :
                        needsConfirm(b) ? 'bg-amber-50/60'  : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-brand-600">
                        <div>{b.bookingRef.slice(-8)}</div>
                        <LegBadge b={b} />
                        {b.returnLeg && (
                          <div className="mt-0.5 font-sans text-[11px] text-gray-400">
                            dönüş: {fmtLegDate(b.returnLeg.transferDate)}
                          </div>
                        )}
                        {b.outbound && (
                          <div className="mt-0.5 font-sans text-[11px] text-gray-400">
                            gidiş: {fmtLegDate(b.outbound.transferDate)}
                          </div>
                        )}
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium">{Number(b.payment?.amount ?? 0).toLocaleString('tr-TR')} ₺</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {METHOD_LABEL[b.payment?.method ?? ''] ?? b.payment?.method ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {b.assignment ? (
                          <div className="space-y-1">
                            <div className="font-medium text-gray-700">
                              {b.assignment.driver
                                ? `${b.assignment.driver.firstName} ${b.assignment.driver.lastName}`
                                : '—'}
                            </div>
                            {b.assignment.vehiclePlate && (
                              <div className="font-mono text-gray-400">{b.assignment.vehiclePlate}</div>
                            )}
                            {/* Takip durumu (şoför iş akışı) */}
                            <span className={ASSIGN_STATUS[b.assignment.status]?.badge ?? 'badge-gray'}>
                              {ASSIGN_STATUS[b.assignment.status]?.label ?? b.assignment.status}
                            </span>
                            {b.assignment.pickedUpAt && (
                              <div className="text-[11px] text-emerald-600">
                                🧍 alındı: {fmtLegDate(b.assignment.pickedUpAt)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                        {/* Harita tahmini yolculuk süresi */}
                        <div className="mt-1 text-[11px] text-gray-400" title="Haritadan (OSRM) otomatik hesaplanan tahmini yolculuk süresi — çakışma penceresinde kullanılır">
                          🗺️ ~{fmtDuration(b.estimatedDurationMin)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={STATUS_BADGE[b.status] ?? 'badge-gray'}>
                            {STATUS_OPTIONS.find((o) => o.value === b.status)?.label ?? b.status}
                          </span>
                          {isOverdue(b) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                              ⚠ Gecikmiş
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          {/* Onayla — nakit/havale bekleyen */}
                          {needsConfirm(b) && (
                            <button
                              className="btn btn-primary py-1 px-3 text-xs whitespace-nowrap"
                              disabled={confirmMut.isPending}
                              onClick={() => confirmMut.mutate(b.id)}
                            >
                              ✓ Onayla
                            </button>
                          )}

                          {/* Şoför Ata */}
                          {canAssign(b) && (
                            <button
                              className="btn-outline py-1 px-3 text-xs whitespace-nowrap"
                              onClick={() => setAssignTarget(b)}
                            >
                              🚗 {b.assignment ? 'Yeniden Ata' : 'Şoför Ata'}
                            </button>
                          )}

                          {/* Atama bekleniyor uyarısı */}
                          {needsAssignment(b) && !b.assignment && (
                            <span className="text-xs text-amber-600 leading-tight">
                              ⚠ Atama gerekli
                            </span>
                          )}

                          {/* Durum İlerlet */}
                          {canAdvance(b) && (
                            <button
                              className="btn-outline py-1 px-3 text-xs whitespace-nowrap text-blue-600 hover:border-blue-400"
                              disabled={advanceMut.isPending}
                              onClick={() => advanceMut.mutate(b.id)}
                            >
                              {advanceLabel(b.status)}
                            </button>
                          )}

                          {/* Düzenle */}
                          {canEdit(b) && (
                            <button
                              className="btn-outline py-1 px-3 text-xs whitespace-nowrap"
                              onClick={() => setEditTarget(b)}
                            >
                              ✏ Düzenle
                            </button>
                          )}

                          {/* İptal Et */}
                          {canCancel(b) && (
                            <button
                              className="btn-outline py-1 px-3 text-xs whitespace-nowrap text-amber-600 hover:border-amber-400"
                              disabled={cancelMut.isPending}
                              onClick={() => handleCancel(b)}
                            >
                              ✕ İptal Et
                            </button>
                          )}

                          {/* Sil (sadece iptal + ödenmemiş) */}
                          {canDelete(b) && (
                            <button
                              className="btn-outline py-1 px-3 text-xs whitespace-nowrap text-red-500 hover:border-red-300"
                              disabled={deleteMut.isPending}
                              onClick={() => handleDelete(b)}
                            >
                              🗑 Sil
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

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
              <span className="flex items-center text-sm text-gray-600">{page} / {data.totalPages}</span>
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

      {assignTarget && (
        <AssignModal booking={assignTarget} onClose={() => setAssignTarget(null)} />
      )}

      {editTarget && (
        <EditBookingModal booking={editTarget} onClose={() => setEditTarget(null)} />
      )}
    </div>
  );
}
