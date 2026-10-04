export const maxDuration = 300;

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

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

function isTransientProviderError(error){
  const message=String(error?.message||'').toLowerCase();
  return (
    message.includes('high demand') ||
    message.includes('overloaded') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('http 429') ||
    message.includes('http 503') ||
    message.includes('temporarily unavailable') ||
    message.includes('service unavailable')
  );
}

async function runProviderWithRetry(provider,key,model,prompt,jsonMode=false){
  const delays=[0,3500,9000,18000];
  let lastError=null;
  for(let attempt=0;attempt<delays.length;attempt++){
    if(delays[attempt]) await sleep(delays[attempt]);
    try{
      return await runProvider(provider,key,model,prompt,jsonMode);
    }catch(error){
      lastError=error;
      if(!isTransientProviderError(error) || attempt===delays.length-1) throw error;
      console.warn('script_provider_retry',{
        provider,model,attempt:attempt+1,
        nextDelayMs:delays[attempt+1]||0,
        message:error?.message
      });
    }
  }
  throw lastError||new Error('Provider request failed.');
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


function selfTestBase(kind){
  if(kind==='long'){
    return {
      topic:'Vì sao con người biết mình cần thay đổi nhưng vẫn tiếp tục lặp lại những thói quen cũ?',
      platformMode:'youtube_long',
      duration:'3-5m',
      language:'vi',
      paragraphs:7,
      extraInstruction:'Ưu tiên chiều sâu tâm lý, ví dụ đời thường và giọng kể cinematic nhưng không khoa trương.',
      contentBrief:{
        targetAudience:'Người đi làm 25–40 tuổi, thường biết điều mình nên làm nhưng khó duy trì thay đổi',
        contentGoal:'educate',
        contentTone:'cinematic',
        expertiseLevel:'general',
        anglePreference:'Khoảng cách giữa hiểu biết và hành vi; tránh đổ lỗi cho ý chí yếu',
        ctaStyle:'none',
        sourceNotes:'Chỉ dùng kiến thức tâm lý phổ thông; không bịa nghiên cứu, số liệu, tên chuyên gia hay chẩn đoán.',
        forbiddenContent:'Không chẩn đoán bệnh lý. Không hứa hẹn thay đổi tức thì.'
      },
      channelBible:{
        channelName:'The Hidden Mind',
        primaryPlatform:'youtube',
        niche:'Tâm lý học và hành vi',
        channelStyle:'Cinematic Psychology, suy ngẫm nhưng dễ hiểu',
        narratorPersona:'Điềm tĩnh, tinh tế, không phán xét người xem',
        vocabularyStyle:'Đời thường, cụ thể, tránh thuật ngữ khi không cần',
        openingStyle:'Mở bằng tình huống quen thuộc khiến người xem nhận ra chính mình',
        storytellingStyle:'Situation → Question → Explanation → Example → Perspective shift → Payoff',
        forbiddenPhrases:'Hãy cùng khám phá; Trong thế giới ngày nay; Điều quan trọng cần lưu ý là; Bạn có bao giờ tự hỏi',
        fixedRules:'Không bịa nghiên cứu hoặc số liệu. Không gọi người xem là lười. Không biến nội dung thành bài giảng.'
      }
    };
  }
  return {
    topic:'Vì sao công ty có CRM, chatbot và AI nhưng nhân viên vẫn phải chép dữ liệu từ Zalo sang Excel?',
    platformMode:'youtube_short',
    duration:'30-60s',
    language:'vi',
    paragraphs:4,
    extraInstruction:'Một ý duy nhất, cụ thể, thực dụng, không quảng cáo KTN.',
    contentBrief:{
      targetAudience:'Chủ doanh nghiệp nhỏ và người quản lý vận hành 25–45 tuổi',
      contentGoal:'educate',
      contentTone:'expert',
      expertiseLevel:'general',
      anglePreference:'Nghịch lý: nhiều công cụ nhưng quy trình vẫn thủ công',
      ctaStyle:'comment',
      sourceNotes:'Ví dụ thực tế: khách điền form, dữ liệu vào bảng theo dõi, gửi xác nhận và giao việc tự động.',
      forbiddenContent:'Không đưa số liệu ROI giả. Không khẳng định mọi doanh nghiệp đều giống nhau.'
    },
    channelBible:{
      channelName:'KTN Tech',
      primaryPlatform:'youtube',
      niche:'AI, công nghệ và tự động hóa',
      channelStyle:'Chuyên gia, rõ ràng, thực dụng',
      narratorPersona:'Logic, bình tĩnh, nói thẳng vào vấn đề',
      vocabularyStyle:'Ngắn gọn, cụ thể, ưu tiên ví dụ ứng dụng',
      openingStyle:'Mở bằng một vấn đề hoặc nghịch lý vận hành thật',
      storytellingStyle:'Problem → Cause → Mechanism → Example → Solution → Payoff',
      forbiddenPhrases:'Cách mạng hóa; thay đổi thế giới; công nghệ đột phá; hãy cùng khám phá',
      fixedRules:'Không hype AI. Không bịa số liệu. Không bán hàng trực diện.'
    }
  };
}

async function runSelfTest(kind,requestedModel=''){
  const provider='gemini';
  const cfg=PROVIDERS[provider];
  const key=process.env[cfg.keyEnv];
  if(!key) throw new Error('GEMINI_API_KEY chưa cấu hình.');
  const base=selfTestBase(kind);
  const c=commonContext(base);
  const model=resolveModel(provider,requestedModel);
  const started=Date.now();
  const timings={};

  const call=async(stage,workflow)=>{
    const t=Date.now();
    const raw=await runProviderWithRetry(provider,key,model,stagePrompt(stage,c,workflow),['angle','outline','qa'].includes(stage));
    timings[stage]=(Date.now()-t)/1000;
    return ['angle','outline','qa'].includes(stage)?parseJsonLoose(raw):raw.trim();
  };

  const angle=await call('angle',{});
  const outline=await call('outline',{angle});
  if(!Array.isArray(outline?.sections)||!outline.sections.length) throw new Error('Self-test outline không có section.');

  const hook=await call('hook',{angle,outline});
  const sections=[];
  const rolling=[hook];
  for(let i=0;i<outline.sections.length;i++){
    const section=outline.sections[i];
    const t=Date.now();
    const text=await runProviderWithRetry(
      provider,key,model,
      stagePrompt('section',c,{
        angle,outline,section,
        nextSection:outline.sections[i+1]||null,
        previousEnding:rolling.join('\n\n').slice(-2200)
      }),
      false
    );
    timings['section_'+(i+1)]=(Date.now()-t)/1000;
    sections.push({id:section.id||('s'+(i+1)),title:section.title||('Phần '+(i+1)),text:text.trim()});
    rolling.push(text.trim());
  }

  const draft=[hook,...sections.map(x=>x.text)].filter(Boolean).join('\n\n');
  const rewritten=await call('rewrite',{angle,outline,script:draft});
  let qa=await call('qa',{angle,outline,script:rewritten});
  let finalScript=rewritten;
  let repaired=false;

  if((Number(qa?.score)||0)<80 || String(qa?.decision||'').toUpperCase()!=='PASS'){
    finalScript=await call('repair',{angle,outline,script:rewritten,qa});
    repaired=true;
    qa=await call('qa',{angle,outline,script:finalScript});
  }

  const words=finalScript.split(/\s+/).filter(Boolean).length;
  return {
    kind,
    provider,
    model,
    angle,
    outline,
    qa,
    repaired,
    finalScript,
    metrics:{
      words,
      sections:sections.length,
      total_seconds:Math.round((Date.now()-started)/100)/10,
      timings
    }
  };
}

export default async function handler(req,res){
  if(req.method==='GET'){
    const selftest=String(req.query?.selftest||'').toLowerCase();
    if(selftest==='long' || selftest==='short'){
      try{
        const result=await runSelfTest(selftest,String(req.query?.model||''));
        return send(res,200,{ok:true,service:'KTN Script Quality Workflow Self-Test',version:'v1-g02a',result});
      }catch(error){
        console.error('v1_g02a_selftest_failed',{selftest,message:error?.message});
        return send(res,502,{ok:false,error:error?.message||'Self-test thất bại.',selftest});
      }
    }
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
    const raw=await runProviderWithRetry(provider,key,model,prompt,jsonMode);
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
