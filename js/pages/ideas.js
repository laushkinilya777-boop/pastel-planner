// Идеи для Reels / TikTok: доска со статусами (телефон — вкладки, компьютер — колонки).
import { store } from '../supabase.js';
import { icon } from '../ui/icons.js';
import { openSheet, choose } from '../ui/sheet.js';
import { STATUSES, byStatus, shiftStatus, parseTags, platformLabel } from '../ideas.js';
import { formatShortDate, todayISO } from '../dates.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let tab = 'idea';
let tagFilter = null;

export function render(root) {
  root.innerHTML = `
    <h1 class="page-title">Идеи для видео</h1>
    <div class="ideas-top">
      <button class="btn" type="button" data-act="new">${icon('plus', 18)}Идея</button>
      <div class="ideas-tags"></div>
    </div>
    <div class="ideas-tabs segmented" role="tablist" aria-label="Статус"></div>
    <div class="board"></div>`;
  root.querySelector('[data-act=new]').addEventListener('click', () => openIdea({ status: tab }));

  async function refresh() {
    const all = await store.list('ideas');
    const tags = [...new Set(all.flatMap((i) => i.tags || []))].sort();
    if (tagFilter && !tags.includes(tagFilter)) tagFilter = null;
    root.querySelector('.ideas-tags').innerHTML = tags.map((t) => `<button class="tag-chip" type="button" data-tag="${esc(t)}" aria-pressed="${t === tagFilter}">#${esc(t)}</button>`).join('');
    root.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => { tagFilter = tagFilter === b.dataset.tag ? null : b.dataset.tag; refresh(); }));

    const ideas = tagFilter ? all.filter((i) => (i.tags || []).includes(tagFilter)) : all;
    const g = byStatus(ideas);
    root.querySelector('.ideas-tabs').innerHTML = STATUSES.map((s) =>
      `<button role="tab" data-tab="${s.id}" aria-selected="${s.id === tab}" aria-label="${s.name}">${s.short || s.name}<span class="cnt">${g[s.id].length}</span></button>`).join('');
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; refresh(); }));

    const board = root.querySelector('.board');
    board.innerHTML = '';
    for (const s of STATUSES) {
      const col = document.createElement('section');
      col.className = `col${s.id === tab ? ' active' : ''}`;
      col.innerHTML = `<h3 class="col-h">${icon(s.icon, 16)}${s.name}<span class="cnt">${g[s.id].length}</span></h3>`;
      if (!g[s.id].length) col.insertAdjacentHTML('beforeend', `<p class="empty-line">${s.id === 'idea' ? 'Запиши идею, пока не забыла' : 'Пусто'}</p>`);
      for (const i of g[s.id]) {
        const card = document.createElement('article');
        card.className = `idea-card st-${i.status}`;
        const overdue = i.publish_date && i.publish_date < todayISO() && i.status !== 'published';
        card.innerHTML = `
          <button class="ic-open" type="button">
            <span class="ic-meta"><span class="pf pf-${i.platform}">${platformLabel(i.platform)}</span>${i.publish_date ? `<span class="ic-date${overdue ? ' overdue' : ''}">${formatShortDate(i.publish_date)}</span>` : ''}</span>
            <b>${esc(i.title)}</b>
            ${i.hook ? `<span class="ic-hook">«${esc(i.hook)}»</span>` : ''}
            ${(i.tags || []).length ? `<span class="ic-tags">${i.tags.map((t) => `#${esc(t)}`).join(' ')}</span>` : ''}
          </button>
          <div class="ic-move">
            <button class="icon-btn" type="button" data-dir="-1" aria-label="Назад по статусу" ${i.status === 'idea' ? 'disabled' : ''}>${icon('chevronLeft', 18)}</button>
            <button class="icon-btn" type="button" data-dir="1" aria-label="Дальше по статусу" ${i.status === 'published' ? 'disabled' : ''}>${icon('chevronRight', 18)}</button>
          </div>`;
        card.querySelector('.ic-open').addEventListener('click', () => openIdea(i));
        card.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () =>
          store.patch('ideas', i.id, { status: shiftStatus(i.status, Number(b.dataset.dir)) })));
        col.appendChild(card);
      }
      board.appendChild(col);
    }
  }

  let timer;
  const off = store.on('change', (t) => { if (t === 'ideas') { clearTimeout(timer); timer = setTimeout(refresh, 50); } });
  refresh();
  return () => { off(); clearTimeout(timer); };
}

export function openIdea(idea = {}) {
  const isNew = !idea.id;
  const i = { title: '', hook: '', script: '', link: '', platform: 'both', tags: [], status: 'idea', publish_date: null, ...idea };
  let status = i.status;
  let platform = i.platform;
  openSheet({
    title: isNew ? 'Новая идея' : 'Идея',
    wide: true,
    build(body, close) {
      body.innerHTML = `
        <form class="editor" novalidate>
          <input class="field" name="title" placeholder="О чём видео?" aria-label="Название" value="${esc(i.title)}" autofocus>
          <label class="lbl">Крючок — первая фраза, которая цепляет
            <input class="field" name="hook" placeholder="«Я перестала делать это — и…»" value="${esc(i.hook)}"></label>
          <label class="lbl">Сценарий / заметки
            <textarea class="field" name="script" rows="5" placeholder="Кадры, текст, музыка…">${esc(i.script)}</textarea></label>
          <label class="lbl">Ссылка-референс<input class="field" name="link" type="url" inputmode="url" placeholder="https://…" value="${esc(i.link)}"></label>
          ${i.link ? `<a class="link-btn" href="${esc(i.link)}" target="_blank" rel="noopener">Открыть референс</a>` : ''}
          <div class="lbl">Площадка
            <div class="segmented kind" role="radiogroup">
              ${[['reels', 'Reels'], ['tiktok', 'TikTok'], ['both', 'Обе']].map(([v, l]) => `<button type="button" data-pf="${v}" aria-selected="${v === platform}">${l}</button>`).join('')}
            </div></div>
          <div class="lbl">Статус
            <div class="segmented kind st-seg" role="radiogroup">
              ${STATUSES.map((s) => `<button type="button" data-st="${s.id}" aria-selected="${s.id === status}" aria-label="${s.name}">${s.short || s.name}</button>`).join('')}
            </div></div>
          <div class="grid2">
            <label class="lbl">Дата публикации<input class="field" type="date" name="date" value="${i.publish_date || ''}"></label>
            <label class="lbl">Теги<input class="field" name="tags" placeholder="#уход #утро" value="${esc((i.tags || []).map((t) => `#${t}`).join(' '))}"></label>
          </div>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions">
            <button class="btn" type="submit">${icon('check', 18)}Сохранить</button>
            ${isNew ? '' : `<button class="icon-btn danger" type="button" data-act="del" aria-label="Удалить идею">${icon('trash', 20)}</button>`}
          </div>
        </form>`;
      const f = body.querySelector('form');
      body.querySelectorAll('[data-pf]').forEach((b) => b.addEventListener('click', () => {
        platform = b.dataset.pf; body.querySelectorAll('[data-pf]').forEach((x) => x.setAttribute('aria-selected', x === b));
      }));
      body.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => {
        status = b.dataset.st; body.querySelectorAll('[data-st]').forEach((x) => x.setAttribute('aria-selected', x === b));
      }));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = f.title.value.trim();
        const err = body.querySelector('.auth-error');
        if (!title) { err.textContent = 'Напиши, о чём видео'; return; }
        const link = f.link.value.trim();
        if (link && !/^https?:\/\//i.test(link)) { err.textContent = 'Ссылка должна начинаться с https://'; return; }
        const row = {
          title, hook: f.hook.value.trim() || null, script: f.script.value.trim() || null, link: link || null,
          platform, status, publish_date: f.date.value || null, tags: parseTags(f.tags.value),
        };
        if (isNew) await store.upsert('ideas', { ...row, sort: Date.now(), created_at: new Date().toISOString() });
        else await store.patch('ideas', i.id, row);
        close();
      });
      body.querySelector('[data-act=del]')?.addEventListener('click', async () => {
        const ok = await choose({ title: 'Удалить идею?', text: `«${i.title}» исчезнет`, options: [{ label: 'Удалить', value: true, tone: 'danger' }, { label: 'Отмена', value: false }] });
        if (!ok) return;
        await store.remove('ideas', i.id);
        close();
      });
    },
  });
}
