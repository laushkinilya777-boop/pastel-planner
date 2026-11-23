// Можно ли включить напоминания на этом устройстве.
// iPhone разрешает push только сайту, добавленному на экран «Домой» (iOS 16.4+).
export function pushAvailability({ hasSW, hasPush, isStandalone, isIOS }) {
  if (isIOS && !isStandalone) return 'need-home-screen';
  if (!hasSW || !hasPush) return 'unsupported';
  return 'ok';
}

export function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
