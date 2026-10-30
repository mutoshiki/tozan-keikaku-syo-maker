import { describe, expect, it } from 'vitest';
import { encodeProjectContext, parseProjectContext } from './project-handoff.js';

describe('mountain maker project context', () => {
  it('encodes and reads only the supported project fields from a URL fragment', () => {
    const hash = encodeProjectContext({
      roomId: 'PLAN-42',
      projectName: '秋名山登山企画',
      eventDate: '2026-11-02',
    });

    expect(parseProjectContext(hash)).toEqual({
      roomId: 'PLAN-42',
      projectName: '秋名山登山企画',
      eventDate: '2026-11-02',
    });
  });

  it('rejects malformed, oversized, and unsupported fragments', () => {
    expect(parseProjectContext('#sanpo-project=%')).toBeNull();
    expect(parseProjectContext(`#sanpo-project=${'a'.repeat(2100)}`)).toBeNull();
    expect(parseProjectContext(`#sanpo-project=${encodeURIComponent(JSON.stringify({ version: 2, roomId: 'PLAN-42', projectName: '企画', eventDate: '2026-11-02' }))}`)).toBeNull();
  });

  it('rejects invalid room IDs and impossible event dates', () => {
    expect(encodeProjectContext({ roomId: 'x', projectName: '企画', eventDate: '2026-11-02' })).toBe('');
    expect(encodeProjectContext({ roomId: 'PLAN-42', projectName: '企画', eventDate: '2026-02-30' })).toBe('');
  });
});
