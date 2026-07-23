import { api } from './api';

// VAPID base64url → Uint8Array (pushManager.subscribe için)
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'disabled' | 'denied' | 'error'; message?: string };

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported';
}

// Bir rezervasyon için bildirim aboneliği kur
export async function subscribeToPush(bookingId: string): Promise<PushResult> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  try {
    const { data } = await api.get<{ publicKey: string | null; enabled: boolean }>('/push/vapid-key');
    if (!data.enabled || !data.publicKey) return { ok: false, reason: 'disabled' };

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'denied' };

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const keyBytes = urlBase64ToUint8Array(data.publicKey);
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes.buffer as ArrayBuffer,
    });

    await api.post('/push/subscribe', { subscription: sub.toJSON(), bookingId });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: 'error', message: e?.message };
  }
}
