// Экран одного дня: кольцо выполнения, лента задач, быстрое добавление.
import { store } from '../supabase.js';
import { createDayRing, setDayRing } from '../ui/progress.js';
import { renderTaskRow } from '../ui/task-item.js';
import { openTaskEditor } from '../ui/task-editor.js';
import { icon } from '../ui/icons.js';
import { renderImageOfDay } from '../ui/image-of-day.js';
import { celebrate } from '../ui/celebrate.js';
import { renderTodayHabits } from '../ui/habit-ui.js';
import { ideasForDate, platformLabel } from '../ideas.js';
import { dayMood } from '../mood.js';
import { sortTasks, dayProgress, newTaskDraft } from '../tasks.js';
import { addDays, todayISO, parseISODate, formatDayTitle } from '../dates.js';

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

// mode: 'today' — переключатель «Сегодня / Завтра»; 'day' — стрелки по дням.
export function renderDay(root, { date, mode, user }) {
  let current = date;
  root.innerHTML = `
    <div class="day-switch"></div>
    <header class="day-head">
      <div class="ring-slot"></div>
      <div class="day-meta">
        <div class="wd"></div><div class="mo"></div>
        <div class="sum"></div>
      </div>
    </header>
    <section class="panel">
      <form class="quick-add">
        <input class="field" name="q" placeholder="Добавить задачу…" aria-label="Быстро добавить задачу" autocomplete="off">
        <button class="icon-btn accent" type="submit" aria-label="Добавить">${icon('plus', 20)}</button>
      </form>
      <div class="timeline" role="list"></div>
      <div class="actions">
        <button class="btn" type="button" data-act="new">${icon('plus', 18)}Задача со временем</button>
      </div>
    </section>
    <div id="day-ideas"></div>
    <div id="day-habits"></div>
    <div id="image-of-day"></div>`;

  const ring = createDayRing(0);
  const num = document.createElement('div');
  num.className = 'day-num';
  ring.appendChild(num);
  root.querySelector('.ring-slot').replaceWith(ring);
  const list = root.querySelector('.timeline');
  const sum = root.querySelector('.sum');
  const sw = root.querySelector('.day-switch');

  function renderSwitch() {
    const today = todayISO();
    if (mode === 'today') {
      const tomorrow = addDays(today, 1);
      sw.innerHTML = `<div class="segmented" role="tablist">
        <button role="tab" aria-selected="${current === today}" data-d="${today}">Сегодня</button>
        <button role="tab" aria-selected="${current === tomorrow}" data-d="${tomorrow}">Завтра</button></div>`;
    } else {
      sw.innerHTML = `<div class="day-arrows">
        <button class="icon-btn" data-d="${addDays(current, -1)}" aria-label="Предыдущий день">${icon('chevronLeft')}</button>
        <a class="link-btn" href="#/today">к сегодняшнему дню</a>
        <button class="icon-btn" data-d="${addDays(current, 1)}" aria-label="Следующий день">${icon('chevronRight')}</button></div>`;
    }
    sw.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
      if (mode === 'day') { location.hash = `#/day/${b.dataset.d}`; return; }
      current = b.dataset.d; refresh();
    }));
  }

  let iodKey = null;
  async function refresh() {
    renderSwitch();
    // публикации идей на этот день
    const pubs = ideasForDate(await store.list('ideas'), current);
    const ib = root.querySelector('#day-ideas');
    ib.innerHTML = pubs.length ? `<section class="panel"><div class="panel-title">${icon('idea', 18)}Публикации</div><div class="day-ideas">${pubs.map((i) =>
      `<a class="day-idea" href="#/ideas">${i.status === 'published' ? icon('check', 14) : ''}${i.title.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))} · ${platformLabel(i.platform)}</a>`).join('')}</div></section>` : '';
    const habitsBox = root.querySelector('#day-habits');
    if (current <= todayISO()) renderTodayHabits(habitsBox, current); else habitsBox.innerHTML = '';
    const d = parseISODate(current);
    num.textContent = d.getDate();
    root.querySelector('.wd').textContent = formatDayTitle(current).split(',')[0];
    root.querySelector('.mo').textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const tasks = sortTasks(await store.list('tasks', (t) => t.date === current));
    const p = dayProgress(tasks);
    // картинка дня по настроению: весёлая, когда всё сделано, грустная — когда задачи ждут (только для сегодня)
    const mood = current === todayISO() ? dayMood(tasks, current, new Date()) : null;
    if (iodKey !== `${current}:${mood}`) { iodKey = `${current}:${mood}`; renderImageOfDay(root.querySelector('#image-of-day'), current, mood); }
    setDayRing(ring, p.percent);
    sum.innerHTML = p.total ? `Сделано <b>${p.done} из ${p.total}</b>` : 'Планов пока нет';
    list.innerHTML = '';
    if (!tasks.length) {
      list.innerHTML = `<p class="empty-line">${current < todayISO() ? 'В этот день задач не было' : 'Пусто. Напиши первую задачу в поле выше'}</p>`;
    }
    const today = todayISO();
    for (const t of tasks) {
      list.appendChild(renderTaskRow(t, {
        today,
        onToggle: async (task) => {
          await store.patch('tasks', task.id, { done: !task.done, done_at: task.done ? null : new Date().toISOString() });
          if (!task.done) celebrate({ done: p.done + 1, total: p.total });
        },
        onOpen: (task) => openTaskEditor({ task, date: current, user }),
      }));
    }
  }

  root.querySelector('.quick-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.q;
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    await store.upsert('tasks', { ...newTaskDraft({ date: current }), title, created_at: new Date().toISOString() });
  });
  root.querySelector('[data-act=new]').addEventListener('click', () => openTaskEditor({ date: current, user }));

  let timer;
  const off = store.on('change', (table) => {
    if (table === 'tasks') { clearTimeout(timer); timer = setTimeout(refresh, 60); }
    if (table === 'ideas') { clearTimeout(timer); timer = setTimeout(refresh, 60); }
    if (table === 'habits' || table === 'habit_logs') { if (current <= todayISO()) renderTodayHabits(root.querySelector('#day-habits'), current); }
    if (table === 'images') { iodKey = null; clearTimeout(timer); timer = setTimeout(refresh, 60); }
  });
  refresh();
  return () => { off(); clearTimeout(timer); };
}
