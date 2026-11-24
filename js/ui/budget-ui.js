// Окна бюджета: запись (доход / расход / копилка), строка плана, копилка.
import { store } from '../supabase.js';
import { openSheet, choose } from './sheet.js';
import { icon } from './icons.js';
import { suggestions, formatMoney, jarBalance } from '../budget.js';
import { todayISO } from '../dates.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v) => Math.round(Number(String(v).replace(/\s/g, '').replace(',', '.')) * 100) / 100;
const KINDS = [['income', 'Доход'], ['expense', 'Расход'], ['save', 'В копилку'], ['withdraw', 'Из копилки']];
export const JAR_COLORS = { peach: ['#ffb38f', '#f57fa3'], lilac: ['#a993e8', '#ef86b1'], mint: ['#4fc9a8', '#6fa8ea'], sky: ['#6fa8ea', '#a993e8'] };

const del = async (table, id, text, close) => {
  const ok = await choose({ title: 'Удалить?', text, options: [{ label: 'Удалить', value: true, tone: 'danger' }, { label: 'Отмена', value: false }] });
  if (!ok) return;
  await store.remove(table, id);
  close();
};

export async function openEntryEditor({ entry = null, kind = 'expense', date = todayISO(), jarId = null } = {}) {
  const all = await store.list('money_entries');
  const jars = (await store.list('savings_jars')).filter((j) => !j.archived);
  const e = entry || { kind, date, amount: '', source: '', target: '', jar_id: jarId || jars[0]?.id || null, note: '' };
  let k = e.kind;
  openSheet({
    title: entry ? 'Запись' : 'Новая запись',
    build(body, close) {
      body.innerHTML = `
        <form class="editor" novalidate>
          <div class="segmented kind kinds" role="radiogroup" aria-label="Тип">
            ${KINDS.map(([v, l]) => `<button type="button" data-k="${v}" aria-selected="${v === k}">${l}</button>`).join('')}
          </div>
          <label class="lbl money-input">Сумма
            <span class="mi-wrap"><input class="field" name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${e.amount ? String(e.amount).replace('.', ',') : ''}" autofocus><b>₽</b></span></label>
          <label class="lbl f-source">Откуда<input class="field" name="source" list="dl-source" placeholder="Зарплата, подработка, подарок…" value="${esc(e.source)}"></label>
          <label class="lbl f-target">Куда<input class="field" name="target" list="dl-target" placeholder="Продукты, кафе, котик…" value="${esc(e.target)}"></label>
          <label class="lbl f-jar">Копилка
            <select class="field" name="jar">${jars.map((j) => `<option value="${j.id}" ${j.id === e.jar_id ? 'selected' : ''}>${esc(j.title)}</option>`).join('') || '<option value="">сначала создай копилку</option>'}</select></label>
          <div class="grid2">
            <label class="lbl">Дата<input class="field" type="date" name="date" value="${e.date}"></label>
            <label class="lbl">Заметка<input class="field" name="note" placeholder="необязательно" value="${esc(e.note)}"></label>
          </div>
          <datalist id="dl-source">${suggestions(all, 'source').map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
          <datalist id="dl-target">${suggestions(all, 'target').map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions">
            <button class="btn" type="submit">${icon('check', 18)}Сохранить</button>
            ${entry ? `<button class="icon-btn danger" type="button" data-act="del" aria-label="Удалить запись">${icon('trash', 20)}</button>` : ''}
          </div>
        </form>`;
      const f = body.querySelector('form');
      const paint = () => {
        body.querySelectorAll('[data-k]').forEach((b) => b.setAttribute('aria-selected', b.dataset.k === k));
        body.querySelector('.f-source').hidden = k !== 'income';
        body.querySelector('.f-target').hidden = k !== 'expense';
        body.querySelector('.f-jar').hidden = !(k === 'save' || k === 'withdraw');
      };
      body.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { k = b.dataset.k; paint(); }));
      paint();
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const err = body.querySelector('.auth-error');
        const amount = money(f.amount.value);
        if (!(amount > 0)) { err.textContent = 'Введи сумму больше нуля'; f.amount.focus(); return; }
        if ((k === 'save' || k === 'withdraw') && !f.jar.value) { err.textContent = 'Сначала создай копилку'; return; }
        const row = {
          kind: k, amount, date: f.date.value || todayISO(), note: f.note.value.trim() || null,
          source: k === 'income' ? (f.source.value.trim() || null) : null,
          target: k === 'expense' ? (f.target.value.trim() || null) : null,
          jar_id: k === 'save' || k === 'withdraw' ? f.jar.value : null,
        };
        if (entry) await store.patch('money_entries', entry.id, row);
        else await store.upsert('money_entries', { ...row, created_at: new Date().toISOString() });
        close();
      });
      body.querySelector('[data-act=del]')?.addEventListener('click', () => del('money_entries', entry.id, `${formatMoney(entry.amount)} — запись исчезнет`, close));
    },
  });
}

export function openPlanRow({ row = null, month }) {
  const p = row || { category: '', planned: '', kind: 'expense' };
  openSheet({
    title: row ? 'Строка плана' : 'Добавить в план',
    build(body, close) {
      body.innerHTML = `
        <form class="editor" novalidate>
          <input class="field" name="category" placeholder="Категория: продукты, кафе, транспорт…" aria-label="Категория" value="${esc(p.category)}" ${row ? '' : 'autofocus'}>
          <label class="lbl money-input">Сколько планирую на месяц
            <span class="mi-wrap"><input class="field" name="planned" inputmode="decimal" placeholder="0" value="${p.planned ? String(p.planned).replace('.', ',') : ''}" ${row ? 'autofocus' : ''}><b>₽</b></span></label>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions">
            <button class="btn" type="submit">${icon('check', 18)}Сохранить</button>
            ${row ? `<button class="icon-btn danger" type="button" data-act="del" aria-label="Убрать из плана">${icon('trash', 20)}</button>` : ''}
          </div>
        </form>`;
      const f = body.querySelector('form');
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const category = f.category.value.trim();
        const planned = money(f.planned.value || 0);
        const err = body.querySelector('.auth-error');
        if (!category) { err.textContent = 'Напиши категорию'; return; }
        if (!(planned >= 0)) { err.textContent = 'Проверь сумму'; return; }
        if (row) await store.patch('budget_plans', row.id, { category, planned });
        else {
          const exists = (await store.list('budget_plans', (x) => x.month === month && x.category.trim().toLowerCase() === category.toLowerCase()))[0];
          if (exists) await store.patch('budget_plans', exists.id, { planned });
          else await store.upsert('budget_plans', { month, category, planned, kind: 'expense', sort: Date.now(), created_at: new Date().toISOString() });
        }
        close();
      });
      body.querySelector('[data-act=del]')?.addEventListener('click', () => del('budget_plans', row.id, `«${row.category}» уберётся из плана этого месяца (записи останутся)`, close));
    },
  });
}

export async function openJar({ jar = null } = {}) {
  const entries = await store.list('money_entries');
  const j = jar || { title: '', target: '', color: 'peach' };
  let color = j.color;
  openSheet({
    title: jar ? jar.title : 'Новая копилка',
    build(body, close) {
      body.innerHTML = `
        ${jar ? `<p class="sheet-sub">В копилке: <b>${formatMoney(jarBalance(jar, entries))}</b></p>
          <div class="actions jar-actions">
            <button class="btn" type="button" data-act="put">${icon('plus', 18)}Положить</button>
            <button class="btn ghost" type="button" data-act="take">Забрать</button>
          </div>` : ''}
        <form class="editor" novalidate>
          <input class="field" name="title" placeholder="На что копишь? Отпуск, ноутбук…" aria-label="Название" value="${esc(j.title)}" ${jar ? '' : 'autofocus'}>
          <label class="lbl money-input">Цель (необязательно)
            <span class="mi-wrap"><input class="field" name="target" inputmode="decimal" placeholder="60 000" value="${j.target ? String(j.target).replace('.', ',') : ''}"><b>₽</b></span></label>
          <div class="colors" role="radiogroup" aria-label="Цвет">
            ${Object.entries(JAR_COLORS).map(([id, [a, b]]) => `<button type="button" class="color-dot" data-c="${id}" role="radio" aria-checked="${id === color}" aria-label="${id}" style="background:linear-gradient(135deg,${a},${b})"></button>`).join('')}
          </div>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions">
            <button class="btn ${jar ? 'ghost' : ''}" type="submit">${icon('check', 18)}${jar ? 'Сохранить изменения' : 'Создать копилку'}</button>
            ${jar ? `<button class="icon-btn danger" type="button" data-act="del" aria-label="Удалить копилку">${icon('trash', 20)}</button>` : ''}
          </div>
        </form>`;
      const f = body.querySelector('form');
      body.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => {
        color = b.dataset.c; body.querySelectorAll('[data-c]').forEach((x) => x.setAttribute('aria-checked', x === b));
      }));
      body.querySelector('[data-act=put]')?.addEventListener('click', () => { close(); openEntryEditor({ kind: 'save', jarId: jar.id }); });
      body.querySelector('[data-act=take]')?.addEventListener('click', () => { close(); openEntryEditor({ kind: 'withdraw', jarId: jar.id }); });
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const title = f.title.value.trim();
        const target = f.target.value.trim() ? money(f.target.value) : null;
        const err = body.querySelector('.auth-error');
        if (!title) { err.textContent = 'Напиши, на что копишь'; return; }
        if (target !== null && !(target > 0)) { err.textContent = 'Цель должна быть больше нуля'; return; }
        if (jar) await store.patch('savings_jars', jar.id, { title, target, color });
        else await store.upsert('savings_jars', { title, target, color, archived: false, created_at: new Date().toISOString() });
        close();
      });
      body.querySelector('[data-act=del]')?.addEventListener('click', () => del('savings_jars', jar.id, 'Копилка исчезнет, записи о деньгах останутся в истории', close));
    },
  });
}
