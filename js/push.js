// Включение push-напоминаний на этом устройстве.
import { client } from './supabase.js';
import { VAPID_PUBLIC_KEY } from './config.js';
import { pushAvailability, urlBase64ToUint8Array } from './push-utils.js';

export function currentAvailability() {
  return pushAvailability({
    hasSW: 'serviceWorker' in navigator,
    hasPush: 'PushManager' in window && 'Notification' in window,
    isStandalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  });
}

// true — напоминания уже включены на этом устройстве.
export async function isPushOn() {
  if (currentAvailability() !== 'ok' || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

// Вызывать только по нажатию кнопки (иначе браузер не покажет запрос).
export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Уведомления не разрешены. Их можно включить в настройках браузера или iPhone');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  const { error } = await client.from('push_subscriptions')
    .upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
  if (error) throw new Error('Не получилось сохранить подписку. Проверь интернет и попробуй ещё раз');
}
