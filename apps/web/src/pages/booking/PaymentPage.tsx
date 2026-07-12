import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

type Method = 'online' | 'bank' | 'cash' | null;

interface BankInfo {
  bankName?: string;
  accountName?: string;
  iban?: string;
  branchCode?: string;
  description?: string;
}

export function PaymentPage() {
  const { t }   = useTranslation();
  const { id }  = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [method,     setMethod]     = useState<Method>(null);
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [bankInfo,   setBankInfo]   = useState<BankInfo | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [confirmed,  setConfirmed]  = useState(false); // araçta ödeme onayı

  // Banka bilgilerini sayfa açılışında çek
  useEffect(() => {
    api.get<{ bankInfo: BankInfo | null }>('/payments/bank-info')
      .then(({ data }) => setBankInfo(data.bankInfo))
      .catch(() => {});
  }, []);

  // PayTR iframe mesajını dinle
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'paymentSuccess') navigate(`/confirmation/${id}`);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [id, navigate]);

  const selectOnline = async () => {
    setMethod('online');
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/payments/iframe/${id}`);
      setIframeToken(data.iframeToken);
    } catch (e: any) {
      setError(e.response?.data?.error ?? t('errors.networkError'));
      setMethod(null);
    } finally {
      setLoading(false);
    }
  };

  const selectBank = async () => {
    setMethod('bank');
    setLoading(true);
    setError('');
    try {
      await api.post(`/payments/bank-transfer/${id}`);
    } catch (e: any) {
      setError(e.response?.data?.error ?? t('errors.networkError'));
      setMethod(null);
    } finally {
      setLoading(false);
    }
  };

  const selectCash = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/payments/cash/${id}`);
      setMethod('cash');
      setConfirmed(true);
    } catch (e: any) {
      setError(e.response?.data?.error ?? t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  };

  // ── Araçta ödeme alındı (onay bekleniyor) ───────────────────────────────
  if (confirmed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-6xl">🕐</p>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Rezervasyonunuz Alındı!</h2>
        <p className="mt-2 text-gray-500">
          Araçta ödeme talebiniz iletildi. Operatörümüz en kısa sürede rezervasyonunuzu onaylayacak.
          Onay sonrası e-posta ile bilgilendirileceksiniz.
        </p>
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700 text-left">
          <p className="font-medium">ℹ️ Bilgi:</p>
          <p className="mt-1">Ödemeniz transfer sırasında şoförümüze nakit olarak yapılacaktır.</p>
        </div>
        <button onClick={() => navigate(`/confirmation/${id}`)} className="btn btn-primary mt-6">
          Rezervasyon Detayı
        </button>
      </div>
    );
  }

  // ── Havale/EFT bilgileri ─────────────────────────────────────────────────
  if (method === 'bank') {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">Havale / EFT ile Ödeme</h1>
        <p className="mt-1 text-sm text-gray-500">
          Aşağıdaki hesaba rezervasyon referansını açıklama olarak belirterek transfer yapın.
        </p>

        {bankInfo ? (
          <div className="mt-6 space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            {bankInfo.bankName && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Banka</span>
                <span className="font-medium">{bankInfo.bankName}</span>
              </div>
            )}
            {bankInfo.accountName && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Hesap Adı</span>
                <span className="font-medium">{bankInfo.accountName}</span>
              </div>
            )}
            {bankInfo.iban && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">IBAN</span>
                <button
                  className="flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-left font-mono text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  onClick={() => navigator.clipboard?.writeText(bankInfo.iban ?? '')}
                  title="Kopyala"
                >
                  {bankInfo.iban}
                  <span className="ml-auto text-xs font-normal text-blue-400">📋 kopyala</span>
                </button>
              </div>
            )}
            {bankInfo.branchCode && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Şube Kodu</span>
                <span className="font-medium">{bankInfo.branchCode}</span>
              </div>
            )}
            {bankInfo.description && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ℹ️ {bankInfo.description}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
            ⚠️ Banka hesap bilgileri henüz tanımlanmamış. Lütfen bizimle iletişime geçin.
          </div>
        )}

        <div className="mt-6 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
          <p className="font-medium">Önemli:</p>
          <ul className="mt-1 list-disc pl-4 space-y-1">
            <li>Transfer açıklamasına rezervasyon referansını yazın</li>
            <li>Transferin ardından ödemeniz operatörümüz tarafından onaylanacak</li>
            <li>Onay sonrası rezervasyonunuz kesinleşecektir</li>
          </ul>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => navigate(`/confirmation/${id}`)} className="btn btn-primary flex-1">
            Tamam, transfer yapacağım
          </button>
          <button onClick={() => setMethod(null)} className="btn btn-outline">
            Geri
          </button>
        </div>
      </div>
    );
  }

  // ── PayTR iframe ─────────────────────────────────────────────────────────
  if (method === 'online') {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">{t('payment.title')}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
          <span>🔒</span> {t('payment.secure')}
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button onClick={() => setMethod(null)} className="ml-3 underline">Geri dön</button>
          </div>
        )}

        {loading ? (
          <div className="mt-6 flex h-64 items-center justify-center text-gray-400">
            {t('common.loading')}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            {iframeToken ? (
              <iframe
                src={`https://www.paytr.com/odeme/guvenli/${iframeToken}`}
                className="h-[600px] w-full border-0"
                title="PayTR Ödeme"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-gray-400">
                {t('payment.processing')}
              </div>
            )}
          </div>
        )}

        {!loading && !error && (
          <button onClick={() => setMethod(null)} className="btn btn-outline mt-4 w-full text-sm">
            ← Farklı ödeme yöntemi seç
          </button>
        )}
      </div>
    );
  }

  // ── Yöntem seçimi (ana ekran) ────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Ödeme Yöntemi Seçin</h1>
      <p className="mt-1 text-sm text-gray-500">Rezervasyonunuzu tamamlamak için bir ödeme yöntemi seçin.</p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 space-y-3">
        {/* Kredi/Banka Kartı */}
        <button
          onClick={selectOnline}
          disabled={loading}
          className="group w-full rounded-2xl border-2 border-gray-200 bg-white p-5 text-left transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">💳</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Kredi / Banka Kartı</p>
              <p className="text-sm text-gray-500">PayTR güvenceli online ödeme</p>
            </div>
            <span className="text-gray-400 group-hover:text-blue-500">→</span>
          </div>
          <div className="mt-2 flex gap-1.5 pl-14">
            {['VISA', 'MC', 'Troy'].map((c) => (
              <span key={c} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{c}</span>
            ))}
          </div>
        </button>

        {/* Havale/EFT */}
        <button
          onClick={selectBank}
          disabled={loading}
          className="group w-full rounded-2xl border-2 border-gray-200 bg-white p-5 text-left transition hover:border-green-400 hover:bg-green-50 disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">🏦</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Havale / EFT</p>
              <p className="text-sm text-gray-500">Banka hesabına transfer yapın</p>
            </div>
            <span className="text-gray-400 group-hover:text-green-500">→</span>
          </div>
          {bankInfo?.bankName && (
            <p className="mt-1 pl-14 text-xs text-gray-400">{bankInfo.bankName}</p>
          )}
        </button>

        {/* Araçta Ödeme */}
        <button
          onClick={selectCash}
          disabled={loading}
          className="group w-full rounded-2xl border-2 border-gray-200 bg-white p-5 text-left transition hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">💵</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Araçta Ödeme</p>
              <p className="text-sm text-gray-500">Transfer sırasında nakit veya kart ile ödeyin</p>
            </div>
            <span className="text-gray-400 group-hover:text-amber-500">→</span>
          </div>
        </button>
      </div>

      {loading && (
        <p className="mt-4 text-center text-sm text-gray-400">{t('common.loading')}</p>
      )}
    </div>
  );
}
