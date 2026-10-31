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

function clean(value,max=400){
  return String(value||'').trim().slice(0,max);
}

function audioPayload(value){
  if(!value || typeof value!=='object') return null;
  const data=String(value.data||'').trim();
  const mime=String(value.mime_type||value.mimeType||'audio/wav').trim();
  if(!data || data.length<100) return null;
  return {data,mime_type:mime};
}

async function listGeminiVoices(key){
  if(!key) return {voices:[],error:null};
  try{
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/voices?page_size=200',{
      headers:{'x-goog-api-key':key,'accept':'application/json'}
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data?.error?.message||('Gemini Voices HTTP '+response.status));
    const voices=(Array.isArray(data?.voices)?data.voices:[]).map(item=>({
      id:String(item.id||item.name||'').replace(/^voices\//,''),
      name:String(item.display_name||item.id||item.name||'Voice'),
      provider:'gemini',
      type:String(item.type||'prebuilt').toLowerCase(),
      category:String(item.type||'prebuilt').toLowerCase(),
      languageCode:String(item.language_code||''),
      description:String(item.description||item.persona||''),
      previewUrl:'',
      owner:true,
      model:String(item.model||'')
    })).filter(item=>item.id);
    return {voices,error:null};
  }catch(error){
    return {voices:[],error:String(error?.message||error)};
  }
}

async function listElevenLabsVoices(key){
  if(!key) return {voices:[],error:null};
  try{
    const response=await fetch('https://api.elevenlabs.io/v1/voices?show_legacy=false',{
      headers:{'xi-api-key':key,'accept':'application/json'}
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data?.detail?.message||data?.detail||('ElevenLabs Voices HTTP '+response.status));
    const voices=(Array.isArray(data?.voices)?data.voices:[]).map(item=>({
      id:String(item.voice_id||''),
      name:String(item.name||'Voice'),
      provider:'elevenlabs',
      type:String(item.category||'voice').toLowerCase(),
      category:String(item.category||'voice').toLowerCase(),
      languageCode:String(item?.verified_languages?.[0]?.locale||item?.verified_languages?.[0]?.language||''),
      description:String(item.description||''),
      previewUrl:String(item.preview_url||item?.verified_languages?.[0]?.preview_url||''),
      owner:Boolean(item.is_owner ?? true),
      model:''
    })).filter(item=>item.id);
    return {voices,error:null};
  }catch(error){
    return {voices:[],error:String(error?.message||error)};
  }
}

async function createGeminiClone(key,{name,sourceAudio,consentAudio}){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/voices',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-goog-api-key':key
    },
    body:JSON.stringify({
      store:true,
      voice:{
        model:'gemini-3.8-flash-tts',
        type:'replicated',
        display_name:name,
        replicated:{
          source_audio:sourceAudio,
          consent_audio:consentAudio
        }
      }
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||('Gemini Voice Replication HTTP '+response.status));
  const id=String(data?.id||data?.name||'').replace(/^voices\//,'');
  if(!id) throw new Error('Gemini không trả về voice_id cho giọng clone.');
  return {
    id,
    name:String(data?.display_name||name),
    provider:'gemini',
    type:'replicated',
    category:'replicated',
    languageCode:String(data?.language_code||''),
    description:String(data?.description||''),
    previewUrl:'',
    owner:true,
    model:String(data?.model||'gemini-3.8-flash-tts')
  };
}

async function createElevenLabsClone(key,{name,sourceAudio,description}){
  const form=new FormData();
  form.append('name',name);
  if(description) form.append('description',description);
  form.append('files',new Blob([Buffer.from(sourceAudio.data,'base64')],{type:sourceAudio.mime_type}), 'reference-audio');
  const response=await fetch('https://api.elevenlabs.io/v1/voices/add',{
    method:'POST',
    headers:{'xi-api-key':key},
    body:form
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.detail?.message||data?.detail||('ElevenLabs Clone HTTP '+response.status));
  const id=String(data?.voice_id||'');
  if(!id) throw new Error('ElevenLabs không trả về voice_id.');
  return {
    id,
    name,
    provider:'elevenlabs',
    type:'cloned',
    category:'cloned',
    languageCode:'',
    description:description||'Instant Voice Clone',
    previewUrl:'',
    owner:true,
    model:''
  };
}

async function deleteVoice(provider,key,voiceId){
  const safe=encodeURIComponent(voiceId);
  const url=provider==='gemini'
    ? 'https://generativelanguage.googleapis.com/v1beta/voices/'+safe
    : 'https://api.elevenlabs.io/v1/voices/'+safe;
  const headers=provider==='gemini'
    ? {'x-goog-api-key':key}
    : {'xi-api-key':key};
  const response=await fetch(url,{method:'DELETE',headers});
  if(!response.ok){
    const data=await response.json().catch(()=>({}));
    throw new Error(data?.error?.message||data?.detail?.message||data?.detail||('Delete voice HTTP '+response.status));
  }
}

export default async function handler(req,res){
  const geminiKey=process.env.GEMINI_API_KEY||'';
  const elevenKey=process.env.ELEVENLABS_API_KEY||'';

  if(req.method==='GET'){
    const [gemini,elevenlabs]=await Promise.all([
      listGeminiVoices(geminiKey),
      listElevenLabsVoices(elevenKey)
    ]);
    return send(res,200,{
      ok:true,
      service:'KTN Voice Library',
      providers:{
        gemini:{configured:Boolean(geminiKey),cloneMode:'replicated',error:gemini.error},
        elevenlabs:{configured:Boolean(elevenKey),cloneMode:'instant',error:elevenlabs.error}
      },
      voices:[...gemini.voices,...elevenlabs.voices],
      consent:{
        gemini:{
          required:true,
          sourceAudio:'10–30 giây giọng thật, sạch; WAV mono 24kHz khuyến nghị.',
          consentAudio:true,
          viVN:'Tôi là chủ sở hữu giọng nói này và tôi đồng ý cho Google sử dụng giọng nói này để tạo mô hình giọng nói tổng hợp.'
        },
        elevenlabs:{
          required:true,
          sourceAudio:'Audio một người nói, sạch và có quyền sử dụng.',
          consentAudio:false
        }
      }
    });
  }

  if(req.method!=='POST') return send(res,405,{error:'Phương thức không được hỗ trợ.'});
  const body=normalizeBody(req.body);
  const action=String(body.action||'clone').toLowerCase();
  const provider=String(body.provider||'gemini').toLowerCase();
  const voiceId=clean(body.voiceId,300);
  const name=clean(body.name,120);
  const consentConfirmed=Boolean(body.consentConfirmed);

  if(!['gemini','elevenlabs'].includes(provider)) return send(res,400,{error:'Voice provider chưa được hỗ trợ.'});
  const key=provider==='gemini'?geminiKey:elevenKey;
  if(!key){
    return send(res,503,{
      error:'Chưa cấu hình '+(provider==='gemini'?'GEMINI_API_KEY':'ELEVENLABS_API_KEY')+' trên Vercel.',
      code:'provider_key_missing',
      provider
    });
  }

  try{
    if(action==='delete'){
      if(!voiceId) return send(res,400,{error:'Thiếu voiceId.'});
      await deleteVoice(provider,key,voiceId);
      return send(res,200,{ok:true,action,provider,voiceId});
    }

    if(action!=='clone') return send(res,400,{error:'Action không hợp lệ.'});
    if(!consentConfirmed){
      return send(res,400,{error:'Cần xác nhận quyền sở hữu/sự đồng ý trước khi clone giọng.',code:'consent_required'});
    }
    if(!name) return send(res,400,{error:'Tên giọng clone không được để trống.'});

    const sourceAudio=audioPayload(body.sourceAudio);
    if(!sourceAudio) return send(res,400,{error:'Thiếu reference audio hợp lệ.'});

    let voice;
    if(provider==='gemini'){
      const consentAudio=audioPayload(body.consentAudio);
      if(!consentAudio) return send(res,400,{error:'Gemini Voice Replication yêu cầu consent audio của cùng người nói.'});
      voice=await createGeminiClone(key,{name,sourceAudio,consentAudio});
    }else{
      voice=await createElevenLabsClone(key,{
        name,
        sourceAudio,
        description:clean(body.description,400)
      });
    }

    return send(res,200,{
      ok:true,
      action:'clone',
      provider,
      voice,
      consentRecorded:true,
      createdAt:new Date().toISOString()
    });
  }catch(error){
    console.error('voice_library_request_failed',{action,provider,message:error?.message});
    return send(res,502,{
      error:'Voice Library thất bại: '+(error?.message||'Lỗi không xác định'),
      code:'voice_library_request_failed',
      provider
    });
  }
}
