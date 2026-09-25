function send(res,status,body){
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.end(JSON.stringify(body));
}

function workerConfig(){
  return {
    baseUrl:String(process.env.MPT_RENDER_BASE_URL||'').trim().replace(/\/$/,''),
    apiKey:String(process.env.MPT_RENDER_API_KEY||'').trim()
  };
}

function workerHeaders(apiKey){
  return apiKey?{'x-api-key':apiKey}:{};
}

export default async function handler(req,res){
  if(req.method==='GET'){
    const cfg=workerConfig();
    return send(res,200,{ok:true,configured:Boolean(cfg.baseUrl)});
  }
  if(req.method!=='POST') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

  const cfg=workerConfig();
  if(!cfg.baseUrl) return send(res,503,{error:'Chưa cấu hình MPT_RENDER_BASE_URL trên Vercel.',code:'render_worker_missing'});

  const body=typeof req.body==='object'&&req.body?req.body:{};
  const sceneId=String(body.sceneId||'scene').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)||'scene';
  const mime=String(body.mime_type||'image/png').toLowerCase();
  const b64=String(body.b64_json||'').trim();
  if(!b64) return send(res,400,{error:'Dữ liệu ảnh đang trống.'});

  const ext=mime.includes('jpeg')||mime.includes('jpg')?'jpg':mime.includes('bmp')?'bmp':'png';
  let bytes;
  try{bytes=Buffer.from(b64,'base64')}catch{return send(res,400,{error:'Ảnh base64 không hợp lệ.'})}
  if(!bytes.length) return send(res,400,{error:'Ảnh base64 không hợp lệ.'});
  if(bytes.length>20*1024*1024) return send(res,413,{error:'Ảnh vượt quá giới hạn 20 MB của MPT.'});

  try{
    const form=new FormData();
    form.append('file',new Blob([bytes],{type:mime}),sceneId+'.'+ext);
    const response=await fetch(cfg.baseUrl+'/api/v1/video_materials',{
      method:'POST',
      headers:workerHeaders(cfg.apiKey),
      body:form
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok || data?.status!==200){
      throw new Error(data?.message||('MPT upload HTTP '+response.status));
    }
    const materialKey=data?.data?.file;
    if(!materialKey) throw new Error('MPT không trả về material key.');
    return send(res,200,{ok:true,sceneId,material_key:materialKey});
  }catch(error){
    console.error('stage_material_failed',{sceneId,message:error?.message});
    return send(res,502,{error:'Không thể tải ảnh lên MPT worker: '+(error?.message||'Lỗi không xác định')});
  }
}
