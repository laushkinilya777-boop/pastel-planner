// Картинки: подборка котиков, собачек, мотивации и своих фото.
import { store } from '../supabase.js';
import { openSheet, choose, toast } from '../ui/sheet.js';
import { uploadPhoto, removePhoto, imageSrc } from '../ui/image-tools.js';
import { renderQuoteCard } from '../ui/image-of-day.js';
import { openStarterPicker } from '../ui/starter-picker.js';
import { icon } from '../ui/icons.js';
import { allCategories, isImageUrl } from '../images.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let filter = 'all';

const MOODS = [['', 'обычная'], ['happy', 'весёлая — за выполненное'], ['sad', 'грустная — когда задачи ждут']];
const moodSelect = (img) => `<label class="lbl">Настроение<select class="field" name="mood">${MOODS.map(([v, l]) => `<option value="${v}" ${(img.mood || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
const wireMood = (body, img) => body.querySelector('[name=mood]').addEventListener('change', (e) => {
  img.mood = e.target.value || null;
  store.patch('images', img.id, { mood: img.mood });
});

// свои категории хранятся в таблице image_categories; держим свежий список под рукой
let custom = [];
const loadCustom = async () => { custom = await store.list('image_categories'); return custom; };
const cats = () => allCategories(custom);
const catOptions = (selected) => cats().map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

export function render(root, _p, { user }) {
  root.innerHTML = `
    <h1 class="page-title">Картинки</h1>
    <div class="img-actions">
      <label class="btn">${icon('gallery', 18)}Фото<input type="file" accept="image/*" multiple hidden></label>
      <button class="btn ghost" type="button" data-act="link">${icon('heart', 18)}Ссылка</button>
      <button class="btn ghost" type="button" data-act="quote">${icon('plus', 18)}Фраза</button>
      <button class="btn ghost" type="button" data-act="starter">${icon('shuffle', 18)}Стартовый набор</button>
    </div>
    <div class="filters" role="tablist" aria-label="Категории"></div>
    <div class="gallery"></div>`;

  const gallery = root.querySelector('.gallery');
  const filtersBox = root.querySelector('.filters');
  function paintFilters() {
    if (filter !== 'all' && !cats().some((c) => c.id === filter)) filter = 'all';
    const cur = cats().find((c) => c.id === filter);
    filtersBox.innerHTML = [{ id: 'all', name: 'Все' }, ...cats()]
      .map((c) => `<button role="tab" data-f="${c.id}" aria-selected="${c.id === filter}">${esc(c.name)}</button>`).join('')
      + (cur?.custom ? `<button class="f-tool" type="button" data-cat-edit aria-label="Изменить категорию">${icon('edit', 16)}</button>` : '')
      + `<button class="f-tool" type="button" data-cat-add aria-label="Новая категория">${icon('plus', 16)}</button>`;
    filtersBox.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; paintFilters(); refresh(); }));
    filtersBox.querySelector('[data-cat-add]').addEventListener('click', () => openCategorySheet());
    filtersBox.querySelector('[data-cat-edit]')?.addEventListener('click', () => openCategorySheet(cur));
  }
  paintFilters();

  root.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    const category = await choose({ title: 'Куда положить?', options: cats().map((c) => ({ label: c.name, value: c.id })) });
    if (!category) return;
    toast(files.length > 1 ? `Загружаем ${files.length} фото…` : 'Загружаем фото…');
    for (const f of files) {
      try {
        const path = await uploadPhoto(f, user.id);
        await store.upsert('images', { kind: 'photo', storage_path: path, category, created_at: new Date().toISOString() });
      } catch (err) { toast(err.message); }
    }
  });
  root.querySelector('[data-act=link]').addEventListener('click', () => openLinkSheet());
  root.querySelector('[data-act=quote]').addEventListener('click', () => openQuoteSheet());
  root.querySelector('[data-act=starter]').addEventListener('click', () => openStarterPicker());

  async function refresh() {
    await loadCustom();
    paintFilters();
    const all = (await store.list('images')).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const list = filter === 'all' ? all : all.filter((i) => i.category === filter);
    gallery.innerHTML = list.length ? '' : `<p class="empty-line">${filter === 'all' ? 'Пока пусто. Добавь фото, ссылку на картинку из Pinterest или фразу' : 'В этой категории пока пусто'}</p>`;
    for (const img of list) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.setAttribute('aria-label', img.kind === 'quote' ? `Фраза: ${img.text}` : 'Открыть картинку');
      if (img.kind === 'quote') tile.appendChild(renderQuoteCard(img.text));
      else {
        const el = new Image();
        el.alt = '';
        el.decoding = 'async';
        imageSrc(img).then((src) => { if (src) el.src = src; });
        el.onerror = () => tile.classList.add('broken');
        tile.appendChild(el);
      }
      tile.addEventListener('click', () => openViewer(img));
      gallery.appendChild(tile);
    }
  }

  let timer;
  const off = store.on('change', (t) => { if (t === 'images' || t === 'image_categories') { clearTimeout(timer); timer = setTimeout(refresh, 60); } });
  refresh();
  return () => { off(); clearTimeout(timer); };
}

// Новая категория или правка своей (переименовать / удалить — картинки переедут в «Мои»).
function openCategorySheet(cat = null) {
  openSheet({
    title: cat ? 'Категория' : 'Новая категория',
    build(body, close) {
      body.innerHTML = `
        <form class="editor" novalidate>
          <input class="field" name="name" maxlength="30" placeholder="Например: цветы, аниме, вдохновение" aria-label="Название категории" value="${esc(cat?.name)}" autofocus>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions">
            <button class="btn" type="submit">${icon('check', 18)}Сохранить</button>
            ${cat ? `<button class="icon-btn danger" type="button" data-act="del" aria-label="Удалить категорию">${icon('trash', 20)}</button>` : ''}
          </div>
        </form>`;
      const f = body.querySelector('form');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = f.name.value.trim();
        const err = body.querySelector('.auth-error');
        if (!name) { err.textContent = 'Напиши название'; return; }
        if (cats().some((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== cat?.id)) { err.textContent = 'Такая категория уже есть'; return; }
        if (cat) await store.patch('image_categories', cat.id, { name });
        else { const row = await store.upsert('image_categories', { name, sort: Date.now(), created_at: new Date().toISOString() }); filter = row.id; }
        close();
      });
      body.querySelector('[data-act=del]')?.addEventListener('click', async () => {
        const ok = await choose({ title: 'Удалить категорию?', text: `Картинки из «${cat.name}» переедут в «Мои»`, options: [{ label: 'Удалить', value: true, tone: 'danger' }, { label: 'Отмена', value: false }] });
        if (!ok) return;
        for (const img of await store.list('images', (i) => i.category === cat.id)) await store.patch('images', img.id, { category: 'mine' });
        await store.remove('image_categories', cat.id);
        filter = 'all';
        close();
      });
    },
  });
}

function openLinkSheet() {
  openSheet({
    title: 'Картинка по ссылке',
    build(body, close) {
      body.innerHTML = `
        <form class="editor" novalidate>
          <p class="hint">На компьютере: открой пин в Pinterest → правый клик по картинке → «Копировать адрес изображения» → вставь сюда.
          На iPhone проще сохранить картинку в «Фото» и добавить кнопкой «Фото».</p>
          <input class="field" name="url" type="url" inputmode="url" placeholder="https://i.pinimg.com/…" aria-label="Ссылка на картинку" autofocus>
          <div class="link-preview" hidden><img alt="Предпросмотр"></div>
          <label class="lbl">Категория<select class="field" name="cat">${catOptions('cats')}</select></label>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions"><button class="btn" type="submit">${icon('check', 18)}Добавить</button></div>
        </form>`;
      const f = body.querySelector('form');
      const prev = body.querySelector('.link-preview');
      const err = body.querySelector('.auth-error');
      let ok = false;
      f.url.addEventListener('input', () => {
        ok = false;
        const u = f.url.value.trim();
        prev.hidden = !isImageUrl(u);
        if (prev.hidden) return;
        const img = prev.querySelector('img');
        img.onload = () => { ok = true; err.textContent = ''; };
        img.onerror = () => { ok = false; err.textContent = 'По этой ссылке нет картинки. Нужен адрес самого изображения, а не страницы'; };
        img.src = u;
      });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = f.url.value.trim();
        if (!isImageUrl(u)) { err.textContent = 'Вставь ссылку, которая начинается с https://'; return; }
        if (!ok) { err.textContent = 'Подожди, пока картинка загрузится, или проверь ссылку'; return; }
        await store.upsert('images', { kind: 'link', url: u, category: f.cat.value, created_at: new Date().toISOString() });
        close();
      });
    },
  });
}

function openQuoteSheet(img = null) {
  openSheet({
    title: img ? 'Фраза' : 'Новая фраза',
    build(body, close) {
      body.innerHTML = `
        <form class="editor" novalidate>
          <textarea class="field" name="text" rows="3" maxlength="160" placeholder="Например: маленькие шаги — тоже шаги" aria-label="Текст фразы" autofocus>${esc(img?.text)}</textarea>
          <p class="auth-error" role="alert"></p>
          <div class="editor-actions"><button class="btn" type="submit">${icon('check', 18)}Сохранить</button></div>
        </form>`;
      const f = body.querySelector('form');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = f.text.value.trim();
        if (!text) { body.querySelector('.auth-error').textContent = 'Напиши фразу'; return; }
        if (img) await store.patch('images', img.id, { text });
        else await store.upsert('images', { kind: 'quote', category: 'motivation', created_at: new Date().toISOString(), text });
        close();
      });
    },
  });
}

function openViewer(img) {
  if (img.kind === 'quote') {
    openSheet({
      title: 'Фраза',
      build(body, close) {
        body.appendChild(renderQuoteCard(img.text));
        body.insertAdjacentHTML('beforeend', `<div class="editor">${moodSelect(img)}</div><div class="editor-actions viewer-actions">
          <button class="btn ghost" type="button" data-act="edit">Изменить</button>
          <button class="icon-btn danger" type="button" data-act="del" aria-label="Удалить">${icon('trash', 20)}</button></div>`);
        wireMood(body, img);
        body.querySelector('[data-act=edit]').addEventListener('click', () => { close(); openQuoteSheet(img); });
        body.querySelector('[data-act=del]').addEventListener('click', () => del(img, close));
      },
    });
    return;
  }
  openSheet({
    title: 'Картинка',
    wide: true,
    build: async (body, close) => {
      body.innerHTML = `<div class="viewer"><img alt=""></div>
        <div class="editor"><label class="lbl">Категория<select class="field" name="cat">${catOptions(img.category)}</select></label>
        ${moodSelect(img)}</div>
        <div class="editor-actions viewer-actions">
          <button class="icon-btn danger" type="button" data-act="del" aria-label="Удалить картинку">${icon('trash', 20)}</button></div>`;
      body.querySelector('.viewer img').src = (await imageSrc(img)) || '';
      body.querySelector('[name=cat]').addEventListener('change', (e) => { img.category = e.target.value; store.patch('images', img.id, { category: img.category }); });
      wireMood(body, img);
      body.querySelector('[data-act=del]').addEventListener('click', () => del(img, close));
    },
  });
}

async function del(img, close) {
  const ok = await choose({ title: 'Удалить из подборки?', options: [{ label: 'Удалить', value: true, tone: 'danger' }, { label: 'Отмена', value: false }] });
  if (!ok) return;
  await store.remove('images', img.id);
  if (img.kind === 'photo') removePhoto(img.storage_path);
  close();
}
