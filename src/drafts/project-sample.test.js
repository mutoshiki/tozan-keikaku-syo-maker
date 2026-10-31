import { describe, expect, it, vi } from 'vitest';
import { loadProjectSample } from './project-sample.js';

describe('loadProjectSample', () => {
  it('uses the project date for an embedded synthetic sample', () => {
    const events = [];
    const field = { value: '', dispatchEvent: event => events.push(event.type) };
    const runtime = {
      loadSampleData: vi.fn(() => '標準サンプル'),
      draftRuntime: { root: { querySelector: vi.fn(() => field) } },
    };

    expect(loadProjectSample(runtime, '2026-11-07')).toBe('標準サンプル');
    expect(field.value).toBe('2026-11-07');
    expect(events).toEqual(['input', 'change']);
  });

  it('does not alter the sample date when the project has no valid date', () => {
    const field = { value: '2026-10-20', dispatchEvent: vi.fn() };
    const runtime = {
      loadSampleData: vi.fn(() => { field.value = '2026-10-20'; return '標準サンプル'; }),
      draftRuntime: { root: { querySelector: vi.fn(() => field) } },
    };

    loadProjectSample(runtime, '2026-02-30');
    expect(field.value).toBe('2026-10-20');
    expect(field.dispatchEvent).not.toHaveBeenCalled();
  });
});
