const ALLOWED_ORIGINS = new Set([
  'https://mutoshiki.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);

export const MODEL_CHAIN = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://mutoshiki.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
  };
}
function json(data,status,origin){return new Response(JSON.stringify(data),{status,headers:corsHeaders(origin)});}

const RESPONSE_SCHEMA = {
  type:'object',
  properties:{
    mountainName:{type:'string',nullable:true,description:'簡潔な山名。主要な山が複数なら「・」でつなぐ。確信できなければnull。'},
    areaMunicipality:{type:'string',nullable:true,description:'山域 / 所在市町村。ルートが複数市町村にまたがる場合はすべて記載。確信できなければnull。'},
    municipalities:{type:'array',items:{type:'string'},description:'ルートが通る市町村名。例: 上田市、長和町。都道府県名は付けない。確信できるものだけ。'},
    durationMinutes:{type:'integer',nullable:true},
    distanceKm:{type:'number',nullable:true},
    ascentM:{type:'integer',nullable:true},
    descentM:{type:'integer',nullable:true},
    routeImageIndex:{type:'integer',nullable:true},
    itinerary:{type:'array',items:{type:'object',properties:{time:{type:'string'},place:{type:'string'},major:{type:'boolean'}},required:['time','place','major']}},
    warnings:{type:'array',items:{type:'string'}}
  },
  required:['mountainName','areaMunicipality','municipalities','durationMinutes','distanceKm','ascentM','descentM','routeImageIndex','itinerary','warnings']
};

const PROMPT = `YAMAPの登山計画スクリーンショットを読み取り、指定JSONだけを返してください。

- 複数画像は同一の計画として統合する。
- ステータスバー、日出・日入、ボタン等のUI時刻を行程に含めない。
- 行程はYAMAPの時刻と地点名を時系列で統合し、重複を除く。
- 行程時刻は24時間制HH:MMで返す。例: 07:00、09:05。
- 「分岐」はmajor=false。山頂、登山口、駐車場、トイレ、主要地点は原則major=true。
- 合計時間、距離、のぼり、くだりを計画データから取得する。
- mountainNameは主要な山名だけを簡潔に返す。
- areaMunicipalityは山域と、ルートが通る市町村を可能な限りすべて含める。
- municipalitiesにはルートが通る市町村名だけを配列で返す。警察署の自動判定に使うため、市・町・村まで正確にする。推測に自信がなければ入れない。
- routeImageIndexはルート全体が最も見やすい元画像。切り抜き座標は返さない。
- 不確実な値はnullまたはwarningsにする。`;

const RETRYABLE_STATUS = new Set([429,500,502,503,504]);
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));

function modelUnavailable(status,message='') {
  return status === 404 || /no longer available|not available|model.*not found|unsupported model|high demand|overloaded|temporarily unavailable/i.test(message);
}

function publicFailure(status,message='') {
  if (status === 401 || status === 403) return '読み取りサービスの設定を確認してください。';
  if (RETRYABLE_STATUS.has(status) || modelUnavailable(status,message)) return '混み合っています。もう一度お試しください。';
  return '読み取りに失敗しました。';
}

async function requestGeminiModel(model,parts,apiKey,fetchImpl) {
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseFormat:{text:{mimeType:'APPLICATION_JSON',schema:RESPONSE_SCHEMA}}}})
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function callGemini(images,apiKey,{fetchImpl=fetch,sleepImpl=sleep}={}){
  const parts=[{text:PROMPT},...images.map(image=>({inlineData:{mimeType:image.mimeType,data:image.data}}))];
  let lastFailure = null;

  for (const model of MODEL_CHAIN) {
    for (let attempt=0; attempt<2; attempt+=1) {
      let response;
      let payload;
      try {
        ({response,payload}=await requestGeminiModel(model,parts,apiKey,fetchImpl));
      } catch (error) {
        lastFailure={model,status:0,message:error?.message||'network error'};
        console.warn('Gemini request failed',lastFailure);
        if (attempt===0) { await sleepImpl(500); continue; }
        break;
      }

      if (response.ok) {
        const text=payload?.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('')||'';
        if (!text) {
          lastFailure={model,status:response.status,message:'empty response'};
          console.warn('Gemini returned no text',lastFailure);
          break;
        }
        try {
          const result=JSON.parse(text);
          console.log(`Gemini model used: ${model}`);
          return result;
        } catch (error) {
          lastFailure={model,status:response.status,message:'invalid JSON'};
          console.warn('Gemini returned invalid JSON',lastFailure);
          break;
        }
      }

      const message=payload?.error?.message||`Gemini API error ${response.status}`;
      lastFailure={model,status:response.status,message};
      console.warn('Gemini model failed',lastFailure);

      if (response.status===401 || response.status===403) throw new Error(publicFailure(response.status,message));
      const retryable=RETRYABLE_STATUS.has(response.status);
      const canFallback=retryable||modelUnavailable(response.status,message);
      if (!canFallback) throw new Error(publicFailure(response.status,message));

      if (retryable && attempt===0) {
        await sleepImpl(500);
        continue;
      }
      break;
    }
  }

  console.error('All Gemini fallback models failed',lastFailure);
  throw new Error('混み合っています。もう一度お試しください。');
}

export default{
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'';const url=new URL(request.url);
    if(request.method==='OPTIONS'){
      if(!ALLOWED_ORIGINS.has(origin))return json({error:'Origin not allowed'},403,origin);
      return new Response(null,{status:204,headers:corsHeaders(origin)});
    }
    if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,geminiConfigured:Boolean(env.GEMINI_API_KEY)},200,origin);
    if(url.pathname!=='/analyze'||request.method!=='POST')return json({error:'Not found'},404,origin);
    if(!ALLOWED_ORIGINS.has(origin))return json({error:'Origin not allowed'},403,origin);
    if(!env.GEMINI_API_KEY)return json({error:'読み取りサービスの設定を確認してください。'},503,origin);
    try{
      const body=await request.json();const images=Array.isArray(body.images)?body.images:[];
      if(!images.length||images.length>8)return json({error:'画像は1〜8枚です。'},400,origin);
      for(const image of images)if(!/^image\/(png|jpeg|webp)$/.test(image?.mimeType||'')||typeof image?.data!=='string'||!image.data)return json({error:'PNG、JPEG、WebPを使用してください。'},400,origin);
      return json(await callGemini(images,env.GEMINI_API_KEY),200,origin);
    }catch(error){console.error(error);return json({error:error?.message||'読み取りに失敗しました。'},500,origin);}
  }
};