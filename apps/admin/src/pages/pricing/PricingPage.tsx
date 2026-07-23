import { Fragment, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Location     { id: string; name: string; type: string; regionId?: string | null; }
interface VehicleClass {
  id: string; name: string; nameEn: string | null;
  capacity: number; luggageCapacity: number; isShared: boolean;
  features: string[]; imageUrl: string | null; isActive: boolean;
}
interface PriceMatrix  {
  id: string; basePrice: number; returnDiscount: number; isActive: boolean;
  fromLocation: { id: string; name: string; type: string };
  toLocation:   { id: string; name: string; type: string };
  vehicleClass: { id: string; name: string };
}
interface Surcharge {
  id: string; name: string; multiplier: number;
  startHour: number | null; endHour: number | null;
  startDate: string | null; endDate: string | null;
  isActive: boolean;
}
interface ChildPriceRule {
  id: string; label: string; maxAge: number;
  discountPercent: number; isActive: boolean;
}

// ─── Lokasyon türü renk şeması ────────────────────────────────────────────────
const TYPE_STYLE: Record<string, { icon: string; label: string; badge: string; dot: string }> = {
  airport: { icon: '✈️', label: 'Havalimanı', badge: 'bg-sky-100 text-sky-700 ring-sky-200',          dot: 'bg-sky-500' },
  region:  { icon: '📍', label: 'Bölge',      badge: 'bg-amber-100 text-amber-800 ring-amber-200',    dot: 'bg-amber-500' },
  hotel:   { icon: '🏨', label: 'Otel',       badge: 'bg-violet-100 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  port:    { icon: '⚓', label: 'Liman',      badge: 'bg-teal-100 text-teal-700 ring-teal-200',       dot: 'bg-teal-500' },
  city:    { icon: '🏙️', label: 'Şehir',      badge: 'bg-rose-100 text-rose-700 ring-rose-200',       dot: 'bg-rose-500' },
};
const typeStyle = (t: string) => TYPE_STYLE[t] ?? { icon: '📌', label: t, badge: 'bg-gray-100 text-gray-600 ring-gray-200', dot: 'bg-gray-400' };

// ─── Lokasyon Hücresi (türe göre renkli) ──────────────────────────────────────
function LocationCell({ name, type }: { name: string; type: string }) {
  const s = typeStyle(type);
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ${s.badge}`}>
      {s.icon} {name}
    </span>
  );
}

// Renk açıklaması (legend)
function TypeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
      <span>Renkler:</span>
      {['airport', 'region', 'hotel'].map((t) => {
        const s = typeStyle(t);
        return (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={`inline-block size-2 rounded-full ${s.dot}`} />
            {s.icon} {s.label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Toplu Fiyat Girişi Paneli ────────────────────────────────────────────────
function BulkPanel({
  locations, vehicleClasses, existingMatrix, onSave, onClose,
}: {
  locations: Location[];
  vehicleClasses: VehicleClass[];
  existingMatrix: PriceMatrix[];
  onSave: (rows: any[]) => void;
  onClose: () => void;
}) {
  const [fromId,      setFromId]      = useState('');
  const [vcIds,       setVcIds]       = useState<string[]>([]);
  const [defaultDisc, setDefaultDisc] = useState('10');
  const [prices, setPrices] = useState<Record<string, { price: string; disc: string }>>({});

  const destinations = useMemo(
    () => locations.filter((l) => l.id !== fromId),
    [locations, fromId],
  );

  // Bölge → oteller gruplaması. Bölge satırı da bir destinasyondur (from değilse).
  const grouped = useMemo(() => {
    const airports = destinations.filter((l) => l.type === 'airport');
    const hotels   = destinations.filter((l) => l.type === 'hotel');
    const others   = destinations.filter((l) => !['airport', 'region', 'hotel'].includes(l.type));
    const regionIds = new Set(locations.filter((l) => l.type === 'region').map((l) => l.id));

    const regionGroups = locations
      .filter((l) => l.type === 'region')
      .map((r) => ({
        region:   r,
        isDest:   r.id !== fromId,             // bölgenin kendisi hedef olabilir mi
        children: hotels.filter((h) => h.regionId === r.id),
      }))
      .filter((g) => g.isDest || g.children.length);

    // Bölgesi olmayan (veya bölgesi listede olmayan) oteller
    const orphanHotels = hotels.filter((h) => !h.regionId || !regionIds.has(h.regionId));
    return { airports, regionGroups, orphanHotels, others };
  }, [destinations, locations, fromId]);

  // Mevcut fiyatları pre-fill et — çoklu seçimde İLK araç sınıfı baz alınır
  const prefill = (newFromId: string, baseVcId?: string) => {
    if (!newFromId || !baseVcId) return setPrices({});
    const filled: Record<string, { price: string; disc: string }> = {};
    existingMatrix.forEach((pm) => {
      if (pm.fromLocation.id === newFromId && pm.vehicleClass.id === baseVcId) {
        filled[pm.toLocation.id] = { price: String(pm.basePrice), disc: String(pm.returnDiscount) };
      }
    });
    setPrices(filled);
  };

  const handleFrom = (id: string) => { setFromId(id); prefill(id, vcIds[0]); };
  const toggleVc = (id: string) => {
    setVcIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      prefill(fromId, next[0]);
      return next;
    });
  };

  // Belirli satırlara fiyat uygula (grup veya tümü)
  const applyTo = (ids: string[], value: string) =>
    setPrices((p) => {
      const next = { ...p };
      ids.forEach((id) => {
        next[id] = { price: value, disc: next[id]?.disc ?? defaultDisc };
      });
      return next;
    });

  const setPrice = (id: string, price: string) =>
    setPrices((p) => ({ ...p, [id]: { disc: p[id]?.disc ?? defaultDisc, price } }));
  const setDisc = (id: string, disc: string) =>
    setPrices((p) => ({ ...p, [id]: { price: p[id]?.price ?? '', disc } }));

  const hasPrice = (id: string) => !!prices[id]?.price && Number(prices[id].price) > 0;

  const handleSave = () => {
    const rows = destinations
      .filter((l) => hasPrice(l.id))
      .flatMap((l) =>
        vcIds.map((vcId) => ({
          fromLocationId: fromId,
          toLocationId:   l.id,
          vehicleClassId: vcId,
          basePrice:      Number(prices[l.id].price),
          returnDiscount: Number(prices[l.id]?.disc ?? defaultDisc),
          isActive:       true,
        })),
      );
    if (!rows.length) return;
    onSave(rows);
  };

  const ready       = !!fromId && vcIds.length > 0;
  const filledCount = destinations.filter((l) => hasPrice(l.id)).length;
  const rowCount    = filledCount * vcIds.length;

  // Tek destinasyon satırı (bileşen değil düz fonksiyon → input focus kaybolmaz)
  const renderRow = (l: Location, indent = false) => (
    <tr key={l.id} className={`border-b border-gray-100 ${hasPrice(l.id) ? 'bg-green-50/40' : ''}`}>
      <td className={`px-4 py-2 ${indent ? 'pl-10' : ''}`}>
        <LocationCell name={l.name} type={l.type} />
      </td>
      <td className="px-4 py-2">
        <input type="number" min={0} placeholder="—" className="input py-1 text-sm w-32"
          value={prices[l.id]?.price ?? ''} onChange={(e) => setPrice(l.id, e.target.value)} />
      </td>
      <td className="px-4 py-2">
        <input type="number" min={0} max={100} placeholder={defaultDisc} className="input py-1 text-sm w-20"
          value={prices[l.id]?.disc ?? ''} onChange={(e) => setDisc(l.id, e.target.value)} />
      </td>
    </tr>
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="font-semibold text-gray-900">Toplu Fiyat Girişi</h2>
        <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">✕ Kapat</button>
      </div>

      <div className="p-4 space-y-4">
        {/* Seçiciler */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nereden</label>
            <select className="input" value={fromId} onChange={(e) => handleFrom(e.target.value)}>
              <option value="">Lokasyon seçin…</option>
              {['airport', 'region', 'hotel', 'port', 'city'].map((t) => {
                const opts = locations.filter((l) => l.type === t);
                if (!opts.length) return null;
                const s = typeStyle(t);
                return (
                  <optgroup key={t} label={`${s.icon} ${s.label}`}>
                    {opts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div>
            <label className="label">Varsayılan Dönüş İndirimi (%)</label>
            <input type="number" className="input" min={0} max={100} value={defaultDisc}
              onChange={(e) => setDefaultDisc(e.target.value)} />
          </div>
        </div>

        {/* Araç sınıfı — çoklu seçim */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0">
              Araç Sınıfı <span className="font-normal normal-case text-gray-400">(çoklu seçim)</span>
            </label>
            <div className="flex gap-3 text-xs">
              <button type="button" className="text-blue-600 hover:underline"
                onClick={() => { const all = vehicleClasses.map((v) => v.id); setVcIds(all); prefill(fromId, all[0]); }}>
                Tümünü seç
              </button>
              <button type="button" className="text-gray-400 hover:underline"
                onClick={() => { setVcIds([]); setPrices({}); }}>
                Temizle
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {vehicleClasses.map((v) => {
              const on = vcIds.includes(v.id);
              return (
                <button key={v.id} type="button" onClick={() => toggleVc(v.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                  }`}>
                  {on ? '✓ ' : ''}{v.name}
                </button>
              );
            })}
          </div>
          {vcIds.length > 1 && (
            <p className="mt-1.5 text-xs text-amber-600">
              ⚠️ Girilen fiyatlar seçili {vcIds.length} araç sınıfının hepsine aynı şekilde uygulanır.
            </p>
          )}
        </div>

        {ready && (
          <>
            {/* Hızlı doldur + legend */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 px-4 py-2.5 text-sm">
              <span className="text-gray-500">Tümüne uygula:</span>
              <input
                type="number" placeholder="Fiyat" min={0}
                className="input py-1 w-28 text-sm"
                onBlur={(e) => { if (e.target.value) { applyTo(destinations.map((l) => l.id), e.target.value); e.target.value = ''; } }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const el = e.target as HTMLInputElement;
                    applyTo(destinations.map((l) => l.id), el.value); el.value = '';
                  }
                }}
              />
              <TypeLegend />
              <span className="ml-auto text-xs font-medium text-blue-600">
                {filledCount} / {destinations.length} doldu
              </span>
            </div>

            {/* Destinasyon tablosu — bölgeye göre gruplu */}
            <div className="max-h-[460px] overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr className="border-b border-gray-200 text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">Nereye</th>
                    <th className="px-4 py-2.5 text-left font-medium w-36">Fiyat (₺)</th>
                    <th className="px-4 py-2.5 text-left font-medium w-56">Dönüş İnd. (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Havalimanları */}
                  {grouped.airports.map((l) => renderRow(l))}

                  {/* Bölgeler + altındaki oteller */}
                  {grouped.regionGroups.map((g) => (
                    <Fragment key={g.region.id}>
                      <tr className="border-b border-amber-200 bg-amber-50/60">
                        <td className="px-4 py-2">
                          <LocationCell name={g.region.name} type="region" />
                          {g.children.length > 0 && (
                            <span className="ml-2 text-xs text-gray-500">{g.children.length} otel</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {g.isDest ? (
                            <input type="number" min={0} placeholder="—" className="input py-1 text-sm w-32"
                              value={prices[g.region.id]?.price ?? ''}
                              onChange={(e) => setPrice(g.region.id, e.target.value)} />
                          ) : <span className="text-xs text-gray-400">kalkış noktası</span>}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {g.isDest && (
                              <input type="number" min={0} max={100} placeholder={defaultDisc}
                                className="input py-1 text-sm w-20"
                                value={prices[g.region.id]?.disc ?? ''}
                                onChange={(e) => setDisc(g.region.id, e.target.value)} />
                            )}
                            {g.children.length > 0 && (
                              <button type="button"
                                title="Bu bölgedeki tüm otellere aynı fiyatı uygula"
                                onClick={() => applyTo(g.children.map((h) => h.id), prices[g.region.id]?.price ?? '')}
                                className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50">
                                ↓ otellere uygula
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {g.children.map((h) => renderRow(h, true))}
                    </Fragment>
                  ))}

                  {/* Bölgesi atanmamış oteller */}
                  {grouped.orphanHotels.length > 0 && (
                    <Fragment>
                      <tr className="border-b border-gray-200 bg-gray-100">
                        <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-gray-500">
                          🏨 Bölgesi atanmamış oteller ({grouped.orphanHotels.length}) —
                          <span className="font-normal"> Lokasyonlar sayfasından “Bağlı Bölge” seçebilirsiniz</span>
                        </td>
                      </tr>
                      {grouped.orphanHotels.map((h) => renderRow(h, true))}
                    </Fragment>
                  )}

                  {/* Diğer türler */}
                  {grouped.others.map((l) => renderRow(l))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={rowCount === 0}
                className="btn btn-primary py-1.5 px-5 text-sm disabled:opacity-50"
              >
                {rowCount} Fiyatı Kaydet
              </button>
              <button onClick={onClose} className="btn btn-outline py-1.5 px-4 text-sm">İptal</button>
              <span className="text-xs text-gray-400">
                {filledCount} güzergah × {vcIds.length} araç sınıfı · boş satırlar atlanır
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tekil Fiyat Satırı ───────────────────────────────────────────────────────
function PriceRow({ row, locations, vehicleClasses, onSave, onDelete, selected, onSelect }: {
  row: PriceMatrix | { fromLocationId: string; toLocationId: string; vehicleClassId: string; basePrice: number; returnDiscount: number };
  locations: Location[]; vehicleClasses: VehicleClass[];
  onSave: (data: any) => void; onDelete?: () => void;
  selected?: boolean; onSelect?: (v: boolean) => void;
}) {
  const isNew = !('id' in row);
  const [edit, setEdit] = useState(isNew);
  const [form, setForm] = useState({
    fromLocationId: 'fromLocation' in row ? row.fromLocation.id : (row as any).fromLocationId,
    toLocationId:   'toLocation'   in row ? row.toLocation.id   : (row as any).toLocationId,
    vehicleClassId: 'vehicleClass' in row ? row.vehicleClass.id : (row as any).vehicleClassId,
    basePrice:      Number(row.basePrice),
    returnDiscount: Number(row.returnDiscount),
    isActive:       'isActive' in row ? row.isActive : true,
  });

  if (!edit && 'id' in row) return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}>
      <td className="px-3 py-2.5">
        <input type="checkbox" checked={!!selected} onChange={(e) => onSelect?.(e.target.checked)} />
      </td>
      <td className="px-4 py-2.5">
        <LocationCell name={row.fromLocation.name} type={row.fromLocation.type} />
      </td>
      <td className="px-4 py-2.5">
        <LocationCell name={row.toLocation.name} type={row.toLocation.type} />
      </td>
      <td className="px-4 py-2.5">{row.vehicleClass.name}</td>
      <td className="px-4 py-2.5 font-medium">{Number(row.basePrice).toLocaleString('tr-TR')} ₺</td>
      <td className="px-4 py-2.5">%{row.returnDiscount}</td>
      <td className="px-4 py-2.5">
        <span className={row.isActive ? 'badge badge-green' : 'badge badge-gray'}>
          {row.isActive ? 'Aktif' : 'Pasif'}
        </span>
      </td>
      <td className="px-4 py-2.5 flex gap-2">
        <button onClick={() => setEdit(true)} className="text-xs text-blue-600 hover:underline">Düzenle</button>
        {onDelete && <button onClick={onDelete} className="text-xs text-red-500 hover:underline">Sil</button>}
      </td>
    </tr>
  );

  return (
    <tr className="border-b border-gray-100 bg-blue-50/30">
      <td className="px-3 py-1.5" />
      <td className="px-2 py-1.5">
        <select className="input py-1 text-xs" value={form.fromLocationId}
          onChange={(e) => setForm((f) => ({ ...f, fromLocationId: e.target.value }))}>
          <option value="">—</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <select className="input py-1 text-xs" value={form.toLocationId}
          onChange={(e) => setForm((f) => ({ ...f, toLocationId: e.target.value }))}>
          <option value="">—</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <select className="input py-1 text-xs" value={form.vehicleClassId}
          onChange={(e) => setForm((f) => ({ ...f, vehicleClassId: e.target.value }))}>
          <option value="">—</option>
          {vehicleClasses.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input type="number" className="input py-1 text-xs w-24" value={form.basePrice}
          onChange={(e) => setForm((f) => ({ ...f, basePrice: Number(e.target.value) }))} />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" className="input py-1 text-xs w-16" value={form.returnDiscount} min={0} max={100}
          onChange={(e) => setForm((f) => ({ ...f, returnDiscount: Number(e.target.value) }))} />
      </td>
      <td className="px-2 py-1.5">
        <input type="checkbox" checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
      </td>
      <td className="px-2 py-1.5 flex gap-2">
        <button onClick={() => { onSave(form); if (!isNew) setEdit(false); }}
          className="text-xs text-green-600 font-medium hover:underline">Kaydet</button>
        {!isNew && <button onClick={() => setEdit(false)} className="text-xs text-gray-400 hover:underline">İptal</button>}
      </td>
    </tr>
  );
}

// ─── Araç Sınıfı Formu ────────────────────────────────────────────────────────
// Eski key'lerin görüntülenmesi için geriye dönük uyumluluk haritası
const LEGACY_LABELS: Record<string, string> = {
  water: '💧 İçme Suyu', wifi: '📶 Wi-Fi', child_seat: '🪑 Çocuk Koltuğu', luggage: '🧳 Ekstra Bagaj',
};
// Hızlı seçim için hazır özellikler (bunlar artık doğrudan display string olarak saklanır)
const FEATURE_PRESETS = ['💧 İçme Suyu', '📶 Wi-Fi', '🪑 Çocuk Koltuğu', '🧳 Ekstra Bagaj', '❄️ Klima', '♿ Engelli Erişimi', '🐾 Evcil Hayvan'];

function featureLabel(f: string) { return LEGACY_LABELS[f] ?? f; }

function VehicleClassForm({ initial, onSave, onCancel }: { initial?: VehicleClass; onSave: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name:            initial?.name            ?? '',
    nameEn:          initial?.nameEn          ?? '',
    capacity:        initial?.capacity        ?? 4,
    luggageCapacity: initial?.luggageCapacity ?? 2,
    isShared:        initial?.isShared        ?? false,
    features:        initial?.features        ?? [] as string[],
    imageUrl:        initial?.imageUrl        ?? '',
    isActive:        initial?.isActive        ?? true,
  });
  const [customInput, setCustomInput] = useState('');
  const [uploading, setUploading]     = useState(false);
  const [uploadErr, setUploadErr]     = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // aynı dosya tekrar seçilebilsin
    if (!file) return;
    setUploadErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post<{ url: string }>('/admin/vehicle-classes/upload', fd);
      setForm((p) => ({ ...p, imageUrl: data.url }));
    } catch (err: any) {
      setUploadErr(err?.response?.data?.error ?? err?.message ?? 'Yükleme başarısız');
    } finally {
      setUploading(false);
    }
  };

  const displayOf  = (f: string) => featureLabel(f);
  const hasFeature = (label: string) =>
    form.features.some((f) => f === label || featureLabel(f) === label);
  const removeFeature = (label: string) =>
    setForm((p) => ({ ...p, features: p.features.filter((f) => f !== label && featureLabel(f) !== label) }));
  const addFeature = (label: string) => {
    if (!label.trim() || hasFeature(label)) return;
    setForm((p) => ({ ...p, features: [...p.features, label.trim()] }));
  };
  const handleCustomAdd = () => { addFeature(customInput); setCustomInput(''); };

  const availablePresets = FEATURE_PRESETS.filter((p) => !hasFeature(p));

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Araç Adı (TR)</label>
          <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></div>
        <div><label className="label">Araç Adı (EN)</label>
          <input className="input" value={form.nameEn} onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))} /></div>
        <div><label className="label">Maks. Yolcu</label>
          <input type="number" className="input" min={1} max={50} value={form.capacity}
            onChange={(e) => setForm((p) => ({ ...p, capacity: Number(e.target.value) }))} /></div>
        <div><label className="label">Bagaj Kapasitesi</label>
          <input type="number" className="input" min={0} max={20} value={form.luggageCapacity}
            onChange={(e) => setForm((p) => ({ ...p, luggageCapacity: Number(e.target.value) }))} /></div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="size-4 rounded" checked={form.isShared}
            onChange={(e) => setForm((p) => ({ ...p, isShared: e.target.checked }))} />
          <span className="text-sm font-medium text-gray-700">Paylaşımlı (Shuttle) — kişi başı fiyat</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="size-4 rounded" checked={form.isActive}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
          <span className="text-sm text-gray-700">Aktif</span>
        </label>
      </div>

      {/* Araç Görseli — dosya yükleme */}
      <div>
        <label className="label">Araç Görseli</label>
        <div className="flex items-start gap-4">
          {form.imageUrl.trim() ? (
            <img
              key={form.imageUrl}
              src={form.imageUrl}
              alt="Önizleme"
              className="h-20 w-28 shrink-0 rounded-lg object-cover border border-gray-200 bg-gray-50"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            />
          ) : (
            <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-2xl text-gray-300">🚐</div>
          )}
          <div className="flex flex-col gap-2">
            <label className={`btn btn-outline py-1.5 px-4 text-sm cursor-pointer w-fit ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? '⏳ Yükleniyor…' : (form.imageUrl.trim() ? '🔄 Görseli Değiştir' : '📤 Resim Yükle')}
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
            {form.imageUrl.trim() && (
              <button type="button" onClick={() => setForm((p) => ({ ...p, imageUrl: '' }))}
                className="text-xs text-red-500 hover:underline text-left">Görseli kaldır</button>
            )}
            <p className="text-xs text-gray-400">JPG, PNG, WebP · en fazla 5 MB</p>
          </div>
        </div>
        {uploadErr && <p className="mt-1 text-xs text-red-500">⚠ {uploadErr}</p>}
      </div>

      {/* Özellikler */}
      <div className="space-y-2">
        <label className="label">Özellikler</label>

        {/* Seçili özellikler (kaldırılabilir chip'ler) */}
        {form.features.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.features.map((f) => (
              <span key={f} className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                {displayOf(f)}
                <button type="button" onClick={() => removeFeature(f)}
                  className="ml-0.5 rounded-full hover:bg-blue-700 leading-none px-0.5">✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Hazır özellikler — henüz eklenmemiş olanlar */}
        {availablePresets.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-gray-400">Hızlı ekle:</p>
            <div className="flex flex-wrap gap-1.5">
              {availablePresets.map((p) => (
                <button key={p} type="button" onClick={() => addFeature(p)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  + {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Özel özellik girişi */}
        <div className="flex gap-2 pt-1">
          <input
            className="input flex-1 text-sm py-1.5"
            placeholder="Özel özellik gir (ör. 🎵 Müzik Sistemi)"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCustomAdd())}
          />
          <button type="button" onClick={handleCustomAdd}
            disabled={!customInput.trim() || hasFeature(customInput)}
            className="btn btn-outline py-1.5 px-3 text-sm disabled:opacity-40">
            Ekle
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => onSave({ ...form, imageUrl: form.imageUrl.trim() || null, ...(initial ? { id: initial.id } : {}) })}
          className="btn btn-primary py-1.5 px-4 text-sm">Kaydet</button>
        <button type="button" onClick={onCancel} className="btn btn-outline py-1.5 px-4 text-sm">İptal</button>
      </div>
    </div>
  );
}

// ─── Ek Ücret Formu ───────────────────────────────────────────────────────────
function SurchargeForm({ initial, onSave, onCancel }: {
  initial?: Surcharge; onSave: (d: any) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name:       initial?.name       ?? '',
    multiplier: Number(initial?.multiplier ?? 1.2),
    startHour:  initial?.startHour  != null ? String(initial.startHour)  : '',
    endHour:    initial?.endHour    != null ? String(initial.endHour)    : '',
    startDate:  initial?.startDate  ? initial.startDate.slice(0, 10) : '',
    endDate:    initial?.endDate    ? initial.endDate.slice(0, 10)   : '',
    isActive:   initial?.isActive   ?? true,
  });
  const set = (k: keyof typeof form, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    const payload: any = {
      name:       form.name,
      multiplier: Number(form.multiplier),
      isActive:   form.isActive,
      startHour:  form.startHour !== '' ? Number(form.startHour) : null,
      endHour:    form.endHour   !== '' ? Number(form.endHour)   : null,
      startDate:  form.startDate || null,
      endDate:    form.endDate   || null,
    };
    if (initial) payload.id = initial.id;
    onSave(payload);
  };

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Ad *</label>
          <input className="input" value={form.name} placeholder="ör. Gece Zammı"
            onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Çarpan * <span className="font-normal text-gray-400">(1.2 = %20 zam)</span></label>
          <input type="number" step="0.05" min={0.1} max={10} className="input" value={form.multiplier}
            onChange={(e) => set('multiplier', e.target.value)} required />
        </div>
        <div>
          <label className="label">Başlangıç Saati <span className="font-normal text-gray-400">(0–23)</span></label>
          <input type="number" min={0} max={23} className="input" value={form.startHour} placeholder="—"
            onChange={(e) => set('startHour', e.target.value)} />
        </div>
        <div>
          <label className="label">Bitiş Saati <span className="font-normal text-gray-400">(0–23)</span></label>
          <input type="number" min={0} max={23} className="input" value={form.endHour} placeholder="—"
            onChange={(e) => set('endHour', e.target.value)} />
        </div>
        <div>
          <label className="label">Başlangıç Tarihi</label>
          <input type="date" className="input" value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)} />
        </div>
        <div>
          <label className="label">Bitiş Tarihi</label>
          <input type="date" className="input" value={form.endDate}
            onChange={(e) => set('endDate', e.target.value)} />
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="size-4 rounded" checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)} />
        <span className="text-sm text-gray-700">Aktif</span>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={handleSave}
          className="btn btn-primary py-1.5 px-4 text-sm">Kaydet</button>
        <button type="button" onClick={onCancel}
          className="btn btn-outline py-1.5 px-4 text-sm">İptal</button>
      </div>
    </div>
  );
}

// ─── Çocuk Fiyat Kuralı Formu ────────────────────────────────────────────────
function ChildPriceRuleForm({ initial, onSave, onCancel }: {
  initial?: ChildPriceRule; onSave: (d: any) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    label:           initial?.label           ?? 'Çocuk (0-12 yaş)',
    maxAge:          initial?.maxAge          ?? 12,
    discountPercent: initial?.discountPercent ?? 100,
    isActive:        initial?.isActive        ?? true,
  });
  const set = (k: keyof typeof form, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-3 rounded-xl border border-green-200 bg-green-50/30 p-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 sm:col-span-1">
          <label className="label">Kural Adı *</label>
          <input className="input" value={form.label} placeholder="ör. Çocuk (0-12 yaş)"
            onChange={(e) => set('label', e.target.value)} required />
        </div>
        <div>
          <label className="label">Max Yaş *</label>
          <input type="number" min={0} max={17} className="input" value={form.maxAge}
            onChange={(e) => set('maxAge', Number(e.target.value))} required />
          <p className="mt-0.5 text-xs text-gray-400">0'dan bu yaşa kadar kural geçerli</p>
        </div>
        <div>
          <label className="label">İndirim % * <span className="font-normal text-gray-400">(100 = ücretsiz)</span></label>
          <input type="number" min={0} max={100} className="input" value={form.discountPercent}
            onChange={(e) => set('discountPercent', Number(e.target.value))} required />
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="size-4 rounded" checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)} />
        <span className="text-sm text-gray-700">Aktif</span>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => onSave(form)}
          className="btn btn-primary py-1.5 px-4 text-sm">Kaydet</button>
        <button type="button" onClick={onCancel}
          className="btn btn-outline py-1.5 px-4 text-sm">İptal</button>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────────
export function PricingPage() {
  const qc = useQueryClient();
  const [showNewRow,  setShowNewRow]  = useState(false);
  const [showBulk,    setShowBulk]    = useState(false);
  const [editingVC,   setEditingVC]   = useState<string | null>(null);
  const [showNewVC,   setShowNewVC]   = useState(false);
  const [showNewSur,  setShowNewSur]  = useState(false);
  const [editingSur,  setEditingSur]  = useState<string | null>(null);
  const [showNewCPR,  setShowNewCPR]  = useState(false);
  const [editingCPR,  setEditingCPR]  = useState<string | null>(null);
  const [activeTab,   setActiveTab]   = useState<'matrix' | 'vehicles' | 'surcharges' | 'child-prices'>('matrix');
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [bulkMultiply, setBulkMultiply] = useState('');
  const [bulkDisc,     setBulkDisc]    = useState('');
  const [filterFrom,   setFilterFrom]  = useState('');
  const [filterVC,     setFilterVC]    = useState('');

  const { data: locData } = useQuery({
    queryKey: ['admin', 'locations'],
    queryFn:  () => api.get<{ locations: Location[] }>('/admin/locations').then((r) => r.data),
  });
  const { data: vcData } = useQuery({
    queryKey: ['admin', 'vehicle-classes'],
    queryFn:  () => api.get<{ vehicleClasses: VehicleClass[] }>('/admin/vehicle-classes').then((r) => r.data),
  });
  const { data: pmData, isLoading: pmLoading } = useQuery({
    queryKey: ['admin', 'price-matrix'],
    queryFn:  () => api.get<{ priceMatrix: PriceMatrix[] }>('/admin/price-matrix').then((r) => r.data),
  });
  const { data: surData } = useQuery({
    queryKey: ['admin', 'surcharges'],
    queryFn:  () => api.get<{ surcharges: Surcharge[] }>('/admin/surcharges').then((r) => r.data),
  });
  const { data: cprData } = useQuery({
    queryKey: ['admin', 'child-price-rules'],
    queryFn:  () => api.get<{ rules: ChildPriceRule[] }>('/admin/child-price-rules').then((r) => r.data),
  });

  const upsertPM = useMutation({
    mutationFn: (data: any) => api.put('/admin/price-matrix', data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin', 'price-matrix'] }); qc.invalidateQueries({ queryKey: ['routes'] }); setShowNewRow(false); },
    onError:    (e: any) => alert(e.response?.data?.error ?? e.message ?? 'Kayıt hatası'),
  });
  const deletePM = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/price-matrix/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'price-matrix'] }),
  });
  const createSur = useMutation({
    mutationFn: (data: any) => api.post('/admin/surcharges', data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin', 'surcharges'] }); setShowNewSur(false); },
    onError:    (e: any) => alert(e.response?.data?.error ?? e.message ?? 'Kayıt hatası'),
  });
  const updateSur = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/admin/surcharges/${id}`, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin', 'surcharges'] }); setEditingSur(null); },
    onError:    (e: any) => alert(e.response?.data?.error ?? e.message ?? 'Kayıt hatası'),
  });
  const deleteSur = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/surcharges/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'surcharges'] }),
  });
  const createCPR = useMutation({
    mutationFn: (data: any) => api.post('/admin/child-price-rules', data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin', 'child-price-rules'] }); setShowNewCPR(false); },
    onError:    (e: any) => alert(e.response?.data?.error ?? e.message ?? 'Kayıt hatası'),
  });
  const updateCPR = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/admin/child-price-rules/${id}`, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin', 'child-price-rules'] }); setEditingCPR(null); },
    onError:    (e: any) => alert(e.response?.data?.error ?? e.message ?? 'Kayıt hatası'),
  });
  const deleteCPR = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/child-price-rules/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'child-price-rules'] }),
  });
  const upsertVC = useMutation({
    mutationFn: (data: any) => data.id
      ? api.patch(`/admin/vehicle-classes/${data.id}`, data)
      : api.post('/admin/vehicle-classes', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'vehicle-classes'] }); setShowNewVC(false); setEditingVC(null); },
  });
  const deleteVC = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/vehicle-classes/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'vehicle-classes'] }),
  });

  const locations       = locData?.locations     ?? [];
  const vehicleClasses  = vcData?.vehicleClasses ?? [];
  const priceMatrix     = pmData?.priceMatrix    ?? [];
  const surcharges      = surData?.surcharges    ?? [];
  const childPriceRules = cprData?.rules         ?? [];

  // Filtreli matris
  const filteredMatrix = useMemo(() => priceMatrix.filter((r) => {
    if (filterFrom && r.fromLocation.id !== filterFrom) return false;
    if (filterVC   && r.vehicleClass.id !== filterVC)   return false;
    return true;
  }), [priceMatrix, filterFrom, filterVC]);

  // Toplu işlemler
  const handleBulkDelete = async () => {
    if (!confirm(`${selected.size} fiyat silinsin mi?`)) return;
    await Promise.all([...selected].map((id) => api.delete(`/admin/price-matrix/${id}`)));
    qc.invalidateQueries({ queryKey: ['admin', 'price-matrix'] });
    setSelected(new Set());
  };

  const handleBulkMultiply = async () => {
    const factor = Number(bulkMultiply);
    if (!factor || factor <= 0) return;
    const targets = priceMatrix.filter((r) => selected.has(r.id));
    await Promise.all(targets.map((r) =>
      api.put('/admin/price-matrix', {
        fromLocationId: r.fromLocation.id, toLocationId: r.toLocation.id,
        vehicleClassId: r.vehicleClass.id,
        basePrice: Math.round(r.basePrice * factor),
        returnDiscount: r.returnDiscount, isActive: r.isActive,
      })
    ));
    qc.invalidateQueries({ queryKey: ['admin', 'price-matrix'] });
    setBulkMultiply(''); setSelected(new Set());
  };

  const handleBulkDisc = async () => {
    const disc = Number(bulkDisc);
    if (isNaN(disc) || disc < 0 || disc > 100) return;
    const targets = priceMatrix.filter((r) => selected.has(r.id));
    await Promise.all(targets.map((r) =>
      api.put('/admin/price-matrix', {
        fromLocationId: r.fromLocation.id, toLocationId: r.toLocation.id,
        vehicleClassId: r.vehicleClass.id,
        basePrice: r.basePrice, returnDiscount: disc, isActive: r.isActive,
      })
    ));
    qc.invalidateQueries({ queryKey: ['admin', 'price-matrix'] });
    setBulkDisc(''); setSelected(new Set());
  };

  const handleBulkSave = async (rows: any[]) => {
    await Promise.all(rows.map((r) => api.put('/admin/price-matrix', r)));
    qc.invalidateQueries({ queryKey: ['admin', 'price-matrix'] });
    setShowBulk(false);
  };

  const allVisibleIds = filteredMatrix.map((r) => r.id);
  const allSelected   = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const toggleAll     = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allVisibleIds));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Fiyatlandırma</h1>

      {/* Sekmeler */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['matrix', 'Fiyat Matrisi'], ['vehicles', 'Araç Sınıfları'], ['surcharges', 'Ek Ücretler'], ['child-prices', '👶 Çocuk Fiyatları']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Fiyat Matrisi ─────────────────────────────────────────────────────── */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">

          {/* Toplu fiyat paneli */}
          {showBulk && (
            <BulkPanel
              locations={locations}
              vehicleClasses={vehicleClasses}
              existingMatrix={priceMatrix}
              onSave={handleBulkSave}
              onClose={() => setShowBulk(false)}
            />
          )}

          <div className="card overflow-hidden">
            {/* Başlık + butonlar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
              <h2 className="font-semibold text-gray-900 mr-2">Güzergah Fiyatları ({filteredMatrix.length}/{priceMatrix.length})</h2>
              <div className="flex gap-2 ml-auto">
                <button className="btn btn-outline py-1 px-3 text-xs" onClick={() => { setShowBulk((v) => !v); setShowNewRow(false); }}>
                  {showBulk ? '✕ Toplu Giriş' : '⚡ Toplu Fiyat Gir'}
                </button>
                <button className="btn btn-primary py-1 px-3 text-xs" onClick={() => { setShowNewRow(true); setShowBulk(false); }}>
                  + Tekil Ekle
                </button>
              </div>
            </div>

            {/* Filtreler */}
            <div className="flex gap-3 border-b border-gray-100 px-5 py-2.5 bg-gray-50/50">
              <select className="input py-1 text-xs" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setSelected(new Set()); }}>
                <option value="">Tüm çıkışlar</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select className="input py-1 text-xs" value={filterVC} onChange={(e) => { setFilterVC(e.target.value); setSelected(new Set()); }}>
                <option value="">Tüm araçlar</option>
                {vehicleClasses.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              {(filterFrom || filterVC) && (
                <button onClick={() => { setFilterFrom(''); setFilterVC(''); setSelected(new Set()); }}
                  className="text-xs text-gray-400 hover:text-gray-600">✕ Temizle</button>
              )}
            </div>

            {/* Toplu işlem çubuğu */}
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2.5">
                <span className="text-sm font-medium text-amber-800">{selected.size} satır seçildi</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-600">Fiyat çarpanı:</span>
                  <input type="number" step="0.1" min="0.1" placeholder="ör. 1.2" className="input py-1 text-xs w-20"
                    value={bulkMultiply} onChange={(e) => setBulkMultiply(e.target.value)} />
                  <button onClick={handleBulkMultiply} disabled={!bulkMultiply}
                    className="btn btn-outline py-1 px-2 text-xs disabled:opacity-40">Uygula</button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-600">Dönüş indirimi %:</span>
                  <input type="number" min="0" max="100" placeholder="ör. 10" className="input py-1 text-xs w-20"
                    value={bulkDisc} onChange={(e) => setBulkDisc(e.target.value)} />
                  <button onClick={handleBulkDisc} disabled={bulkDisc === ''}
                    className="btn btn-outline py-1 px-2 text-xs disabled:opacity-40">Uygula</button>
                </div>
                <button onClick={handleBulkDelete}
                  className="ml-auto text-xs text-red-600 hover:underline font-medium">
                  Seçilenleri Sil
                </button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:underline">İptal</button>
              </div>
            )}

            {/* Tablo */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                    <th className="px-3 py-3">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                    </th>
                    {['Nereden', 'Nereye', 'Araç', 'Fiyat (₺)', 'Dönüş İnd.', 'Durum', ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {showNewRow && (
                    <PriceRow
                      row={{ fromLocationId: '', toLocationId: '', vehicleClassId: '', basePrice: 0, returnDiscount: 10 }}
                      locations={locations} vehicleClasses={vehicleClasses}
                      onSave={(data) => upsertPM.mutate(data)}
                    />
                  )}
                  {pmLoading
                    ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Yükleniyor…</td></tr>
                    : filteredMatrix.length === 0
                      ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Fiyat bulunamadı</td></tr>
                      : filteredMatrix.map((row) => (
                        <PriceRow key={row.id} row={row}
                          locations={locations} vehicleClasses={vehicleClasses}
                          onSave={(data) => upsertPM.mutate(data)}
                          onDelete={() => { if (confirm('Silinsin mi?')) deletePM.mutate(row.id); }}
                          selected={selected.has(row.id)}
                          onSelect={(v) => setSelected((s) => { const n = new Set(s); v ? n.add(row.id) : n.delete(row.id); return n; })}
                        />
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Araç Sınıfları ──────────────────────────────────────────────────────── */}
      {activeTab === 'vehicles' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Araç Sınıfları ({vehicleClasses.length})</h2>
            <button className="btn btn-primary py-1.5 px-4 text-sm" onClick={() => setShowNewVC(true)}>+ Yeni Araç Sınıfı</button>
          </div>
          {showNewVC && <VehicleClassForm onSave={(d) => upsertVC.mutate(d)} onCancel={() => setShowNewVC(false)} />}
          <div className="space-y-2">
            {vehicleClasses.map((vc) => (
              <div key={vc.id} className="card p-4">
                {editingVC === vc.id ? (
                  <VehicleClassForm initial={vc} onSave={(d) => upsertVC.mutate(d)} onCancel={() => setEditingVC(null)} />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    {vc.imageUrl ? (
                      <img src={vc.imageUrl} alt={vc.name}
                        className="h-14 w-20 shrink-0 rounded-lg object-cover border border-gray-200 bg-gray-50"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                    ) : (
                      <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-lg text-gray-300">🚐</div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">{vc.name}</span>
                        {vc.nameEn && <span className="text-sm text-gray-400">/ {vc.nameEn}</span>}
                        {vc.isShared && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Paylaşımlı</span>}
                        <span className={vc.isActive ? 'badge badge-green' : 'badge badge-gray'}>{vc.isActive ? 'Aktif' : 'Pasif'}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        <span>👥 Max {vc.capacity} kişi</span>
                        <span>🧳 {vc.luggageCapacity} bagaj</span>
                        {vc.features.length > 0 && <span>{vc.features.map((f) => featureLabel(f)).join(' · ')}</span>}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setEditingVC(vc.id)} className="text-sm text-blue-600 hover:underline">Düzenle</button>
                      <button onClick={() => { if (confirm(`"${vc.name}" silinsin mi?`)) deleteVC.mutate(vc.id); }}
                        className="text-sm text-red-500 hover:underline">Sil</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ek Ücretler ─────────────────────────────────────────────────────────── */}
      {activeTab === 'surcharges' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Ek Ücretler ({surcharges.length})</h2>
            <button className="btn btn-primary py-1.5 px-4 text-sm"
              onClick={() => { setShowNewSur(true); setEditingSur(null); }}>
              + Yeni Ek Ücret
            </button>
          </div>

          {showNewSur && (
            <SurchargeForm
              onSave={(d) => createSur.mutate(d)}
              onCancel={() => setShowNewSur(false)}
            />
          )}

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                  {['Ad', 'Çarpan', 'Saat Aralığı', 'Tarih Aralığı', 'Durum', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {surcharges.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Henüz ek ücret tanımlanmamış</td></tr>
                ) : surcharges.map((s) => (
                  <Fragment key={s.id}>
                    {editingSur === s.id ? (
                      <tr key={s.id + '-edit'}>
                        <td colSpan={6} className="px-4 py-3">
                          <SurchargeForm
                            initial={s}
                            onSave={(d) => updateSur.mutate(d)}
                            onCancel={() => setEditingSur(null)}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">
                            ×{Number(s.multiplier).toFixed(2)}
                          </span>
                          <span className="ml-1.5 text-xs text-gray-400">
                            (+{Math.round((Number(s.multiplier) - 1) * 100)}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {s.startHour != null ? `${String(s.startHour).padStart(2,'0')}:00 – ${String(s.endHour).padStart(2,'0')}:00` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {s.startDate ? `${s.startDate.slice(0,10)} – ${s.endDate?.slice(0,10) ?? '?'}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={s.isActive ? 'badge badge-green' : 'badge badge-gray'}>
                            {s.isActive ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3">
                            <button onClick={() => { setEditingSur(s.id); setShowNewSur(false); }}
                              className="text-xs text-blue-600 hover:underline">Düzenle</button>
                            <button onClick={() => { if (confirm(`"${s.name}" silinsin mi?`)) deleteSur.mutate(s.id); }}
                              className="text-xs text-red-500 hover:underline">Sil</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Çocuk Fiyatları ───────────────────────────────────────────────────── */}
      {activeTab === 'child-prices' && (
        <div className="space-y-3">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <div>
                <h2 className="font-semibold text-gray-900">Çocuk Fiyatlandırma Kuralları</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  Tanımlanan yaş aralığındaki çocuklar için indirim oranı. 100% = ücretsiz.
                </p>
              </div>
              <button className="btn btn-primary py-1 px-3 text-xs"
                onClick={() => { setShowNewCPR(true); setEditingCPR(null); }}>
                + Kural Ekle
              </button>
            </div>

            {showNewCPR && (
              <div className="border-b border-gray-100 p-4">
                <ChildPriceRuleForm
                  onSave={(d) => createCPR.mutate(d)}
                  onCancel={() => setShowNewCPR(false)}
                />
              </div>
            )}

            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  {['Kural Adı', 'Max Yaş', 'İndirim', 'Durum', 'İşlem'].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {childPriceRules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-xs">
                      Henüz çocuk fiyat kuralı eklenmemiş. "Kural Ekle" butonuna tıklayın.
                    </td>
                  </tr>
                )}
                {childPriceRules.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.label}</td>
                      <td className="px-4 py-3 text-gray-600">0 – {r.maxAge} yaş</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${r.discountPercent === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                          %{r.discountPercent} indirim
                          {r.discountPercent === 100 && <span className="ml-1 text-xs font-normal text-green-500">(ücretsiz)</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={r.isActive ? 'badge badge-green' : 'badge badge-gray'}>
                          {r.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button onClick={() => { setEditingCPR(r.id); setShowNewCPR(false); }}
                            className="text-xs text-blue-600 hover:underline">Düzenle</button>
                          <button onClick={() => { if (confirm(`"${r.label}" kuralı silinsin mi?`)) deleteCPR.mutate(r.id); }}
                            className="text-xs text-red-500 hover:underline">Sil</button>
                        </div>
                      </td>
                    </tr>
                    {editingCPR === r.id && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3">
                          <ChildPriceRuleForm
                            initial={r}
                            onSave={(d) => updateCPR.mutate({ id: r.id, ...d })}
                            onCancel={() => setEditingCPR(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
