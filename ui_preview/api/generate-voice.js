const GEMINI_TTS_MODEL_DEFAULT='gemini-2.5-flash-preview-tts';
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

function writeAscii(buffer,offset,text){
  for(let i=0;i<text.length;i++) buffer[offset+i]=text.charCodeAt(i);
}

function pcm16MonoToWavBase64(pcmBase64,sampleRate=24000){
  const pcm=Buffer.from(pcmBase64,'base64');
  const wav=Buffer.alloc(44+pcm.length);
  writeAscii(wav,0,'RIFF');
  wav.writeUInt32LE(36+pcm.length,4);
  writeAscii(wav,8,'WAVE');
  writeAscii(wav,12,'fmt ');
  wav.writeUInt32LE(16,16);
  wav.writeUInt16LE(1,20);
  wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(sampleRate,24);
  wav.writeUInt32LE(sampleRate*2,28);
  wav.writeUInt16LE(2,32);
  wav.writeUInt16LE(16,34);
  writeAscii(wav,36,'data');
  wav.writeUInt32LE(pcm.length,40);
  pcm.copy(wav,44);
  return wav.toString('base64');
}

function findAudioPart(value){
  if(!value) return null;
  if(Array.isArray(value)){
    for(const item of value){
      const found=findAudioPart(item);
      if(found) return found;
    }
    return null;
  }
  if(typeof value!=='object') return null;

  const inline=value.inlineData||value.inline_data;
  if(inline && typeof inline.data==='string'){
    const mime=String(inline.mimeType||inline.mime_type||'').toLowerCase();
    if(mime.startsWith('audio/') || mime.includes('pcm') || mime.includes('l16')){
      return {data:inline.data,mime_type:inline.mimeType||inline.mime_type||'audio/L16;rate=24000'};
    }
  }

  for(const item of Object.values(value)){
    const found=findAudioPart(item);
    if(found) return found;
  }
  return null;
}

function normalizeAudio(audio){
  const mime=String(audio.mime_type||'').toLowerCase();
  if(mime.includes('wav')){
    return {b64_audio:audio.data,mime_type:'audio/wav'};
  }
  if(mime.includes('mpeg') || mime.includes('mp3')){
    return {b64_audio:audio.data,mime_type:'audio/mpeg'};
  }
  if(mime.includes('ogg')){
    return {b64_audio:audio.data,mime_type:'audio/ogg'};
  }
  return {
    b64_audio:pcm16MonoToWavBase64(audio.data,24000),
    mime_type:'audio/wav'
  };
}

async function generateGeminiVoice(key,model,text,voice,languageCode){
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key);
  const response=await fetch(url,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      contents:[{
        role:'user',
        parts:[{
          text:'Đọc tự nhiên, rõ ràng, phù hợp giọng thuyết minh video. Không đọc thêm lời dẫn ngoài nội dung sau:\n\n'+text
        }]
      }],
      generationConfig:{
        responseModalities:['AUDIO'],
        speechConfig:{
          languageCode,
          voiceConfig:{
            prebuiltVoiceConfig:{voiceName:voice}
          }
        }
      }
    })
  });

  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||('Gemini TTS HTTP '+response.status));
  const audio=findAudioPart(data);
  if(!audio) throw new Error('Gemini TTS không trả về dữ liệu âm thanh.');
  return normalizeAudio(audio);
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

  if(req.method!=='POST') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

  const body=normalizeBody(req.body);
  const provider=String(body.provider||'gemini').toLowerCase();
  const text=String(body.text||'').trim();
  const voice=String(body.voice||'Kore').trim();
  const languageCode=String(body.languageCode||'vi-VN').trim();
  const sceneId=String(body.sceneId||'').trim().slice(0,100);

  if(provider!=='gemini') return send(res,400,{error:'Hiện UI V1 chỉ bật Gemini TTS.'});
  if(!text) return send(res,400,{error:'Lời đọc không được để trống.'});
  if(text.length>8000) return send(res,400,{error:'Lời đọc của một scene quá dài.'});
  if(!ALLOWED_VOICES.has(voice)) return send(res,400,{error:'Giọng đọc không được hỗ trợ.'});

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
      createdAt:new Date().toISOString()
    });
  }catch(error){
    console.error('voice_generation_failed',{sceneId,model,voice,message:error?.message});
    return send(res,502,{
      error:'Tạo giọng thất bại: '+(error?.message||'Lỗi không xác định'),
      code:'voice_provider_request_failed',
      provider:'gemini',
      sceneId
    });
  }
}
