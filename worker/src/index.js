const ALLOWED_ORIGINS = new Set([
  'https://mutoshiki.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://mutoshiki.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(origin) });
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    mountainName: { type: ['string', 'null'], description: 'YAMAPのコース名や主要ピークから分かる簡潔な山名・企画名。例: 根子岳・四阿山。確信できなければnull。' },
    areaMunicipality: { type: ['string', 'null'], description: '高い確信度で分かる山域 / 所在市町村。例: 四阿山 / 長野県上田市。確信できなければnull。' },
    durationMinutes: { type: ['integer', 'null'], description: 'YAMAP計画データに表示された合計時間を分に換算。読めなければnull。' },
    distanceKm: { type: ['number', 'null'], description: '距離km。読めなければnull。' },
    ascentM: { type: ['integer', 'null'], description: 'のぼり/上りの累積標高m。読めなければnull。' },
    descentM: { type: ['integer', 'null'], description: 'くだり/下りの累積標高m。読めなければnull。' },
    routeImageIndex: { type: ['integer', 'null'], description: 'アップロード順0始まりで、全体ルート地図が最も明瞭に写る画像のindex。なければnull。' },
    itinerary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          time: { type: 'string', description: '24時間制HH:MM' },
          place: { type: 'string', description: 'YAMAP上の地点名を日本語で正確に転記' },
          major: { type: 'boolean', description: '山頂・登山口・駐車場・主要地点はtrue。単なる「分岐」はfalse。' },
        },
        required: ['time', 'place', 'major'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' }, description: '読み取りが曖昧な箇所だけ短く記載。問題なければ空配列。' },
  },
  required: ['mountainName', 'areaMunicipality', 'durationMinutes', 'distanceKm', 'ascentM', 'descentM', 'routeImageIndex', 'itinerary', 'warnings'],
};

const PROMPT = `あなたは日本の登山計画書を作成するためのYAMAPスクリーンショット解析器です。
渡された複数画像は同一の登山計画です。画像の見た目とレイアウトを理解し、単純OCRではなく意味を使って読み取ってください。

必須ルール:
- iPhoneのステータスバー時刻、日出/日入、ページUI、活動日記、ボタンなどを行程時刻として絶対に採用しない。
- 行程はYAMAPの縦タイムラインに並ぶ「時刻 + 地点名」のみを時系列で統合する。
- 複数スクリーンショットに重複地点があれば1件に統合する。
- 地点名を推測で別の山名に変えない。日本語表示を優先する。
- 「分岐」は行程には残してよいが major=false。それ以外の山頂、登山口、駐車場、トイレ、主要鞍部などは原則major=true。
- 計画データ画面から合計時間、距離、のぼり、くだりを取得する。
- mountainNameは、画面に見えるコース名・主要ピーク・行程から簡潔な山名を作る。主要な山が複数なら「・」でつなぐ。「周回コース」等のUI語は付けない。確信できなければnull。
- areaMunicipalityは、画像内の地名または山の位置関係から高い確信度で分かる場合だけ「山域 / 都道府県市町村」の形で返す。曖昧ならnull。提出者が後で確認する前提でも、推測で別地域を埋めない。
- routeImageIndexは、地図全体とルート線が最もよく見える元画像を選ぶ。画像の切り抜き座標は返さない。
- 不確実な値は無理に埋めずnullまたはwarningsにする。
- 出力は指定JSONスキーマのみ。`;

async function callGemini(images, apiKey) {
  const parts = [{ text: PROMPT }];
  for (const image of images) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseFormat: {
          text: {
            mimeType: 'APPLICATION_JSON',
            schema: RESPONSE_SCHEMA,
          },
        },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const detail = payload?.error?.message || `Gemini API error ${response.status}`;
    throw new Error(detail);
  }
  const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
  if (!text) throw new Error('Geminiから解析結果が返りませんでした。');
  return JSON.parse(text);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403, origin);
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, geminiConfigured: Boolean(env.GEMINI_API_KEY) }, 200, origin);
    }

    if (url.pathname !== '/analyze' || request.method !== 'POST') {
      return json({ error: 'Not found' }, 404, origin);
    }
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403, origin);
    if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY がWorkerに設定されていません。' }, 503, origin);

    try {
      const body = await request.json();
      const images = Array.isArray(body.images) ? body.images : [];
      if (!images.length || images.length > 8) return json({ error: 'YAMAP画像を1〜8枚送ってください。' }, 400, origin);
      for (const image of images) {
        if (!/^image\/(png|jpeg|webp)$/.test(image?.mimeType || '') || typeof image?.data !== 'string' || !image.data) {
          return json({ error: '画像形式が不正です。PNG/JPEG/WebPを使用してください。' }, 400, origin);
        }
      }
      const result = await callGemini(images, env.GEMINI_API_KEY);
      return json(result, 200, origin);
    } catch (error) {
      console.error(error);
      return json({ error: error?.message || '画像解析に失敗しました。' }, 500, origin);
    }
  },
};
