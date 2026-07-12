import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── Sistem Parametreleri ─────────────────────────────────────────────────────

interface SystemSetting {
  key:      string;
  value:    string;
  label:    string;
  updatedAt: string;
}

const NUMERIC_META: Record<string, { label: string; description: string; unit: string; min: number; max: number }> = {
  min_advance_minutes: {
    label:       'Minimum Rezervasyon Öncesi Süre',
    description: 'Rezervasyon transfer saatinden en az bu kadar dakika önce yapılabilir. (Örn: 60 = 1 saat önceye kadar kabul)',
    unit: 'dakika', min: 0, max: 1440,
  },
  cash_confirm_timeout_min: {
    label:       'Araçta Ödeme Onay Süresi',
    description: 'Bu süre içinde admin onaylamazsa araçta ödeme rezervasyonu otomatik iptal edilir.',
    unit: 'dakika', min: 10, max: 1440,
  },
  bank_confirm_timeout_min: {
    label:       'Havale/EFT Onay Süresi',
    description: 'Bu süre içinde admin ödemeyi onaylamazsa havale rezervasyonu otomatik iptal edilir.',
    unit: 'dakika', min: 30, max: 10080,
  },
  slot_hold_timeout_min: {
    label:       'Slot Rezervasyon Bekleme Süresi',
    description: 'Online ödeme başlatıldığında, ödeme tamamlanmadan rezervasyon ne kadar süre tutulacak.',
    unit: 'dakika', min: 5, max: 60,
  },
  vehicle_turnaround_minutes: {
    label:       'Araç Dönüş Süresi (Çakışma Penceresi)',
    description: 'Bir transferin önünde ve arkasında kaç dakikalık süre bloklanacak. Bu pencere içinde aynı araç sınıfına yeni rezervasyon alınmaz.',
    unit: 'dakika', min: 30, max: 720,
  },
};

const TIMEZONES = [
  { value: 'Europe/Istanbul',  label: 'Türkiye (UTC+3)' },
  { value: 'UTC',              label: 'UTC (UTC+0)' },
  { value: 'Europe/London',    label: 'Londra (UTC+0/+1)' },
  { value: 'Europe/Berlin',    label: 'Berlin / Paris (UTC+1/+2)' },
  { value: 'Europe/Moscow',    label: 'Moskova (UTC+3)' },
  { value: 'Asia/Dubai',       label: 'Dubai (UTC+4)' },
  { value: 'Asia/Riyadh',      label: 'Riyad (UTC+3)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
];

function TimezoneRow({ setting }: { setting: SystemSetting }) {
  const qc = useQueryClient();
  const [val, setVal]     = useState(setting.value);
  const [saved, setSaved] = useState(false);

  const mut = useMutation({
    mutationFn: () => api.patch(`/admin/system-settings/${setting.key}`, { value: val }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'system-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const nowSample = new Intl.DateTimeFormat('tr-TR', {
    timeZone: val, hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: 'short', year: 'numeric', hour12: false,
  }).format(new Date());

  return (
    <div className="card p-5">
      <p className="font-medium text-gray-900">Zaman Dilimi</p>
      <p className="mt-0.5 text-sm text-gray-500">Admin paneli header saatinde kullanılan zaman dilimi.</p>
      <p className="mt-1 font-mono text-xs text-gray-400">timezone</p>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <select className="input w-64" value={val}
          onChange={(e) => { setVal(e.target.value); setSaved(false); }}>
          {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
          {!TIMEZONES.find((tz) => tz.value === val) && <option value={val}>{val}</option>}
        </select>
        <button
          className={`btn ${saved ? 'btn-outline text-green-600' : 'btn-primary'} py-1 px-4 text-xs min-w-[80px]`}
          onClick={() => mut.mutate()}
          disabled={mut.isPending || val === setting.value}
        >
          {saved ? '✓ Kaydedildi' : mut.isPending ? '…' : 'Kaydet'}
        </button>
      </div>
      <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Şu an: <span className="font-semibold tabular-nums">{nowSample}</span>
      </div>
      <p className="mt-2 text-xs text-gray-400">Son güncelleme: {new Date(setting.updatedAt).toLocaleString('tr-TR')}</p>
    </div>
  );
}

function NumericRow({ setting }: { setting: SystemSetting }) {
  const qc = useQueryClient();
  const meta = NUMERIC_META[setting.key];
  const [val, setVal]     = useState(setting.value);
  const [saved, setSaved] = useState(false);

  const mut = useMutation({
    mutationFn: () => api.patch(`/admin/system-settings/${setting.key}`, { value: val }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'system-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-gray-900">{meta?.label ?? setting.label ?? setting.key}</p>
          {meta?.description && <p className="mt-0.5 text-sm text-gray-500">{meta.description}</p>}
          <p className="mt-1 font-mono text-xs text-gray-400">{setting.key}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input type="number" className="input w-24 text-right" value={val}
            min={meta?.min} max={meta?.max}
            onChange={(e) => { setVal(e.target.value); setSaved(false); }} />
          {meta?.unit && <span className="text-sm text-gray-500 w-16">{meta.unit}</span>}
          <button
            className={`btn ${saved ? 'btn-outline text-green-600' : 'btn-primary'} py-1 px-3 text-xs min-w-[70px]`}
            onClick={() => mut.mutate()}
            disabled={mut.isPending || val === setting.value}
          >
            {saved ? '✓ Kaydedildi' : mut.isPending ? '…' : 'Kaydet'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">Son güncelleme: {new Date(setting.updatedAt).toLocaleString('tr-TR')}</p>
    </div>
  );
}

// ─── Hero Arka Plan Görseli ───────────────────────────────────────────────────

function HeroImageRow({ current }: { current?: SystemSetting }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [err, setErr]             = useState('');
  const url = current?.value ?? '';

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.post('/admin/settings/hero-image', fd);
      qc.invalidateQueries({ queryKey: ['admin', 'system-settings'] });
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Yükleme başarısız');
    } finally {
      setUploading(false);
    }
  };

  const removeMut = useMutation({
    mutationFn: () => api.patch('/admin/system-settings/hero_image_url', { value: '' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'system-settings'] }),
  });

  return (
    <div className="card p-5">
      <p className="font-medium text-gray-900">Ana Sayfa Hero Arka Plan Görseli</p>
      <p className="mt-0.5 text-sm text-gray-500">Ana sayfanın üst bölümünün tam ekran arka plan görseli.</p>
      <p className="mt-1 font-mono text-xs text-gray-400">hero_image_url</p>

      <div className="mt-3 flex items-start gap-4">
        {url ? (
          <img
            key={url}
            src={url}
            alt="Hero önizleme"
            className="h-24 w-44 shrink-0 rounded-lg object-cover border border-gray-200 bg-gray-50"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          />
        ) : (
          <div className="flex h-24 w-44 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center text-xs text-gray-400">
            <span className="text-2xl">🖼️</span>
            Varsayılan görsel
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label className={`btn btn-outline py-1.5 px-4 text-sm cursor-pointer w-fit ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? '⏳ Yükleniyor…' : (url ? '🔄 Görseli Değiştir' : '📤 Görsel Yükle')}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
          {url && (
            <button type="button" onClick={() => removeMut.mutate()} disabled={removeMut.isPending}
              className="text-xs text-red-500 hover:underline text-left">Varsayılana dön</button>
          )}
        </div>
      </div>

      {/* Görsel önerileri */}
      <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        <p className="font-semibold">💡 İdeal görsel için öneriler</p>
        <p>• <b>Çözünürlük:</b> 1920×1080 (Full HD) idealdir. Çok büyük (4K) sayfayı yavaşlatır, çok küçük görsel bulanıklaşır.</p>
        <p>• <b>Format:</b> Yatay (landscape) fotoğraf. object-cover ile telefon/tablette esnemeden merkezden kırpılır.</p>
        <p>• <b>Kompozisyon:</b> Masaüstünde form sağda durur; ana odak (ör. VIP araç) görselin <b>sol / sol-orta</b> kısmında olursa formun arkasında kalmaz.</p>
        <p className="text-amber-600">Maksimum dosya boyutu 5 MB · JPG, PNG, WebP</p>
      </div>
      {err && <p className="mt-1 text-xs text-red-500">⚠ {err}</p>}
    </div>
  );
}

// ─── Yönetim Ekibi ────────────────────────────────────────────────────────────

type StaffRole = 'ADMIN' | 'OPERATOR';

interface StaffUser {
  id: string; email: string; firstName: string; lastName: string;
  phone: string | null; role: StaffRole; isActive: boolean; createdAt: string;
  _count: { bookings: number };
}

const STAFF_ROLE_LABELS: Record<StaffRole, string> = { ADMIN: 'Admin', OPERATOR: 'Operatör' };
const STAFF_ROLE_BADGE:  Record<StaffRole, string> = { ADMIN: 'badge-red', OPERATOR: 'badge-blue' };

function CreateStaffModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', phone: '', role: 'OPERATOR' as StaffRole,
  });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => api.post('/admin/users', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'staff'] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Hata'),
  });

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Yeni Yönetim Kullanıcısı</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ad</label>
              <input className="input" value={form.firstName} onChange={set('firstName')} />
            </div>
            <div>
              <label className="label">Soyad</label>
              <input className="input" value={form.lastName} onChange={set('lastName')} />
            </div>
          </div>
          <div>
            <label className="label">E-posta</label>
            <input type="email" className="input" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input type="tel" className="input" value={form.phone} onChange={set('phone')} placeholder="+90…" />
          </div>
          <div>
            <label className="label">Şifre</label>
            <input type="password" className="input" value={form.password} onChange={set('password')} />
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}>
              <option value="ADMIN">Admin</option>
              <option value="OPERATOR">Operatör</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditStaffModal({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName:  user.lastName,
    phone:     user.phone ?? '',
    email:     user.email,
  });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => api.patch(`/admin/users/${user.id}/profile`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'staff'] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Hata'),
  });

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Kullanıcı Düzenle</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ad</label>
              <input className="input" value={form.firstName} onChange={set('firstName')} />
            </div>
            <div>
              <label className="label">Soyad</label>
              <input className="input" value={form.lastName} onChange={set('lastName')} />
            </div>
          </div>
          <div>
            <label className="label">E-posta</label>
            <input type="email" className="input" value={form.email} onChange={set('email')}
              disabled={user.id === me?.id} />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input type="tel" className="input" value={form.phone} onChange={set('phone')} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffTab() {
  const qc           = useQueryClient();
  const { user: me } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn:  () =>
      api.get<{ users: StaffUser[] }>('/admin/users', { params: { role: 'ADMIN,OPERATOR' } })
         .then((r) => r.data),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: StaffRole }) =>
      api.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'staff'] }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/users/${id}/active`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'staff'] }),
  });

  const staff = data?.users ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Admin ve Operatör hesaplarını buradan yönetin.</p>
        <button className="btn btn-primary py-1.5 px-4 text-sm" onClick={() => setShowCreate(true)}>
          + Yeni Kullanıcı
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
              {['Ad Soyad', 'E-posta', 'Telefon', 'Rol', 'Durum', 'Kayıt', 'İşlem'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Yükleniyor…</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Henüz yönetim kullanıcısı yok.</td></tr>
            ) : staff.map((u) => (
              <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50 ${u.id === me?.id ? 'bg-blue-50/40' : ''}`}>
                <td className="px-4 py-3 font-medium">
                  {u.firstName} {u.lastName}
                  {u.id === me?.id && <span className="ml-1.5 text-xs text-brand-500">(siz)</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-gray-500">{u.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  {me?.role === 'ADMIN' && u.id !== me.id ? (
                    <select
                      className="rounded border border-gray-200 px-2 py-0.5 text-xs"
                      value={u.role}
                      onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value as StaffRole })}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="OPERATOR">Operatör</option>
                    </select>
                  ) : (
                    <span className={`badge ${STAFF_ROLE_BADGE[u.role]}`}>{STAFF_ROLE_LABELS[u.role]}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={u.isActive ? 'badge badge-green' : 'badge badge-gray'}>
                    {u.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-gray-500 hover:text-brand-600 hover:underline"
                      onClick={() => setEditTarget(u)}
                    >
                      Düzenle
                    </button>
                    {u.id !== me?.id && (
                      <button
                        onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                        className={`text-xs hover:underline ${u.isActive ? 'text-red-500' : 'text-green-600'}`}
                      >
                        {u.isActive ? 'Deaktive' : 'Aktive'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateStaffModal onClose={() => setShowCreate(false)} />}
      {editTarget  && <EditStaffModal  user={editTarget} onClose={() => setEditTarget(null)} />}
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

type Tab = 'settings' | 'staff';

export function SystemSettingsPage() {
  const [tab, setTab] = useState<Tab>('settings');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'system-settings'],
    queryFn:  () => api.get<{ settings: SystemSetting[] }>('/admin/system-settings').then((r) => r.data),
    enabled:  tab === 'settings',
  });

  const settings    = data?.settings ?? [];
  const tzSetting   = settings.find((s) => s.key === 'timezone');
  const heroSetting = settings.find((s) => s.key === 'hero_image_url');
  const numSettings = settings.filter((s) => s.key !== 'timezone');

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'settings', label: 'Sistem Parametreleri', icon: '⚙️' },
    { key: 'staff',    label: 'Yönetim Ekibi',        icon: '👥' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Sistem Ayarları</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sistem parametreleri, zaman dilimi ve yönetim kullanıcıları.
        </p>
      </div>

      {/* Sekme navigasyonu */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sistem Parametreleri */}
      {tab === 'settings' && (
        isLoading ? (
          <div className="text-center text-gray-400 py-12">Yükleniyor…</div>
        ) : (
          <div className="space-y-3">
            <HeroImageRow current={heroSetting} />
            {tzSetting && <TimezoneRow setting={tzSetting} />}
            {numSettings.map((s) =>
              NUMERIC_META[s.key] ? <NumericRow key={s.key} setting={s} /> : null
            )}
            <div className="card p-4 bg-blue-50 border-blue-200">
              <p className="text-sm text-blue-700">
                <span className="font-medium">ℹ️ Otomatik İptal Sistemi:</span> Scheduler her 5 dakikada
                bir kontrol eder. Araçta ödeme veya havale ile yapılan ve admin tarafından onaylanmayan
                rezervasyonlar süre dolunca otomatik iptal edilir.
              </p>
            </div>
          </div>
        )
      )}

      {/* Yönetim Ekibi */}
      {tab === 'staff' && <StaffTab />}
    </div>
  );
}
