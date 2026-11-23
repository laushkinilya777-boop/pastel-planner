import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createStore } from './store.js';

export const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true /* вход по ссылке из письма */ },
});

// Тестовая копия сайта (dev/) хранит данные отдельно, чтобы не смешиваться с настоящими.
const isDev = location.pathname.includes('/dev/');
export const store = createStore({ client, dbName: isDev ? 'planner-dev' : 'planner' });
