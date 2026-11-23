export const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

// null — пароль подходит, иначе текст подсказки.
export function passwordProblem(pw, again) {
  if (!String(pw).trim()) return 'Пароль не может состоять из одних пробелов';
  if (String(pw).length < 8) return 'Пароль должен быть не короче 8 символов';
  if (pw !== again) return 'Пароли не совпадают';
  return null;
}

// Вошла по ссылке из письма, а пароль ещё не придумала.
export const needsPassword = (user) => !!user && !user.user_metadata?.has_password;

// Понятный текст ошибки при отправке письма со ссылкой.
export function linkErrorMessage(msg = '') {
  const secs = /after (\d+) seconds?/i.exec(msg);
  if (secs) return `Письмо уже отправлено. Новое можно запросить через ${secs[1]} сек.`;
  if (/rate limit/i.test(msg)) return 'Бесплатный Supabase отправляет не больше пары писем в час. Подожди около часа и попробуй снова';
  if (/signups? not allowed|not found/i.test(msg)) return 'Этот планер личный: вход только для хозяйки';
  return 'Не получилось отправить письмо. Проверь интернет и попробуй ещё раз';
}
