import axios from 'axios';

export const api = axios.create({
  baseURL:         '/api',
  withCredentials: true,
  // NOT: Global 'Content-Type: application/json' KOYMUYORUZ. Aksi halde FormData
  // (dosya yükleme) gönderiminde tarayıcının multipart boundary'sini ezip
  // multer'ın dosyayı parse etmesini engelliyordu. Axios nesne gövdeler için
  // application/json'ı, FormData için boundary'li multipart'ı otomatik ayarlar.
});

let refreshing: Promise<void> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // 401 + refresh denemedi + login sayfasında değil
    if (
      err.response?.status === 401 &&
      !original._retried &&
      !original.url?.includes('/auth/refresh') &&
      !window.location.pathname.startsWith('/admin/login')
    ) {
      original._retried = true;

      // Eş zamanlı refresh isteklerini tek bir isteğe indir
      if (!refreshing) {
        refreshing = axios
          .post('/api/auth/refresh', {}, { withCredentials: true })
          .then(() => { refreshing = null; })
          .catch(() => {
            refreshing = null;
            window.location.href = '/admin/login';
          });
      }

      try {
        await refreshing;
        // Token yenilendi — orijinal isteği tekrar gönder
        return api(original);
      } catch {
        window.location.href = '/admin/login';
      }
    }

    if (err.response?.status === 401 && !window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login';
    }

    return Promise.reject(err);
  },
);

export type ApiError = { error: string; details?: unknown };
