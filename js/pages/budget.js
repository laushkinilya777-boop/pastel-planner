// Бюджет: остаток месяца, план по категориям, копилки, откуда пришли деньги, записи.
import { client, store } from '../supabase.js';
import { icon } from '../ui/icons.js';
import { createDayRing, setDayRing, createLiquid } from '../ui/progress.js';
import { openEntryEditor, openPlanRow, openJar, JAR_COLORS } from '../ui/budget-ui.js';
import { monthStart, prevMonth, nextMonth, monthSummary, jarBalance, planForNewMonth, formatMoney } from '../budget.js';
import { todayISO, parseISODate, formatMonthTitle, formatShortDate } from '../dates.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let month = null;
const KIND_ICON = { income: '+', expense: '−', save: '↗', withdraw: '↙' };

export function render(root) {
  month ??= monthStart(todayISO());
  root.innerHTML = `
    <div class="period-head">
      <button class="icon-btn" data-nav="-1" aria-label="Предыдущий месяц">${icon('chevronLeft')}</button>
      <div><h1 class="page-title">Бюджет</h1><p class="period-sub"></p></div>
      <button class="icon-btn" data-nav="1" aria-label="Следующий месяц">${icon('chevronRight')}</button>
    </div>
    <section class="panel money-hero">
      <div class="mh-left">
        <span class="mh-label">Осталось в этом месяце</span>
        <b class="mh-left-sum"></b>
        <div class="mh-stats"></div>
      </div>
      <div class="mh-ring"></div>
    </section>
    <div class="money-actions">
      <button class="btn" data-k="expense">${icon('plus', 18)}Расход</button>
      <button class="btn ghost" data-k="income">${icon('plus', 18)}Доход</button>
      <button class="btn ghost" data-k="save">${icon('piggy', 18)}В копилку</button>
    </div>
    <section class="panel"><div class="panel-title">${icon('target', 18)}План месяца</div><div class="plan"></div>
      <button class="btn ghost" type="button" data-act="plan">${icon('plus', 18)}Категория в план</button></section>
    <section class="panel"><div class="panel-title">${icon('piggy', 18)}Копилки</div><div class="jars"></div>
      <button class="btn ghost" type="button" data-act="jar">${icon('plus', 18)}Копилка</button></section>
    <section class="panel sources-panel"><div class="panel-title">${icon('wallet', 18)}Откуда пришли деньги</div><div class="sources"></div></section>
    <section class="panel"><div class="panel-title">${icon('history', 18)}Записи месяца</div><div class="entries"></div></section>`;

  const ring = createDayRing(0, 116);
  ring.classList.add('money-ring');
  ring.insertAdjacentHTML('beforeend', '<div class="mr-text"><b></b><span>плана</span></div>');
  root.querySelector('.mh-ring').appendChild(ring);

  root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    month = Number(b.dataset.nav) < 0 ? prevMonth(month) : nextMonth(month); refresh();
  }));
  root.querySelectorAll('.money-actions [data-k]').forEach((b) => b.addEventListener('click', () =>
    openEntryEditor({ kind: b.dataset.k, date: month === monthStart(todayISO()) ? todayISO() : month })));
  root.querySelector('[data-act=plan]').addEventListener('click', () => openPlanRow({ month }));
  root.querySelector('[data-act=jar]').addEventListener('click', () => openJar());

  let copying = false;
  async function refresh() {
    const [entries, plans, jars] = await Promise.all([store.list('money_entries'), store.list('budget_plans'), store.list('savings_jars')]);
    const d = parseISODate(month);
    root.querySelector('.period-sub').textContent = formatMonthTitle(d.getFullYear(), d.getMonth() + 1);

    // новый месяц: план переносится сам по прошлому — один раз, только в текущий месяц
    if (!copying && month === monthStart(todayISO()) && !plans.some((p) => p.month === month)) {
      copying = true;
      try { if (await copyPlanOnce()) return; } finally { copying = false; }
    }

    const s = monthSummary(entries, plans, month);
    root.querySelector('.mh-left-sum').textContent = formatMoney(s.left);
    root.querySelector('.mh-left-sum').classList.toggle('neg', s.left < 0);
    root.querySelector('.mh-stats').innerHTML = `
      <span><i class="dot in"></i>Пришло <b>${formatMoney(s.income)}</b></span>
      <span><i class="dot out"></i>Потрачено <b>${formatMoney(s.expense)}</b></span>
      <span><i class="dot save"></i>Отложено <b>${formatMoney(s.saved)}</b></span>`;
    const pct = s.plannedExpense ? Math.round((s.expense / s.plannedExpense) * 100) : 0;
    setDayRing(ring, Math.min(100, pct));
    ring.classList.toggle('over', pct > 100);
    ring.querySelector('.mr-text b').textContent = s.plannedExpense ? `${pct}%` : '—';

    const plan = root.querySelector('.plan');
    plan.innerHTML = s.rows.length ? '' : '<p class="empty-line">Добавь категории и суммы на месяц — например, «Продукты 10 000». Со следующего месяца план появится сам</p>';
    for (const r of s.rows) {
      const p = r.planned ? Math.min(100, Math.round((r.spent / r.planned) * 100)) : 100;
      const over = r.planned && r.spent > r.planned;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `plan-row${over ? ' over' : ''}${r.planned ? '' : ' unplanned'}`;
      el.innerHTML = `<div class="pr-top"><b>${esc(r.category)}</b><span>${formatMoney(r.spent)}${r.planned ? ` <small>из ${formatMoney(r.planned)}</small>` : ''}</span></div>
        <div class="pr-bar"><i style="width:${p}%"></i></div>
        <small class="pr-left">${r.planned ? (over ? `перерасход ${formatMoney(-r.left)}` : `осталось ${formatMoney(r.left)}`) : 'нет в плане — нажми, чтобы добавить'}</small>`;
      el.addEventListener('click', () => (r.plan ? openPlanRow({ row: r.plan, month }) : openPlanRowFor(r.category)));
      plan.appendChild(el);
    }

    const jarsBox = root.querySelector('.jars');
    const live = jars.filter((j) => !j.archived);
    jarsBox.innerHTML = live.length ? '' : '<p class="empty-line">Создай копилку — на отпуск, подарок или подушку безопасности. Накопленное не сгорает со сменой месяца</p>';
    for (const j of live) {
      const bal = jarBalance(j, entries);
      const [a, b] = JAR_COLORS[j.color] || JAR_COLORS.peach;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'jar';
      card.style.setProperty('--ja', a);
      card.style.setProperty('--jb', b);
      card.innerHTML = `<div class="jar-top"><span class="jar-ico">${icon('piggy', 20)}</span><b>${esc(j.title)}</b>
        <span class="jar-sum">${formatMoney(bal)}${j.target ? `<small> / ${formatMoney(j.target)}</small>` : ''}</span></div>`;
      if (j.target) card.appendChild(createLiquid(Math.round((bal / Number(j.target)) * 100)));
      card.addEventListener('click', () => openJar({ jar: j }));
      jarsBox.appendChild(card);
    }

    root.querySelector('.sources-panel').hidden = !s.sources.length;
    root.querySelector('.sources').innerHTML = s.sources.map((x) => `<div class="src"><span>${esc(x.name)}</span><b>${formatMoney(x.sum)}</b></div>`).join('');

    const list = entries.filter((e) => e.date?.slice(0, 7) === month.slice(0, 7))
      .sort((a2, b2) => String(b2.date).localeCompare(String(a2.date)) || String(b2.created_at).localeCompare(String(a2.created_at)));
    const box = root.querySelector('.entries');
    box.innerHTML = list.length ? '' : '<p class="empty-line">Записей пока нет. Нажми «Расход» или «Доход» сверху</p>';
    const jarName = (id) => jars.find((j) => j.id === id)?.title || 'копилка';
    for (const e of list) {
      const name = e.kind === 'income' ? (e.source || 'Доход') : e.kind === 'expense' ? (e.target || 'Расход')
        : e.kind === 'save' ? `В «${jarName(e.jar_id)}»` : `Из «${jarName(e.jar_id)}»`;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `entry ${e.kind}`;
      row.innerHTML = `<span class="en-ico">${KIND_ICON[e.kind]}</span><span class="en-name"><b>${esc(name)}</b><small>${formatShortDate(e.date)}${e.note ? ` · ${esc(e.note)}` : ''}</small></span>
        <b class="en-sum">${e.kind === 'income' || e.kind === 'withdraw' ? '+' : '−'}${formatMoney(e.amount)}</b>`;
      row.addEventListener('click', () => openEntryEditor({ entry: e }));
      box.appendChild(row);
    }
  }

  // Перенос плана прошлого месяца: только с интернетом, по свежим данным с сервера,
  // без перезаписи уже существующих строк, и отметка в settings — чтобы удалённое не возвращалось.
  async function copyPlanOnce() {
    if (navigator.onLine === false) return false;
    await Promise.all([store.refresh('budget_plans'), store.refresh('settings')]);
    const settings = (await store.list('settings'))[0];
    if ((settings?.plans_copied || []).includes(month)) return false;
    const fresh = await store.list('budget_plans');
    if (fresh.some((p) => p.month === month)) return false;
    const prev = fresh.filter((p) => p.month === prevMonth(month));
    if (prev.length) {
      const rows = planForNewMonth(prev, month).map((r) => ({ ...r, created_at: new Date().toISOString() }));
      const { error } = await client.from('budget_plans').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (error) return false;
    }
    if (settings) await store.patch('settings', settings.user_id, { plans_copied: [...(settings.plans_copied || []), month] });
    await store.refresh('budget_plans');
    return prev.length > 0;
  }

  // категория, которой нет в плане: сразу добавить её с суммой
  function openPlanRowFor(category) {
    openPlanRow({ month, row: null });
    setTimeout(() => { const inp = document.querySelector('.sheet [name=category]'); if (inp) { inp.value = category; document.querySelector('.sheet [name=planned]')?.focus(); } }, 50);
  }

  let timer;
  const off = store.on('change', (t) => {
    if (['money_entries', 'budget_plans', 'savings_jars'].includes(t)) { clearTimeout(timer); timer = setTimeout(refresh, 60); }
  });
  refresh();
  return () => { off(); clearTimeout(timer); };
}
