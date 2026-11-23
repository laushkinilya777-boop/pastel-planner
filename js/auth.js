// Экран входа: почта -> 6-значный код из письма.
import { client } from './supabase.js';
import { isValidEmail, normalizeCode } from './auth-utils.js';
import { icon } from './ui/icons.js';

// Пока создан только аккаунт хозяйки, регистрация разрешена; после — false (шаг 7.3).
const ALLOW_SIGNUP = true;

export function renderAuth(root) {
  let email = '';
  root.innerHTML = `
    <section class="auth">
      <div class="auth-mark">${icon('sun', 34)}</div>
      <h1 class="auth-title">Мой планер</h1>
      <p class="auth-sub" id="auth-sub">Введи почту — пришлём код для входа</p>
      <form class="auth-form" id="auth-form" novalidate>
        <input class="field" id="auth-input" type="email" inputmode="email" autocomplete="email"
               placeholder="почта" aria-label="Почта" required>
        <button class="btn auth-btn" id="auth-btn" type="submit">Получить код</button>
        <p class="auth-error" id="auth-error" role="alert"></p>
        <button class="link-btn" id="auth-back" type="button" hidden>Другая почта</button>
      </form>
    </section>`;

  const form = root.querySelector('#auth-form');
  const input = root.querySelector('#auth-input');
  const btn = root.querySelector('#auth-btn');
  const err = root.querySelector('#auth-error');
  const sub = root.querySelector('#auth-sub');
  const back = root.querySelector('#auth-back');
  let step = 'email';

  const busy = (on, label) => { btn.disabled = on; btn.textContent = label; };
  const showCodeStep = () => {
    step = 'code';
    sub.textContent = `Код отправлен на ${email}. Он придёт в течение минуты`;
    Object.assign(input, { type: 'text', value: '', placeholder: '000000', autocomplete: 'one-time-code', inputMode: 'numeric' });
    input.setAttribute('aria-label', 'Код из письма');
    input.maxLength = 7;
    input.classList.add('code');
    busy(false, 'Войти');
    back.hidden = false;
    input.focus();
  };

  back.addEventListener('click', () => renderAuth(root));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    if (step === 'email') {
      email = input.value.trim().toLowerCase();
      if (!isValidEmail(email)) { err.textContent = 'Проверь почту: похоже, в ней опечатка'; return; }
      busy(true, 'Отправляем…');
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: ALLOW_SIGNUP } });
      if (error) {
        busy(false, 'Получить код');
        err.textContent = /signups? not allowed|not found/i.test(error.message)
          ? 'Этот планер личный: вход только для хозяйки'
          : /rate|seconds/i.test(error.message)
            ? 'Код уже отправлен. Подожди минуту и попробуй снова'
            : 'Не получилось отправить код. Проверь интернет и попробуй ещё раз';
        return;
      }
      showCodeStep();
    } else {
      const token = normalizeCode(input.value);
      if (!token) { err.textContent = 'В коде должно быть 6 цифр'; return; }
      busy(true, 'Входим…');
      const { error } = await client.auth.verifyOtp({ email, token, type: 'email' });
      if (error) {
        busy(false, 'Войти');
        err.textContent = /expired/i.test(error.message)
          ? 'Код устарел. Нажми «Другая почта» и запроси новый'
          : 'Код не подошёл. Проверь цифры в письме';
      }
      // при успехе app.js сам поймает событие входа
    }
  });
  input.focus();
}
