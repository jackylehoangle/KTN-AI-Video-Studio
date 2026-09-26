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

function publicVideoUrl(baseUrl,value){
  if(!value) return '';
  if(/^https?:\/\//i.test(value)) return value;
  return baseUrl+'/'+String(value).replace(/^\//,'');
}

export default async function handler(req,res){
  const cfg=config();

  if(req.method==='GET' && !req.query?.task_id){
    return send(res,200,{ok:true,configured:Boolean(cfg.baseUrl)});
  }

  if(!cfg.baseUrl){
    return send(res,503,{error:'Chưa cấu hình MPT_RENDER_BASE_URL trên Vercel.',code:'render_worker_missing'});
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
        video_url:videos.length?publicVideoUrl(cfg.baseUrl,videos[0]):''
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
  const voiceName='vi-VN-HoaiMyNeural';
  const aspect=['16:9','9:16','1:1'].includes(body?.video?.aspect)?body.video.aspect:'16:9';
  const transition=body?.video?.transition||null;

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
    voice_name:voiceName,
    voice_volume:1.0,
    voice_rate:1.0,
    bgm_type:'',
    bgm_file:'',
    bgm_volume:0,
    subtitle_enabled:Boolean(body?.video?.subtitles),
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
    return send(res,200,{ok:true,task_id:taskId});
  }catch(error){
    console.error('render_submit_failed',{message:error?.message});
    return send(res,502,{error:'Không thể tạo MPT render task: '+(error?.message||'Lỗi không xác định')});
  }
}
