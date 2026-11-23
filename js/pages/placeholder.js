// Временная страница для разделов, которые появятся в следующих шагах.
import { icon } from '../ui/icons.js';

export function placeholder(title, iconName, text) {
  return {
    render(root) {
      root.innerHTML = `
        <h1 class="page-title">${title}</h1>
        <section class="panel empty-state">
          <div class="empty-ico">${icon(iconName, 28)}</div>
          <p>${text}</p>
        </section>`;
    },
  };
}
