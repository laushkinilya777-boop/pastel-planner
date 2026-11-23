// Карточка цели с «жидкой» капсулой и кнопками ±1, плюс редактор цели.
import { store } from '../supabase.js';
import { createLiquid, setLiquid } from './progress.js';
import { openSheet, choose } from './sheet.js';
import { icon } from './icons.js';
import { goalProgress } from '../goals.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Рисует цели в box: существующие карточки обновляет на месте (капсула плавно доливается), новые создаёт.
export function renderGoals(box, goals, tasks, emptyText) {
  const old = new Map([...box.querySelectorAll('.goal-card')].map((c) => [c.dataset.id, c]));
  box.querySelector('.empty-line')?.remove();
  for (const g of goals) {
    const c = old.get(g.id);
    if (c) { c._update(g, tasks); old.delete(g.id); box.appendChild(c); } else box.appendChild(createGoalCard(g, tasks));
  }
  old.forEach((c) => c.remove());
  if (!goals.length) box.insertAdjacentHTML('afterbegin', `<p class="empty-line">${emptyText}</p>`);
}

export function createGoalCard(goal, tasks) {
  const card = document.createElement('div');
  card.className = 'goal-card';
  card.dataset.id = goal.id;
  const linked = tasks.filter((t) => t.goal_id === goal.id).length;
  card.innerHTML = `
    <button class="goal goal-open" type="button" aria-label="Изменить цель ${esc(goal.title)}">
      <b>${esc(goal.title)}</b><span class="goal-count"></span>
    </button>
    <div class="liquid-slot"></div>
    <div class="goal-foot">
      <span class="hint">${linked ? `задач привязано: ${linked}` : 'можно привязать задачи в редакторе задачи'}</span>
      <div class="goal-btns">
        <button class="icon-btn" type="button" data-d="-1" aria-label="Минус один">−1</button>
        <button class="icon-btn accent" type="button" data-d="1" aria-label="Плюс один">+1</button>
      </div>
    </div>`;
  const p = goalProgress(goal, tasks);
  card.querySelector('.goal-count').textContent = `${p.value} / ${p.target}`;
  const liquid = createLiquid(p.percent);
  card.querySelector('.liquid-slot').replaceWith(liquid);

  card.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', async () => {
    const d = Number(b.dataset.d);
    const cur = goalProgress(goal, tasks);
    if ((d > 0 && cur.value >= cur.target) || (d < 0 && cur.value <= 0)) return;
    goal = { ...goal, manual_adjust: (goal.manual_adjust || 0) + d };
    const np = goalProgress(goal, tasks);
    card.querySelector('.goal-count').textContent = `${np.value} / ${np.target}`;
    setLiquid(liquid, np.percent);
    await store.patch('goals', goal.id, { manual_adjust: goal.manual_adjust });
  }));
  card.querySelector('.goal-open').addEventListener('click', () => openGoalEditor({ goal }));
  card._update = (g, ts) => {
    goal = g; tasks = ts;
    const np = goalProgress(goal, tasks);
    card.querySelector('.goal b').textContent = goal.title;
    card.querySelector('.goal-count').textContent = `${np.value} / ${np.target}`;
    const n = tasks.filter((t) => t.goal_id === goal.id).length;
    card.querySelector('.goal-foot .hint').textContent = n ? `задач привязано: ${n}` : 'можно привязать задачи в редакторе задачи';
    setLiquid(liquid, np.percent);
  };
  return card;
}

export function openGoalEditor({ goal = null, period, periodStart }) {
  const g = goal || { title: '', target: 1, manual_adjust: 0, period, period_start: periodStart };
  openSheet({
    title: goal ? 'Цель' : (g.period === 'week' ? 'Новая цель недели' : 'Новая цель месяца'),
    build(body, close) {
      body.innerHTML = `
        <form class="editor" novalidate>
          <input class="field" name="title" placeholder="Например: прочитать 2 книги" aria-label="Цель" value="${esc(g.title)}" autofocus>
          <label class="lbl">Сколько раз нужно сделать
            <input class="field" name="target" type="number" min="1" max="999" inputmode="numeric" value="${g.target}"></label>
          <p class="hint">Прогресс растёт от выполненных задач, привязанных к цели, и от кнопок +1 / −1</p>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions">
            <button class="btn" type="submit">${icon('check', 18)}Сохранить</button>
            ${goal ? `<button class="icon-btn danger" type="button" data-act="delete" aria-label="Удалить цель">${icon('trash', 20)}</button>` : ''}
          </div>
        </form>`;
      const f = body.querySelector('form');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = f.title.value.trim();
        const target = Math.round(Number(f.target.value));
        const err = body.querySelector('.auth-error');
        if (!title) { err.textContent = 'Напиши цель'; return; }
        if (!(target >= 1)) { err.textContent = 'Число должно быть от 1'; return; }
        if (goal) await store.patch('goals', g.id, { title, target });
        else await store.upsert('goals', { ...g, title, target, created_at: new Date().toISOString() });
        close();
      });
      body.querySelector('[data-act=delete]')?.addEventListener('click', async () => {
        const ok = await choose({ title: 'Удалить цель?', text: 'Задачи останутся, просто без привязки к цели', options: [{ label: 'Удалить', value: true, tone: 'danger' }, { label: 'Отмена', value: false }] });
        if (!ok) return;
        await store.remove('goals', g.id);
        close();
      });
    },
  });
}
