const PROVIDERS={
  gemini:{label:'Google Gemini',keyEnv:'GEMINI_API_KEY',modelEnv:'GEMINI_SCRIPT_MODEL',defaultModel:'gemini-3.8-flash'},
  openai:{label:'OpenAI',keyEnv:'OPENAI_API_KEY',modelEnv:'OPENAI_SCRIPT_MODEL',defaultModel:'gpt-6.1-sol'},
  anthropic:{label:'Anthropic Claude',keyEnv:'ANTHROPIC_API_KEY',modelEnv:'ANTHROPIC_SCRIPT_MODEL',defaultModel:'claude-sonnet-5'},
  xai:{label:'xAI Grok',keyEnv:'XAI_API_KEY',modelEnv:'XAI_SCRIPT_MODEL',defaultModel:'grok-4.7'}
};

const STAGES=['angle','outline','hook','section','rewrite','qa','repair'];

function send(res,status,body){
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.end(JSON.stringify(body));
}
function bodyOf(body){
  if(!body) return {};
  if(typeof body==='object') return body;
  try{return JSON.parse(body)}catch{return {}}
}
function clean(value,max=12000){return String(value??'').trim().slice(0,max)}
function resolveGemini(value){
  const v=clean(value,120);
  if(!v || v==='gemini-2.5-flash' || v==='models/gemini-2.5-flash') return 'gemini-3.8-flash';
  return v.replace(/^models\//,'');
}
function resolveModel(provider,requested){
  const cfg=PROVIDERS[provider];
  const explicit=clean(requested,120);
  if(explicit) return explicit;
  if(provider==='gemini') return resolveGemini(process.env[cfg.modelEnv]);
  return clean(process.env[cfg.modelEnv]||cfg.defaultModel,120);
}
function extractGemini(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim()) return data.output_text.trim();
  const steps=Array.isArray(data?.steps)?data.steps:[];
  for(let i=steps.length-1;i>=0;i--){
    if(steps[i]?.type!=='model_output') continue;
    const text=(Array.isArray(steps[i]?.content)?steps[i].content:[])
      .filter(x=>x?.type==='text'&&typeof x?.text==='string')
      .map(x=>x.text).join('').trim();
    if(text) return text;
  }
  return '';
}
async function gemini(key,model,prompt,jsonMode=false){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',
    headers:{'content-type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({
      model,
      input:prompt,
      generation_config:{
        temperature:jsonMode?0.45:0.78,
        max_output_tokens:jsonMode?8192:16000,
        thinking_level:'low'
      }
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||('Gemini HTTP '+response.status));
  const text=extractGemini(data);
  if(!text) throw new Error('Gemini không trả về nội dung.');
  return text;
}
function extractOpenAI(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim()) return data.output_text.trim();
  return (Array.isArray(data?.output)?data.output:[])
    .flatMap(x=>Array.isArray(x?.content)?x.content:[])
    .map(x=>String(x?.text||'')).join('').trim();
}
async function openai(key,model,prompt,jsonMode=false){
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{'content-type':'application/json','authorization':'Bearer '+key},
    body:JSON.stringify({
      model,
      input:[
        {role:'system',content:[{type:'input_text',text:jsonMode?'Return valid JSON only.':'You are a senior video script strategist and spoken-word writer.'}]},
        {role:'user',content:[{type:'input_text',text:prompt}]}
      ],
      max_output_tokens:16000
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||('OpenAI HTTP '+response.status));
  const text=extractOpenAI(data);
  if(!text) throw new Error('OpenAI không trả về nội dung.');
  return text;
}
async function anthropic(key,model,prompt,jsonMode=false){
  const response=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({
      model,max_tokens:16000,
      system:jsonMode?'Return one valid JSON value only. No markdown fences.':'You are a senior video script strategist and spoken-word writer.',
      messages:[{role:'user',content:prompt}]
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||('Anthropic HTTP '+response.status));
  const text=(Array.isArray(data?.content)?data.content:[])
    .filter(x=>x?.type==='text').map(x=>String(x.text||'')).join('').trim();
  if(!text) throw new Error('Anthropic không trả về nội dung.');
  return text;
}
async function xai(key,model,prompt,jsonMode=false){
  const response=await fetch('https://api.x.ai/v1/chat/completions',{
    method:'POST',
    headers:{'content-type':'application/json','authorization':'Bearer '+key},
    body:JSON.stringify({
      model,
      messages:[
        {role:'system',content:jsonMode?'Return valid JSON only. No markdown fences.':'You are a senior video script strategist and spoken-word writer.'},
        {role:'user',content:prompt}
      ]
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||('xAI HTTP '+response.status));
  const text=String(data?.choices?.[0]?.message?.content||'').trim();
  if(!text) throw new Error('xAI không trả về nội dung.');
  return text;
}
async function runProvider(provider,key,model,prompt,jsonMode=false){
  if(provider==='gemini') return gemini(key,model,prompt,jsonMode);
  if(provider==='openai') return openai(key,model,prompt,jsonMode);
  if(provider==='anthropic') return anthropic(key,model,prompt,jsonMode);
  if(provider==='xai') return xai(key,model,prompt,jsonMode);
  throw new Error('Provider chưa được hỗ trợ.');
}
function parseJsonLoose(text){
  const raw=String(text||'').trim().replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim();
  try{return JSON.parse(raw)}catch{}
  const firstObj=raw.indexOf('{'), lastObj=raw.lastIndexOf('}');
  if(firstObj>=0&&lastObj>firstObj){
    try{return JSON.parse(raw.slice(firstObj,lastObj+1))}catch{}
  }
  const firstArr=raw.indexOf('['), lastArr=raw.lastIndexOf(']');
  if(firstArr>=0&&lastArr>firstArr){
    try{return JSON.parse(raw.slice(firstArr,lastArr+1))}catch{}
  }
  throw new Error('Model không trả về JSON hợp lệ.');
}
function commonContext(body){
  const brief=body.contentBrief&&typeof body.contentBrief==='object'?body.contentBrief:{};
  const bible=body.channelBible&&typeof body.channelBible==='object'?body.channelBible:{};
  return {
    topic:clean(body.topic,2000),
    platformMode:clean(body.platformMode,80)||'youtube_long',
    duration:clean(body.duration,80)||'8-12m',
    language:body.language==='en'?'en':'vi',
    paragraphs:Math.max(1,Math.min(40,Number(body.paragraphs)||10)),
    extraInstruction:clean(body.extraInstruction,2500),
    contentBrief:{
      targetAudience:clean(brief.targetAudience,1200),
      contentGoal:clean(brief.contentGoal,100),
      contentTone:clean(brief.contentTone,100),
      expertiseLevel:clean(brief.expertiseLevel,100),
      anglePreference:clean(brief.anglePreference,1800),
      ctaStyle:clean(brief.ctaStyle,100),
      sourceNotes:clean(brief.sourceNotes,4500),
      forbiddenContent:clean(brief.forbiddenContent,2500)
    },
    channelBible:{
      channelName:clean(bible.channelName,300),
      primaryPlatform:clean(bible.primaryPlatform,100),
      niche:clean(bible.niche,800),
      channelStyle:clean(bible.channelStyle,1800),
      narratorPersona:clean(bible.narratorPersona,1800),
      vocabularyStyle:clean(bible.vocabularyStyle,1800),
      openingStyle:clean(bible.openingStyle,1800),
      storytellingStyle:clean(bible.storytellingStyle,2200),
      forbiddenPhrases:clean(bible.forbiddenPhrases,2200),
      fixedRules:clean(bible.fixedRules,2500)
    }
  };
}
function contextText(c){
  const lang=c.language==='en'?'English':'Tiếng Việt';
  return [
    'VIDEO CONTEXT',
    '- Topic: '+c.topic,
    '- Platform: '+c.platformMode,
    '- Duration: '+c.duration,
    '- Language: '+lang,
    '- Audience: '+c.contentBrief.targetAudience,
    '- Goal: '+c.contentBrief.contentGoal,
    '- Tone: '+c.contentBrief.contentTone,
    '- Expertise: '+c.contentBrief.expertiseLevel,
    c.contentBrief.anglePreference?'- Preferred angle: '+c.contentBrief.anglePreference:'',
    '- CTA style: '+c.contentBrief.ctaStyle,
    c.contentBrief.sourceNotes?'- Source/evidence notes: '+c.contentBrief.sourceNotes:'',
    c.contentBrief.forbiddenContent?'- Forbidden content: '+c.contentBrief.forbiddenContent:'',
    '',
    'CHANNEL DNA',
    '- Channel: '+c.channelBible.channelName,
    '- Niche: '+c.channelBible.niche,
    '- Style: '+c.channelBible.channelStyle,
    '- Narrator: '+c.channelBible.narratorPersona,
    '- Vocabulary: '+c.channelBible.vocabularyStyle,
    '- Opening style: '+c.channelBible.openingStyle,
    '- Storytelling: '+c.channelBible.storytellingStyle,
    c.channelBible.forbiddenPhrases?'- Forbidden phrases: '+c.channelBible.forbiddenPhrases:'',
    c.channelBible.fixedRules?'- Fixed rules: '+c.channelBible.fixedRules:'',
    c.extraInstruction?'- Extra instruction: '+c.extraInstruction:''
  ].filter(Boolean).join('\n');
}
function stagePrompt(stage,c,workflow){
  const base=contextText(c);
  if(stage==='angle') return [
    'You are the ANGLE PLANNER of KTN AI Video Studio.',
    base,
    '',
    'Create a differentiated angle before any script is written.',
    'Avoid generic topic restatement. Do not invent facts not present in source notes.',
    'Return JSON only with:',
    '{"angle":"","viewer_question":"","promise":"","key_tension":"","retention_strategy":"","factual_boundaries":[""]}'
  ].join('\n');

  if(stage==='outline') return [
    'You are the OUTLINE BUILDER of KTN AI Video Studio.',
    base,
    '',
    'APPROVED ANGLE:',
    JSON.stringify(workflow.angle||{},null,2),
    '',
    'Build a coherent spoken-video outline. For youtube_long use 5–9 body sections; for short-form use 2–4.',
    'Do not create filler sections. Each section must advance the central argument/story.',
    'Return JSON only:',
    '{"title":"","sections":[{"id":"s1","title":"","purpose":"","viewer_question":"","key_points":[""],"transition":"","target_words":250}]}'
  ].join('\n');

  if(stage==='hook') return [
    'You are the HOOK WRITER of KTN AI Video Studio.',
    base,
    '',
    'ANGLE:',JSON.stringify(workflow.angle||{}),
    'OUTLINE:',JSON.stringify(workflow.outline||{}),
    '',
    'Write only the spoken opening narration.',
    'Start concretely; no greeting, no channel intro, no generic AI phrases.',
    'Create curiosity without clickbait or unsupported claims.',
    'For long-form aim roughly 80–180 Vietnamese words; for short-form 25–80 words.'
  ].join('\n');

  if(stage==='section'){
    const section=workflow.section||{};
    return [
      'You are the SECTION WRITER of KTN AI Video Studio.',
      base,
      '',
      'ANGLE:',JSON.stringify(workflow.angle||{}),
      'FULL OUTLINE:',JSON.stringify(workflow.outline||{}),
      'CURRENT SECTION:',JSON.stringify(section),
      workflow.previousEnding?'PREVIOUS ENDING:\n'+clean(workflow.previousEnding,2200):'',
      workflow.nextSection?'NEXT SECTION CONTEXT:\n'+JSON.stringify(workflow.nextSection):'',
      '',
      'Write only this section as spoken narration.',
      'Preserve continuity with the previous ending and leave a natural bridge toward the next section.',
      'Do not repeat the hook or re-explain points already covered.',
      'Respect target_words approximately; quality and spoken rhythm are more important than exact count.',
      'Never invent statistics, research, quotes or sources.'
    ].filter(Boolean).join('\n');
  }

  if(stage==='rewrite') return [
    'You are the HUMANIZATION + RETENTION EDITOR of KTN AI Video Studio.',
    base,
    '',
    'ANGLE:',JSON.stringify(workflow.angle||{}),
    'OUTLINE:',JSON.stringify(workflow.outline||{}),
    '',
    'DRAFT SCRIPT:',
    clean(workflow.script,50000),
    '',
    'Rewrite the full script into one cohesive spoken narration.',
    'Remove AI-like repetition, generic transitions, filler and essay tone.',
    'Vary sentence length, preserve facts, preserve Channel DNA and improve retention/payoff.',
    'Do not add Markdown headings or labels. Return only final narration.'
  ].join('\n');

  if(stage==='qa') return [
    'You are the SCRIPT QA / CRITIC of KTN AI Video Studio.',
    base,
    '',
    'ANGLE:',JSON.stringify(workflow.angle||{}),
    'OUTLINE:',JSON.stringify(workflow.outline||{}),
    '',
    'SCRIPT TO REVIEW:',clean(workflow.script,50000),
    '',
    'Score 0–100. Be strict. Return JSON only:',
    '{"score":0,"dimensions":{"channel_dna":0,"retention":0,"coherence":0,"naturalness":0,"specificity":0,"factual_discipline":0},"hard_failures":[],"strengths":[""],"problems":[""],"rewrite_plan":[""],"decision":"PASS|REPAIR"}',
    'Decision PASS only when score >= 80 and no hard failure.'
  ].join('\n');

  if(stage==='repair') return [
    'You are the FINAL REPAIR EDITOR of KTN AI Video Studio.',
    base,
    '',
    'SCRIPT:',clean(workflow.script,50000),
    '',
    'QA REPORT:',JSON.stringify(workflow.qa||{}),
    '',
    'Apply only the necessary repairs from QA while preserving good passages and factual boundaries.',
    'Return only the repaired spoken narration. No headings, no explanation.'
  ].join('\n');
  throw new Error('Stage không hợp lệ.');
}

export default async function handler(req,res){
  if(req.method==='GET'){
    return send(res,200,{ok:true,service:'KTN Script Quality Workflow',version:'v1-multipass',stages:STAGES,qaThreshold:80});
  }
  if(req.method!=='POST') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

  const body=bodyOf(req.body);
  const stage=clean(body.stage,40).toLowerCase();
  if(!STAGES.includes(stage)) return send(res,400,{error:'Stage không hợp lệ.',stages:STAGES});

  const provider=clean(body.provider,40).toLowerCase()||'gemini';
  if(!PROVIDERS[provider]) return send(res,400,{error:'Provider chưa được hỗ trợ.'});
  const cfg=PROVIDERS[provider];
  const key=process.env[cfg.keyEnv];
  if(!key) return send(res,503,{error:'Chưa cấu hình '+cfg.keyEnv+' trên Vercel.',code:'provider_key_missing',provider});

  const c=commonContext(body);
  if(!c.topic) return send(res,400,{error:'Thiếu chủ đề.'});
  if(!c.channelBible.channelName) return send(res,400,{error:'Thiếu Channel Profile.'});
  if(!c.contentBrief.targetAudience) return send(res,400,{error:'Thiếu người xem mục tiêu.'});

  const model=resolveModel(provider,body.model);
  const workflow=body.workflow&&typeof body.workflow==='object'?body.workflow:{};
  const jsonMode=['angle','outline','qa'].includes(stage);
  const prompt=stagePrompt(stage,c,workflow);

  try{
    const raw=await runProvider(provider,key,model,prompt,jsonMode);
    const output=jsonMode?parseJsonLoose(raw):raw.trim();
    return send(res,200,{
      ok:true,stage,output,provider,providerLabel:cfg.label,model,
      createdAt:new Date().toISOString()
    });
  }catch(error){
    console.error('script_workflow_stage_failed',{stage,provider,model,message:error?.message});
    return send(res,502,{
      error:'Script workflow '+stage+' thất bại: '+(error?.message||'Lỗi không xác định'),
      code:'script_workflow_stage_failed',stage,provider
    });
  }
}
