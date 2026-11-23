import { renderDay } from './day-view.js';

export function render(root, { date }, { user }) {
  return renderDay(root, { date, mode: 'day', user });
}
