# Пастельный планер: план сборки

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Личный PWA-планер (Сегодня / Неделя / Месяц / Картинки) с синхронизацией между iPhone и компьютером, автопереносом, историей, повторами, целями и push-напоминаниями.

**Architecture:** Статический сайт на чистом HTML/CSS/JS (ES-модули, без сборщика) на GitHub Pages. Данные, вход и файлы в Supabase. Логика переноса, повторов и напоминаний живёт в SQL-функциях Postgres: pg_cron вызывает их по расписанию, Edge Function `reminders` рассылает Web Push. На клиенте есть офлайн-кэш в IndexedDB и очередь изменений.

**Tech Stack:** HTML/CSS/JS, supabase-js v2 с CDN (точная закреплённая версия), Supabase (Postgres, Auth с email OTP, Storage, Edge Functions на Deno, pg_cron, pg_net, Vault), Web Push (VAPID, `npm:web-push` в Deno). Тесты: `node --test`, `@electric-sql/pglite` для SQL, `fake-indexeddb` для хранилища.

**Spec:** `pastel-planner/docs/2026-11-22-planner-design.md`

## Global Constraints

- Весь интерфейс на русском. Неделя начинается с понедельника.
- Три светлые темы (`opal`, `peach`, `mint`) через `data-theme` на `<html>` и CSS-токены в `css/theme.css`; тёмной нет. Иконки только SVG из `js/ui/icons.js`, никаких эмодзи в интерфейсе. Тема дня по погоде — `initDailyTheme(today)`, `createWeatherChip(today)`, событие `daytheme` из `js/theme.js` (в задаче 7 синхронизировать с `settings.day_date/day_weather`). Прогресс дня — `createDayRing`, прогресс цели — `createLiquid` из `js/ui/progress.js`.
- Сначала мобильная вёрстка: зоны нажатия от 44px, без горизонтальной прокрутки при ширине 375px. На телефоне нижняя панель «Сегодня · Неделя · Месяц · Картинки», на компьютере (≥ 900px) боковое меню.
- Даты на клиенте всегда в **локальном** времени через `js/dates.js`. `toISOString()` для дат дня запрещён.
- RLS включён на всех таблицах и в bucket `images`, правило `user_id = auth.uid()`.
- В репозиторий не попадают service role key и приватный VAPID-ключ, только в секреты Supabase. URL проекта, anon key и публичный VAPID-ключ лежат в `js/config.js`, это допустимо.
- Вход по 6-значному коду (`signInWithOtp` + `verifyOtp`, `type: 'email'`). Регистрация новых пользователей отключается после создания аккаунта хозяйки.
- Напоминание по умолчанию: `remind_minutes = 15` у задач со временем, `null` у задач без времени.
- Повторяющиеся задачи не переносятся. Обычные переносятся с `carry_count += число пропущенных дней`.
- Повторы материализуются на 60 дней вперёд.
- После каждой задачи результат показывается хозяйке, следующая начинается только после её «ок» (её прямая просьба).

## Review Focus

1. **Граница суток и часовой пояс.** Задача, созданная в 00:30 по Москве, должна попасть на сегодняшнюю дату, а не на вчерашнюю (UTC+3). Тест в задаче 2: `toISODate` для `new Date(2026,10,23,0,30)` возвращает `'2026-11-23'`.
2. **Повторная отправка очереди офлайн-изменений** (связь моргнула посреди отправки) не должна создавать дубликаты или менять порядок. Тест в задаче 6: `flush` дважды подряд после частичной ошибки даёт ровно один upsert на каждую строку, в исходном порядке.
3. **Ежемесячный повтор 31-го числа и ежегодный 29 февраля.** Ожидается последний день короткого месяца и 28 февраля в невисокосный год. Тест в задаче 4.
4. **Несколько пропущенных дней** (сайт не открывали, cron не сработал). Обычная задача переносится один раз, `carry_count` растёт на число дней, напоминание повторно не приходит. Тесты в задаче 5.
5. **Фото с iPhone на 5–10 МБ.** Перед загрузкой уменьшается до 1600px по длинной стороне. Тест `fitWithin` в задаче 10.

---

## Структура файлов

```
pastel-planner/
  index.html                 оболочка, подключает css и js/app.js
  manifest.webmanifest, sw.js, icons/   PWA (задача 11)
  css/theme.css              цвета-токены, градиенты, шрифты
  css/layout.css             сетка, нижняя панель / боковое меню, карточки
  js/config.js               SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY
  js/supabase.js             createClient
  js/app.js                  hash-роутер, проверка входа, run_daily при открытии
  js/auth.js                 экран входа (почта → код)
  js/dates.js                работа с датами (чистые функции)
  js/store.js                офлайн-кэш + очередь + синхронизация
  js/tasks.js                чистая логика задач (бейджи, сортировка, черновик)
  js/goals.js                прогресс целей
  js/special-dates.js        красные даты в месяце (ежегодные)
  js/images.js               картинка дня, fitWithin, уменьшение фото
  js/push.js                 pushAvailability, подписка
  js/ui/*.js                 компоненты: task-item, task-editor, history-sheet, repeat-dialog, goal-card, image-of-day, quote-card, nav
  js/pages/today.js, week.js, month.js, day.js, images.js
  supabase/migrations/001_schema.sql, 002_rls.sql, 003_history.sql,
                     004_recurrence.sql, 005_daily.sql, 006_reminders.sql, 007_cron.sql
  supabase/functions/reminders/index.ts, payload.js
  scripts/serve.mjs          локальный статический сервер (без зависимостей)
  tests/*.test.js, tests/db/*.test.js, tests/db/harness.js
  package.json               только devDependencies и "test": "node --test"
```

---

### Task 1: Проект Supabase вместе с хозяйкой и проверка доступа с телефона

Ручная задача, всё делается вместе с хозяйкой, шаг за шагом.

- [ ] **Step 1:** Хозяйка регистрируется на supabase.com и создаёт проект `pastel-planner`, регион Central EU (Frankfurt). Пароль базы она сохраняет сама, его никто не вводит за неё.
- [ ] **Step 2:** Хозяйка открывает на iPhone через **мобильный интернет** `https://<project>.supabase.co/rest/v1/` и проверяет, что пришёл JSON-ответ (ошибка ключа — это нормально), а не таймаут. Если таймаут, **стоп**: обсуждаем с хозяйкой замену, план дальше не выполняется.
- [ ] **Step 3:** Authentication → Email: включить провайдер, в шаблон «Magic Link» добавить `{{ .Token }}` (текст «Твой код входа: {{ .Token }}»), длина OTP 6.
- [ ] **Step 4:** Записать URL проекта и anon key в `js/config.js` (файл создаётся в задаче 2, до этого значения хранятся в заметке хозяйки).

Готово, когда: шаг 2 прошёл на телефоне, шаблон письма содержит код.

### Task 2: Каркас, даты, тестовый стенд

**Files:**
- Create: `package.json`, `scripts/serve.mjs`, `index.html`, `css/theme.css`, `css/layout.css`, `js/config.js`, `js/dates.js`, `.gitignore`
- Test: `tests/dates.test.js`

**Interfaces:**
- Produces (`js/dates.js`, все даты — строки `'YYYY-MM-DD'`):
  - `toISODate(d: Date) -> string` (локальная дата)
  - `todayISO() -> string`
  - `addDays(iso: string, n: number) -> string`
  - `weekStart(iso: string) -> string` (понедельник)
  - `weekDays(iso: string) -> string[7]`
  - `monthGrid(year: number, month: number /*1-12*/) -> string[42]` (с понедельника)
  - `daysBetween(a: string, b: string) -> number` (b − a)
  - `formatDayTitle(iso: string) -> string`, например `'Суббота, 23 ноября'`
  - `formatMonthTitle(year, month) -> string`, например `'Ноябрь 2026'`

- [ ] **Step 1:** `git init` в `pastel-planner`. `package.json` с `"type": "module"`, `"test": "node --test tests/"`, devDependencies `@electric-sql/pglite`, `fake-indexeddb`. `npm install`.
- [ ] **Step 2: Тесты** `tests/dates.test.js`:
  - `toISODate(new Date(2026,10,23,0,30)) === '2026-11-23'` и `toISODate(new Date(2026,10,22,23,59)) === '2026-11-22'`
  - `weekStart('2026-11-22') === '2026-11-16'` (вс → пн), `weekStart('2026-11-16') === '2026-11-16'`
  - `monthGrid(2026,11)[0] === '2026-10-26'`, длина 42, содержит `'2026-11-30'`
  - `addDays('2026-02-28', 1) === '2026-03-01'`, `addDays('2028-02-28', 1) === '2028-02-29'`
  - `daysBetween('2026-11-20','2026-11-23') === 3`
  - `formatDayTitle('2026-11-23') === 'Понедельник, 23 ноября'`
- [ ] **Step 3:** `npm test`, ожидается FAIL (модуля нет).
- [ ] **Step 4:** Реализовать `js/dates.js`. Арифметику делать через `new Date(y, m-1, d, 12)`, полдень защищает от сдвигов перехода на летнее время. Названия брать из `Intl.DateTimeFormat('ru-RU')`, первую букву делать заглавной.
- [ ] **Step 5:** `npm test`, ожидается PASS.
- [ ] **Step 6:** `scripts/serve.mjs`: статический сервер на `node:http`, порт 5173, корень проекта, без кэша. Добавить в `.claude/launch.json` конфигурацию `planner` (`node scripts/serve.mjs`, порт 5173). `index.html` с пастельным градиентным фоном, заголовком «Мой планер» и подключёнными css. `theme.css`: токены `--peach --lavender --mint --pink --sky --ink --card --radius` и градиент фона. Показать хозяйке в браузере и согласовать палитру.
- [ ] **Step 7:** Commit `feat: каркас, даты, тесты`.

### Task 3: Схема базы, защита, история изменений

**Files:**
- Create: `supabase/migrations/001_schema.sql`, `002_rls.sql`, `003_history.sql`, `tests/db/harness.js`
- Test: `tests/db/schema.test.js`

**Interfaces:**
- Produces (таблицы, у всех `id uuid pk default gen_random_uuid()`, кроме `settings` и `task_history`; у всех `user_id uuid not null default auth.uid()`; у изменяемых `updated_at timestamptz default now()`):
  - `goals(period text check in ('week','month'), period_start date, title text, target int check > 0, manual_adjust int default 0)`
  - `recurrences(title, time time, note, remind_minutes int, goal_id → goals on delete set null, freq text check in ('daily','weekdays','weekly','monthly','yearly'), weekdays int[] /*ISO 1=пн..7=вс*/, start_date date, end_date date null, materialized_until date null)`
  - `tasks(title text not null, date date not null, time time, note text, done bool default false, done_at timestamptz, carry_count int default 0, remind_minutes int, reminded_at timestamptz, goal_id → goals on delete set null, recurrence_id → recurrences on delete set null, occurrence_date date, is_exception bool default false)` + `unique(recurrence_id, occurrence_date)`
  - `task_history(id bigserial pk, task_id → tasks on delete cascade, user_id, changed_at timestamptz default now(), field text, old_value text, new_value text)`
  - `special_dates(date date, title text, kind text check in ('red','deadline'), color text, yearly bool default false)`
  - `images(kind text check in ('photo','link','quote'), storage_path text, url text, text text, category text, created_at)`
  - `push_subscriptions(endpoint text unique, p256dh text, auth text, created_at)`
  - `settings(user_id uuid pk, tz text default 'Europe/Moscow', day_date date, day_weather text check in ('sunny','cloudy','rainy'), last_rollover_date date)`
  - Триггер `tasks_history` AFTER UPDATE пишет строку в `task_history` для каждого изменившегося поля из `title, date, time, note`.
  - Триггер `touch_updated_at` BEFORE UPDATE на изменяемых таблицах.
- Produces (`tests/db/harness.js`): `async makeDb() -> PGlite`. Создаёт заглушки `auth.users(id uuid pk)` и `auth.uid()` = `nullif(current_setting('request.jwt.claim.sub', true),'')::uuid`, роль `authenticated`, затем применяет все `supabase/migrations/*.sql`, кроме `007_cron.sql` и `008_storage.sql` (в PGlite нет pg_cron и схемы storage). `async asUser(db, uid, fn)` выполняет `fn` в транзакции с `set local role authenticated` и `set local request.jwt.claim.sub`.

- [ ] **Step 1: Тесты** `tests/db/schema.test.js`:
  - `history: смена date и title пишет 2 строки` (`field` = `'date'` / `'title'`, `old_value`/`new_value` = строковые значения)
  - `history: смена только done не пишет историю`
  - `rls: пользователь B не видит задачи пользователя A` (select под B возвращает 0 строк)
  - `rls: пользователь B не может обновить задачу A` (затронуто 0 строк)
  - `unique: вторая задача с тем же (recurrence_id, occurrence_date) падает`
- [ ] **Step 2:** `npm test`, ожидается FAIL.
- [ ] **Step 3:** Написать 001–003. RLS: `enable row level security` и политика `for all using (user_id = auth.uid()) with check (user_id = auth.uid())` на каждой таблице, `grant select, insert, update, delete ... to authenticated`. Если PGlite не поддерживает `set role`, rls-тесты переходят на проверку `pg_policies` для каждой таблицы. Это решение сборщика, отметить в коммите.
- [ ] **Step 4:** `npm test`, ожидается PASS.
- [ ] **Step 5:** Commit `feat(db): схема, RLS, история`.

### Task 4: Повторы (SQL)

**Files:**
- Create: `supabase/migrations/004_recurrence.sql`
- Test: `tests/db/recurrence.test.js`

**Interfaces:**
- Consumes: таблицы задачи 3.
- Produces:
  - `recurrence_dates(r recurrences, p_from date, p_to date) returns setof date`. Даты в окне `[greatest(p_from, r.start_date), least(p_to, coalesce(r.end_date, p_to))]` по правилу: `daily` каждый день; `weekdays` — ISO-день в `r.weekdays`; `weekly` — тот же день недели, что `start_date`; `monthly` — день `start_date` или последний день месяца, если такого нет; `yearly` — те же месяц и день, 29.02 → 28.02 в невисокосный год.
  - `materialize(p_user uuid, p_until date) returns int`. Для каждой recurrence пользователя создаёт задачи с `date = occurrence_date = d`, копирует `title, time, note, remind_minutes, goal_id`, начиная с `coalesce(materialized_until + 1, start_date)`. `on conflict do nothing`, обновляет `materialized_until`. Возвращает число вставленных строк.
  - `split_recurrence(p_task_id uuid, p_changes jsonb) returns uuid` («эта и все следующие»). У старой recurrence ставит `end_date = occurrence_date − 1`. Удаляет её задачи с `occurrence_date ≥` этой даты, где `done = false and is_exception = false`. Создаёт новую recurrence: копия старой + `p_changes` (ключи `title, time, note, remind_minutes, goal_id, freq, weekdays, end_date`), `start_date = occurrence_date`. Вызывает `materialize(..., current_date + 60)`. Возвращает id новой.
  - `end_recurrence_from(p_task_id uuid) returns void` («удалить эту и все следующие»): то же без создания новой.
  - Все функции `security invoker`, кроме `materialize`, который вызывается из cron (`security definer` + проверка `auth.uid() is null or auth.uid() = p_user`).
  - «Только эта»: обычный update задачи на клиенте + `is_exception = true`, отдельной функции нет.

- [ ] **Step 1: Тесты:**
  - `weekdays пн,ср с 2026-11-16 по 2026-11-29` → `['2026-11-16','2026-11-18','2026-11-23','2026-11-25']`
  - `monthly с 2026-01-31` за янв–апр → `['2026-01-31','2026-02-28','2026-03-31','2026-04-30']`
  - `yearly с 2028-02-29` за 2028–2030 → `['2028-02-29','2029-02-28','2030-02-28']`
  - `end_date ограничивает`: daily с 2026-11-20, end 2026-11-22, окно до 12-31 → 3 даты
  - `materialize идемпотентен`: два вызова → вторая возвращает 0, задач столько же
  - `split: правка с середины` — daily с 11-20, split на задаче 11-25 с `{"title":"Йога 2"}`. Задачи 11-20…11-24 со старым названием, с 11-25 с новым. Выполненная задача 11-26 до split сохранилась.
  - `split не трогает is_exception`
- [ ] **Step 2:** `npm test`, ожидается FAIL.
- [ ] **Step 3:** Реализовать 004 (`generate_series` по дням с фильтром по правилу).
- [ ] **Step 4:** `npm test`, ожидается PASS.
- [ ] **Step 5:** Commit `feat(db): повторы`.

### Task 5: Ежедневный перенос и выборка напоминаний (SQL)

**Files:**
- Create: `supabase/migrations/005_daily.sql`, `006_reminders.sql`
- Test: `tests/db/daily.test.js`, `tests/db/reminders.test.js`

**Interfaces:**
- Produces:
  - `rollover_tasks(p_user uuid, p_today date) returns int`: `update tasks set carry_count = carry_count + (p_today - date), date = p_today where user_id = p_user and done = false and occurrence_date is null and date < p_today`. `reminded_at` не трогать.
  - `run_daily(p_now timestamptz default now()) returns void`, security definer. Для пользователя `auth.uid()` (если вызвано клиентом) или для всех строк `settings` (если `auth.uid()` null): `local_today = (p_now at time zone tz)::date`. Если `last_rollover_date is distinct from local_today` и локальное время ≥ 00:05, вызвать `rollover_tasks`, `materialize(user, local_today + 60)` и записать `last_rollover_date`. `grant execute to authenticated`.
  - `due_reminders(p_now timestamptz) returns table(task_id uuid, user_id uuid, title text, time time)`: задачи `done = false`, `time`, `remind_minutes` не null, `reminded_at` null, `((date + time) at time zone s.tz) - remind_minutes * interval '1 minute'` в `(p_now - interval '1 hour', p_now]`. `revoke execute from public, authenticated`.
  - `mark_reminded(p_ids uuid[]) returns void`, также только для service role.
- [ ] **Step 1: Тесты:**
  - `перенос за 3 дня`: задача 11-20 не выполнена, `run_daily('2026-11-23 00:10+03')` → `date = '2026-11-23'`, `carry_count = 3`, одна строка истории `date`
  - `выполненная не переносится`, `повторяющаяся не переносится`
  - `до 00:05 не переносится`: `'2026-11-23 00:03+03'` → дата прежняя
  - `второй вызов в тот же день ничего не делает`
  - `run_daily досоздаёт повторы до today + 60`
  - `напоминание: задача 23-го в 09:00, remind 15` → в `'2026-11-23 08:45+03'` есть, в `08:44` нет, в `10:30` нет (старше часа)
  - `после mark_reminded и переноса на следующий день напоминания нет`
- [ ] **Step 2:** FAIL. **Step 3:** реализовать. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(db): перенос и напоминания`.

### Task 6: Офлайн-хранилище и синхронизация

**Files:**
- Create: `js/store.js`
- Test: `tests/store.test.js` (`fake-indexeddb/auto`, фейковый клиент Supabase с журналом вызовов и переключателем «сеть упала»)

**Interfaces:**
- Produces `createStore({ client, indexedDB = globalThis.indexedDB, dbName = 'planner' }) -> Store`:
  - `list(table: string, filter?: (row) => boolean) -> Promise<row[]>`: сразу из кэша, параллельно `refresh(table)`
  - `refresh(table) -> Promise<void>`: выборка с сервера в кэш; строки с неотправленными изменениями не перезаписываются; событие `change`
  - `upsert(table, row) -> Promise<row>`: проставляет `id = row.id ?? crypto.randomUUID()`, `updated_at = new Date().toISOString()`, пишет кэш, кладёт в очередь `{op:'upsert', table, row}`, вызывает `flush()`
  - `remove(table, id) -> Promise<void>`: то же с `{op:'delete'}`
  - `rpc(name, args) -> Promise<any>`: только онлайн, офлайн бросает `OfflineError`
  - `flush() -> Promise<void>`: по порядку, каждую операцию после успеха удаляет из очереди, на сетевой ошибке останавливается; одновременно идёт только один flush
  - `pendingCount() -> Promise<number>`, `on(event: 'change'|'pending', cb)`
  - Таблицы в кэше: `tasks, goals, special_dates, recurrences, images, task_history` (последняя только для чтения).
  - Автоматический `flush` на `window` `online` и раз в 30 с при `pendingCount > 0`.
- [ ] **Step 1: Тесты:**
  - `upsert офлайн попадает в кэш и очередь` (`pendingCount === 1`, `list` возвращает строку)
  - `flush после восстановления сети отправляет в порядке A, B, C`
  - `частичная ошибка + повторный flush = ровно один upsert на строку, порядок сохранён` (Review Focus 2)
  - `refresh не затирает строку с неотправленной правкой`
  - `rpc офлайн бросает OfflineError`
- [ ] **Step 2:** FAIL. **Step 3:** реализовать (IndexedDB: store на каждую таблицу + `outbox` с autoIncrement). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: офлайн-хранилище`.

### Task 7: Вход и оболочка приложения

**Files:**
- Create: `js/supabase.js`, `js/auth.js`, `js/app.js`, `js/ui/nav.js`
- Modify: `index.html`, `css/layout.css`, `js/config.js`

**Interfaces:**
- Produces:
  - `js/supabase.js`: `export const client` (`createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })`), `export const store = createStore({ client })`
  - `js/app.js`: маршруты `#/today` (по умолчанию), `#/week`, `#/month`, `#/day/YYYY-MM-DD`, `#/images`. Каждая страница — модуль с `render(root: HTMLElement, params) -> void | (() => void)` (функция очистки). При открытии и при `visibilitychange → visible` вызывает `store.rpc('run_daily')` (ошибки офлайн игнорируются) и `store.flush()`.
  - Индикатор «не синхронизировано» в шапке при `pendingCount > 0`.
- [ ] **Step 1:** `auth.js`: экран «Вход» с полем почты → кнопка «Получить код» (`signInWithOtp({ email, options: { shouldCreateUser: true } })`, на первом входе) → поле на 6 цифр (`inputmode="numeric"`, `autocomplete="one-time-code"`) → `verifyOtp`. После первого входа вставить строку в `settings` с `tz = Intl.DateTimeFormat().resolvedOptions().timeZone`.
- [ ] **Step 2:** Применить миграции 001–006 в проекте хозяйки (SQL Editor или `npx supabase db push`, на выбор хозяйки).
- [ ] **Step 3:** Хозяйка входит на компьютере. Затем в Authentication → Settings выключить «Allow new users to sign up», а в `auth.js` поменять на `shouldCreateUser: false`.
- [ ] **Step 4:** Проверка: `preview_start planner`, вход, видна навигация. Ширина 375px: нижняя панель, без горизонтальной прокрутки. Ширина 1280px: боковое меню.
- [ ] **Step 5:** Commit `feat: вход и навигация`.

### Task 8: Страница «Сегодня», редактор задачи, история, повторы в интерфейсе

**Files:**
- Create: `js/tasks.js`, `js/pages/today.js`, `js/pages/day.js`, `js/ui/task-item.js`, `js/ui/task-editor.js`, `js/ui/history-sheet.js`, `js/ui/repeat-dialog.js`
- Test: `tests/tasks.test.js`

**Interfaces:**
- Produces (`js/tasks.js`):
  - `sortTasks(tasks) -> tasks`: сначала со временем по возрастанию, потом без времени по `created_at`, выполненные в конце
  - `taskBadges(task, todayISO) -> string[]`: `'carried'` если `carry_count > 0 && !occurrence_date`; `'missed'` если `occurrence_date && !done && date < todayISO`; `'repeat'` если `recurrence_id`
  - `newTaskDraft({ date, time }) -> row` с `remind_minutes = time ? 15 : null`
  - `withTimeChange(task, time) -> task`: при появлении времени, если `remind_minutes` null, ставит 15; при удалении времени ставит null
- Produces (UI): `renderDayList(root, isoDate)` используется в `today.js` и `day.js`; `openTaskEditor({ task?, date }) -> Promise<void>`.
- [ ] **Step 1: Тесты** для `sortTasks`, `taskBadges` (три случая + пустой), `newTaskDraft` (с временем → 15, без → null), `withTimeChange`.
- [ ] **Step 2:** FAIL. **Step 3:** реализовать `tasks.js`. **Step 4:** PASS.
- [ ] **Step 5: UI.** Шапка `formatDayTitle`, список задач (галочка, время, название, бейджи «↻ перенесено ×N» / «пропущено» / «🔁»), кнопка «+ Задача». Редактор (нижний лист на телефоне, модальное окно на компьютере): название, дата, время, заметка, переключатель напоминания «за 15 минут» с выбором 5/15/30/60, цель (список целей текущей недели и месяца), повтор (нет / каждый день / по дням недели с чипами пн–вс / каждую неделю / каждый месяц / каждый год, плюс «до даты»). Кнопка «История» показывает `task_history` задачи («23 ноя, 21:10 — дата: 22.11 → 23.11»). Галочка ставит `done` и `done_at`. Сохранение повторяющейся задачи открывает `repeat-dialog`: «Только эта» (update + `is_exception = true`) или «Эта и все следующие» (`rpc('split_recurrence')`). Удаление: «Только эта» / «Эта и все следующие» (`end_recurrence_from`). Создание или изменение правила повтора офлайн показывает «Для повторов нужен интернет 🌐».
- [ ] **Step 6:** Блок «Картинка дня» на этой странице — заглушка-слот, его наполняет задача 10.
- [ ] **Step 7:** Проверка в браузере: создать задачу на 09:00, отметить, перенести на завтра и увидеть историю; создать повтор «пн, ср», поменять «эта и все следующие». Офлайн (DevTools → Offline): отметка работает, виден индикатор, после включения сети синхронизируется. Показать хозяйке.
- [ ] **Step 8:** Commit `feat: страница Сегодня`.

### Task 9: «Неделя», «Месяц», цели и красные даты

**Files:**
- Create: `js/goals.js`, `js/special-dates.js`, `js/pages/week.js`, `js/pages/month.js`, `js/ui/goal-card.js`
- Test: `tests/goals.test.js`, `tests/special-dates.test.js`

**Interfaces:**
- Produces:
  - `goalProgress(goal, tasks) -> { value, target, percent }`: `value = clamp(число задач с goal_id === goal.id && done + goal.manual_adjust, 0, target)`, `percent = Math.round(value / target * 100)`
  - `goalsFor(goals, period: 'week'|'month', periodStartISO) -> goals`
  - `specialDatesForMonth(dates, year, month) -> Map<iso, row[]>`: обычные по точной дате, `yearly` переносятся в год `year` (29.02 → 28.02 в невисокосный)
- [ ] **Step 1: Тесты:**
  - `goalProgress`: 1 привязанная выполненная + adjust 1, target 2 → `{value:2, percent:100}`; adjust −5 → value 0; невыполненная не считается
  - `specialDatesForMonth`: ежегодный ДР 2000-03-15 в марте 2027 на `'2027-03-15'`; ежегодный 2028-02-29 в феврале 2027 на `'2027-02-28'`; разовый дедлайн из другого года не показывается
- [ ] **Step 2:** FAIL. **Step 3:** реализовать. **Step 4:** PASS.
- [ ] **Step 5: «Неделя».** Стрелки ‹ › по неделям. Карточки целей недели (полоска прогресса, «+1», «−1» меняют `manual_adjust`, «+ Цель»). Ниже 7 дней с короткими списками задач, нажатие на день ведёт на `#/day/…`.
- [ ] **Step 6: «Месяц».** Стрелки по месяцам, `formatMonthTitle`. Сетка `monthGrid`: красные даты — розово-красный кружок, дедлайн — значок ⏳, точка, если есть задачи. Нажатие на день ведёт на `#/day/…`. Под сеткой цели месяца (те же карточки) и список «Красные даты и дедлайны месяца». «+ Дата»: название, дата, тип (красная дата / дедлайн), цвет, «каждый год».
- [ ] **Step 7:** Проверка в браузере на 375px и 1280px, показать хозяйке.
- [ ] **Step 8:** Commit `feat: неделя, месяц, цели, красные даты`.

### Task 10: Картинки и картинка дня

**Files:**
- Create: `js/images.js`, `js/pages/images.js`, `js/ui/image-of-day.js`, `js/ui/quote-card.js`, `supabase/migrations/008_storage.sql`
- Test: `tests/images.test.js`

**Interfaces:**
- Produces:
  - `fitWithin(w, h, max = 1600) -> { w, h }`: сохраняет пропорции, не увеличивает
  - `async downscale(file: File, max = 1600) -> Blob` (JPEG 0.85 через canvas / `createImageBitmap`)
  - `pickImageForDate(images, iso, offset = 0) -> image | null`: `images[(djb2(iso) + offset) % n]`, стабильно для одного дня
  - `async imageSrc(image) -> string`: `photo` → signed URL из bucket `images` (на 1 час, с кэшем в памяти); `link` → `url`
  - `renderImageOfDay(root, iso)`: кнопка «другая» увеличивает `offset` в `localStorage['iod:' + iso]` (в try/catch)
  - `renderQuoteCard(text) -> HTMLElement`: фраза на пастельном градиенте, градиент выбирается по хэшу текста
- [ ] **Step 1: Тесты:**
  - `fitWithin(4032, 3024) → {w:1600, h:1200}`; `fitWithin(800, 600) → {w:800, h:600}`; портрет `fitWithin(3024, 4032) → {w:1200, h:1600}`
  - `pickImageForDate` стабилен для одной даты, даёт другой элемент при `offset = 1` (n ≥ 2), `null` при пустом списке
- [ ] **Step 2:** FAIL. **Step 3:** реализовать. **Step 4:** PASS.
- [ ] **Step 5:** `008_storage.sql`: приватный bucket `images`, политики storage `(storage.foldername(name))[1] = auth.uid()::text`. Путь файла `${uid}/${uuid}.jpg`. Применить в проекте.
- [ ] **Step 6:** Страница «Картинки»: сетка, фильтр по категориям (котики / собачки / мотивация / мои). «+ Фото» (`<input type="file" accept="image/*">` → `downscale` → upload → строка `images`). «+ Ссылка» (прямая ссылка на картинку, проверка загрузкой `<img>`). «+ Фраза». Удаление.
- [ ] **Step 7: Стартовый набор.** Найти 12–15 фото с открытой лицензией (Unsplash, Pexels, Wikimedia Commons) по списку из спецификации, раздел 6. Показать хозяйке галерею кандидатов с источником и лицензией. **Перед скачиванием** спросить разрешение (имена файлов, источник, размер). Выбранные уменьшить и загрузить в bucket с категориями. Написать 10 стартовых мотивационных фраз, согласовать с хозяйкой, добавить как `kind = 'quote'`. Автор фото указывается в подписи, если этого требует лицензия.
- [ ] **Step 8:** Вставить `renderImageOfDay` в «Сегодня». Проверить в браузере, показать хозяйке.
- [ ] **Step 9:** Commit `feat: картинки и картинка дня`.

### Task 11: PWA и push-напоминания

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`, `js/push.js`, `supabase/functions/reminders/index.ts`, `supabase/functions/reminders/payload.js`, `supabase/migrations/007_cron.sql`
- Modify: `index.html` (manifest, `apple-touch-icon`, `apple-mobile-web-app-capable`, `theme-color`), `js/app.js` (регистрация sw)
- Test: `tests/push.test.js`, `tests/payload.test.js`

**Interfaces:**
- Produces:
  - `pushAvailability({ hasSW, hasPush, isStandalone, isIOS }) -> 'ok' | 'need-home-screen' | 'unsupported'`: iOS без standalone → `'need-home-screen'`
  - `async enablePush() -> void`: вызывается только по нажатию. `Notification.requestPermission()` → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })` → upsert в `push_subscriptions`.
  - `buildPayload({ title, time }) -> { title: '⏰ ' + title, body: 'в ' + 'HH:MM', url: './#/today' }` (`payload.js`, чистый JS, импортируется и Node, и Deno)
  - `sw.js`: кэширует оболочку (html, css, js, иконки, supabase-js с CDN) по версии `CACHE = 'planner-v1'`; на `push` показывает уведомление; на `notificationclick` открывает или фокусирует `url`.
  - Edge Function `reminders`: service role. `rpc('due_reminders', { p_now: new Date().toISOString() })` → для каждой задачи рассылка на все подписки пользователя через `npm:web-push` → подписки с 404/410 удалить → `rpc('mark_reminded')`. Вызов разрешён только с заголовком `Authorization: Bearer <CRON_SECRET>`.
  - `007_cron.sql`: `cron.schedule('run-daily', '*/15 * * * *', 'select public.run_daily()')`; `cron.schedule('reminders', '* * * * *', ...)` через `net.http_post` на `/functions/v1/reminders` с секретом из Vault.
- [ ] **Step 1: Тесты:** `pushAvailability` (4 случая: iOS не standalone, iOS standalone, без PushManager, десктоп); `buildPayload({title:'Йога', time:'09:00:00'})` → `body === 'в 09:00'`.
- [ ] **Step 2:** FAIL. **Step 3:** реализовать `push.js`, `payload.js`. **Step 4:** PASS.
- [ ] **Step 5:** Сгенерировать VAPID-ключи (`npx web-push generate-vapid-keys`). Публичный положить в `config.js`. Приватный, `CRON_SECRET` и `VAPID_SUBJECT = 'mailto:'` + почта хозяйки положить в секреты Supabase (`npx supabase secrets set`, хозяйка вводит сама). Задеплоить функцию, применить 007 (включить расширения pg_cron, pg_net).
- [ ] **Step 6:** Иконки: пастельный градиентный круг с 🌸 (PNG; генерировать скриптом через canvas в браузере или нарисовать SVG и сконвертировать).
- [ ] **Step 7:** В шапке «Сегодня» кнопка «🔔 Включить напоминания». По `pushAvailability`: `'need-home-screen'` → подсказка «Добавь сайт на экран Домой: Поделиться → На экран Домой», `'unsupported'` → кнопка скрыта.
- [ ] **Step 8:** Проверка на компьютере (Chrome): включить, задача через 17 минут → уведомление пришло через ~2 минуты при закрытой вкладке. Ещё раз не пришло.
- [ ] **Step 9:** Commit `feat: PWA и напоминания`.

### Task 12: Выкладка на GitHub Pages и установка на iPhone

- [ ] **Step 1:** `gh auth status`. Если не вошли, хозяйка выполняет `gh auth login` сама.
- [ ] **Step 2:** Спросить хозяйку про имя репозитория (по умолчанию `pastel-planner`) и предупредить: репозиторий публичный, код виден, данные нет. После «да»: `gh repo create pastel-planner --public --source . --push`, затем включить Pages (ветка `main`, корень) через `gh api`.
- [ ] **Step 3:** В Supabase Authentication → URL Configuration добавить адрес Pages в Site URL.
- [ ] **Step 4:** Хозяйка открывает адрес в Safari на iPhone → Поделиться → «На экран Домой» → открывает с иконки → входит по коду → «Включить напоминания» → разрешает.
- [ ] **Step 5:** Сквозная проверка вместе: задача на компьютере появилась на телефоне; галочка на телефоне видна на компьютере; напоминание пришло на iPhone при закрытом приложении; картинка дня показывается; вёрстка на iPhone без горизонтальной прокрутки.
- [ ] **Step 6:** Обновить память проекта (где сайт, как обновлять), commit и push.
