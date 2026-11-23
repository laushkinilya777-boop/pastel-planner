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
