import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Integration {
  id: string; service: string; provider: string; isActive: boolean;
  configJson: Record<string, unknown> | null;
  secrets: Record<string, string>;   // maskeli — '••••••••'
  updatedAt: string;
}

const SERVICE_LABELS: Record<string, { label: string; icon: string; provider?: string; providerOptions?: { value: string; label: string }[]; secretFields: string[]; configFields: string[]; configHints?: Record<string, string> }> = {
  paytr:         { label: 'PayTR Ödeme',       icon: '💳', secretFields: ['merchantKey', 'merchantSalt'], configFields: ['merchantId', 'callbackUrl', 'okUrl', 'failUrl', 'testMode'] },
  bank_transfer: { label: 'Havale / EFT',      icon: '🏦', secretFields: [], configFields: ['bankName', 'accountName', 'iban', 'branchCode', 'description'],
    configHints: { iban: 'TR00 0000 0000 0000 0000 0000 00', branchCode: 'Şube kodu (opsiyonel)', description: 'Müşteriye gösterilecek ek not' } },
  // service='flight' (backend getIntegration('flight') bunu arar). Sağlayıcı seçilebilir:
  // aeroDataBox (RapidAPI) veya airlabs. İkisi de tek 'apiKey' secret'i kullanır;
  // flight.service cfg.provider'a göre doğru API'yi çağırır.
  flight:        { label: 'Uçuş Takibi', icon: '✈️', provider: 'aeroDataBox',
    providerOptions: [
      { value: 'aeroDataBox', label: 'AeroDataBox (RapidAPI)' },
      { value: 'airlabs',     label: 'AirLabs' },
    ],
    secretFields: ['apiKey'], configFields: [],
    configHints: { apiKey: 'Seçili sağlayıcının API anahtarı' } },
  netgsm:        { label: 'Netgsm (SMS)',        icon: '📱', secretFields: ['apiKey', 'apiSecret'], configFields: ['sender'] },
  whatsapp:      { label: 'WhatsApp (Meta)',     icon: '💬', secretFields: ['accessToken'], configFields: ['phoneNumberId', 'waBaId'] },
  smtp:          { label: 'E-posta (SMTP)',      icon: '📧', secretFields: ['password'], configFields: ['host', 'port', 'user', 'from'] },
  exchangeRate:  { label: 'Döviz Kuru API',     icon: '💱', secretFields: ['apiKey'], configFields: ['baseCurrency'] },
  osm:           { label: 'Harita (OSM/OSRM)',  icon: '🗺️', secretFields: [], configFields: ['photonUrl', 'osrmUrl', 'nominatimUrl'] },
};

// ─── SMTP Test Bölümü ─────────────────────────────────────────────────────────

function SmtpTestSection() {
  const [email,  setEmail]  = useState('');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mut = useMutation({
    mutationFn: (to: string) =>
      api.post<{ ok: boolean }>('/admin/integrations/smtp/test', { to }).then((r) => r.data),
    onSuccess: () => setResult({ ok: true,  msg: 'Test emaili başarıyla gönderildi!' }),
    onError:   (e: any) => setResult({ ok: false, msg: e?.response?.data?.error ?? e?.message ?? 'Gönderilemedi' }),
  });

  function handleSend() {
    if (!email) { inputRef.current?.focus(); return; }
    setResult(null);
    mut.mutate(email);
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-medium text-gray-500 mb-2">SMTP Bağlantı Testi</p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="email"
          className="input py-1.5 text-sm flex-1 min-w-0"
          placeholder="Test emaili gönderilecek adres…"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setResult(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className="btn btn-outline py-1.5 px-3 text-xs whitespace-nowrap"
          disabled={!email || mut.isPending}
          onClick={handleSend}
        >
          {mut.isPending ? 'Gönderiliyor…' : '📧 Test Gönder'}
        </button>
      </div>
      {result && (
        <p className={`mt-2 text-xs rounded-lg px-3 py-1.5 ${
          result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {result.ok ? '✅' : '❌'} {result.msg}
        </p>
      )}
    </div>
  );
}

// ─── Entegrasyon Kartı ────────────────────────────────────────────────────────

function IntegrationCard({ item, onEdit }: { item: Integration; onEdit: () => void }) {
  const meta = SERVICE_LABELS[item.service] ?? { label: item.service, icon: '🔌', secretFields: [], configFields: [] };
  const hasSecrets = Object.keys(item.secrets).length > 0;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{meta.label}</h3>
            <p className="text-xs text-gray-400">
              {item.service}{('providerOptions' in meta && meta.providerOptions) ? ` · ${item.provider}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={item.isActive ? 'badge badge-green' : 'badge badge-gray'}>
            {item.isActive ? 'Aktif' : 'Pasif'}
          </span>
          <button className="btn btn-outline py-1 px-3 text-xs" onClick={onEdit}>Düzenle</button>
        </div>
      </div>

      {item.configJson && Object.keys(item.configJson).length > 0 && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          {Object.entries(item.configJson).map(([k, v]) => (
            <div key={k} className="flex gap-2 text-xs">
              <span className="text-gray-500 w-28 shrink-0">{k}:</span>
              <span className="font-mono text-gray-700">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {hasSecrets && (
        <div className="mt-2 rounded-lg bg-gray-50 p-3">
          {Object.entries(item.secrets).map(([k, v]) => (
            <div key={k} className="flex gap-2 text-xs">
              <span className="text-gray-500 w-28 shrink-0">{k}:</span>
              <span className="font-mono text-gray-400">{v}</span>
            </div>
          ))}
        </div>
      )}

      {item.service === 'smtp' && item.isActive && <SmtpTestSection />}

      <p className="mt-2 text-xs text-gray-400">
        Son güncelleme: {new Date(item.updatedAt).toLocaleString('tr-TR')}
      </p>
    </div>
  );
}

function EditModal({ item, onClose }: { item: Integration | { service: string }; onClose: () => void }) {
  const qc  = useQueryClient();
  const svc = item.service;
  const meta = SERVICE_LABELS[svc] ?? { secretFields: [], configFields: [] };

  const [isActive, setIsActive] = useState('isActive' in item ? item.isActive : true);
  const [provider, setProvider] = useState('provider' in item ? item.provider : (meta.provider ?? svc));
  const [config,   setConfig]   = useState<Record<string, string>>(() => {
    if ('configJson' in item && item.configJson) {
      return Object.fromEntries(Object.entries(item.configJson).map(([k, v]) => [k, String(v)]));
    }
    return Object.fromEntries(meta.configFields.map((k) => [k, '']));
  });
  const [secrets, setSecrets] = useState<Record<string, string>>(
    Object.fromEntries(meta.secretFields.map((k) => [k, '']))
  );
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => api.put('/admin/integrations', {
      service:  svc,
      provider,
      isActive,
      config:   Object.keys(config).length  > 0 ? config   : undefined,
      secrets:  Object.values(secrets).some(Boolean) ? secrets : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'integrations'] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Hata'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {(SERVICE_LABELS[svc]?.label ?? svc)} Ayarları
        </h2>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="active" className="text-sm text-gray-700">Aktif</label>
          </div>

          {meta.providerOptions && (
            <div>
              <label className="label">Sağlayıcı</label>
              <select className="input" value={provider}
                onChange={(e) => setProvider(e.target.value)}>
                {meta.providerOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Seçtiğiniz sağlayıcının API anahtarını aşağıya girin. Sağlayıcıyı değiştirdiyseniz anahtarı da güncelleyin.
              </p>
            </div>
          )}

          {meta.configFields.map((field) => (
            <div key={field}>
              <label className="label">{field}</label>
              <input className="input" value={config[field] ?? ''}
                placeholder={(meta as any).configHints?.[field] ?? ''}
                onChange={(e) => setConfig((c) => ({ ...c, [field]: e.target.value }))} />
            </div>
          ))}

          {meta.secretFields.length > 0 && (
            <>
              <div className="border-t border-dashed border-gray-200 pt-2">
                <p className="text-xs text-gray-400 mb-2">
                  🔒 Gizli alanlar — boş bırakırsanız mevcut değer korunur
                </p>
                {meta.secretFields.map((field) => (
                  <div key={field} className="mb-3">
                    <label className="label">{field}</label>
                    <input type="password" className="input font-mono"
                      placeholder="••••••••"
                      value={secrets[field] ?? ''}
                      onChange={(e) => setSecrets((s) => ({ ...s, [field]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
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

export function IntegrationsPage() {
  const [editing, setEditing] = useState<Integration | { service: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn:  () => api.get<{ integrations: Integration[] }>('/admin/integrations').then((r) => r.data),
  });

  const integrations = data?.integrations ?? [];
  const configuredServices = new Set(integrations.map((i) => i.service));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Entegrasyonlar</h1>
      <p className="text-sm text-gray-500">
        API anahtarları şifreli olarak veritabanında saklanır. Hiçbir secret değer düz metin olarak döndürülmez.
      </p>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Yükleniyor…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Yapılandırılmış entegrasyonlar */}
          {integrations.map((item) => (
            <IntegrationCard key={item.id} item={item} onEdit={() => setEditing(item)} />
          ))}

          {/* Henüz eklenmemiş servisler */}
          {Object.entries(SERVICE_LABELS)
            .filter(([svc]) => !configuredServices.has(svc))
            .map(([svc, meta]) => (
              <div key={svc} className="card border-dashed p-5 flex items-center gap-4">
                <span className="text-2xl opacity-50">{meta.icon}</span>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-500">{meta.label}</h3>
                  <p className="text-xs text-gray-400">Henüz yapılandırılmadı</p>
                </div>
                <button
                  className="btn btn-outline py-1 px-3 text-xs"
                  onClick={() => setEditing({ service: svc })}
                >
                  Yapılandır
                </button>
              </div>
            ))}
        </div>
      )}

      {editing && <EditModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
