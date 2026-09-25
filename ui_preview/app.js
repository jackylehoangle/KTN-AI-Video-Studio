const toast=document.getElementById('toast');
const backendStatus=document.getElementById('backendStatus');
const generateBtn=document.getElementById('generateBtn');
const generateBtnText=document.getElementById('generateBtnText');
const keywordBtn=document.getElementById('keywordBtn');
const sceneBtn=document.getElementById('sceneBtn');
const sceneBtnText=document.getElementById('sceneBtnText');
const scriptEmpty=document.getElementById('scriptEmpty');
const scriptDemo=document.getElementById('scriptDemo');
const scriptResult=document.getElementById('scriptResult');
const scriptMeta=document.getElementById('scriptMeta');
const scriptTitle=document.getElementById('scriptTitle');
const keywordPanel=document.getElementById('keywordPanel');
const keywordList=document.getElementById('keywordList');
const keywordMeta=document.getElementById('keywordMeta');
const historyPanel=document.getElementById('historyPanel');
const sceneEmpty=document.getElementById('sceneEmpty');
const sceneList=document.getElementById('sceneList');
const subtitleBtn=document.getElementById('subtitleBtn');
const subtitleEmpty=document.getElementById('subtitleEmpty');
const subtitleOutput=document.getElementById('subtitleOutput');
const subtitlePreview=document.getElementById('subtitlePreview');
const subtitleMeta=document.getElementById('subtitleMeta');
let currentSrt='';
let renderWorkerAvailable=false;
let activeRenderTaskId='';

let currentScriptProvider='gemini';
let currentScenes=[];
let providerAvailability={gemini:false,openai:false};
let voiceAvailability={gemini:false};

const showToast=(msg)=>{toast.textContent=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3200)};

async function refreshBackendStatus(){
  try{
    const res=await fetch('/api/generate-script',{headers:{'accept':'application/json'}});
    const data=await res.json();
    const configured=[];
    providerAvailability={
      gemini:Boolean(data.providers?.gemini),
      openai:Boolean(data.providers?.openai)
    };
    if(providerAvailability.gemini) configured.push('Gemini');
    if(providerAvailability.openai) configured.push('OpenAI');
    updateImageProviderState();
    if(configured.length){
      backendStatus.textContent='AI sẵn sàng · '+configured.join(' / ');
      backendStatus.className='preview-badge ready';
      voiceAvailability.gemini=providerAvailability.gemini;
      updateVoiceProviderState();
    }else{
      backendStatus.textContent='Chưa cấu hình API key';
      backendStatus.className='preview-badge warn';
      voiceAvailability.gemini=false;
      updateVoiceProviderState();
    }
  }catch(e){
    backendStatus.textContent='Không kết nối được AI';
    backendStatus.className='preview-badge error';
  }
}

function activateScriptTools(){
  const hasScript=Boolean(scriptResult.value.trim());
  keywordBtn.disabled=!hasScript;
  sceneBtn.disabled=!hasScript;
  subtitleBtn.disabled=currentScenes.length===0;
}

function selectScriptTab(tab){
  const buttons={
    script:document.getElementById('scriptTabBtn'),
    keywords:document.getElementById('keywordTabBtn'),
    history:document.getElementById('historyTabBtn')
  };
  Object.values(buttons).forEach(btn=>btn.classList.remove('active'));
  buttons[tab].classList.add('active');

  scriptDemo.classList.toggle('hidden',tab!=='script' || !scriptResult.value.trim());
  scriptEmpty.classList.toggle('hidden',tab!=='script' || Boolean(scriptResult.value.trim()));
  keywordPanel.classList.toggle('hidden',tab!=='keywords');
  historyPanel.classList.toggle('hidden',tab!=='history');
}

function renderKeywords(items,meta){
  keywordList.innerHTML='';
  items.forEach(item=>{
    const chip=document.createElement('span');
    chip.className='keyword-chip';
    chip.textContent=typeof item==='string'?item:(item.keyword||item.label||'');
    if(typeof item==='object' && item.visual_keyword) chip.title='Visual: '+item.visual_keyword;
    keywordList.appendChild(chip);
  });
  keywordMeta.textContent=(meta?.providerLabel||'AI')+' · '+items.length+' từ khóa';
  selectScriptTab('keywords');
}

function escapeText(value){
  return String(value??'');
}

function updateVoiceProviderState(){
  const state=document.getElementById('voiceProviderState');
  if(!state) return;
  state.textContent=voiceAvailability.gemini?'Sẵn sàng':'Thiếu API key';
  state.style.color=voiceAvailability.gemini?'#198754':'#9b6b16';
}

function updateImageProviderState(){
  const provider=document.getElementById('imageProvider')?.value||'gemini';
  const state=document.getElementById('imageProviderState');
  if(!state) return;
  state.textContent=providerAvailability[provider]?'Sẵn sàng':'Thiếu API key';
  state.style.color=providerAvailability[provider]?'#198754':'#9b6b16';
}

async function generateSceneVoice(scene,card,button){
  const text=String(scene.narration||'').trim();
  const voice=document.getElementById('voiceName').value||'Kore';
  const audioBox=card.querySelector('.scene-audio');
  const status=audioBox.querySelector('.scene-audio-status');
  if(!text){showToast('Scene này chưa có lời đọc.');return;}

  button.disabled=true;
  button.textContent='Đang tạo giọng...';
  audioBox.classList.remove('hidden');
  status.textContent='Gemini đang tạo giọng cho scene '+String(scene.order).padStart(2,'0')+'...';
  const oldAudio=audioBox.querySelector('audio');
  if(oldAudio) oldAudio.remove();

  try{
    const res=await fetch('/api/generate-voice',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({
        provider:'gemini',
        text,
        voice,
        languageCode:'vi-VN',
        sceneId:scene.id
      })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('HTTP '+res.status));
    if(!data.b64_audio) throw new Error('API không trả về dữ liệu âm thanh.');

    const audio=document.createElement('audio');
    audio.controls=true;
    audio.preload='metadata';
    audio.src='data:'+(data.mime_type||'audio/wav')+';base64,'+data.b64_audio;
    const actualDuration=Number(data.duration_seconds);
    if(Number.isFinite(actualDuration) && actualDuration>0){
      scene.audio_duration_seconds=actualDuration;
      const durationBadge=card.querySelector('.scene-duration');
      if(durationBadge) durationBadge.textContent=actualDuration.toFixed(1)+' giây · audio';
    }
    status.textContent=(data.voice||voice)+' · '+(data.providerLabel||'Gemini TTS');
    audioBox.appendChild(audio);
    button.textContent='Tạo lại giọng';
    showToast('Đã tạo giọng cho '+(scene.title||scene.id)+'.');
  }catch(err){
    audioBox.classList.remove('hidden');
    status.textContent=err.message||'Không thể tạo giọng.';
    button.textContent='Thử lại giọng';
    showToast(err.message||'Không thể tạo giọng.');
  }finally{
    button.disabled=false;
  }
}

async function generateSceneImage(scene,card,button){
  const provider=document.getElementById('imageProvider').value;
  const imageBox=card.querySelector('.scene-image');
  const status=imageBox.querySelector('.scene-image-status');
  const prompt=String(scene.image_prompt||'').trim();
  if(!prompt){showToast('Scene này chưa có image prompt.');return;}

  button.disabled=true;
  button.textContent='Đang tạo...';
  imageBox.classList.remove('hidden');
  status.textContent='AI đang tạo ảnh cho scene '+String(scene.order).padStart(2,'0')+'...';
  const oldImage=imageBox.querySelector('img');
  if(oldImage) oldImage.remove();

  try{
    const res=await fetch('/api/generate-image',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({
        provider,
        prompt,
        sceneId:scene.id,
        aspectRatio:'16:9'
      })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('HTTP '+res.status));
    if(!data.b64_json) throw new Error('API không trả về dữ liệu ảnh.');

    const img=document.createElement('img');
    img.alt='Ảnh '+(scene.title||scene.id);
    img.src='data:'+(data.mime_type||'image/png')+';base64,'+data.b64_json;
    scene.image_asset={
      b64_json:data.b64_json,
      mime_type:data.mime_type||'image/png',
      provider:data.provider||provider,
      model:data.model||''
    };
    scene.material_key='';
    status.textContent='';
    imageBox.prepend(img);
    button.textContent='Tạo lại ảnh';
    updateRenderReadiness();
    showToast('Đã tạo ảnh cho '+(scene.title||scene.id)+' bằng '+(data.providerLabel||provider)+'.');
  }catch(err){
    imageBox.classList.remove('hidden');
    status.textContent=err.message||'Không thể tạo ảnh.';
    button.textContent='Thử lại';
    showToast(err.message||'Không thể tạo ảnh.');
  }finally{
    button.disabled=false;
  }
}

function renderScenes(scenes,meta){
  currentScenes=scenes;
  sceneList.innerHTML='';
  scenes.forEach((scene,index)=>{
    const card=document.createElement('article');
    card.className='scene-card';

    const head=document.createElement('div');
    head.className='scene-card-head';

    const idx=document.createElement('div');
    idx.className='scene-index';
    const num=document.createElement('span');
    num.className='scene-number';
    num.textContent=String(scene.order||index+1).padStart(2,'0');
    const titleWrap=document.createElement('div');
    const title=document.createElement('h3');
    title.textContent=escapeText(scene.title||('Cảnh '+(index+1)));
    const sub=document.createElement('small');
    sub.textContent='Scene ID: '+escapeText(scene.id||('scene_'+String(index+1).padStart(2,'0')));
    titleWrap.append(title,sub);
    idx.append(num,titleWrap);

    const actions=document.createElement('div');
    actions.className='scene-actions';
    const duration=document.createElement('span');
    duration.className='scene-duration';
    duration.textContent=(scene.duration_seconds||scene.duration_estimate_seconds||0)+' giây';
    const voiceBtn=document.createElement('button');
    voiceBtn.className='scene-voice-btn';
    voiceBtn.textContent='Tạo giọng';
    const imageBtn=document.createElement('button');
    imageBtn.className='scene-image-btn';
    imageBtn.textContent='Tạo ảnh';
    actions.append(duration,voiceBtn,imageBtn);
    head.append(idx,actions);

    const grid=document.createElement('div');
    grid.className='scene-grid';

    const fields=[
      ['Lời đọc',scene.narration,'full',false],
      ['Mô tả hình ảnh',scene.visual_description,'',false],
      ['Image prompt',scene.image_prompt,'',true]
    ];
    fields.forEach(([label,value,extra,isCode])=>{
      const field=document.createElement('div');
      field.className='scene-field '+extra;
      const lab=document.createElement('label');
      lab.textContent=label;
      const body=document.createElement(isCode?'code':'p');
      body.textContent=escapeText(value);
      field.append(lab,body);
      grid.appendChild(field);
    });

    const audioBox=document.createElement('div');
    audioBox.className='scene-audio hidden';
    const audioStatus=document.createElement('div');
    audioStatus.className='scene-audio-status';
    audioStatus.textContent='Chưa tạo giọng';
    audioBox.appendChild(audioStatus);

    const imageBox=document.createElement('div');
    imageBox.className='scene-image hidden';
    const imageStatus=document.createElement('div');
    imageStatus.className='scene-image-status';
    imageStatus.textContent='Chưa tạo ảnh';
    imageBox.appendChild(imageStatus);

    card.append(head,grid,audioBox,imageBox);
    voiceBtn.addEventListener('click',()=>generateSceneVoice(scene,card,voiceBtn));
    imageBtn.addEventListener('click',()=>generateSceneImage(scene,card,imageBtn));
    sceneList.appendChild(card);
  });
  sceneEmpty.classList.add('hidden');
  sceneList.classList.remove('hidden');
  subtitleBtn.disabled=scenes.length===0;
  subtitleEmpty.classList.remove('hidden');
  subtitleOutput.classList.add('hidden');
  currentSrt='';
  document.getElementById('sceneSection').scrollIntoView({behavior:'smooth',block:'start'});
  showToast('Đã chia '+scenes.length+' cảnh bằng '+(meta?.providerLabel||'AI')+'.');
}

async function analyzeScript(action){
  const script=scriptResult.value.trim();
  const provider=document.getElementById('scriptProvider').value||currentScriptProvider;
  const language=document.getElementById('scriptLanguage').value;
  if(!script){showToast('Cần có kịch bản trước.');return;}

  const targetButton=action==='keywords'?keywordBtn:sceneBtn;
  const originalText=targetButton.textContent;
  targetButton.disabled=true;
  if(action==='scenes') sceneBtnText.innerHTML='<span class="loading-dot"></span>Đang chia cảnh...';
  else targetButton.innerHTML='<span class="loading-dot"></span>Đang tạo từ khóa...';

  try{
    const res=await fetch('/api/analyze-script',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({action,script,provider,language,topic:document.getElementById('topic').value.trim()})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('HTTP '+res.status));

    if(action==='keywords'){
      renderKeywords(data.keywords||[],data);
    }else{
      renderScenes(data.scenes||[],data);
    }
  }catch(err){
    showToast(err.message||'AI không thể phân tích kịch bản.');
  }finally{
    if(action==='scenes') sceneBtnText.textContent='▦ Chia cảnh bằng AI';
    else targetButton.textContent=originalText;
    activateScriptTools();
  }
}

document.querySelectorAll('.nav-item[data-section]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    if(btn.dataset.section==='library'){
      document.getElementById('renderSection').scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(btn.dataset.section==='subtitle'){
      document.getElementById('subtitleSection').scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(btn.dataset.section==='scene'){
      document.getElementById('sceneSection').scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(btn.dataset.section==='script'){
      document.querySelector('.script-preview').scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(btn.dataset.section!=='create') showToast('Mục “'+btn.textContent.trim()+'” sẽ được hoàn thiện khi chúng ta đi từng chức năng.');
  });
});

generateBtn.addEventListener('click',async()=>{
  const topic=document.getElementById('topic').value.trim();
  const provider=document.getElementById('scriptProvider').value;
  const language=document.getElementById('scriptLanguage').value;
  const paragraphs=Number(document.getElementById('paragraphCount').value||6);
  const duration=document.getElementById('targetDuration').value;
  const extraInstruction=document.getElementById('extraInstruction').value.trim();

  if(!topic){showToast('Hãy nhập chủ đề video trước.');document.getElementById('topic').focus();return;}

  generateBtn.disabled=true;
  generateBtnText.innerHTML='<span class="loading-dot"></span>Đang tạo kịch bản...';
  backendStatus.textContent='AI đang xử lý...';
  backendStatus.className='preview-badge';

  try{
    const res=await fetch('/api/generate-script',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({topic,provider,language,paragraphs,duration,extraInstruction})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('HTTP '+res.status));

    currentScriptProvider=provider;
    scriptEmpty.classList.add('hidden');
    scriptDemo.classList.remove('hidden');
    scriptTitle.textContent=topic;
    scriptResult.value=data.script||'';
    scriptMeta.textContent='Đã tạo · '+(data.providerLabel||provider)+' · '+(data.model||'AI')+' · bản nháp';
    backendStatus.textContent='AI sẵn sàng · '+(data.providerLabel||provider);
    backendStatus.className='preview-badge ready';
    keywordList.innerHTML='';
    currentScenes=[];
    sceneList.innerHTML='';
    sceneList.classList.add('hidden');
    sceneEmpty.classList.remove('hidden');
    subtitleBtn.disabled=true;
    subtitleEmpty.classList.remove('hidden');
    subtitleOutput.classList.add('hidden');
    currentSrt='';
    updateRenderReadiness();
    selectScriptTab('script');
    activateScriptTools();
    showToast('Đã tạo kịch bản thật bằng '+(data.providerLabel||provider)+'.');
  }catch(err){
    backendStatus.textContent='Cần kiểm tra cấu hình AI';
    backendStatus.className='preview-badge warn';
    showToast(err.message||'Không thể tạo kịch bản.');
  }finally{
    generateBtn.disabled=false;
    generateBtnText.textContent='✦ Tạo kịch bản bằng AI';
  }
});

document.getElementById('copyScriptBtn').addEventListener('click',async()=>{
  if(!scriptResult.value) return;
  await navigator.clipboard.writeText(scriptResult.value);
  showToast('Đã sao chép kịch bản.');
});

document.getElementById('editScriptBtn').addEventListener('click',(e)=>{
  const editing=scriptResult.hasAttribute('readonly');
  if(editing){
    scriptResult.removeAttribute('readonly');
    scriptResult.classList.add('editing');
    e.currentTarget.textContent='Lưu chỉnh sửa';
    scriptResult.focus();
  }else{
    scriptResult.setAttribute('readonly','');
    scriptResult.classList.remove('editing');
    e.currentTarget.textContent='Chỉnh sửa';
    activateScriptTools();
    showToast('Đã giữ bản chỉnh sửa trong phiên hiện tại.');
  }
});

keywordBtn.addEventListener('click',()=>analyzeScript('keywords'));
sceneBtn.addEventListener('click',()=>analyzeScript('scenes'));
document.getElementById('scriptTabBtn').addEventListener('click',()=>selectScriptTab('script'));
document.getElementById('keywordTabBtn').addEventListener('click',()=>selectScriptTab('keywords'));
document.getElementById('historyTabBtn').addEventListener('click',()=>selectScriptTab('history'));
function formatSrtTime(seconds){
  const totalMs=Math.max(0,Math.round(Number(seconds||0)*1000));
  const h=Math.floor(totalMs/3600000);
  const m=Math.floor((totalMs%3600000)/60000);
  const s=Math.floor((totalMs%60000)/1000);
  const ms=totalMs%1000;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(ms).padStart(3,'0');
}

function splitSubtitleText(text,maxChars){
  const cleaned=String(text||'').replace(/\s+/g,' ').trim();
  if(!cleaned) return [];
  const sentences=cleaned.match(/[^.!?…]+[.!?…]?/g)||[cleaned];
  const chunks=[];
  for(const sentenceRaw of sentences){
    const sentence=sentenceRaw.trim();
    if(!sentence) continue;
    if(sentence.length<=maxChars){chunks.push(sentence);continue;}
    const words=sentence.split(' ');
    let line='';
    for(const word of words){
      const next=line?line+' '+word:word;
      if(next.length>maxChars && line){chunks.push(line);line=word;}
      else line=next;
    }
    if(line) chunks.push(line);
  }
  return chunks;
}

function buildSrt(){
  if(!currentScenes.length){showToast('Cần chia cảnh trước khi tạo phụ đề.');return;}
  const maxChars=Number(document.getElementById('subtitleMaxChars').value||42);
  const gap=Number(document.getElementById('subtitleGap').value||0);
  let cursor=0;
  let cue=1;
  const blocks=[];

  for(const scene of currentScenes){
    const chunks=splitSubtitleText(scene.narration,maxChars);
    if(!chunks.length) continue;
    const duration=Math.max(1,Number(scene.audio_duration_seconds||scene.duration_seconds||3));
    const weights=chunks.map(x=>Math.max(x.replace(/\s+/g,'').length,1));
    const totalWeight=weights.reduce((a,b)=>a+b,0);
    let sceneCursor=cursor;

    chunks.forEach((chunk,index)=>{
      const share=duration*(weights[index]/totalWeight);
      const end=index===chunks.length-1?cursor+duration:sceneCursor+share;
      blocks.push(
        cue+'\n'+
        formatSrtTime(sceneCursor)+' --> '+formatSrtTime(end)+'\n'+
        chunk
      );
      cue+=1;
      sceneCursor=end;
    });

    cursor+=duration+gap;
  }

  currentSrt=blocks.join('\n\n')+'\n';
  subtitlePreview.textContent=currentSrt;
  subtitleMeta.textContent=(cue-1)+' câu · '+formatSrtTime(cursor)+' · '+currentScenes.length+' cảnh';
  subtitleEmpty.classList.add('hidden');
  subtitleOutput.classList.remove('hidden');
  document.getElementById('subtitleSection').scrollIntoView({behavior:'smooth',block:'start'});
  updateRenderReadiness();
  showToast('Đã tạo phụ đề SRT từ '+currentScenes.length+' cảnh.');
}

subtitleBtn.addEventListener('click',buildSrt);
document.getElementById('downloadSrtBtn').addEventListener('click',()=>{
  if(!currentSrt){showToast('Chưa có nội dung SRT để tải.');return;}
  const blob=new Blob([currentSrt],{type:'application/x-subrip;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='ktn-ai-video-studio.srt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

function setReadiness(name,ready,detail){
  const item=document.querySelector('.readiness-item[data-check="'+name+'"]');
  if(!item) return;
  item.classList.toggle('ready',Boolean(ready));
  item.querySelector(':scope > span').textContent=ready?'✓':'○';
  const small=item.querySelector('small');
  if(small) small.textContent=detail;
}

function updateRenderReadiness(){
  const hasScript=Boolean(scriptResult.value.trim());
  const hasScenes=currentScenes.length>0;
  const imageCount=currentScenes.filter(scene=>scene.image_asset?.b64_json || scene.material_key).length;
  const imagesReady=hasScenes && imageCount===currentScenes.length;
  setReadiness('script',hasScript,hasScript?'Sẵn sàng':'Chưa sẵn sàng');
  setReadiness('scenes',hasScenes,hasScenes?currentScenes.length+' cảnh':'Chưa sẵn sàng');
  setReadiness('images',imagesReady,hasScenes?imageCount+'/'+currentScenes.length+' ảnh':'Chưa sẵn sàng');
  setReadiness('subtitles',Boolean(currentSrt),currentSrt?'Đã tạo SRT':'Tùy chọn');
  document.getElementById('renderBtn').disabled=!(hasScript && hasScenes && imagesReady && renderWorkerAvailable);
}

function buildRenderManifest(){
  const maxDuration=currentScenes.reduce((max,scene)=>Math.max(max,Math.ceil(Number(scene.audio_duration_seconds||scene.duration_seconds||5))),1);
  return {
    version:'ktn-render-manifest-v1',
    topic:document.getElementById('topic').value.trim(),
    script:scriptResult.value.trim(),
    voice:{
      provider:'gemini',
      voice:document.getElementById('voiceName').value||'Kore',
      languageCode:'vi-VN'
    },
    video:{
      aspect:document.getElementById('renderAspect').value,
      transition:document.getElementById('renderTransition').value||null,
      maxClipDuration:maxDuration,
      subtitles:Boolean(currentSrt)
    },
    scenes:currentScenes.map(scene=>({
      id:scene.id,
      order:scene.order,
      title:scene.title,
      narration:scene.narration,
      duration_seconds:Math.max(1,Math.ceil(Number(scene.audio_duration_seconds||scene.duration_seconds||5))),
      image_prompt:scene.image_prompt,
      material_key:scene.material_key||null,
      image_ready:Boolean(scene.image_asset?.b64_json || scene.material_key)
    }))
  };
}

async function refreshRenderWorker(){
  const status=document.getElementById('renderWorkerStatus');
  try{
    const res=await fetch('/api/render-video',{headers:{accept:'application/json'}});
    const data=await res.json().catch(()=>({}));
    renderWorkerAvailable=Boolean(res.ok && data.configured);
    status.textContent=renderWorkerAvailable?'Render worker sẵn sàng':'Chưa cấu hình render worker';
    status.style.background=renderWorkerAvailable?'#eaf8ef':'#fff7df';
    status.style.color=renderWorkerAvailable?'#198754':'#805d16';
  }catch{
    renderWorkerAvailable=false;
    status.textContent='Không kết nối được render worker';
  }
  updateRenderReadiness();
}

async function stageSceneImage(scene){
  if(scene.material_key) return scene.material_key;
  if(!scene.image_asset?.b64_json) throw new Error('Scene '+scene.order+' chưa có ảnh.');
  const res=await fetch('/api/stage-material',{
    method:'POST',
    headers:{'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify({
      sceneId:scene.id,
      mime_type:scene.image_asset.mime_type,
      b64_json:scene.image_asset.b64_json
    })
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||('Upload ảnh scene '+scene.order+' thất bại.'));
  scene.material_key=data.material_key;
  return data.material_key;
}

async function submitRender(){
  const progress=document.getElementById('renderProgress');
  const label=document.getElementById('renderProgressLabel');
  const value=document.getElementById('renderProgressValue');
  const bar=document.getElementById('renderProgressBar');
  const result=document.getElementById('renderResult');
  const button=document.getElementById('renderBtn');

  progress.classList.remove('hidden');
  result.textContent='';
  button.disabled=true;

  try{
    for(let i=0;i<currentScenes.length;i++){
      label.textContent='Đang tải ảnh scene '+(i+1)+'/'+currentScenes.length+' lên render worker...';
      const p=Math.round(((i)/Math.max(currentScenes.length,1))*30);
      value.textContent=p+'%'; bar.style.width=p+'%';
      await stageSceneImage(currentScenes[i]);
    }

    label.textContent='Đang tạo render task...';
    value.textContent='35%'; bar.style.width='35%';
    const manifest=buildRenderManifest();
    const res=await fetch('/api/render-video',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify(manifest)
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('Không thể tạo render task.'));
    activeRenderTaskId=data.task_id;
    await pollRenderTask(activeRenderTaskId);
  }catch(err){
    label.textContent='Render thất bại';
    result.textContent=err.message||'Không thể render video.';
    button.disabled=false;
  }
}

async function pollRenderTask(taskId){
  const label=document.getElementById('renderProgressLabel');
  const value=document.getElementById('renderProgressValue');
  const bar=document.getElementById('renderProgressBar');
  const result=document.getElementById('renderResult');
  const button=document.getElementById('renderBtn');

  for(let attempt=0;attempt<180;attempt++){
    await new Promise(resolve=>setTimeout(resolve,2000));
    const res=await fetch('/api/render-video?task_id='+encodeURIComponent(taskId),{headers:{accept:'application/json'}});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||'Không đọc được trạng thái render.');

    const p=Math.max(35,Math.min(99,Number(data.progress)||35));
    label.textContent=data.state_label||'Đang render video...';
    value.textContent=p+'%'; bar.style.width=p+'%';

    if(data.state==='failed') throw new Error(data.error||'MPT render thất bại.');
    if(data.state==='complete'){
      value.textContent='100%'; bar.style.width='100%';
      label.textContent='Hoàn tất MP4';
      if(data.video_url){
        const link=document.createElement('a');
        link.href=data.video_url;
        link.target='_blank';
        link.rel='noopener noreferrer';
        link.textContent='Mở video MP4';
        result.innerHTML='';
        result.appendChild(link);
      }else{
        result.textContent='Task hoàn tất nhưng chưa có URL video.';
      }
      button.disabled=false;
      return;
    }
  }
  throw new Error('Render quá thời gian chờ của giao diện.');
}

document.getElementById('downloadManifestBtn').addEventListener('click',()=>{
  const manifest=buildRenderManifest();
  const blob=new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='ktn-render-manifest.json';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
});

document.getElementById('renderBtn').addEventListener('click',submitRender);
document.getElementById('imageProvider').addEventListener('change',updateImageProviderState);
document.getElementById('voiceName').addEventListener('change',updateVoiceProviderState);
document.querySelectorAll('.quick-row button,.ghost,.icon-btn').forEach(btn=>btn.addEventListener('click',()=>showToast('Chức năng này sẽ được nối ở bước tương ứng.')));

activateScriptTools();
updateImageProviderState();
updateVoiceProviderState();
updateRenderReadiness();
refreshBackendStatus();
refreshRenderWorker();
