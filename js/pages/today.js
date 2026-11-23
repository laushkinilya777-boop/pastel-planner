import { renderDay } from './day-view.js';
import { todayISO } from '../dates.js';

export function render(root, _params, { user }) {
  return renderDay(root, { date: todayISO(), mode: 'today', user });
}
