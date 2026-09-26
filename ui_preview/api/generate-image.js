const PROVIDERS={
  gemini:{
    label:'Gemini',
    keyEnv:'GEMINI_API_KEY',
    modelEnv:'GEMINI_IMAGE_MODEL',
    defaultModel:'gemini-3.1-flash-image'
  },
  openai:{
    label:'OpenAI',
    keyEnv:'OPENAI_API_KEY',
    modelEnv:'OPENAI_IMAGE_MODEL',
    defaultModel:'gpt-image-2.5-flare'
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

function findGeminiImage(value){
  if(!value) return null;
  if(Array.isArray(value)){
    for(const item of value){
      const found=findGeminiImage(item);
      if(found) return found;
    }
    return null;
  }
  if(typeof value!=='object') return null;

  if(value.type==='image' && typeof value.data==='string' && value.data.length>100){
    return {
      data:value.data,
      mime_type:value.mime_type||value.mimeType||'image/jpeg'
    };
  }

  if(value.output_image && typeof value.output_image.data==='string'){
    return {
      data:value.output_image.data,
      mime_type:value.output_image.mime_type||value.output_image.mimeType||'image/jpeg'
    };
  }

  for(const item of Object.values(value)){
    const found=findGeminiImage(item);
    if(found) return found;
  }
  return null;
}

async function generateGeminiImage(key,model,prompt,aspectRatio){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-goog-api-key':key
    },
    body:JSON.stringify({
      model,
      input:[{type:'text',text:prompt}],
      response_format:{
        type:'image',
        mime_type:'image/jpeg',
        aspect_ratio:aspectRatio,
        image_size:'1K'
      }
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||('Gemini Image HTTP '+response.status));
  const image=findGeminiImage(data);
  if(!image) throw new Error('Gemini không trả về ảnh hợp lệ.');
  const mime=String(image.mime_type||'image/jpeg').toLowerCase()==='image/jpg'
    ? 'image/jpeg'
    : String(image.mime_type||'image/jpeg').toLowerCase();
  if(mime!=='image/jpeg'){
    throw new Error('Gemini trả về MIME không đúng JPEG contract: '+mime);
  }
  return {b64_json:image.data,mime_type:mime};
}

async function generateOpenAIImage(key,model,prompt){
  const response=await fetch('https://api.openai.com/v1/images/generations',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'authorization':'Bearer '+key
    },
    body:JSON.stringify({
      model,
      prompt,
      n:1,
      size:'1536x1024',
      quality:'low',
      output_format:'jpeg'
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const message=data?.error?.message||('OpenAI Image HTTP '+response.status);
    const err=new Error(message);
    err.status=response.status;
    err.code=data?.error?.code||data?.error?.type||'openai_image_error';
    throw err;
  }
  const image=data?.data?.[0];
  if(!image?.b64_json) throw new Error('OpenAI không trả về ảnh base64 hợp lệ.');
  return {b64_json:image.b64_json,mime_type:'image/jpeg'};
}

export default async function handler(req,res){
  if(req.method==='GET'){
    return send(res,200,{
      ok:true,
      service:'KTN Image Generator',
      providers:{
        gemini:Boolean(process.env.GEMINI_API_KEY),
        openai:Boolean(process.env.OPENAI_API_KEY)
      },
      models:{
        gemini:process.env.GEMINI_IMAGE_MODEL||PROVIDERS.gemini.defaultModel,
        openai:process.env.OPENAI_IMAGE_MODEL||PROVIDERS.openai.defaultModel
      },
      contracts:{
        gemini:{responseMimeType:'image/jpeg'},
        openai:{
          responseMimeType:'image/jpeg',
          size:'1536x1024',
          quality:'low'
        }
      }
    });
  }

  if(req.method!=='POST') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

  const body=normalizeBody(req.body);
  const provider=String(body.provider||'gemini').toLowerCase();
  const prompt=String(body.prompt||'').trim();
  const sceneId=String(body.sceneId||'').trim().slice(0,100);
  const aspectRatio=body.aspectRatio==='1:1'?'1:1':'16:9';

  if(!PROVIDERS[provider]) return send(res,400,{error:'Nhà cung cấp ảnh chưa được hỗ trợ.'});
  if(!prompt) return send(res,400,{error:'Image prompt không được để trống.'});
  if(prompt.length>12000) return send(res,400,{error:'Image prompt quá dài.'});

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

  const finalPrompt=[
    prompt,
    'Cinematic composition suitable for a professional video frame.',
    'Do not add captions, subtitles, logos, UI, watermarks, or readable text unless explicitly required by the scene.'
  ].join('\n');

  try{
    const image=provider==='gemini'
      ? await generateGeminiImage(key,model,finalPrompt,aspectRatio)
      : await generateOpenAIImage(key,model,finalPrompt);

    return send(res,200,{
      ok:true,
      sceneId,
      provider,
      providerLabel:cfg.label,
      model,
      mime_type:image.mime_type,
      b64_json:image.b64_json,
      createdAt:new Date().toISOString()
    });
  }catch(error){
    const providerMessage=String(error?.message||'Lỗi không xác định');
    const rateLimited=/rate limit exceeded|rate_limit/i.test(providerMessage);
    const zeroFreeTier=provider==='gemini' && rateLimited && (
      /limit:\s*0\s+requests per day/i.test(providerMessage) ||
      /limit:\s*0\s+input tokens per minute/i.test(providerMessage)
    );
    const billingBlocked=provider==='openai' && /billing|quota|insufficient_quota|credit/i.test(providerMessage);
    const status=rateLimited?429:(billingBlocked?402:502);
    const code=zeroFreeTier
      ? 'provider_free_tier_unavailable'
      : (billingBlocked?'provider_billing_unavailable':(rateLimited?'provider_rate_limited':'image_provider_request_failed'));
    const retryable=!zeroFreeTier && !billingBlocked && rateLimited;

    console.error('image_generation_failed',{
      sceneId,
      provider,
      model,
      status,
      retryable,
      freeTierUnavailable:zeroFreeTier,
      message:providerMessage
    });

    return send(res,status,{
      error:zeroFreeTier
        ? 'Gemini Image không có quota Free Tier cho model '+model+' trên API key hiện tại.'
        : (billingBlocked
          ? 'OpenAI Image chưa có quota/credit khả dụng cho API key hiện tại.'
          : ('Tạo ảnh thất bại: '+providerMessage)),
      code,
      provider,
      sceneId,
      retryable
    });
  }
}
