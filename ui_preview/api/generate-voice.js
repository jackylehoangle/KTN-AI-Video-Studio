const GEMINI_TTS_MODEL_DEFAULT='gemini-3.8-flash-lite-tts';
const ELEVENLABS_TTS_MODEL_DEFAULT='eleven_multilingual_v2';
const GEMINI_PREBUILT_VOICES=new Set(['Kore','Achernar','Aoede','Charon','Sulafat','Puck']);

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

function wavDurationSeconds(buffer){
  try{
    if(buffer.length<44 || buffer.toString('ascii',0,4)!=='RIFF') return null;
    const byteRate=buffer.readUInt32LE(28);
    if(!byteRate) return null;
    let offset=12;
    while(offset+8<=buffer.length){
      const chunkId=buffer.toString('ascii',offset,offset+4);
      const chunkSize=buffer.readUInt32LE(offset+4);
      if(chunkId==='data') return chunkSize/byteRate;
      offset+=8+chunkSize+(chunkSize%2);
    }
    return null;
  }catch{return null}
}

function findInteractionAudio(payload){
  const steps=Array.isArray(payload?.steps)?payload.steps:[];
  for(let i=steps.length-1;i>=0;i--){
    const step=steps[i];
    if(step?.type!=='model_output') continue;
    const content=Array.isArray(step?.content)?step.content:[];
    for(let j=content.length-1;j>=0;j--){
      const item=content[j];
      if(item?.type==='audio' && typeof item?.data==='string' && item.data.length>100){
        return {
          data:item.data,
          mime_type:String(item.mime_type||item.mimeType||'audio/wav')
        };
      }
    }
  }
  return null;
}

function validGeminiVoice(voice){
  const value=String(voice||'').trim();
  if(GEMINI_PREBUILT_VOICES.has(value)) return true;
  if(/^voice_[A-Za-z0-9_-]+$/.test(value) || /^voicekey_[A-Za-z0-9_-]+$/.test(value)) return true;
  // Voices API returns catalog IDs such as "achernar", locale-specific IDs,
  // and other safe alphanumeric/hyphen/underscore identifiers.
  return /^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$/.test(value);
}

async function generateGeminiVoice(key,model,text,voice,languageCode,styleInstruction){
  const defaultStyle=languageCode==='vi-VN'
    ? 'Đọc tiếng Việt tự nhiên, rõ ràng, có nhịp kể chuyện như người thật, phát âm chính xác và không thêm bất kỳ lời nào ngoài bản chép lời.'
    : 'Natural, clear professional video narration with human pacing and accurate pronunciation. Do not add words beyond the transcript.';
  const style=[defaultStyle,String(styleInstruction||'').trim()].filter(Boolean).join(' ');

  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-goog-api-key':key
    },
    body:JSON.stringify({
      model,
      input:[{
        type:'user_input',
        content:[{
          type:'text',
          text,
          annotations:[{
            type:'speech_metadata',
            style
          }]
        }]
      }],
      response_format:{
        type:'audio',
        mime_type:'audio/wav',
        sample_rate:24000
      },
      generation_config:{
        speech_config:[{voice}]
      }
    })
  });

  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||('Gemini TTS HTTP '+response.status));

  const audio=findInteractionAudio(data);
  if(!audio) throw new Error('Gemini TTS không trả về dữ liệu âm thanh.');

  const bytes=Buffer.from(audio.data,'base64');
  if(bytes.length<44 || bytes.toString('ascii',0,4)!=='RIFF'){
    throw new Error('Gemini TTS trả về audio không phải WAV hợp lệ.');
  }

  return {
    b64_audio:audio.data,
    mime_type:'audio/wav',
    duration_seconds:wavDurationSeconds(bytes)
  };
}

async function generateElevenLabsVoice(key,model,text,voice,voiceSettings){
  const stability=Math.max(0,Math.min(1,Number(voiceSettings?.stability ?? 0.5)));
  const similarity=Math.max(0,Math.min(1,Number(voiceSettings?.similarity_boost ?? 0.75)));
  const style=Math.max(0,Math.min(1,Number(voiceSettings?.style ?? 0)));
  const speed=Math.max(0.7,Math.min(1.2,Number(voiceSettings?.speed ?? 1)));

  const response=await fetch(
    'https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voice)+'?output_format=mp3_44100_128',
    {
      method:'POST',
      headers:{
        'content-type':'application/json',
        'xi-api-key':key,
        'accept':'audio/mpeg'
      },
      body:JSON.stringify({
        text,
        model_id:model,
        voice_settings:{
          stability,
          similarity_boost:similarity,
          style,
          use_speaker_boost:true,
          speed
        }
      })
    }
  );

  if(!response.ok){
    const data=await response.json().catch(()=>({}));
    throw new Error(data?.detail?.message||data?.detail||('ElevenLabs TTS HTTP '+response.status));
  }
  const buffer=Buffer.from(await response.arrayBuffer());
  if(buffer.length<100) throw new Error('ElevenLabs trả về audio rỗng.');
  return {
    b64_audio:buffer.toString('base64'),
    mime_type:'audio/mpeg',
    duration_seconds:null
  };
}

export default async function handler(req,res){
  const geminiKey=process.env.GEMINI_API_KEY||'';
  const elevenKey=process.env.ELEVENLABS_API_KEY||'';

  if(req.method==='GET'){
    const selftest=String(req.query?.selftest||'').toLowerCase();
    if(selftest==='gemini'){
      if(!geminiKey) return send(res,503,{ok:false,error:'GEMINI_API_KEY chưa cấu hình.',code:'provider_key_missing'});
      const model=process.env.GEMINI_TTS_MODEL||GEMINI_TTS_MODEL_DEFAULT;
      try{
        const audio=await generateGeminiVoice(
          geminiKey,
          model,
          'Đây là bản kiểm thử giọng đọc V1 của KTN AI Video Studio.',
          'Kore',
          'vi-VN',
          'Đọc tự nhiên, rõ ràng, bình tĩnh.'
        );
        const bytes=Buffer.from(audio.b64_audio,'base64');
        return send(res,200,{
          ok:true,
          service:'KTN Voice Generator Self-Test',
          provider:'gemini',
          model,
          voice:'Kore',
          mime_type:audio.mime_type,
          bytes:bytes.length,
          duration_seconds:audio.duration_seconds,
          wav_magic:bytes.length>=4 && bytes.toString('ascii',0,4)==='RIFF',
          createdAt:new Date().toISOString()
        });
      }catch(error){
        return send(res,502,{
          ok:false,
          provider:'gemini',
          model,
          voice:'Kore',
          error:String(error?.message||'Voice self-test failed.')
        });
      }
    }

    return send(res,200,{
      ok:true,
      service:'KTN Voice Generator',
      providers:{
        gemini:Boolean(geminiKey),
        elevenlabs:Boolean(elevenKey)
      },
      models:{
        gemini:process.env.GEMINI_TTS_MODEL||GEMINI_TTS_MODEL_DEFAULT,
        elevenlabs:process.env.ELEVENLABS_TTS_MODEL||ELEVENLABS_TTS_MODEL_DEFAULT
      },
      voices:Array.from(GEMINI_PREBUILT_VOICES)
    });
  }

  if(req.method!=='POST') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

  const body=normalizeBody(req.body);
  const provider=String(body.provider||'gemini').toLowerCase();
  const text=String(body.text||'').trim();
  const voice=String(body.voice||'Kore').trim().slice(0,300);
  const languageCode=String(body.languageCode||'vi-VN').trim();
  const sceneId=String(body.sceneId||'').trim().slice(0,100);
  const styleInstruction=String(body.styleInstruction||'').trim().slice(0,1200);
  const voiceSettings=body.voiceSettings&&typeof body.voiceSettings==='object'?body.voiceSettings:{};

  if(!['gemini','elevenlabs'].includes(provider)){
    return send(res,400,{error:'Voice provider chưa được hỗ trợ.'});
  }
  if(!text) return send(res,400,{error:'Lời đọc không được để trống.'});
  if(text.length>12000) return send(res,400,{error:'Lời đọc của một scene quá dài.'});
  if(!voice) return send(res,400,{error:'Chưa chọn giọng đọc.'});
  if(provider==='gemini' && !validGeminiVoice(voice)){
    return send(res,400,{error:'Gemini voice ID không hợp lệ.'});
  }

  const key=provider==='gemini'?geminiKey:elevenKey;
  const model=provider==='gemini'
    ? (process.env.GEMINI_TTS_MODEL||GEMINI_TTS_MODEL_DEFAULT)
    : (process.env.ELEVENLABS_TTS_MODEL||ELEVENLABS_TTS_MODEL_DEFAULT);

  if(!key){
    return send(res,503,{
      error:'Chưa cấu hình '+(provider==='gemini'?'GEMINI_API_KEY':'ELEVENLABS_API_KEY')+' trên Vercel.',
      code:'provider_key_missing',
      provider
    });
  }

  try{
    const audio=provider==='gemini'
      ? await generateGeminiVoice(key,model,text,voice,languageCode,styleInstruction)
      : await generateElevenLabsVoice(key,model,text,voice,voiceSettings);

    return send(res,200,{
      ok:true,
      sceneId,
      provider,
      providerLabel:provider==='gemini'?'Gemini TTS':'ElevenLabs TTS',
      model,
      voice,
      languageCode,
      mime_type:audio.mime_type,
      b64_audio:audio.b64_audio,
      duration_seconds:audio.duration_seconds,
      createdAt:new Date().toISOString()
    });
  }catch(error){
    const providerMessage=String(error?.message||'Lỗi không xác định');
    const retryMatch=providerMessage.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
    const retryAfterSeconds=retryMatch ? Math.ceil(Number(retryMatch[1])) : null;
    const rateLimited=/rate limit|too many requests|429/i.test(providerMessage);
    const dailyQuota=provider==='gemini' && rateLimited && /requests per day/i.test(providerMessage);
    const minuteQuota=rateLimited && /requests per minute/i.test(providerMessage);
    const highDemand=/high demand|overloaded/i.test(providerMessage);
    const status=rateLimited ? 429 : (highDemand ? 503 : 502);
    const quotaScope=dailyQuota?'day':(minuteQuota?'minute':null);
    const retryable=!dailyQuota && (rateLimited || highDemand);

    console.error('voice_generation_failed',{
      sceneId,provider,model,voice,status,quotaScope,retryable,
      retryAfterSeconds:dailyQuota?null:retryAfterSeconds,
      message:providerMessage
    });

    const userError=dailyQuota
      ? 'Gemini TTS Free Tier đã đạt giới hạn request theo ngày. Hệ thống sẽ không retry tự động.'
      : ('Tạo giọng thất bại: '+providerMessage);

    return send(res,status,{
      error:userError,
      code:dailyQuota
        ? 'provider_daily_quota_exhausted'
        : (rateLimited?'provider_rate_limited':(highDemand?'provider_high_demand':'voice_provider_request_failed')),
      provider,
      sceneId,
      quota_scope:quotaScope,
      retryable,
      retry_after_seconds:dailyQuota?null:retryAfterSeconds
    });
  }
}
