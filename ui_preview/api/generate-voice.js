const GEMINI_TTS_MODEL_DEFAULT='gemini-3.8-flash-lite-tts';
const ALLOWED_VOICES=new Set(['Kore','Achernar','Aoede','Charon','Sulafat','Puck']);

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

async function generateGeminiVoice(key,model,text,voice,languageCode){
  const style=languageCode==='vi-VN'
    ? 'Đọc tiếng Việt tự nhiên, rõ ràng, nhịp kể chuyện chuyên nghiệp, phát âm chính xác và không thêm bất kỳ lời nào ngoài bản chép lời.'
    : 'Natural, clear professional video narration with accurate pronunciation. Do not add words beyond the transcript.';

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
        speech_config:[
          {voice}
        ]
      }
    })
  });

  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    throw new Error(data?.error?.message||('Gemini TTS HTTP '+response.status));
  }

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

export default async function handler(req,res){
  if(req.method==='GET'){
    return send(res,200,{
      ok:true,
      service:'KTN Voice Generator',
      providers:{gemini:Boolean(process.env.GEMINI_API_KEY)},
      model:process.env.GEMINI_TTS_MODEL||GEMINI_TTS_MODEL_DEFAULT,
      voices:Array.from(ALLOWED_VOICES)
    });
  }

  if(req.method!=='POST'){
    return send(res,405,{error:'Phương thức không được hỗ trợ.'});
  }

  const body=normalizeBody(req.body);
  const provider=String(body.provider||'gemini').toLowerCase();
  const text=String(body.text||'').trim();
  const voice=String(body.voice||'Kore').trim();
  const languageCode=String(body.languageCode||'vi-VN').trim();
  const sceneId=String(body.sceneId||'').trim().slice(0,100);

  if(provider!=='gemini'){
    return send(res,400,{error:'Hiện UI V1 chỉ bật Gemini TTS.'});
  }
  if(!text) return send(res,400,{error:'Lời đọc không được để trống.'});
  if(text.length>8000) return send(res,400,{error:'Lời đọc của một scene quá dài.'});
  if(!ALLOWED_VOICES.has(voice)){
    return send(res,400,{error:'Giọng đọc không được hỗ trợ.'});
  }

  const key=process.env.GEMINI_API_KEY;
  const model=process.env.GEMINI_TTS_MODEL||GEMINI_TTS_MODEL_DEFAULT;
  if(!key){
    return send(res,503,{
      error:'Chưa cấu hình GEMINI_API_KEY trên Vercel.',
      code:'provider_key_missing',
      provider
    });
  }

  try{
    const audio=await generateGeminiVoice(key,model,text,voice,languageCode);
    return send(res,200,{
      ok:true,
      sceneId,
      provider:'gemini',
      providerLabel:'Gemini TTS',
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
    const rateLimited=/rate limit exceeded/i.test(providerMessage);
    const highDemand=/high demand/i.test(providerMessage);
    const status=rateLimited ? 429 : (highDemand ? 503 : 502);

    console.error('voice_generation_failed',{
      sceneId,
      model,
      voice,
      status,
      retryAfterSeconds,
      message:providerMessage
    });
    return send(res,status,{
      error:'Tạo giọng thất bại: '+providerMessage,
      code:rateLimited?'provider_rate_limited':(highDemand?'provider_high_demand':'voice_provider_request_failed'),
      provider:'gemini',
      sceneId,
      retry_after_seconds:retryAfterSeconds
    });
  }
}
