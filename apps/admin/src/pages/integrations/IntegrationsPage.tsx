import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Integration {
  id: string; service: string; provider: string; isActive: boolean;
  configJson: Record<string, unknown> | null;
  secrets: Record<string, string>;   // maskeli — '••••••••'
  updatedAt: string;
}

const SERVICE_LABELS: Record<string, { label: string; icon: string; secretFields: string[]; configFields: string[] }> = {
  paytr:         { label: 'PayTR Ödeme',      icon: '💳', secretFields: ['merchantKey', 'merchantSalt'], configFields: ['merchantId'] },
  aeroDataBox:   { label: 'AeroDataBox (Uçuş)', icon: '✈️', secretFields: ['rapidApiKey'], configFields: [] },
  netgsm:        { label: 'Netgsm (SMS)',       icon: '📱', secretFields: ['apiKey', 'apiSecret'], configFields: ['sender'] },
  whatsapp:      { label: 'WhatsApp (Meta)',    icon: '💬', secretFields: ['accessToken'], configFields: ['phoneNumberId', 'waBaId'] },
  smtp:          { label: 'E-posta (SMTP)',     icon: '📧', secretFields: ['password'], configFields: ['host', 'port', 'user', 'from'] },
  exchangeRate:  { label: 'Döviz Kuru API',    icon: '💱', secretFields: ['apiKey'], configFields: ['baseCurrency'] },
  osm:           { label: 'Harita (OSM/OSRM)', icon: '🗺️', secretFields: [], configFields: ['photonUrl', 'osrmUrl', 'nominatimUrl'] },
};

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
            <p className="text-xs text-gray-400">{item.service}</p>
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

      <p className="mt-2 text-xs text-gray-400">
        Son güncelleme: {new Date(item.updatedAt).toLocaleString('tr-TR')}
      </p>
    </div>
  );
}

function EditModal({ item, onClose }: { item: Integration | { service: string }; onClose: () => void }) {
  const qc  = useQueryClient();
  const isNew = !('id' in item);
  const svc = item.service;
  const meta = SERVICE_LABELS[svc] ?? { secretFields: [], configFields: [] };

  const [isActive, setIsActive] = useState('isActive' in item ? item.isActive : true);
  const [provider, setProvider] = useState('provider' in item ? item.provider : svc);
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

          {meta.configFields.map((field) => (
            <div key={field}>
              <label className="label">{field}</label>
              <input className="input" value={config[field] ?? ''}
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
