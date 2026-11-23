// Прогресс цели = выполненные привязанные задачи + ручная поправка (+1/−1), в пределах [0, цель].
export function goalProgress(goal, tasks) {
  const linked = tasks.filter((t) => t.goal_id === goal.id && t.done).length;
  const target = Math.max(1, goal.target || 1);
  const value = Math.max(0, Math.min(target, linked + (goal.manual_adjust || 0)));
  return { value, target, percent: Math.round((value / target) * 100) };
}

export function goalsFor(goals, period, periodStartISO) {
  return goals.filter((g) => g.period === period && g.period_start === periodStartISO);
}
