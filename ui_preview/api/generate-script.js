const PROVIDERS = {
  gemini: {
    label: 'Gemini',
    keyEnv: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_SCRIPT_MODEL',
    defaultModel: 'gemini-3.8-flash'
  },
  openai: {
    label: 'OpenAI',
    keyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_SCRIPT_MODEL',
    defaultModel: 'gpt-4.1-mini'
  }
};

const PLATFORM_PROFILES = {
  youtube_long: {
    label: 'YouTube Long',
    guidance: [
      'Viết như một video YouTube dài: có luận điểm trung tâm rõ, tiến triển theo từng lớp ý và giữ được mạch kể xuyên suốt.',
      'Mở đầu phải vào thẳng vấn đề hoặc một tình huống/câu hỏi cụ thể; không mở bằng lời chào hay giới thiệu kênh.',
      'Dùng ví dụ, đối chiếu, câu hỏi và chuyển nhịp để tránh một mặt phẳng thông tin.',
      'Tạo các open loop vừa đủ rồi trả payoff; không lạm dụng câu giật gân.',
      'Không viết theo kiểu danh sách đọc máy móc nếu chủ đề có thể kể thành một dòng lập luận hoặc câu chuyện.'
    ]
  },
  youtube_short: {
    label: 'YouTube Short',
    guidance: [
      'Viết như YouTube Short: hook xuất hiện ngay câu đầu, chỉ theo đuổi một ý trung tâm.',
      'Không chào hỏi, không dạo đầu, không giải thích dài trước khi vào giá trị chính.',
      'Mỗi câu phải đẩy câu chuyện hoặc lập luận về phía trước.',
      'Kết thúc bằng payoff, twist, kết luận đáng nhớ hoặc CTA phù hợp; không kéo dài sau payoff.'
    ]
  },
  facebook_short: {
    label: 'Facebook Short / Reels',
    guidance: [
      'Viết cho người xem lướt feed: câu đầu phải hiểu được ngay cả khi họ chưa biết bối cảnh.',
      'Ngôn ngữ trực tiếp, gần gũi, ít thuật ngữ và ưu tiên ví dụ đời thường.',
      'Một video chỉ nên có một ý chính, một chuyển biến và một payoff rõ.',
      'CTA nếu có phải tự nhiên, tránh giọng quảng cáo hoặc xin tương tác máy móc.'
    ]
  }
};

const DURATION_PROFILES = {
  '15-30s': {label:'15–30 giây', words:'45–80 từ'},
  '30-60s': {label:'30–60 giây', words:'80–150 từ'},
  '60-90s': {label:'60–90 giây', words:'140–220 từ'},
  '90-180s': {label:'90–180 giây', words:'220–450 từ'},
  '3-5m': {label:'3–5 phút', words:'450–750 từ'},
  '8-12m': {label:'8–12 phút', words:'1.200–1.800 từ'},
  '12-20m': {label:'12–20 phút', words:'1.800–3.000 từ'},
  '20-30m': {label:'20–30 phút', words:'3.000–4.500 từ'}
};

const LABELS = {
  contentGoal: {
    educate:'Giải thích / giáo dục',
    storytelling:'Kể chuyện / tạo cảm xúc',
    retention:'Giữ chân / khám phá chủ đề',
    persuade:'Thuyết phục / thay đổi góc nhìn',
    entertain:'Giải trí'
  },
  contentTone: {
    natural:'Tự nhiên, gần gũi',
    cinematic:'Cinematic, chiêm nghiệm',
    documentary:'Tài liệu, điềm tĩnh',
    energetic:'Nhanh, năng lượng',
    expert:'Chuyên gia, rõ ràng',
    witty:'Thông minh, dí dỏm'
  },
  expertiseLevel: {
    general:'Phổ thông, dễ hiểu',
    intermediate:'Trung cấp',
    advanced:'Chuyên sâu'
  },
  ctaStyle: {
    soft:'Nhẹ nhàng, tự nhiên',
    none:'Không CTA',
    comment:'Gợi mở bình luận',
    follow:'Theo dõi / đăng ký',
    action:'Kêu gọi hành động cụ thể'
  }
};

function send(res,status,body){
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.end(JSON.stringify(body));
}

function resolveGeminiScriptModel(configured){
  const value=String(configured||'').trim();
  if(!value || value==='gemini-2.5-flash' || value==='models/gemini-2.5-flash'){
    return 'gemini-3.8-flash';
  }
  return value.replace(/^models\//,'');
}

function normalizeBody(body){
  if(!body) return {};
  if(typeof body==='object') return body;
  try{return JSON.parse(body)}catch{return {}}
}

function clean(value,max=1200){
  return String(value||'').trim().slice(0,max);
}

function labelled(group,value,fallback=''){
  return LABELS[group]?.[value]||fallback||clean(value,120);
}

function buildPrompt({
  topic,platformMode,language,paragraphs,duration,extraInstruction,
  contentBrief,channelBible
}){
  const languageName=language==='en'?'English':'Tiếng Việt';
  const platform=PLATFORM_PROFILES[platformMode]||PLATFORM_PROFILES.youtube_long;
  const durationProfile=DURATION_PROFILES[duration]||{label:duration,words:'phù hợp thời lượng'};
  const brief=contentBrief||{};
  const bible=channelBible||{};

  const briefLines=[
    '- Người xem mục tiêu: '+brief.targetAudience+'.',
    '- Mục tiêu nội dung: '+labelled('contentGoal',brief.contentGoal,'Giải thích / giáo dục')+'.',
    '- Tông giọng: '+labelled('contentTone',brief.contentTone,'Tự nhiên, gần gũi')+'.',
    '- Mức độ chuyên môn: '+labelled('expertiseLevel',brief.expertiseLevel,'Phổ thông, dễ hiểu')+'.',
    brief.anglePreference ? '- Góc tiếp cận mong muốn: '+brief.anglePreference+'.' : '',
    '- CTA: '+labelled('ctaStyle',brief.ctaStyle,'Nhẹ nhàng, tự nhiên')+'.',
    brief.sourceNotes ? '- Dữ kiện/nguồn người dùng yêu cầu bám theo: '+brief.sourceNotes+'.' : '',
    brief.forbiddenContent ? '- Điều không được làm: '+brief.forbiddenContent+'.' : ''
  ].filter(Boolean);

  const bibleLines=[
    bible.channelName ? '- Tên kênh: '+bible.channelName+'.' : '',
    bible.primaryPlatform ? '- Nền tảng chính của kênh: '+bible.primaryPlatform+'.' : '',
    bible.niche ? '- Chủ đề/niche cốt lõi: '+bible.niche+'.' : '',
    bible.channelStyle ? '- Phong cách kênh: '+bible.channelStyle+'.' : '',
    bible.narratorPersona ? '- Nhân vật người kể: '+bible.narratorPersona+'.' : '',
    bible.vocabularyStyle ? '- Phong cách từ vựng: '+bible.vocabularyStyle+'.' : '',
    bible.openingStyle ? '- Kiểu mở đầu ưu tiên: '+bible.openingStyle+'.' : '',
    bible.storytellingStyle ? '- Cấu trúc kể chuyện quen thuộc: '+bible.storytellingStyle+'.' : '',
    bible.forbiddenPhrases ? '- Cụm từ/kiểu viết tuyệt đối tránh: '+bible.forbiddenPhrases+'.' : '',
    bible.fixedRules ? '- Nguyên tắc nội dung cố định của kênh: '+bible.fixedRules+'.' : '',
    bible.pronunciationNotes ? '- Ghi chú phát âm để ưu tiên cách viết dễ đọc thành lời: '+bible.pronunciationNotes+'.' : ''
  ].filter(Boolean);

  return [
    'Bạn là Senior Content Strategist + Scriptwriter của KTN AI Video Studio.',
    'Nhiệm vụ là viết một kịch bản spoken-word chất lượng cao, nghe như người thật viết để người thật kể, không phải văn bản AI tổng hợp.',
    '',
    '=== VIDEO CONTRACT ===',
    '- Nền tảng: '+platform.label+'.',
    '- Ngôn ngữ: '+languageName+'.',
    '- Chủ đề: '+topic+'.',
    '- Thời lượng mục tiêu: '+durationProfile.label+'.',
    '- Độ dài tham chiếu: khoảng '+durationProfile.words+'; ưu tiên nhịp kể tự nhiên hơn việc ép đủ số từ.',
    '- Số phần/đoạn mục tiêu: '+paragraphs+'.',
    '',
    '=== CONTENT BRIEF ===',
    ...briefLines,
    '',
    '=== CHANNEL BIBLE ===',
    ...(bibleLines.length?bibleLines:['- Chưa có Channel Bible riêng; vẫn phải giữ một giọng kể nhất quán trong toàn bài.']),
    '',
    '=== PLATFORM WRITING RULES ===',
    ...platform.guidance.map(item=>'- '+item),
    '',
    '=== HUMAN WRITING RULES ===',
    '- Tránh văn phong AI chung chung, sáo rỗng hoặc quá hoàn hảo. Không mở bằng “Trong thế giới ngày nay”, “Hãy cùng khám phá”, “Bạn có bao giờ tự hỏi” nếu không thật sự cần thiết.',
    '- Xen kẽ câu ngắn và câu dài. Viết để đọc thành lời, không viết như bài luận.',
    '- Ưu tiên chi tiết cụ thể, tình huống đời thường, hình ảnh có thể tưởng tượng và chuyển ý tự nhiên.',
    '- Không lặp lại cùng một luận điểm bằng nhiều cách chỉ để kéo dài thời lượng.',
    '- Không dùng bảng, không Markdown heading, không ghi “Hook”, “CTA”, “Scene”, “Narrator” trong output.',
    '- Không tự bịa số liệu, nghiên cứu, chuyên gia, nguồn hoặc trích dẫn. Nếu thiếu dữ kiện cần thiết, diễn đạt thận trọng thay vì chế tạo.',
    '- Kết thúc phải tạo cảm giác nội dung đã được trả lời/payoff; CTA phải đúng kiểu đã chọn và không phá cảm xúc cuối.',
    '- Chỉ trả về kịch bản cuối cùng để đọc thành voice-over. Không giải thích quá trình viết.',
    extraInstruction ? '- Yêu cầu riêng của video này: '+extraInstruction : ''
  ].filter(item=>item!==null && item!==undefined).join('\n');
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

async function generateGemini(key,model,prompt){
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
        temperature:0.82,
        max_output_tokens:8192,
        thinking_level:'low'
      }
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    throw new Error(data?.error?.message||('Gemini HTTP '+response.status));
  }
  const text=extractInteractionText(data);
  if(!text) throw new Error('Gemini không trả về nội dung kịch bản.');
  return text;
}

async function generateOpenAI(key,model,prompt){
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'authorization':'Bearer '+key
    },
    body:JSON.stringify({
      model,
      messages:[
        {
          role:'system',
          content:'You are a senior content strategist and professional spoken-word video scriptwriter. Produce only the final narration and follow the platform, audience, channel voice, and anti-generic writing constraints exactly.'
        },
        {role:'user',content:prompt}
      ],
      temperature:0.82
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    throw new Error(data?.error?.message||('OpenAI HTTP '+response.status));
  }
  const text=data?.choices?.[0]?.message?.content?.trim();
  if(!text) throw new Error('OpenAI không trả về nội dung kịch bản.');
  return text;
}

export default async function handler(req,res){
  if(req.method==='GET'){
    return send(res,200,{
      ok:true,
      service:'KTN Script Generator',
      version:'content-quality-v2',
      platforms:Object.entries(PLATFORM_PROFILES).map(([id,item])=>({id,label:item.label})),
      providers:{
        gemini:Boolean(process.env.GEMINI_API_KEY),
        openai:Boolean(process.env.OPENAI_API_KEY)
      },
      models:{
        gemini:resolveGeminiScriptModel(process.env.GEMINI_SCRIPT_MODEL),
        openai:process.env.OPENAI_SCRIPT_MODEL||PROVIDERS.openai.defaultModel
      }
    });
  }

  if(req.method!=='POST') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

  const body=normalizeBody(req.body);
  const topic=clean(body.topic,2000);
  const platformMode=PLATFORM_PROFILES[body.platformMode]?body.platformMode:'youtube_long';
  const provider=String(body.provider||'gemini').toLowerCase();
  const language=body.language==='en'?'en':'vi';
  const paragraphs=Math.max(1,Math.min(40,Number(body.paragraphs)||10));
  const duration=DURATION_PROFILES[body.duration]?body.duration:PLATFORM_PRESETS_FALLBACK(platformMode);
  const extraInstruction=clean(body.extraInstruction,2000);
  const sourceBrief=typeof body.contentBrief==='object'&&body.contentBrief?body.contentBrief:{};
  const sourceBible=typeof body.channelBible==='object'&&body.channelBible?body.channelBible:{};

  const contentBrief={
    targetAudience:clean(sourceBrief.targetAudience,1000),
    contentGoal:clean(sourceBrief.contentGoal,80)||'educate',
    contentTone:clean(sourceBrief.contentTone,80)||'natural',
    expertiseLevel:clean(sourceBrief.expertiseLevel,80)||'general',
    anglePreference:clean(sourceBrief.anglePreference,1200),
    ctaStyle:clean(sourceBrief.ctaStyle,80)||'soft',
    sourceNotes:clean(sourceBrief.sourceNotes,2500),
    forbiddenContent:clean(sourceBrief.forbiddenContent,1500)
  };
  const channelBible={
    channelName:clean(sourceBible.channelName,300),
    primaryPlatform:clean(sourceBible.primaryPlatform,80),
    niche:clean(sourceBible.niche,500),
    channelStyle:clean(sourceBible.channelStyle,1200),
    narratorPersona:clean(sourceBible.narratorPersona,1200),
    vocabularyStyle:clean(sourceBible.vocabularyStyle,1200),
    openingStyle:clean(sourceBible.openingStyle,1200),
    storytellingStyle:clean(sourceBible.storytellingStyle,1500),
    forbiddenPhrases:clean(sourceBible.forbiddenPhrases,1500),
    fixedRules:clean(sourceBible.fixedRules,1800),
    defaultVoice:clean(sourceBible.defaultVoice,100),
    pronunciationNotes:clean(sourceBible.pronunciationNotes,1200)
  };

  if(!topic) return send(res,400,{error:'Chủ đề video không được để trống.'});
  if(!channelBible.channelName){
    return send(res,400,{error:'Hãy chọn Channel Profile trước khi AI viết kịch bản.'});
  }
  if(!contentBrief.targetAudience){
    return send(res,400,{error:'Content Brief cần có người xem mục tiêu trước khi AI viết kịch bản.'});
  }
  if(!PROVIDERS[provider]) return send(res,400,{error:'Nhà cung cấp AI chưa được hỗ trợ.'});

  const cfg=PROVIDERS[provider];
  const key=process.env[cfg.keyEnv];
  const model=provider==='gemini'
    ? resolveGeminiScriptModel(process.env[cfg.modelEnv])
    : (process.env[cfg.modelEnv]||cfg.defaultModel);
  if(!key){
    return send(res,503,{
      error:'Chưa cấu hình '+cfg.keyEnv+' trên Vercel.',
      code:'provider_key_missing',
      provider
    });
  }

  const prompt=buildPrompt({
    topic,platformMode,language,paragraphs,duration,extraInstruction,
    contentBrief,channelBible
  });

  try{
    const script=provider==='gemini'
      ? await generateGemini(key,model,prompt)
      : await generateOpenAI(key,model,prompt);

    return send(res,200,{
      ok:true,
      script,
      platformMode,
      platformLabel:PLATFORM_PROFILES[platformMode].label,
      duration,
      targetWords:DURATION_PROFILES[duration]?.words||'',
      provider,
      providerLabel:cfg.label,
      model,
      createdAt:new Date().toISOString()
    });
  }catch(error){
    console.error('script_generation_failed',{
      platformMode,provider,model,message:error?.message
    });
    return send(res,502,{
      error:'Tạo kịch bản thất bại: '+(error?.message||'Lỗi không xác định'),
      code:'provider_request_failed',
      provider
    });
  }
}

function PLATFORM_PRESETS_FALLBACK(platformMode){
  if(platformMode==='youtube_short') return '60-90s';
  if(platformMode==='facebook_short') return '30-60s';
  return '8-12m';
}
