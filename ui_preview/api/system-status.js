const DEFAULTS={
  gemini:{
    scriptModel:'gemini-3.8-flash',
    imageModel:'gemini-3.1-flash-image',
    ttsModel:'gemini-3.8-flash-lite-tts'
  },
  openai:{
    scriptModel:'gpt-4.1-mini',
    imageModel:'gpt-image-2.5-flare'
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

export default async function handler(req,res){
  if(req.method!=='GET') return send(res,405,{error:'Phương thức không được hỗ trợ.'});

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
      ktnImage:{
        configured:Boolean(process.env.KTN_IMAGE_GATEWAY_URL),
        model:'FLUX.1-schnell FP8',
        gatewayUrlConfigured:Boolean(process.env.KTN_IMAGE_GATEWAY_URL),
        tokenConfigured:Boolean(process.env.KTN_IMAGE_GATEWAY_TOKEN)
      },
      render:{
        configured:Boolean(process.env.MPT_RENDER_BASE_URL),
        apiKeyConfigured:Boolean(process.env.MPT_RENDER_API_KEY)
      }
    }
  });
}
