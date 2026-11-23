// Экран одного дня: кольцо выполнения, лента задач, быстрое добавление.
import { store } from '../supabase.js';
import { createDayRing, setDayRing } from '../ui/progress.js';
import { renderTaskRow } from '../ui/task-item.js';
import { openTaskEditor } from '../ui/task-editor.js';
import { toast } from '../ui/sheet.js';
import { icon } from '../ui/icons.js';
import { renderImageOfDay } from '../ui/image-of-day.js';
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

  let iodDate = null;
  async function refresh() {
    renderSwitch();
    if (iodDate !== current) { iodDate = current; renderImageOfDay(root.querySelector('#image-of-day'), current); }
    const d = parseISODate(current);
    num.textContent = d.getDate();
    root.querySelector('.wd').textContent = formatDayTitle(current).split(',')[0];
    root.querySelector('.mo').textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const tasks = sortTasks(await store.list('tasks', (t) => t.date === current));
    const p = dayProgress(tasks);
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
          await store.upsert('tasks', { ...task, done: !task.done, done_at: task.done ? null : new Date().toISOString() });
          if (!task.done && p.done + 1 === p.total) toast('Все задачи дня выполнены!');
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
    if (table === 'images') { iodDate = null; clearTimeout(timer); timer = setTimeout(refresh, 60); }
  });
  refresh();
  return () => { off(); clearTimeout(timer); };
}
