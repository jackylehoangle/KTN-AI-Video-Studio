function send(res,status,body){
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.end(JSON.stringify(body));
}

function config(){
  return {
    baseUrl:String(process.env.MPT_RENDER_BASE_URL||'').trim().replace(/\/$/,''),
    apiKey:String(process.env.MPT_RENDER_API_KEY||'').trim()
  };
}

function headers(cfg,extra={}){
  return {...extra,...(cfg.apiKey?{'x-api-key':cfg.apiKey}:{})};
}


const DEFAULT_MPT_EDGE_VOICE='vi-VN-HoaiMyNeural';

function envEnabled(value){
  return ['1','true','yes','on'].includes(String(value||'').trim().toLowerCase());
}

function mptVoiceName(voiceConfig={},env=process.env){
  const provider=String(voiceConfig?.provider||'').trim().toLowerCase();
  const voice=String(voiceConfig?.voice||'').trim();
  const edgeVoice=String(env?.MPT_RENDER_EDGE_VOICE||'').trim()||DEFAULT_MPT_EDGE_VOICE;
  if(!voice) return edgeVoice;
  if(provider==='gemini'){
    if(!envEnabled(env?.MPT_RENDER_GEMINI_TTS_ENABLED)) return edgeVoice;
    return voice.startsWith('gemini:')?voice:('gemini:'+voice);
  }
  if(provider==='elevenlabs'){
    if(!envEnabled(env?.MPT_RENDER_ELEVENLABS_TTS_ENABLED)) return edgeVoice;
    return voice.startsWith('elevenlabs:')?voice:('elevenlabs:'+voice+':KTN');
  }
  return voice;
}

function safeVoiceRate(value){
  const parsed=Number(value);
  if(!Number.isFinite(parsed) || parsed<=0) return 1;
  return Math.max(0.5,Math.min(2,parsed));
}

function publicVideoUrl(baseUrl,value){
  if(!value) return '';
  if(/^https?:\/\//i.test(value)) return value;
  return baseUrl+'/'+String(value).replace(/^\//,'');
}

async function signedVideoUrl(cfg,value,nowSeconds=Math.floor(Date.now()/1000)){
  const publicUrl=publicVideoUrl(cfg.baseUrl,value);
  if(!publicUrl || !cfg.apiKey) return publicUrl;
  const url=new URL(publicUrl);
  if(url.origin!==new URL(cfg.baseUrl).origin || !url.pathname.startsWith('/tasks/')) return publicUrl;
  const expires=nowSeconds+3600;
  const {createHmac}=await import('node:crypto');
  const signature=createHmac('sha256',cfg.apiKey)
    .update(url.pathname+'\n'+expires)
    .digest('hex');
  url.searchParams.set('expires',String(expires));
  url.searchParams.set('signature',signature);
  url.searchParams.set('download','1');
  return url.toString();
}

function findGeminiAudio(payload){
  const steps=Array.isArray(payload?.steps)?payload.steps:[];
  for(let i=steps.length-1;i>=0;i--){
    const content=Array.isArray(steps[i]?.content)?steps[i].content:[];
    for(let j=content.length-1;j>=0;j--){
      const item=content[j];
      if(item?.type==='audio' && typeof item?.data==='string' && item.data.length>100){
        return {data:item.data,mimeType:String(item.mime_type||item.mimeType||'audio/wav')};
      }
    }
  }
  return null;
}

async function stageGeminiVoiceover(cfg,{script,voice,languageCode,stylePreset}){
  const key=String(process.env.GEMINI_API_KEY||'').trim();
  if(!key) throw new Error('GEMINI_API_KEY chưa cấu hình cho voiceover render.');
  const model=String(process.env.GEMINI_TTS_MODEL||'gemini-3.8-flash-lite-tts').trim();
  const voiceName=String(voice||'Kore').trim();
  const language=String(languageCode||'vi-VN').trim();
  const style=language==='vi-VN'
    ? 'Đọc tiếng Việt tự nhiên, rõ ràng, có nhịp kể chuyện như người thật, phát âm chính xác và không thêm bất kỳ lời nào ngoài bản chép lời.'
    : 'Natural, clear professional video narration. Do not add words beyond the transcript.';
  const styledPrompt=[style,String(stylePreset||'').trim()].filter(Boolean).join(' ');

  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',
    headers:{'content-type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({
      model,
      input:[{type:'user_input',content:[{type:'text',text:script,annotations:[{type:'speech_metadata',style:styledPrompt}]}]}],
      response_format:{type:'audio',mime_type:'audio/wav',sample_rate:24000},
      generation_config:{speech_config:[{voice:voiceName}]}
    })
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(payload?.error?.message||('Gemini TTS HTTP '+response.status));
  const audio=findGeminiAudio(payload);
  if(!audio) throw new Error('Gemini TTS không trả về dữ liệu âm thanh.');
  const bytes=Buffer.from(audio.data,'base64');
  if(bytes.length<44 || bytes.toString('ascii',0,4)!=='RIFF'){
    throw new Error('Gemini TTS trả về audio không phải WAV hợp lệ.');
  }

  const form=new FormData();
  form.append('file',new Blob([bytes],{type:audio.mimeType}),'ktn-voiceover.wav');
  const upload=await fetch(cfg.baseUrl+'/api/v1/musics',{
    method:'POST',
    headers:headers(cfg),
    body:form
  });
  const uploaded=await upload.json().catch(()=>({}));
  if(!upload.ok || uploaded?.status!==200){
    throw new Error(uploaded?.message||('MPT audio upload HTTP '+upload.status));
  }
  const file=String(uploaded?.data?.file||'').trim();
  if(!file) throw new Error('MPT không trả về custom audio key.');
  return {file,model,voice:voiceName,bytes:bytes.length};
}

export default async function handler(req,res){
  const cfg=config();

  if(req.method==='GET' && !req.query?.task_id){
    if(!cfg.baseUrl || !cfg.apiKey){
      return send(res,200,{
        ok:true,
        configured:Boolean(cfg.baseUrl && cfg.apiKey),
        ready:false,
        baseUrlConfigured:Boolean(cfg.baseUrl),
        apiKeyConfigured:Boolean(cfg.apiKey)
      });
    }
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(cfg.baseUrl+'/api/v1/tasks?page=1&page_size=1',{
        headers:headers(cfg),
        signal:controller.signal,
        cache:'no-store'
      });
      return send(res,200,{
        ok:true,
        configured:true,
        ready:response.ok,
        authenticated:response.ok,
        workerStatus:response.status,
        baseUrlConfigured:true,
        apiKeyConfigured:true
      });
    }catch{
      return send(res,200,{ok:true,configured:true,ready:false,authenticated:false,baseUrlConfigured:true,apiKeyConfigured:true});
    }finally{
      clearTimeout(timer);
    }
  }

  if(!cfg.baseUrl){
    return send(res,503,{error:'Chưa cấu hình MPT_RENDER_BASE_URL trên Vercel.',code:'render_worker_missing'});
  }
  if(!cfg.apiKey){
    return send(res,503,{error:'Chưa cấu hình MPT_RENDER_API_KEY trên Vercel.',code:'render_worker_auth_missing'});
  }

  if(req.method==='GET'){
    const taskId=String(req.query?.task_id||'').trim();
    if(!taskId) return send(res,400,{error:'Thiếu task_id.'});
    try{
      const response=await fetch(cfg.baseUrl+'/api/v1/tasks/'+encodeURIComponent(taskId),{
        headers:headers(cfg)
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok || payload?.status!==200){
        throw new Error(payload?.message||('MPT status HTTP '+response.status));
      }
      const task=payload?.data||{};
      const stateNumber=Number(task.state);
      const complete=stateNumber===1 || Number(task.progress)>=100;
      const failed=stateNumber===-1 || Boolean(task.error);
      const videos=Array.isArray(task.videos)?task.videos:[];
      return send(res,200,{
        ok:true,
        task_id:taskId,
        state:failed?'failed':complete?'complete':'processing',
        state_label:failed?'Render thất bại':complete?'Hoàn tất MP4':'MoneyPrinterTurbo đang render...',
        progress:Number(task.progress)||0,
        error:task.error||'',
        video_url:videos.length?await signedVideoUrl(cfg,videos[0]):'',
        download_url:videos.length
          ?'/api/render-video-download?task_id='+encodeURIComponent(taskId)
          :''
      });
    }catch(error){
      return send(res,502,{error:'Không đọc được MPT task: '+(error?.message||'Lỗi không xác định')});
    }
  }

  if(req.method!=='POST') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

  const body=typeof req.body==='object'&&req.body?req.body:{};
  const scenes=Array.isArray(body.scenes)?body.scenes:[];
  const script=String(body.script||'').trim();
  const topic=String(body.topic||'').trim()||'KTN AI Video';
  if(!script) return send(res,400,{error:'Render manifest chưa có kịch bản.'});
  if(!scenes.length) return send(res,400,{error:'Render manifest chưa có scene.'});

  const materials=[];
  for(const scene of scenes){
    const key=String(scene?.material_key||'').trim();
    if(!key) return send(res,400,{error:'Còn scene chưa được stage ảnh lên render worker.'});
    materials.push({
      provider:'local',
      url:key,
      duration:Math.max(1,Math.ceil(Number(scene?.duration_seconds)||5))
    });
  }

  const maxClipDuration=Math.max(
    1,
    ...materials.map(item=>item.duration)
  );
  const voiceName=mptVoiceName(body?.voice||{});
  const voiceRate=safeVoiceRate(body?.voice?.speed);
  const aspect=['16:9','9:16','1:1'].includes(body?.video?.aspect)?body.video.aspect:'16:9';
  const transition=body?.video?.transition||null;

  let customAudio=null;
  const requestedProvider=String(body?.voice?.provider||'').trim().toLowerCase();
  if(requestedProvider==='gemini'){
    try{
      customAudio=await stageGeminiVoiceover(cfg,{
        script,
        voice:body?.voice?.voice,
        languageCode:body?.voice?.languageCode,
        stylePreset:body?.voice?.stylePreset
      });
    }catch(error){
      console.error('render_voiceover_failed',{provider:'gemini',message:error?.message});
      return send(res,502,{error:'Không thể chuẩn bị voiceover Gemini: '+(error?.message||'Lỗi không xác định')});
    }
  }

  const requestBody={
    video_subject:topic,
    video_script:script,
    video_terms:[],
    video_aspect:aspect,
    video_fit_mode:'cover',
    video_concat_mode:'sequential',
    video_transition_mode:transition,
    video_clip_duration:maxClipDuration,
    video_clip_speed:1.0,
    match_materials_to_script:true,
    video_count:1,
    video_source:'local',
    video_materials:materials,
    video_language:'vi-VN',
    custom_audio_file:customAudio?.file||null,
    voice_name:voiceName,
    voice_volume:1.0,
    voice_rate:voiceRate,
    bgm_type:'',
    bgm_file:'',
    bgm_volume:0,
    subtitle_enabled:Boolean(body?.video?.subtitles),
    custom_subtitle_content:String(body?.subtitle_srt||'').trim().slice(0,200000),
    subtitle_position:'bottom',
    subtitle_display_mode:'sentence',
    subtitle_animation:'none',
    font_size:60,
    text_fore_color:'#FFFFFF',
    stroke_color:'#000000',
    stroke_width:1.5,
    n_threads:2
  };

  try{
    const response=await fetch(cfg.baseUrl+'/api/v1/videos',{
      method:'POST',
      headers:headers(cfg,{'content-type':'application/json'}),
      body:JSON.stringify(requestBody)
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok || payload?.status!==200){
      throw new Error(payload?.message||('MPT render HTTP '+response.status));
    }
    const taskId=payload?.data?.task_id;
    if(!taskId) throw new Error('MPT không trả về task_id.');
    return send(res,200,{
      ok:true,
      task_id:taskId,
      voice:{
        provider:String(body?.voice?.provider||''),
        voice:String(body?.voice?.voice||''),
        mpt_voice_name:voiceName,
        speed:voiceRate
      },
      voiceover:customAudio?{provider:'gemini',model:customAudio.model,voice:customAudio.voice,bytes:customAudio.bytes}:null
    });
  }catch(error){
    console.error('render_submit_failed',{message:error?.message});
    return send(res,502,{error:'Không thể tạo MPT render task: '+(error?.message||'Lỗi không xác định')});
  }
}
