import { describe, expect, it } from 'vitest';
import { parseMetrics, parseItinerary, applyRests, buildItineraryText } from './yamap.js';

describe('YAMAP parser', () => {
  it('parses plan metrics', () => {
    const result = parseMetrics('タイム 06:10 距離 9.5 km のぼり 987 m くだり 988 m');
    expect(result).toEqual({ durationMinutes: 370, distanceKm: 9.5, ascentM: 987, descentM: 988 });
  });

  it('parses itinerary lines', () => {
    const result = parseItinerary('7:00 菅平牧場公衆トイレ\n9:00 根子岳\n10:30 分岐\n10:45 四阿山');
    expect(result).toHaveLength(4);
    expect(result[1].place).toBe('根子岳');
    expect(result[2].major).toBe(false);
  });

  it('shifts later times after rest', () => {
    const rows = [
      { time: '09:00', place: '根子岳', major: true, restMinutes: 60 },
      { time: '10:45', place: '四阿山', major: true, restMinutes: 0 },
    ];
    expect(applyRests(rows)[1].adjustedTime).toBe('11:45');
    expect(buildItineraryText(rows)).toContain('11:45');
  });
});
