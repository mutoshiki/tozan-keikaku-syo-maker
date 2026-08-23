import { describe, expect, it, vi } from 'vitest';
import { MODEL_CHAIN, callGemini } from '../worker/src/index.js';

const images = [{ mimeType:'image/webp', data:'ZmFrZQ==' }];
const okPayload = {
  mountainName:'根子岳・四阿山',
  areaMunicipality:'菅平・四阿山域 / 上田市・須坂市・嬬恋村',
  municipalities:['上田市','須坂市','嬬恋村'],
  durationMinutes:370,distanceKm:9.5,ascentM:987,descentM:988,routeImageIndex:0,
  itinerary:[{time:'07:00',place:'菅平牧場公衆トイレ',major:true}],warnings:[]
};

function response(status, body) {
  return { ok:status >= 200 && status < 300, status, json:async()=>body };
}

function geminiSuccess(result=okPayload) {
  return response(200,{candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]});
}

describe('Gemini fallback', () => {
  it('uses the configured high-to-low model order', () => {
    expect(MODEL_CHAIN).toEqual([
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
    ]);
  });

  it('retries a busy model once, then falls back to the next model', async () => {
    const calls=[];
    const fetchImpl=vi.fn(async url => {
      calls.push(String(url));
      if (calls.length <= 2) return response(503,{error:{message:'This model is currently experiencing high demand.'}});
      return geminiSuccess();
    });

    const result=await callGemini(images,'test-key',{fetchImpl,sleepImpl:async()=>{}});
    expect(result.durationMinutes).toBe(370);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain('/gemini-3.7-flash:generateContent');
    expect(calls[1]).toContain('/gemini-3.7-flash:generateContent');
    expect(calls[2]).toContain('/gemini-3.6-flash:generateContent');
  });

  it('keeps stepping down when models are unavailable', async () => {
    const calls=[];
    const fetchImpl=vi.fn(async url => {
      calls.push(String(url));
      const model=MODEL_CHAIN.find(name => String(url).includes(`/${name}:generateContent`));
      if (model === 'gemini-3.1-flash-lite') return geminiSuccess();
      return response(404,{error:{message:'Model not available'}});
    });

    const result=await callGemini(images,'test-key',{fetchImpl,sleepImpl:async()=>{}});
    expect(result.mountainName).toBe('根子岳・四阿山');
    expect(calls).toHaveLength(MODEL_CHAIN.length);
    MODEL_CHAIN.forEach((model,index)=>expect(calls[index]).toContain(`/${model}:generateContent`));
  });

  it('never exposes the provider English overload message after all fallbacks fail', async () => {
    const fetchImpl=vi.fn(async()=>response(503,{error:{message:'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.'}}));
    await expect(callGemini(images,'test-key',{fetchImpl,sleepImpl:async()=>{}}))
      .rejects.toThrow('混み合っています。もう一度お試しください。');
    expect(fetchImpl).toHaveBeenCalledTimes(MODEL_CHAIN.length * 2);
  });
});
