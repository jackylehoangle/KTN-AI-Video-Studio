const PROVIDERS={
  gemini:{label:'Gemini',keyEnv:'GEMINI_API_KEY',modelEnv:'GEMINI_SCRIPT_MODEL',defaultModel:'gemini-3.8-flash'},
  openai:{label:'OpenAI',keyEnv:'OPENAI_API_KEY',modelEnv:'OPENAI_SCRIPT_MODEL',defaultModel:'gpt-4.1-mini'}
};

function send(res,status,body){
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.end(JSON.stringify(body));
}

function normalizeBody(body){
  if(!body) return {};
  if(typeof body==='object') return body;
  try{return JSON.parse(body)}catch{return {}}
}

function parseJsonText(text){
  let value=String(text||'').trim();
  value=value.replace(/^\s*\x60\x60\x60(?:json)?/i,'').replace(/\x60\x60\x60\s*$/,'').trim();
  try{return JSON.parse(value)}catch{}
  const start=value.indexOf('{');
  const end=value.lastIndexOf('}');
  if(start>=0 && end>start) return JSON.parse(value.slice(start,end+1));
  throw new Error('AI trả về JSON không hợp lệ.');
}

function extractInteractionText(data){
  if(typeof data?.output_text==='string' && data.output_text.trim()){
    return data.output_text.trim();
  }
  const steps=Array.isArray(data?.steps)?data.steps:[];
  for(let i=steps.length-1;i>=0;i--){
    const step=steps[i];
    if(step?.type!=='model_output') continue;
    const content=Array.isArray(step?.content)?step.content:[];
    const text=content
      .filter(item=>item?.type==='text' && typeof item?.text==='string')
      .map(item=>item.text)
      .join('')
      .trim();
    if(text) return text;
  }
  return '';
}

function keywordSchema(){
  return {
    type:'object',
    properties:{
      keywords:{
        type:'array',
        items:{
          type:'object',
          properties:{
            keyword:{type:'string'},
            visual_keyword:{type:'string'}
          },
          required:['keyword','visual_keyword']
        }
      }
    },
    required:['keywords']
  };
}

function sceneSchema(){
  return {
    type:'object',
    properties:{
      scenes:{
        type:'array',
        items:{
          type:'object',
          properties:{
            title:{type:'string'},
            narration:{type:'string'},
            duration_seconds:{type:'integer'},
            visual_description:{type:'string'},
            image_prompt:{type:'string'}
          },
          required:['title','narration','duration_seconds','visual_description','image_prompt']
        }
      }
    },
    required:['scenes']
  };
}

async function callGeminiJson(key,model,prompt,action){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-goog-api-key':key
    },
    body:JSON.stringify({
      model,
      input:prompt,
      generation_config:{
        temperature:0.35,
        max_output_tokens:8192,
        thinking_level:'low'
      },
      response_format:{
        type:'text',
        mime_type:'application/json',
        schema:action==='keywords'?keywordSchema():sceneSchema()
      }
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||('Gemini HTTP '+response.status));
  const text=extractInteractionText(data);
  if(!text) throw new Error('Gemini không trả về dữ liệu phân tích.');
  return parseJsonText(text);
}

async function callOpenAIJson(key,model,prompt){
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{'content-type':'application/json','authorization':'Bearer '+key},
    body:JSON.stringify({
      model,
      messages:[
        {role:'system',content:'Return valid JSON only. Do not wrap JSON in markdown fences.'},
        {role:'user',content:prompt}
      ],
      response_format:{type:'json_object'},
      temperature:0.35
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||('OpenAI HTTP '+response.status));
  const text=data?.choices?.[0]?.message?.content;
  if(!text) throw new Error('OpenAI không trả về dữ liệu phân tích.');
  return parseJsonText(text);
}

function normalizeKeywords(payload){
  const raw=Array.isArray(payload?.keywords)?payload.keywords:[];
  const output=[];
  const seen=new Set();
  for(const item of raw){
    const keyword=typeof item==='string'?item:String(item?.keyword||item?.label||'').trim();
    if(!keyword) continue;
    const key=keyword.toLowerCase();
    if(seen.has(key)) continue;
    seen.add(key);
    output.push({
      keyword,
      visual_keyword:typeof item==='object'?String(item?.visual_keyword||'').trim():''
    });
    if(output.length>=15) break;
  }
  return output;
}

function estimateDuration(narration){
  const words=String(narration||'').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3,Math.min(30,Math.round(words/2.4)));
}

function normalizeScenes(payload){
  const raw=Array.isArray(payload?.scenes)?payload.scenes:[];
  return raw.slice(0,30).map((item,index)=>{
    const narration=String(item?.narration||'').trim();
    return {
      id:'scene_'+String(index+1).padStart(2,'0'),
      order:index+1,
      title:String(item?.title||('Cảnh '+(index+1))).trim(),
      narration,
      duration_seconds:Number.isFinite(Number(item?.duration_seconds))
        ? Math.max(2,Math.min(45,Math.round(Number(item.duration_seconds))))
        : estimateDuration(narration),
      visual_description:String(item?.visual_description||'').trim(),
      image_prompt:String(item?.image_prompt||'').trim()
    };
  }).filter(scene=>scene.narration && scene.visual_description && scene.image_prompt);
}

function keywordPrompt({script,language,topic}){
  return [
    'Phân tích kịch bản video sau.',
    'Mục tiêu: tạo 8-12 từ khóa đại diện cho nội dung và hình ảnh của video.',
    'keyword: từ khóa ngắn gọn bằng '+(language==='en'?'English':'Tiếng Việt')+'.',
    'visual_keyword: cụm từ hình ảnh tương ứng bằng English, dùng được cho AI image/search.',
    topic?'Chủ đề: '+topic:'',
    'Kịch bản:',
    script
  ].filter(Boolean).join('\n');
}

function scenePrompt({script,language,topic}){
  return [
    'Bạn là storyboard planner cho KTN AI Video Studio.',
    'Hãy chia kịch bản thành các scene liên tiếp.',
    'Mỗi scene phải đủ ngắn để dùng cho một hình hoặc một clip hình ảnh riêng.',
    'Không bỏ sót ý quan trọng và không tự thêm dữ kiện mới.',
    'narration phải giữ nguyên ý từ kịch bản và dùng '+(language==='en'?'English':'Tiếng Việt')+'.',
    'visual_description mô tả hình cần thấy bằng '+(language==='en'?'English':'Tiếng Việt')+'.',
    'image_prompt phải viết bằng English, giàu chi tiết thị giác, không chứa chữ cần hiển thị trong ảnh, dùng được trực tiếp cho Gemini/OpenAI image generation.',
    'duration_seconds là thời lượng ước tính cho narration, số nguyên khoảng 3-20 giây khi có thể.',
    topic?'Chủ đề: '+topic:'',
    'Kịch bản:',
    script
  ].filter(Boolean).join('\n');
}

export default async function handler(req,res){
  if(req.method==='GET'){
    return send(res,200,{
      ok:true,
      service:'KTN Script Analyzer',
      providers:{
        gemini:Boolean(process.env.GEMINI_API_KEY),
        openai:Boolean(process.env.OPENAI_API_KEY)
      },
      models:{
        gemini:process.env.GEMINI_SCRIPT_MODEL||PROVIDERS.gemini.defaultModel,
        openai:process.env.OPENAI_SCRIPT_MODEL||PROVIDERS.openai.defaultModel
      },
      actions:['keywords','scenes']
    });
  }
  if(req.method!=='POST') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

  const body=normalizeBody(req.body);
  const action=String(body.action||'').toLowerCase();
  const script=String(body.script||'').trim();
  const provider=String(body.provider||'gemini').toLowerCase();
  const language=body.language==='en'?'en':'vi';
  const topic=String(body.topic||'').trim().slice(0,2000);

  if(!['keywords','scenes'].includes(action)) return send(res,400,{error:'Action không hợp lệ.'});
  if(!script) return send(res,400,{error:'Kịch bản không được để trống.'});
  if(script.length>60000) return send(res,400,{error:'Kịch bản quá dài cho một lần phân tích.'});
  if(!PROVIDERS[provider]) return send(res,400,{error:'Nhà cung cấp AI chưa được hỗ trợ.'});

  const cfg=PROVIDERS[provider];
  const key=process.env[cfg.keyEnv];
  const model=process.env[cfg.modelEnv]||cfg.defaultModel;
  if(!key) return send(res,503,{error:'Chưa cấu hình '+cfg.keyEnv+' trên Vercel.',code:'provider_key_missing',provider});

  const prompt=action==='keywords'
    ? keywordPrompt({script,language,topic})
    : scenePrompt({script,language,topic});

  try{
    const payload=provider==='gemini'
      ? await callGeminiJson(key,model,prompt,action)
      : await callOpenAIJson(key,model,prompt);

    if(action==='keywords'){
      const keywords=normalizeKeywords(payload);
      if(!keywords.length) throw new Error('AI không tạo được danh sách từ khóa hợp lệ.');
      return send(res,200,{ok:true,action,keywords,provider,providerLabel:cfg.label,model,createdAt:new Date().toISOString()});
    }

    const scenes=normalizeScenes(payload);
    if(!scenes.length) throw new Error('AI không tạo được danh sách scene hợp lệ.');
    return send(res,200,{
      ok:true,
      action,
      scenes,
      totalEstimatedSeconds:scenes.reduce((sum,s)=>sum+s.duration_seconds,0),
      provider,
      providerLabel:cfg.label,
      model,
      createdAt:new Date().toISOString()
    });
  }catch(error){
    console.error('script_analysis_failed',{action,provider,model,message:error?.message});
    return send(res,502,{
      error:'Phân tích kịch bản thất bại: '+(error?.message||'Lỗi không xác định'),
      code:'provider_request_failed',
      action,
      provider
    });
  }
}
