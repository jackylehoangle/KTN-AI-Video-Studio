const CHUNK_BYTES=2*1024*1024;

function sendJson(res,status,body){
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

function safeTaskId(value){
  const taskId=String(value||'').trim();
  return /^[a-zA-Z0-9_-]{1,100}$/.test(taskId)?taskId:'';
}

function safeOffset(value){
  const offset=Number(value||0);
  return Number.isSafeInteger(offset)&&offset>=0?offset:null;
}

function workerVideoUrl(cfg,taskId,value){
  if(!value) return null;
  const url=new URL(value,cfg.baseUrl+'/');
  const expectedPrefix='/tasks/'+encodeURIComponent(taskId)+'/';
  if(url.origin!==new URL(cfg.baseUrl).origin || !url.pathname.startsWith(expectedPrefix)) return null;
  return url;
}

function totalFromResponse(response,bytesLength,offset){
  const contentRange=String(response.headers.get('content-range')||'');
  const match=contentRange.match(/^bytes\s+\d+-\d+\/(\d+)$/i);
  if(match) return Number(match[1]);
  const contentLength=Number(response.headers.get('content-length'));
  if(response.status===200 && Number.isFinite(contentLength)) return contentLength;
  return offset+bytesLength;
}

export default async function handler(req,res){
  if(req.method!=='GET') return sendJson(res,405,{error:'Phương thức không được hỗ trợ.'});

  const cfg=config();
  if(!cfg.baseUrl || !cfg.apiKey){
    return sendJson(res,503,{error:'Render worker chưa được cấu hình đầy đủ.'});
  }

  const taskId=safeTaskId(req.query?.task_id);
  const offset=safeOffset(req.query?.offset);
  if(!taskId) return sendJson(res,400,{error:'task_id không hợp lệ.'});
  if(offset===null) return sendJson(res,400,{error:'offset không hợp lệ.'});

  try{
    const taskResponse=await fetch(cfg.baseUrl+'/api/v1/tasks/'+encodeURIComponent(taskId),{
      headers:{'x-api-key':cfg.apiKey},
      cache:'no-store'
    });
    const taskPayload=await taskResponse.json().catch(()=>({}));
    const task=taskPayload?.data||{};
    const videos=Array.isArray(task.videos)?task.videos:[];
    if(!taskResponse.ok || taskPayload?.status!==200 || !videos.length){
      return sendJson(res,404,{error:'Không tìm thấy MP4 đã hoàn tất.'});
    }

    const videoUrl=workerVideoUrl(cfg,taskId,videos[0]);
    if(!videoUrl) return sendJson(res,502,{error:'Worker trả về đường dẫn MP4 không hợp lệ.'});

    const end=offset+CHUNK_BYTES-1;
    const videoResponse=await fetch(videoUrl,{
      headers:{'x-api-key':cfg.apiKey,range:'bytes='+offset+'-'+end},
      cache:'no-store'
    });
    if(videoResponse.status===416){
      res.statusCode=416;
      return res.end();
    }
    if(!videoResponse.ok) return sendJson(res,502,{error:'Không đọc được MP4 từ worker.'});

    const bytes=Buffer.from(await videoResponse.arrayBuffer());
    if(!bytes.length) return sendJson(res,502,{error:'Worker trả về chunk MP4 rỗng.'});
    if(videoResponse.status!==206 && bytes.length>CHUNK_BYTES){
      return sendJson(res,502,{error:'Render worker chưa hỗ trợ tải MP4 theo từng phần.'});
    }

    const total=totalFromResponse(videoResponse,bytes.length,offset);
    res.statusCode=206;
    res.setHeader('content-type',videoResponse.headers.get('content-type')||'video/mp4');
    res.setHeader('content-length',String(bytes.length));
    res.setHeader('content-range','bytes '+offset+'-'+(offset+bytes.length-1)+'/'+total);
    res.setHeader('accept-ranges','bytes');
    res.setHeader('x-ktn-video-size',String(total));
    res.setHeader('cache-control','private, no-store');
    return res.end(bytes);
  }catch(error){
    return sendJson(res,502,{error:'Không tải được MP4: '+(error?.message||'Lỗi không xác định')});
  }
}

