import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

export function PaymentPage() {
  const { t }    = useTranslation();
  const { id }   = useParams<{ id: string }>();
  const navigate  = useNavigate();

  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  useEffect(() => {
    if (!id) return;
    api.post(`/payments/iframe/${id}`)
      .then(({ data }) => setIframeToken(data.iframeToken))
      .catch((e) => setError(e.response?.data?.error ?? t('errors.networkError')))
      .finally(() => setLoading(false));
  }, [id]);

  // PayTR iframe mesajını dinle
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'paymentSuccess') {
        navigate(`/confirmation/${id}`);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [id, navigate]);

  if (loading) return (
    <div className="flex min-h-64 items-center justify-center text-gray-500">
      {t('common.loading')}
    </div>
  );

  if (error) return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center">
      <p className="text-red-600">{error}</p>
      <button onClick={() => navigate(-1)} className="btn-outline mt-4">{t('common.back')}</button>
    </div>
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">{t('payment.title')}</h1>
      <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
        <span>🔒</span> {t('payment.secure')}
      </p>

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
    </div>
  );
}
