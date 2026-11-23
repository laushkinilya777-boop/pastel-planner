export const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

// Код из письма: только цифры, ровно 6.
export function normalizeCode(s) {
  const digits = String(s || '').replace(/\D/g, '');
  return digits.length === 6 ? digits : null;
}
