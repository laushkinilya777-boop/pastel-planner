// Месяц: календарь с красными датами, дедлайнами и задачами; цели месяца; список важных дат.
import { store } from '../supabase.js';
import { renderGoals, openGoalEditor } from '../ui/goal-card.js';
import { openSheet, choose } from '../ui/sheet.js';
import { icon } from '../ui/icons.js';
import { goalsFor } from '../goals.js';
import { specialDatesForMonth } from '../special-dates.js';
import { monthGrid, todayISO, parseISODate, formatMonthTitle } from '../dates.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const pad = (n) => String(n).padStart(2, '0');
let shown = null; // { y, m }

export function render(root) {
  if (!shown) { const t = parseISODate(todayISO()); shown = { y: t.getFullYear(), m: t.getMonth() + 1 }; }
  root.innerHTML = `
    <div class="period-head">
      <button class="icon-btn" data-nav="-1" aria-label="Предыдущий месяц">${icon('chevronLeft')}</button>
      <div><h1 class="page-title month-title"></h1><p class="period-sub"></p></div>
      <button class="icon-btn" data-nav="1" aria-label="Следующий месяц">${icon('chevronRight')}</button>
    </div>
    <section class="panel cal-panel">
      <div class="cal" role="grid" aria-label="Календарь месяца">
        ${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d, i) => `<div class="cal-wd${i >= 5 ? ' weekend' : ''}" role="columnheader">${d}</div>`).join('')}
      </div>
      <div class="cal-legend">
        <span><i class="lg red"></i>красная дата</span>
        <span>${icon('hourglass', 14)}дедлайн</span>
        <span><i class="lg dot"></i>есть задачи</span>
      </div>
    </section>
    <section class="panel">
      <div class="panel-title">${icon('flag', 18)}Красные даты и дедлайны</div>
      <ul class="special-list"></ul>
      <button class="btn ghost" type="button" data-act="date">${icon('plus', 18)}Дата</button>
    </section>
    <section class="panel">
      <div class="panel-title">${icon('target', 18)}Цели месяца</div>
      <div class="goals"></div>
      <button class="btn ghost" type="button" data-act="goal">${icon('plus', 18)}Цель месяца</button>
    </section>`;

  const monthStart = () => `${shown.y}-${pad(shown.m)}-01`;
  root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    const d = new Date(shown.y, shown.m - 1 + Number(b.dataset.nav), 1);
    shown = { y: d.getFullYear(), m: d.getMonth() + 1 };
    refresh();
  }));
  root.querySelector('[data-act=goal]').addEventListener('click', () => openGoalEditor({ period: 'month', periodStart: monthStart() }));
  root.querySelector('[data-act=date]').addEventListener('click', () => openDateEditor({ date: todayISO().startsWith(monthStart().slice(0, 8)) ? todayISO() : monthStart() }));

  async function refresh() {
    const [tasks, goals, dates] = await Promise.all([store.list('tasks'), store.list('goals'), store.list('special_dates')]);
    const today = todayISO();
    const special = specialDatesForMonth(dates, shown.y, shown.m);
    root.querySelector('.month-title').textContent = formatMonthTitle(shown.y, shown.m);
    const inMonth = tasks.filter((t) => t.date.startsWith(monthStart().slice(0, 8)));
    root.querySelector('.period-sub').textContent = inMonth.length
      ? `задач: ${inMonth.length}, выполнено: ${inMonth.filter((t) => t.done).length}` : 'задач пока нет';

    const cal = root.querySelector('.cal');
    cal.querySelectorAll('.cal-day').forEach((c) => c.remove());
    for (const d of monthGrid(shown.y, shown.m)) {
      const dayTasks = tasks.filter((t) => t.date === d);
      const sp = special.get(d) || [];
      const red = sp.find((x) => x.kind === 'red');
      const deadline = sp.some((x) => x.kind === 'deadline');
      const other = !d.startsWith(monthStart().slice(0, 8));
      const a = document.createElement('a');
      a.href = `#/day/${d}`;
      const wkend = parseISODate(d).getDay() % 6 === 0; // суббота или воскресенье
      a.className = `cal-day${other ? ' other' : ''}${d === today ? ' today' : ''}${red ? ' red' : ''}${wkend ? ' weekend' : ''}`;
      a.setAttribute('role', 'gridcell');
      const label = [parseISODate(d).getDate() + ' ' + MONTHS_GEN[parseISODate(d).getMonth()], ...sp.map((x) => x.title), dayTasks.length ? `задач: ${dayTasks.length}` : ''].filter(Boolean).join(', ');
      a.setAttribute('aria-label', label);
      if (red?.color) a.style.setProperty('--red-day', red.color);
      a.innerHTML = `<span class="cd-num">${parseISODate(d).getDate()}</span>
        <span class="cd-marks">${deadline ? icon('hourglass', 12) : ''}${dayTasks.length ? `<i class="cd-dot${dayTasks.every((t) => t.done) ? ' all' : ''}"></i>` : ''}</span>`;
      cal.appendChild(a);
    }

    const list = root.querySelector('.special-list');
    list.innerHTML = special.size ? '' : '<li class="empty-line">В этом месяце важных дат нет</li>';
    for (const [d, rows] of special) {
      for (const r of rows) {
        const li = document.createElement('li');
        li.innerHTML = `<button class="special-item" type="button">
          <span class="si-date ${r.kind}">${parseISODate(d).getDate()}</span>
          <span class="si-text"><b>${esc(r.title)}</b><small>${r.kind === 'red' ? 'красная дата' : 'дедлайн'}${r.yearly ? ' · каждый год' : ''}</small></span>
          ${r.kind === 'deadline' ? icon('hourglass', 16) : icon('flag', 16)}</button>`;
        li.querySelector('button').addEventListener('click', () => openDateEditor({ row: r }));
        list.appendChild(li);
      }
    }
    renderGoals(root.querySelector('.goals'), goalsFor(goals, 'month', monthStart()), tasks, 'Целей на этот месяц пока нет');
  }

  let timer;
  const off = store.on('change', (t) => {
    if (['tasks', 'goals', 'special_dates'].includes(t)) { clearTimeout(timer); timer = setTimeout(refresh, 60); }
  });
  refresh();
  return () => { off(); clearTimeout(timer); };
}

const COLORS = ['#e8577f', '#f08a5d', '#9d86f7', '#4fc9a8'];

function openDateEditor({ row = null, date }) {
  const r = row || { title: '', date, kind: 'red', color: COLORS[0], yearly: false };
  openSheet({
    title: row ? 'Важная дата' : 'Новая дата',
    build(body, close) {
      body.innerHTML = `
        <form class="editor" novalidate>
          <input class="field" name="title" placeholder="Например: день рождения мамы" aria-label="Название" value="${esc(r.title)}" autofocus>
          <label class="lbl">Дата<input class="field" type="date" name="date" value="${r.date}"></label>
          <div class="segmented kind" role="radiogroup" aria-label="Тип">
            <button type="button" role="radio" data-kind="red" aria-checked="${r.kind === 'red'}" aria-selected="${r.kind === 'red'}">Красная дата</button>
            <button type="button" role="radio" data-kind="deadline" aria-checked="${r.kind === 'deadline'}" aria-selected="${r.kind === 'deadline'}">Дедлайн</button>
          </div>
          <div class="colors" ${r.kind === 'red' ? '' : 'hidden'} role="radiogroup" aria-label="Цвет">
            ${COLORS.map((c) => `<button type="button" class="color-dot" style="background:${c}" data-c="${c}" role="radio" aria-checked="${r.color === c}" aria-label="Цвет"></button>`).join('')}
          </div>
          <label class="switch"><input type="checkbox" name="yearly" ${r.yearly ? 'checked' : ''}><span></span>Повторять каждый год</label>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions">
            <button class="btn" type="submit">${icon('check', 18)}Сохранить</button>
            ${row ? `<button class="icon-btn danger" type="button" data-act="delete" aria-label="Удалить дату">${icon('trash', 20)}</button>` : ''}
          </div>
        </form>`;
      const f = body.querySelector('form');
      let kind = r.kind;
      let color = r.color || COLORS[0];
      body.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
        kind = b.dataset.kind;
        body.querySelectorAll('[data-kind]').forEach((x) => { const on = x === b; x.setAttribute('aria-checked', on); x.setAttribute('aria-selected', on); });
        body.querySelector('.colors').hidden = kind !== 'red';
      }));
      body.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => {
        color = b.dataset.c;
        body.querySelectorAll('[data-c]').forEach((x) => x.setAttribute('aria-checked', x === b));
      }));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = f.title.value.trim();
        if (!title) { body.querySelector('.auth-error').textContent = 'Напиши, что это за дата'; return; }
        if (!f.date.value) { body.querySelector('.auth-error').textContent = 'Выбери дату'; return; }
        const fields = { title, date: f.date.value, kind, color: kind === 'red' ? color : null, yearly: f.yearly.checked };
        if (row) await store.patch('special_dates', r.id, fields);
        else await store.upsert('special_dates', { ...fields, created_at: new Date().toISOString() });
        close();
      });
      body.querySelector('[data-act=delete]')?.addEventListener('click', async () => {
        const ok = await choose({ title: 'Удалить дату?', text: `«${r.title}» исчезнет из календаря`, options: [{ label: 'Удалить', value: true, tone: 'danger' }, { label: 'Отмена', value: false }] });
        if (!ok) return;
        await store.remove('special_dates', r.id);
        close();
      });
    },
  });
}
