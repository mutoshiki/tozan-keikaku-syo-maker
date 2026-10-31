export function loadProjectSample(runtime, projectDate = '') {
  const label = runtime?.loadSampleData?.('standard');
  const date = String(projectDate || '').trim();
  if (!label || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return label;
  const [year, month, day] = date.split('-').map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) return label;

  const field = runtime?.draftRuntime?.root?.querySelector?.('#eventDate');
  if (!field) return label;
  field.value = date;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  return label;
}
