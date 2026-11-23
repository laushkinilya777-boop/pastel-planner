// Редактор задачи: создание, правка, повтор, напоминание, цель, удаление.
import { client, store } from '../supabase.js';
import { openSheet, choose, toast } from './sheet.js';
import { openHistory } from './history-sheet.js';
import { icon } from './icons.js';
import { newTaskDraft, recurrenceRule, describeRule, DEFAULT_REMIND } from '../tasks.js';
import { addDays, todayISO, weekStart } from '../dates.js';

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const REPEATS = [
  ['none', 'Не повторять'], ['daily', 'Каждый день'], ['weekdays', 'По дням недели'],
  ['weekly', 'Каждую неделю'], ['monthly', 'Каждый месяц'], ['yearly', 'Каждый год'],
];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NEED_NET = 'Для повторов нужен интернет. Подключись и попробуй ещё раз';

async function goalsFor(date) {
  const wk = weekStart(date);
  const mo = date.slice(0, 8) + '01';
  return (await store.list('goals')).filter((g) =>
    (g.period === 'week' && g.period_start === wk) || (g.period === 'month' && g.period_start === mo));
}

async function online(fn) {
  if (navigator.onLine === false) throw new Error(NEED_NET);
  try { return await fn(); } catch (e) {
    if (e instanceof TypeError || /fetch/i.test(e.message)) throw new Error(NEED_NET);
    throw e;
  }
}
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export async function openTaskEditor({ task = null, date = todayISO(), user }) {
  const isNew = !task;
  const t = task ? { ...task } : newTaskDraft({ date });
  const rec = t.recurrence_id ? (await store.list('recurrences')).find((r) => r.id === t.recurrence_id) : null;
  const goals = await goalsFor(t.date);

  openSheet({
    title: isNew ? 'Новая задача' : 'Задача',
    build(body, close) {
      body.innerHTML = `
        <form class="editor" novalidate>
          <input class="field" name="title" placeholder="Что сделать?" aria-label="Название" value="${esc(t.title)}" autofocus required>
          <div class="grid2">
            <label class="lbl">Дата<input class="field" type="date" name="date" value="${t.date}"></label>
            <label class="lbl">Время<input class="field" type="time" name="time" value="${t.time ? t.time.slice(0, 5) : ''}"></label>
          </div>
          <label class="lbl remind" ${t.time ? '' : 'hidden'}><span class="lbl-t">${icon('bell', 16)}Напоминание</span>
            <select class="field" name="remind">
              <option value="">без напоминания</option>
              ${[5, 15, 30, 60].map((m) => `<option value="${m}" ${t.remind_minutes === m ? 'selected' : ''}>за ${m} мин</option>`).join('')}
            </select>
          </label>
          <textarea class="field" name="note" rows="2" placeholder="Заметка" aria-label="Заметка">${esc(t.note)}</textarea>
          ${goals.length ? `<label class="lbl"><span class="lbl-t">${icon('target', 16)}Цель</span>
            <select class="field" name="goal"><option value="">без цели</option>
              ${goals.map((g) => `<option value="${g.id}" ${t.goal_id === g.id ? 'selected' : ''}>${esc(g.title)} · ${g.period === 'week' ? 'неделя' : 'месяц'}</option>`).join('')}
            </select></label>` : ''}
          <fieldset class="repeat">
            <label class="lbl"><span class="lbl-t">${icon('repeat', 16)}Повтор</span>
              <select class="field" name="repeat">
                ${REPEATS.filter(([v]) => !(rec && v === 'none')).map(([v, l]) => `<option value="${v}" ${(rec?.freq || 'none') === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select></label>
            <div class="chips" ${rec?.freq === 'weekdays' ? '' : 'hidden'}>
              ${WD.map((d, i) => `<label class="chip"><input type="checkbox" name="wd" value="${i + 1}" ${rec?.weekdays?.includes(i + 1) ? 'checked' : ''}><span>${d}</span></label>`).join('')}
            </div>
            <label class="lbl until" ${rec ? '' : 'hidden'}>До даты (необязательно)<input class="field" type="date" name="until" value="${rec?.end_date || ''}"></label>
            ${rec ? `<p class="hint">Сейчас: ${describeRule(rec)}</p>` : ''}
          </fieldset>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions">
            <button class="btn" type="submit">${icon('check', 18)}Сохранить</button>
            ${isNew ? '' : `<button class="btn ghost" type="button" data-act="history">${icon('history', 18)}История</button>
            <button class="icon-btn danger" type="button" data-act="delete" aria-label="Удалить">${icon('trash', 20)}</button>`}
          </div>
        </form>`;

      const f = body.querySelector('form');
      const err = body.querySelector('.auth-error');
      const btn = f.querySelector('[type=submit]');
      f.time.addEventListener('input', () => {
        body.querySelector('.remind').hidden = !f.time.value;
        if (f.time.value && !f.remind.value && t.remind_minutes !== 0) f.remind.value = String(DEFAULT_REMIND);
      });
      f.repeat.addEventListener('change', () => {
        body.querySelector('.chips').hidden = f.repeat.value !== 'weekdays';
        body.querySelector('.until').hidden = f.repeat.value === 'none';
      });
      body.querySelector('[data-act=history]')?.addEventListener('click', () => openHistory(t));
      body.querySelector('[data-act=delete]')?.addEventListener('click', async () => {
        try { if (await removeTask(t)) close(); } catch (e) { err.textContent = e.message; }
      });

      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.textContent = '';
        const title = f.title.value.trim();
        if (!title) { err.textContent = 'Напиши, что нужно сделать'; f.title.focus(); return; }
        const time = f.time.value || null;
        const next = {
          ...t, title, date: f.date.value || t.date, time,
          remind_minutes: time && f.remind.value ? Number(f.remind.value) : null,
          note: f.note.value.trim() || null,
          goal_id: f.goal ? (f.goal.value || null) : t.goal_id,
        };
        const form = { repeat: f.repeat.value, weekdays: [...f.querySelectorAll('[name=wd]:checked')].map((x) => Number(x.value)), until: f.until.value };
        if (form.repeat === 'weekdays' && !form.weekdays.length) { err.textContent = 'Выбери хотя бы один день недели'; return; }
        btn.disabled = true;
        try {
          if (await saveTask({ before: t, next, rec, form, user })) close();
        } catch (ex) {
          err.textContent = ex.message;
        } finally {
          btn.disabled = false;
        }
      });
    },
  });
}

const RULE_KEYS = ['freq', 'weekdays', 'end_date'];
const TASK_KEYS = ['title', 'time', 'note', 'remind_minutes', 'goal_id'];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const timeKey = (v) => (v ? String(v).slice(0, 5) : null);

// true — можно закрыть редактор.
async function saveTask({ before, next, rec, form, user }) {
  const rule = recurrenceRule(form, next.date);

  // новое время или дата — напоминание должно сработать снова
  if (timeKey(before.time) !== timeKey(next.time) || before.date !== next.date) next.reminded_at = null;

  // 1) обычная задача без повтора
  if (!before.recurrence_id && !rule) {
    await store.upsert('tasks', strip({ ...next, created_at: next.created_at || new Date().toISOString() }));
    return true;
  }

  // 2) новая или обычная задача становится повторяющейся
  if (!before.recurrence_id && rule) {
    await online(async () => {
      check(await client.from('recurrences').insert({
        ...rule, title: next.title, time: next.time, note: next.note,
        remind_minutes: next.remind_minutes, goal_id: next.goal_id,
      }));
      if (before.id) check(await client.from('tasks').delete().eq('id', before.id));
      check(await client.rpc('materialize', { p_user: user.id, p_until: addDays(todayISO(), 60) }));
    });
    await store.refresh('recurrences');
    await store.refresh('tasks');
    toast('Повтор создан');
    return true;
  }

  // 3) повторяющаяся задача
  const changes = {};
  for (const k of TASK_KEYS) {
    const a = k === 'time' ? timeKey(before[k]) : before[k];
    const b = k === 'time' ? timeKey(next[k]) : next[k];
    if (!same(a, b)) changes[k] = b;
  }
  const ruleChanged = rule && RULE_KEYS.some((k) => !same(rec?.[k], rule[k]));
  if (ruleChanged) Object.assign(changes, { freq: rule.freq, weekdays: rule.weekdays, end_date: rule.end_date });
  const dateChanged = next.date !== before.date;

  if (!Object.keys(changes).length && !dateChanged) return true;

  // перенос одного дня или правка без смены правила — можно «только эту»
  let scope = 'one';
  if (!dateChanged || ruleChanged) {
    scope = ruleChanged ? 'all' : await choose({
      title: 'Изменить повторяющуюся задачу',
      options: [
        { label: 'Только эту', value: 'one' },
        { label: 'Эту и все следующие', value: 'all', tone: '' },
      ],
    });
    if (!scope) return false;
  }
  if (scope === 'one') {
    await store.upsert('tasks', strip({ ...next, is_exception: true }));
    return true;
  }
  await online(async () => {
    check(await client.rpc('split_recurrence', { p_task_id: before.id, p_changes: changes }));
  });
  await store.refresh('recurrences');
  await store.refresh('tasks');
  toast('Изменено для этой и следующих');
  return true;
}

async function removeTask(t) {
  if (!t.recurrence_id) {
    const ok = await choose({ title: 'Удалить задачу?', text: `«${t.title}» исчезнет из планера`, options: [{ label: 'Удалить', value: true, tone: 'danger' }, { label: 'Отмена', value: false }] });
    if (!ok) return false;
    await store.remove('tasks', t.id);
    return true;
  }
  const scope = await choose({
    title: 'Удалить повторяющуюся задачу',
    options: [
      { label: 'Только эту', value: 'one' },
      { label: 'Эту и все следующие', value: 'all', tone: 'danger' },
    ],
  });
  if (!scope) return false;
  if (scope === 'one') { await store.remove('tasks', t.id); return true; }
  await online(async () => check(await client.rpc('end_recurrence_from', { p_task_id: t.id })));
  await store.refresh('recurrences');
  await store.refresh('tasks');
  return true;
}

// В базу уходят только колонки таблицы tasks.
const COLS = ['id', 'title', 'date', 'time', 'note', 'done', 'done_at', 'carry_count', 'remind_minutes', 'reminded_at',
  'goal_id', 'recurrence_id', 'occurrence_date', 'is_exception', 'created_at', 'user_id'];
function strip(row) {
  const out = {};
  for (const k of COLS) if (row[k] !== undefined) out[k] = row[k];
  if (out.time && out.time.length === 5) out.time += ':00';
  return out;
}
