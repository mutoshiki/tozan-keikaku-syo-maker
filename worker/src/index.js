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
- 「分岐」はmajor=false。山頂、登山口、駐車場、トイレ、主要地点は原則major=true。
- 合計時間、距離、のぼり、くだりを計画データから取得する。
- mountainNameは主要な山名だけを簡潔に返す。
- areaMunicipalityは山域と、ルートが通る市町村を可能な限りすべて含める。
- municipalitiesにはルートが通る市町村名だけを配列で返す。警察署の自動判定に使うため、市・町・村まで正確にする。推測に自信がなければ入れない。
- routeImageIndexはルート全体が最も見やすい元画像。切り抜き座標は返さない。
- 不確実な値はnullまたはwarningsにする。`;

async function callGemini(images,apiKey){
  const parts=[{text:PROMPT},...images.map(image=>({inlineData:{mimeType:image.mimeType,data:image.data}}))];
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseFormat:{text:{mimeType:'APPLICATION_JSON',schema:RESPONSE_SCHEMA}}}})
  });
  const payload=await response.json();
  if(!response.ok)throw new Error(payload?.error?.message||`Gemini API error ${response.status}`);
  const text=payload?.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('')||'';
  if(!text)throw new Error('解析結果が返りませんでした。');
  return JSON.parse(text);
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
    if(!env.GEMINI_API_KEY)return json({error:'GEMINI_API_KEY が設定されていません。'},503,origin);
    try{
      const body=await request.json();const images=Array.isArray(body.images)?body.images:[];
      if(!images.length||images.length>8)return json({error:'画像は1〜8枚です。'},400,origin);
      for(const image of images)if(!/^image\/(png|jpeg|webp)$/.test(image?.mimeType||'')||typeof image?.data!=='string'||!image.data)return json({error:'PNG、JPEG、WebPを使用してください。'},400,origin);
      return json(await callGemini(images,env.GEMINI_API_KEY),200,origin);
    }catch(error){console.error(error);return json({error:error?.message||'読み取りに失敗しました。'},500,origin);}
  }
};
