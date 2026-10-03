const DEFAULTS={
  gemini:{
    scriptModel:'gemini-3.8-flash',
    imageModel:'gemini-3.1-flash-image',
    ttsModel:'gemini-3.8-flash-lite-tts'
  },
  openai:{
    scriptModel:'gpt-6.1-sol',
    imageModel:'gpt-image-2.5-flare'
  },
  anthropic:{
    scriptModel:'claude-sonnet-5'
  },
  xai:{
    scriptModel:'grok-4.7'
  }
};

function resolveGeminiScriptModel(configured){
  const value=String(configured||'').trim();
  if(!value || value==='gemini-2.5-flash' || value==='models/gemini-2.5-flash'){
    return 'gemini-3.8-flash';
  }
  return value.replace(/^models\//,'');
}

function send(res,status,body){
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.end(JSON.stringify(body));
}

async function probe(url, options={}) {
  if(!url) return false;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
    return response.ok;
  }catch{
    return false;
  }finally{
    clearTimeout(timer);
  }
}

export default async function handler(req,res){
  if(req.method!=='GET') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

  const ktnImageUrl=String(process.env.KTN_IMAGE_GATEWAY_URL||'').trim().replace(/\/$/,'');
  const ktnImageToken=String(process.env.KTN_IMAGE_GATEWAY_TOKEN||'').trim();
  const renderUrl=String(process.env.MPT_RENDER_BASE_URL||'').trim().replace(/\/$/,'');

  const [ktnImageReady,renderReady]=await Promise.all([
    probe(ktnImageUrl?ktnImageUrl+'/health':''),
    probe(renderUrl?renderUrl+'/docs':'')
  ]);

  return send(res,200,{
    ok:true,
    service:'KTN AI Video Studio Status',
    providers:{
      gemini:{
        configured:Boolean(process.env.GEMINI_API_KEY),
        scriptModel:resolveGeminiScriptModel(process.env.GEMINI_SCRIPT_MODEL),
        imageModel:process.env.GEMINI_IMAGE_MODEL||DEFAULTS.gemini.imageModel,
        ttsModel:process.env.GEMINI_TTS_MODEL||DEFAULTS.gemini.ttsModel
      },
      openai:{
        configured:Boolean(process.env.OPENAI_API_KEY),
        scriptModel:process.env.OPENAI_SCRIPT_MODEL||DEFAULTS.openai.scriptModel,
        imageModel:process.env.OPENAI_IMAGE_MODEL||DEFAULTS.openai.imageModel
      },
      anthropic:{
        configured:Boolean(process.env.ANTHROPIC_API_KEY),
        scriptModel:process.env.ANTHROPIC_SCRIPT_MODEL||DEFAULTS.anthropic.scriptModel
      },
      xai:{
        configured:Boolean(process.env.XAI_API_KEY),
        scriptModel:process.env.XAI_SCRIPT_MODEL||DEFAULTS.xai.scriptModel
      },
      ktnImage:{
        configured:Boolean(ktnImageUrl),
        ready:ktnImageReady,
        model:'FLUX.1-schnell FP8',
        gatewayUrlConfigured:Boolean(ktnImageUrl),
        tokenConfigured:Boolean(ktnImageToken)
      },
      render:{
        configured:Boolean(renderUrl),
        ready:renderReady,
        apiKeyConfigured:Boolean(process.env.MPT_RENDER_API_KEY)
      }
    }
  });
}
