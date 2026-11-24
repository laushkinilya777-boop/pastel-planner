// Привычки: неделя с кружками-отметками и серии; месяц — пастельная тепловая карта.
import { store } from '../supabase.js';
import { icon } from '../ui/icons.js';
import { toggleHabit, openHabitEditor } from '../ui/habit-ui.js';
import { habitColor, streak, weekStates, monthStates } from '../habits.js';
import { weekStart, weekDays, addDays, todayISO, parseISODate, formatMonthTitle } from '../dates.js';
import { monthStart, prevMonth, nextMonth } from '../budget.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
let shownWeek = null;
let shownMonth = null; // 'YYYY-MM-01' для вида «Месяц»
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
let mode = 'week';

export function render(root) {
  shownWeek ??= weekStart(todayISO());
  shownMonth ??= monthStart(todayISO());
  root.innerHTML = `
    <div class="period-head">
      <button class="icon-btn" data-nav="-1" aria-label="Назад">${icon('chevronLeft')}</button>
      <div><h1 class="page-title">Привычки</h1><p class="period-sub"></p></div>
      <button class="icon-btn" data-nav="1" aria-label="Вперёд">${icon('chevronRight')}</button>
    </div>
    <div class="view-switch">
      <div class="segmented" role="tablist" aria-label="Вид">
        <button role="tab" data-mode="week">Неделя</button>
        <button role="tab" data-mode="month">Месяц</button>
      </div>
    </div>
    <section class="panel habits-panel"></section>
    <button class="btn" type="button" data-act="new">${icon('plus', 18)}Привычка</button>`;

  const panel = root.querySelector('.habits-panel');
  root.querySelector('[data-act=new]').addEventListener('click', () => openHabitEditor());
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; refresh(); }));
  root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    const k = Number(b.dataset.nav);
    if (mode === 'week') shownWeek = addDays(shownWeek, 7 * k);
    else shownMonth = k < 0 ? prevMonth(shownMonth) : nextMonth(shownMonth);
    refresh();
  }));

  async function refresh() {
    root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === mode));
    const today = todayISO();
    const [habits, logs] = await Promise.all([store.list('habits'), store.list('habit_logs')]);
    const list = habits.filter((h) => !h.archived).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const days = weekDays(shownWeek);
    const y = Number(shownMonth.slice(0, 4)); const m = Number(shownMonth.slice(5, 7));
    const a = parseISODate(days[0]); const b = parseISODate(days[6]);
    root.querySelector('.period-sub').textContent = mode === 'week'
      ? (a.getMonth() === b.getMonth()
        ? `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`
        : `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`)
      : formatMonthTitle(y, m);

    if (!list.length) {
      panel.innerHTML = `<p class="empty-line">Пока нет привычек. Добавь первую — например, «вода 2 л» или «10 минут чтения»</p>`;
      return;
    }
    if (mode === 'week') {
      panel.innerHTML = `<div class="hw-head"><span></span>${days.map((d, i) => `<span class="${d === today ? 'today' : ''}${i >= 5 ? ' weekend' : ''}">${WD[i]}<b>${parseISODate(d).getDate()}</b></span>`).join('')}</div>`;
      for (const h of list) {
        const c = habitColor(h.color);
        const st = weekStates(h, logs, shownWeek, today);
        const s = streak(h, logs, today);
        const row = document.createElement('div');
        row.className = 'hw-row';
        row.style.setProperty('--hc', c.fill);
        row.style.setProperty('--hs', c.soft);
        row.innerHTML = `<button class="hw-title" type="button"><b>${esc(h.title)}</b>${s ? `<span class="hc-streak">${icon('flame', 13)}${s}</span>` : ''}</button>
          ${st.map((x, i) => `<button class="hw-dot ${x}" type="button" data-i="${i}" ${x === 'off' || days[i] > today ? 'disabled' : ''}
            aria-label="${esc(h.title)}, ${WD[i]}: ${x === 'done' ? 'выполнено' : x === 'off' ? 'не запланировано' : 'не выполнено'}">${x === 'done' ? icon('check', 14) : ''}</button>`).join('')}`;
        row.querySelector('.hw-title').addEventListener('click', () => openHabitEditor(h));
        row.querySelectorAll('.hw-dot:not([disabled])').forEach((b) => b.addEventListener('click', () => toggleHabit(h, days[Number(b.dataset.i)], logs)));
        panel.appendChild(row);
      }
    } else {
      panel.innerHTML = '';
      for (const h of list) {
        const c = habitColor(h.color);
        const ms = monthStates(h, logs, y, m, today);
        const done = ms.filter((x) => x.state === 'done').length;
        const due = ms.filter((x) => x.state !== 'off' && x.date <= today).length;
        const first = (parseISODate(ms[0].date).getDay() + 6) % 7;
        const card = document.createElement('div');
        card.className = 'hm-card';
        card.style.setProperty('--hc', c.fill);
        card.style.setProperty('--hs', c.soft);
        card.innerHTML = `<button class="hw-title" type="button"><b>${esc(h.title)}</b><span class="hm-sum">${done}${due ? ` из ${due}` : ''}</span></button>
          <div class="hm-grid">${'<i class="hm-pad"></i>'.repeat(first)}${ms.map((x) => `<i class="hm ${x.state}" title="${parseISODate(x.date).getDate()}"></i>`).join('')}</div>`;
        card.querySelector('.hw-title').addEventListener('click', () => openHabitEditor(h));
        panel.appendChild(card);
      }
    }
  }

  let timer;
  const off = store.on('change', (t) => { if (t === 'habits' || t === 'habit_logs') { clearTimeout(timer); timer = setTimeout(refresh, 40); } });
  refresh();
  return () => { off(); clearTimeout(timer); };
}
