import { describe, expect, it } from 'vitest';
import { parseMetrics, parseItinerary, applyRests, buildItineraryText, classifyOcr } from './yamap.js';

const METRICS_OCR = `
計画 デー タ
@ タイ ム
99 距離
S の ぼり
きす くだ り
06:10
9.5 km
987 m
988 m
2400m
2200m
`;

const ITINERARY_OCR = `
根子 岳 - 四 阿山 周回 コー ス
日 出 05:10 / 日 入 18:26
7:00 Q
菅平 牧場 公衆 トイ レ
2 時 間
根子 岳
9:00 Q
1 時間 30 分
10:30
分 岐
10:40
分 岐
四阿 山
10:45 Q
10:50
分 岐
11:00
分 岐
11:10
分 岐
11:35
中 四阿
11:45
分 岐
12:05 O 小 四 阿
13:05 Q) 四阿 山 登 山口 (中 四阿 経由 )
13:10 O 菅 平 牧場 公衆 トイ レ
`;

describe('YAMAP parser', () => {
  it('parses plan metrics even when labels and values are separated', () => {
    expect(parseMetrics(METRICS_OCR)).toEqual({ durationMinutes: 370, distanceKm: 9.5, ascentM: 987, descentM: 988 });
  });

  it('parses the real YAMAP timeline shape and omits branches by default', () => {
    const result = parseItinerary(ITINERARY_OCR);
    expect(result.find((row) => row.time === '07:00')?.place).toBe('菅平牧場公衆トイレ');
    expect(result.find((row) => row.time === '09:00')?.place).toBe('根子岳');
    expect(result.find((row) => row.time === '10:30')).toMatchObject({ place: '分岐', major: false });
    expect(result.find((row) => row.time === '10:45')?.place).toBe('四阿山');
    expect(result.find((row) => row.time === '11:35')?.place).toBe('中四阿');
    expect(result.find((row) => row.time === '12:05')?.place).toBe('小四阿');
    expect(result.find((row) => row.time === '13:10')?.place).toBe('菅平牧場公衆トイレ');
    expect(classifyOcr(ITINERARY_OCR)).toBe('itinerary');
  });

  it('shifts later times after rest', () => {
    const rows = [
      { time: '10:45', place: '四阿山', major: true, restMinutes: 60 },
      { time: '11:35', place: '中四阿', major: true, restMinutes: 0 },
      { time: '12:05', place: '小四阿', major: true, restMinutes: 0 },
    ];
    expect(applyRests(rows)[1].adjustedTime).toBe('12:35');
    expect(buildItineraryText(rows)).toContain('12:35');
    expect(buildItineraryText(rows)).toContain('休憩 60分');
  });
});
