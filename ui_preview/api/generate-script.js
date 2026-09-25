const PROVIDERS = {
  gemini: {
    label: 'Gemini',
    keyEnv: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_SCRIPT_MODEL',
    defaultModel: 'gemini-2.5-flash'
  },
  openai: {
    label: 'OpenAI',
    keyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_SCRIPT_MODEL',
    defaultModel: 'gpt-4.1-mini'
  }
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

function buildPrompt({topic,language,paragraphs,duration,extraInstruction}){
  const languageName=language==='en'?'English':'Tiếng Việt';
  const durationMap={
    '60-90s':'60–90 giây',
    '3-5m':'3–5 phút',
    '8-12m':'8–12 phút'
  };
  return [
    'Bạn là biên kịch video chuyên nghiệp của KTN AI Video Studio.',
    'Hãy viết một kịch bản có thể dùng trực tiếp cho giọng đọc và bước chia cảnh sau đó.',
    'Yêu cầu:',
    '- Ngôn ngữ: '+languageName+'.',
    '- Chủ đề: '+topic+'.',
    '- Thời lượng mục tiêu: '+(durationMap[duration]||duration)+'.',
    '- Số đoạn mục tiêu: '+paragraphs+'.',
    '- Mở đầu phải tạo tò mò nhưng không giật gân sai sự thật.',
    '- Nội dung mạch lạc, có chuyển ý tự nhiên, ưu tiên câu dễ đọc thành lời.',
    '- Không dùng bảng, không chèn ghi chú kỹ thuật, không chèn Markdown heading.',
    '- Không tự bịa số liệu hoặc nguồn. Nếu chủ đề cần dữ kiện nhưng không được cung cấp, diễn đạt thận trọng.',
    '- Chỉ trả về nội dung kịch bản cuối cùng, không giải thích quá trình.',
    extraInstruction ? '- Yêu cầu bổ sung: '+extraInstruction : ''
  ].filter(Boolean).join('\n');
}

async function generateGemini(key,model,prompt){
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key);
  const response=await fetch(url,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      contents:[{role:'user',parts:[{text:prompt}]}],
      generationConfig:{temperature:0.8,maxOutputTokens:8192}
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const message=data?.error?.message||('Gemini HTTP '+response.status);
    throw new Error(message);
  }
  const text=(data.candidates||[])
    .flatMap(c=>c?.content?.parts||[])
    .map(p=>p?.text||'')
    .join('')
    .trim();
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
        {role:'system',content:'You are a professional video scriptwriter. Follow the user requirements exactly.'},
        {role:'user',content:prompt}
      ],
      temperature:0.8
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const message=data?.error?.message||('OpenAI HTTP '+response.status);
    throw new Error(message);
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
      providers:{
        gemini:Boolean(process.env.GEMINI_API_KEY),
        openai:Boolean(process.env.OPENAI_API_KEY)
      }
    });
  }

  if(req.method!=='POST') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

  const body=normalizeBody(req.body);
  const topic=String(body.topic||'').trim();
  const provider=String(body.provider||'gemini').toLowerCase();
  const language=body.language==='en'?'en':'vi';
  const paragraphs=Math.max(1,Math.min(20,Number(body.paragraphs)||6));
  const duration=['60-90s','3-5m','8-12m'].includes(body.duration)?body.duration:'60-90s';
  const extraInstruction=String(body.extraInstruction||'').trim().slice(0,1500);

  if(!topic) return send(res,400,{error:'Chủ đề video không được để trống.'});
  if(topic.length>2000) return send(res,400,{error:'Chủ đề video quá dài.'});
  if(!PROVIDERS[provider]) return send(res,400,{error:'Nhà cung cấp AI chưa được hỗ trợ.'});

  const cfg=PROVIDERS[provider];
  const key=process.env[cfg.keyEnv];
  const model=process.env[cfg.modelEnv]||cfg.defaultModel;
  if(!key){
    return send(res,503,{
      error:'Chưa cấu hình '+cfg.keyEnv+' trên Vercel.',
      code:'provider_key_missing',
      provider
    });
  }

  const prompt=buildPrompt({topic,language,paragraphs,duration,extraInstruction});

  try{
    const script=provider==='gemini'
      ? await generateGemini(key,model,prompt)
      : await generateOpenAI(key,model,prompt);

    return send(res,200,{
      ok:true,
      script,
      provider,
      providerLabel:cfg.label,
      model,
      createdAt:new Date().toISOString()
    });
  }catch(error){
    console.error('script_generation_failed',{provider,model,message:error?.message});
    return send(res,502,{
      error:'Tạo kịch bản thất bại: '+(error?.message||'Lỗi không xác định'),
      code:'provider_request_failed',
      provider
    });
  }
}
