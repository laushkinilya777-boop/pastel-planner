// Неделя: цели недели и 7 дней с короткими списками задач.
import { store } from '../supabase.js';
import { renderGoals, openGoalEditor } from '../ui/goal-card.js';
import { icon } from '../ui/icons.js';
import { goalsFor } from '../goals.js';
import { sortTasks, dayProgress } from '../tasks.js';
import { weekStart, weekDays, addDays, todayISO, parseISODate } from '../dates.js';

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let shownWeek = null; // запоминаем неделю, пока сайт открыт
const VIEW_KEY = 'planner-week-view';
const loadView = () => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; } };
const saveView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* ничего */ } };

function rangeTitle(start) {
  const a = parseISODate(start);
  const b = parseISODate(addDays(start, 6));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
}

export function render(root) {
  shownWeek ??= weekStart(todayISO());
  root.innerHTML = `
    <div class="period-head">
      <button class="icon-btn" data-nav="-7" aria-label="Предыдущая неделя">${icon('chevronLeft')}</button>
      <div><h1 class="page-title">Неделя</h1><p class="period-sub"></p></div>
      <button class="icon-btn" data-nav="7" aria-label="Следующая неделя">${icon('chevronRight')}</button>
    </div>
    <section class="panel">
      <div class="panel-title">${icon('target', 18)}Цели недели</div>
      <div class="goals"></div>
      <button class="btn ghost" type="button" data-act="goal">${icon('plus', 18)}Цель недели</button>
    </section>
    <div class="view-switch">
      <div class="segmented" role="tablist" aria-label="Вид дней">
        <button role="tab" data-view="grid">Плитка</button>
        <button role="tab" data-view="list">Лента</button>
      </div>
    </div>
    <div class="week-days"></div>`;

  let view = loadView();
  const paintView = () => {
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === view));
    root.querySelector('.week-days').classList.toggle('as-list', view === 'list');
  };
  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    view = b.dataset.view; saveView(view); paintView(); refresh();
  }));
  paintView();

  root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    shownWeek = addDays(shownWeek, Number(b.dataset.nav)); refresh();
  }));
  root.querySelector('[data-act=goal]').addEventListener('click', () => openGoalEditor({ period: 'week', periodStart: shownWeek }));

  async function refresh() {
    const days = weekDays(shownWeek);
    root.querySelector('.period-sub').textContent = rangeTitle(shownWeek) + (shownWeek === weekStart(todayISO()) ? ' · эта неделя' : '');
    const [tasks, goals] = await Promise.all([store.list('tasks'), store.list('goals')]);
    const weekGoals = goalsFor(goals, 'week', shownWeek);
    renderGoals(root.querySelector('.goals'), weekGoals, tasks, 'Целей на эту неделю пока нет');

    const today = todayISO();
    root.querySelector('.week-days').innerHTML = days.map((d, i) => {
      const list = sortTasks(tasks.filter((t) => t.date === d));
      const p = dayProgress(list);
      const free = i >= 5 ? 'выходной — отдыхай' : 'свободно';
      const cls = `day-card${d === today ? ' today' : ''}${d < today ? ' past' : ''}${i >= 5 ? ' weekend' : ''}${p.total && p.done === p.total ? ' all-done' : ''}`;
      if (view === 'list') {
        // «Лента»: слева бейдж с датой, который «наливается» по мере выполнения, справа задачи-пилюли
        return `<a class="${cls}" href="#/day/${d}">
          <div class="dl-badge" style="--p:${p.percent}%">
            <span class="dc-wd">${WD[i]}</span><span class="dc-num">${parseISODate(d).getDate()}</span>
          </div>
          <div class="dl-body">
            ${list.length ? `<ul class="pills">${list.slice(0, 6).map((t) => `<li class="${t.done ? 'done' : ''}">${t.time ? `<i>${t.time.slice(0, 5)}</i>` : ''}<span>${esc(t.title)}</span></li>`).join('')}${list.length > 6 ? `<li class="more">+${list.length - 6}</li>` : ''}</ul>` : `<p class="dc-empty">${free}</p>`}
          </div>
          ${p.total ? `<span class="dc-sum">${p.done}/${p.total}</span>` : ''}
        </a>`;
      }
      const shown = list.slice(0, 4);
      return `<a class="${cls}" href="#/day/${d}">
        <div class="day-card-head">
          <span class="dc-wd">${WD[i]}</span><span class="dc-num">${parseISODate(d).getDate()}</span>
          ${p.total ? `<span class="dc-sum">${p.done}/${p.total}</span>` : ''}
        </div>
        ${shown.length ? `<ul>${shown.map((t) => `<li class="${t.done ? 'done' : ''}">${t.time ? `<i>${t.time.slice(0, 5)}</i>` : ''}${esc(t.title)}</li>`).join('')}</ul>` : `<p class="dc-empty">${free}</p>`}
        ${list.length > 4 ? `<p class="dc-more">ещё ${list.length - 4}</p>` : ''}
      </a>`;
    }).join('');
  }

  let timer;
  const off = store.on('change', (t) => {
    if (t === 'tasks' || t === 'goals') { clearTimeout(timer); timer = setTimeout(refresh, 60); }
  });
  refresh();
  return () => { off(); clearTimeout(timer); };
}
