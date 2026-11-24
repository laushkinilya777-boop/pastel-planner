// Общие части привычек: отметка дня, редактор привычки, блок «Привычки дня».
import { store } from '../supabase.js';
import { openSheet, choose } from './sheet.js';
import { icon } from './icons.js';
import { HABIT_COLORS, habitColor, todayHabits, streak } from '../habits.js';
import { stableId } from '../ids.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export const logId = (habitId, date) => stableId(`habit:${habitId}:${date}`);

// Поставить / снять отметку привычки за день.
export async function toggleHabit(habit, date, logs) {
  const id = logId(habit.id, date);
  if (logs.some((l) => l.id === id || (l.habit_id === habit.id && l.date === date))) {
    const existing = logs.find((l) => l.habit_id === habit.id && l.date === date);
    await store.remove('habit_logs', existing?.id || id);
  } else {
    await store.upsert('habit_logs', { id, habit_id: habit.id, date, created_at: new Date().toISOString() });
  }
}

export function openHabitEditor(habit = null) {
  const h = habit || { title: '', color: 'lilac', weekdays: null };
  let color = h.color;
  openSheet({
    title: habit ? 'Привычка' : 'Новая привычка',
    build(body, close) {
      body.innerHTML = `
        <form class="editor" novalidate>
          <input class="field" name="title" placeholder="Например: выпить 2 л воды" aria-label="Привычка" value="${esc(h.title)}" autofocus>
          <div class="lbl">Цвет
            <div class="colors" role="radiogroup" aria-label="Цвет">
              ${HABIT_COLORS.map((c) => `<button type="button" class="color-dot" data-c="${c.id}" role="radio" aria-checked="${c.id === color}" aria-label="${c.name}" style="background:${c.fill}"></button>`).join('')}
            </div>
          </div>
          <div class="segmented kind" role="radiogroup" aria-label="Когда">
            <button type="button" data-every="1" aria-selected="${!h.weekdays?.length}">Каждый день</button>
            <button type="button" data-every="0" aria-selected="${!!h.weekdays?.length}">По дням недели</button>
          </div>
          <div class="chips" ${h.weekdays?.length ? '' : 'hidden'}>
            ${WD.map((d, i) => `<label class="chip"><input type="checkbox" name="wd" value="${i + 1}" ${h.weekdays?.includes(i + 1) ? 'checked' : ''}><span>${d}</span></label>`).join('')}
          </div>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions">
            <button class="btn" type="submit">${icon('check', 18)}Сохранить</button>
            ${habit ? `<button class="icon-btn danger" type="button" data-act="delete" aria-label="Удалить привычку">${icon('trash', 20)}</button>` : ''}
          </div>
        </form>`;
      const f = body.querySelector('form');
      let every = !h.weekdays?.length;
      body.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => {
        color = b.dataset.c;
        body.querySelectorAll('[data-c]').forEach((x) => x.setAttribute('aria-checked', x === b));
      }));
      body.querySelectorAll('[data-every]').forEach((b) => b.addEventListener('click', () => {
        every = b.dataset.every === '1';
        body.querySelectorAll('[data-every]').forEach((x) => x.setAttribute('aria-selected', x === b));
        body.querySelector('.chips').hidden = every;
      }));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = f.title.value.trim();
        const err = body.querySelector('.auth-error');
        if (!title) { err.textContent = 'Напиши привычку'; return; }
        const weekdays = every ? null : [...f.querySelectorAll('[name=wd]:checked')].map((x) => Number(x.value));
        if (!every && !weekdays.length) { err.textContent = 'Выбери хотя бы один день'; return; }
        if (habit) await store.patch('habits', h.id, { title, color, weekdays });
        else await store.upsert('habits', { title, color, weekdays, archived: false, sort: Date.now(), created_at: new Date().toISOString() });
        close();
      });
      body.querySelector('[data-act=delete]')?.addEventListener('click', async () => {
        const ok = await choose({ title: 'Удалить привычку?', text: `«${h.title}» и все её отметки исчезнут`, options: [{ label: 'Удалить', value: true, tone: 'danger' }, { label: 'Отмена', value: false }] });
        if (!ok) return;
        await store.remove('habits', h.id);
        close();
      });
    },
  });
}

// Блок на странице «Сегодня»: привычки дня одним касанием.
export async function renderTodayHabits(root, today) {
  const [habits, logs] = await Promise.all([store.list('habits'), store.list('habit_logs')]);
  const list = todayHabits(habits, today).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  if (!list.length) { root.innerHTML = ''; return; }
  const done = list.filter((h) => logs.some((l) => l.habit_id === h.id && l.date === today)).length;
  root.innerHTML = `<section class="panel">
    <div class="panel-title">${icon('habit', 18)}Привычки дня<span class="pt-count">${done} / ${list.length}</span></div>
    <div class="habit-chips"></div></section>`;
  const box = root.querySelector('.habit-chips');
  for (const h of list) {
    const on = logs.some((l) => l.habit_id === h.id && l.date === today);
    const c = habitColor(h.color);
    const s = streak(h, logs, today);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `habit-chip${on ? ' on' : ''}`;
    b.style.setProperty('--hc', c.fill);
    b.style.setProperty('--hs', c.soft);
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = `<span class="hc-dot">${on ? icon('check', 14) : ''}</span><span>${esc(h.title)}</span>${s ? `<span class="hc-streak">${icon('flame', 13)}${s}</span>` : ''}`;
    b.addEventListener('click', () => toggleHabit(h, today, logs));
    box.appendChild(b);
  }
}
