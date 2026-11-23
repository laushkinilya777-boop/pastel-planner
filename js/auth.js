// Вход: почта + пароль. В первый раз (и если пароль забыт) — ссылка из письма,
// после неё сайт просит придумать пароль.
import { client } from './supabase.js';
import { isValidEmail, passwordProblem } from './auth-utils.js';
import { icon } from './ui/icons.js';

const redirectTo = () => location.origin + location.pathname;

function shell(root, sub, form) {
  root.innerHTML = `
    <section class="auth">
      <div class="auth-mark">${icon('sun', 34)}</div>
      <h1 class="auth-title">Мой планер</h1>
      <p class="auth-sub">${sub}</p>
      <form class="auth-form" novalidate>${form}
        <p class="auth-error" role="alert"></p>
      </form>
    </section>`;
  const f = root.querySelector('form');
  return { f, err: root.querySelector('.auth-error'), btn: f.querySelector('[type=submit]') };
}

const pwField = (id, label, auto) => `
  <div class="pw-wrap">
    <input class="field" id="${id}" type="password" autocomplete="${auto}" placeholder="${label}" aria-label="${label}" required>
    <button class="pw-eye" type="button" aria-label="Показать пароль" data-eye="${id}">${icon('eye', 20)}</button>
  </div>`;

function wireEyes(root) {
  root.querySelectorAll('[data-eye]').forEach((b) => b.addEventListener('click', () => {
    const inp = root.querySelector('#' + b.dataset.eye);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
    b.innerHTML = icon(show ? 'eyeOff' : 'eye', 20);
  }));
}

// Основной экран: почта + пароль.
export function renderAuth(root) {
  const { f, err, btn } = shell(root, 'С возвращением! Войди, чтобы открыть свои планы', `
    <input class="field" id="email" type="email" inputmode="email" autocomplete="username" placeholder="почта" aria-label="Почта" required>
    ${pwField('pw', 'пароль', 'current-password')}
    <button class="btn auth-btn" type="submit">Войти</button>
    <button class="link-btn" type="button" id="by-link">Первый вход или забыла пароль? Войти по ссылке из письма</button>`);
  wireEyes(root);
  root.querySelector('#by-link').addEventListener('click', () => renderLinkLogin(root, f.email.value));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const email = f.email.value.trim().toLowerCase();
    if (!isValidEmail(email)) { err.textContent = 'Проверь почту: похоже, в ней опечатка'; return; }
    if (!f.pw.value) { err.textContent = 'Введи пароль'; return; }
    btn.disabled = true; btn.textContent = 'Входим…';
    const { error } = await client.auth.signInWithPassword({ email, password: f.pw.value });
    if (error) {
      btn.disabled = false; btn.textContent = 'Войти';
      err.textContent = /invalid login/i.test(error.message)
        ? 'Почта или пароль не подходят. Если пароля ещё нет — войди по ссылке из письма'
        : 'Не получилось войти. Проверь интернет и попробуй ещё раз';
    }
    // при успехе app.js сам поймает событие входа
  });
  f.email.focus();
}

// Вход по ссылке из письма.
function renderLinkLogin(root, emailPrefill = '') {
  const { f, err, btn } = shell(root, 'Пришлём письмо со ссылкой. Открой его на этом же устройстве и нажми ссылку', `
    <input class="field" id="email" type="email" inputmode="email" autocomplete="username" placeholder="почта" aria-label="Почта" required>
    <button class="btn auth-btn" type="submit">Прислать ссылку</button>
    <button class="link-btn" type="button" id="back">Назад ко входу с паролем</button>`);
  f.email.value = emailPrefill;
  root.querySelector('#back').addEventListener('click', () => renderAuth(root));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const email = f.email.value.trim().toLowerCase();
    if (!isValidEmail(email)) { err.textContent = 'Проверь почту: похоже, в ней опечатка'; return; }
    btn.disabled = true; btn.textContent = 'Отправляем…';
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo() } });
    btn.disabled = false; btn.textContent = 'Прислать ссылку';
    if (error) {
      err.textContent = /signups? not allowed|not found/i.test(error.message)
        ? 'Этот планер личный: вход только для хозяйки'
        : /rate|seconds/i.test(error.message)
          ? 'Письмо уже отправлено. Подожди минуту и попробуй снова'
          : 'Не получилось отправить письмо. Проверь интернет и попробуй ещё раз';
      return;
    }
    root.querySelector('.auth-sub').textContent = `Письмо отправлено на ${email}. Открой его на этом устройстве и нажми ссылку`;
    btn.hidden = true;
  });
  f.email.focus();
}

// После входа по ссылке: придумать пароль. onDone() — когда готово или «позже».
export function renderSetPassword(root, onDone) {
  const { f, err, btn } = shell(root, 'Придумай пароль — с ним удобно входить с телефона и компьютера. Можно сохранить его в «Паролях» iPhone', `
    ${pwField('pw', 'новый пароль', 'new-password')}
    ${pwField('pw2', 'ещё раз', 'new-password')}
    <button class="btn auth-btn" type="submit">Сохранить пароль</button>
    <button class="link-btn" type="button" id="later">Позже</button>`);
  wireEyes(root);
  root.querySelector('#later').addEventListener('click', onDone);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const problem = passwordProblem(f.pw.value, f.pw2.value);
    err.textContent = problem || '';
    if (problem) return;
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    const { error } = await client.auth.updateUser({ password: f.pw.value, data: { has_password: true } });
    if (error) {
      btn.disabled = false; btn.textContent = 'Сохранить пароль';
      err.textContent = /weak|pwned|easy/i.test(error.message)
        ? 'Этот пароль слишком простой, придумай другой'
        : 'Не получилось сохранить. Проверь интернет и попробуй ещё раз';
      return;
    }
    onDone();
  });
  f.pw.focus();
}
