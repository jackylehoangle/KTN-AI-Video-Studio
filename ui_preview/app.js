
function wait(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

function parseRetrySeconds(message){
  const match=String(message||'').match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if(!match) return null;
  const seconds=Math.ceil(Number(match[1]));
  return Number.isFinite(seconds) && seconds>0 ? seconds : null;
}

async function waitWithCountdown(seconds,onTick){
  const total=Math.max(1,Math.ceil(Number(seconds)||1));
  for(let remaining=total;remaining>0;remaining--){
    if(typeof onTick==='function') onTick(remaining);
    await wait(1000);
  }
}

function makeVoiceError(message,data={},status=0){
  const err=new Error(message);
  err.code=String(data.code||'voice_request_failed');
  err.status=Number(status||0);
  err.quotaScope=String(data.quota_scope||'');
  err.retryable=data.retryable!==false;
  err.retryAfterSeconds=Number(data.retry_after_seconds)||null;
  return err;
}

function markVoiceDailyQuotaBlocked(message){
  voiceDailyQuotaBlocked=true;
  voiceDailyQuotaMessage=String(message||'Gemini TTS đã hết quota Free Tier theo ngày.');
  renderVoiceWorkspace();
}

async function requestVoiceWithRetry(payload,onRetry){
  const transientStatuses=new Set([429,500,502,503,504]);
  let lastError=null;

  if(voiceDailyQuotaBlocked){
    throw makeVoiceError(
      voiceDailyQuotaMessage||'Gemini TTS đã hết quota Free Tier theo ngày.',
      {code:'provider_daily_quota_exhausted',quota_scope:'day',retryable:false},
      429
    );
  }

  for(let attempt=1;attempt<=3;attempt++){
    try{
      const res=await fetch('/api/generate-voice',{
        method:'POST',
        headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify(payload)
      });
      const data=await res.json().catch(()=>({}));
      if(res.ok){
        if(!data.b64_audio) throw new Error('API không trả về dữ liệu âm thanh.');
        return data;
      }

      const message=data.error||('HTTP '+res.status);
      const requestError=makeVoiceError(message,data,res.status);
      lastError=requestError;

      if(
        requestError.code==='provider_daily_quota_exhausted' ||
        requestError.quotaScope==='day' ||
        requestError.retryable===false
      ){
        markVoiceDailyQuotaBlocked(message);
        throw requestError;
      }

      if(!transientStatuses.has(res.status) || attempt===3) throw requestError;

      const providerRetry=requestError.retryAfterSeconds||parseRetrySeconds(message);
      const fallback=res.status===429 ? 60 : Math.min(15,5*attempt);
      const retrySeconds=Math.max(1,Math.min(120,providerRetry||fallback));

      if(typeof onRetry==='function'){
        onRetry({
          attempt,
          status:res.status,
          message,
          retrySeconds,
          quotaScope:requestError.quotaScope
        });
      }
      await waitWithCountdown(retrySeconds,remaining=>{
        if(typeof onRetry==='function'){
          onRetry({
            attempt,
            status:res.status,
            message,
            retrySeconds,
            remaining,
            quotaScope:requestError.quotaScope
          });
        }
      });
    }catch(err){
      lastError=err;
      if(
        err?.code==='provider_daily_quota_exhausted' ||
        err?.quotaScope==='day' ||
        err?.retryable===false
      ){
        throw err;
      }

      const message=String(err?.message||'');
      const isNetwork=message.toLowerCase().includes('fetch');
      if(!isNetwork || attempt===3) throw err;

      const retrySeconds=Math.min(15,5*attempt);
      if(typeof onRetry==='function'){
        onRetry({attempt,status:0,message,retrySeconds});
      }
      await waitWithCountdown(retrySeconds,remaining=>{
        if(typeof onRetry==='function'){
          onRetry({attempt,status:0,message,retrySeconds,remaining});
        }
      });
    }
  }

  throw lastError||new Error('Không thể tạo giọng.');
}

function getVoiceBatchCandidates(scope){
  const missing=currentScenes.filter(scene=>!scene.audio_asset?.b64_audio);
  if(scope==='all') return currentScenes.slice();
  if(scope==='test2') return missing.slice(0,2);
  return missing;
}


function syncVoiceSelectors(source){
  const quick=document.getElementById('voiceName');
  const workspace=document.getElementById('voiceWorkspaceVoice');
  const value=source?.value||quick?.value||workspace?.value||'Kore';
  if(quick && quick.value!==value) quick.value=value;
  if(workspace && workspace.value!==value) workspace.value=value;
  scheduleAutosave();
  renderVoiceWorkspace();
}

function renderVoiceWorkspace(){
  const total=currentScenes.length;
  const ready=currentScenes.filter(scene=>scene.audio_asset?.b64_audio).length;
  const missing=Math.max(0,total-ready);
  const status=document.getElementById('voiceWorkspaceStatus');
  const quotaNotice=document.getElementById('voiceDailyQuotaNotice');
  if(status){
    if(voiceDailyQuotaBlocked){
      status.textContent='Hết quota TTS hôm nay';
      status.style.background='#fff0f0';
      status.style.color='#a23b3b';
    }else{
      status.textContent=voiceAvailability.gemini?'Gemini TTS sẵn sàng':'Chưa cấu hình Gemini TTS';
      status.style.background=voiceAvailability.gemini?'#eaf8ef':'#fff7df';
      status.style.color=voiceAvailability.gemini?'#198754':'#805d16';
    }
  }
  if(quotaNotice){
    quotaNotice.classList.toggle('hidden',!voiceDailyQuotaBlocked);
    const detail=quotaNotice.querySelector('span');
    if(detail && voiceDailyQuotaBlocked){
      detail.textContent=voiceDailyQuotaMessage+
        ' Hệ thống đã dừng retry và khóa tạo audio mới trong phiên này.';
    }
  }
  document.getElementById('voiceSceneTotal').textContent=String(total);
  document.getElementById('voiceSceneReady').textContent=String(ready);
  document.getElementById('voiceSceneMissing').textContent=String(missing);
  document.getElementById('voiceBatchSummary').textContent=ready+'/'+total+' audio';

  const list=document.getElementById('voiceSceneStatusList');
  const empty=document.getElementById('voiceSceneStatusEmpty');
  list.innerHTML='';

  if(!total){
    empty.classList.remove('hidden');
    list.classList.add('hidden');
  }else{
    empty.classList.add('hidden');
    list.classList.remove('hidden');
    currentScenes.forEach(scene=>{
      const hasAudio=Boolean(scene.audio_asset?.b64_audio);
      const row=document.createElement('div');
      row.className='voice-status-row';

      const number=document.createElement('div');
      number.className='voice-status-number';
      number.textContent=String(scene.order||0).padStart(2,'0');

      const main=document.createElement('div');
      main.className='voice-status-main';
      const strong=document.createElement('strong');
      strong.textContent=scene.title||scene.id;
      const small=document.createElement('small');
      small.textContent=hasAudio
        ? ((scene.audio_asset.voice||'Giọng')+' · '+(Number(scene.audio_duration_seconds||scene.audio_asset.duration_seconds)||0).toFixed(1)+' giây')
        : 'Chưa có audio';
      main.append(strong,small);

      const badge=document.createElement('span');
      badge.className='voice-status-badge'+(hasAudio?' ready':'');
      badge.textContent=hasAudio?'READY':'THIẾU AUDIO';

      const action=document.createElement('button');
      action.textContent=voiceDailyQuotaBlocked?'Hết quota':(hasAudio?'Tạo lại':'Tạo audio');
      action.disabled=voiceDailyQuotaBlocked;
      action.addEventListener('click',()=>{
        const card=findSceneCard(scene.id);
        const button=card?.querySelector('.scene-voice-btn');
        if(card && button){
          generateSceneVoice(scene,card,button).then(()=>{
            renderVoiceWorkspace();
            renderAssetLibrary();
          });
        }else{
          showToast('Không tìm thấy scene trên giao diện.');
        }
      });

      row.append(number,main,badge,action);
      list.appendChild(row);
    });
  }

  const previewButton=document.getElementById('voicePreviewBtn');
  if(previewButton) previewButton.disabled=voiceDailyQuotaBlocked || !voiceAvailability.gemini;
  document.querySelectorAll('.scene-voice-btn').forEach(btn=>{
    btn.disabled=voiceDailyQuotaBlocked;
    if(voiceDailyQuotaBlocked) btn.textContent='Hết quota TTS';
  });
  updateVoiceBatchButton();
}

function updateVoiceBatchButton(){
  const button=document.getElementById('voiceBatchBtn');
  const confirmed=document.getElementById('voiceBatchConfirm').checked;
  const scope=document.getElementById('voiceBatchScope').value;
  const candidates=getVoiceBatchCandidates(scope);
  button.disabled=!(voiceAvailability.gemini && !voiceDailyQuotaBlocked && confirmed && candidates.length>0);
  button.textContent=voiceDailyQuotaBlocked
    ? 'Hết quota TTS hôm nay'
    : (candidates.length
      ? ((scope==='test2'?'Test batch':'Tạo audio hàng loạt')+' · '+candidates.length+' scene')
      : 'Không có scene cần tạo');
}

async function previewVoice(){
  const button=document.getElementById('voicePreviewBtn');
  const text=document.getElementById('voicePreviewText').value.trim();
  const voice=document.getElementById('voiceWorkspaceVoice').value||'Kore';
  const output=document.getElementById('voicePreviewOutput');
  const audio=document.getElementById('voicePreviewAudio');
  const meta=document.getElementById('voicePreviewMeta');

  if(!text){showToast('Hãy nhập câu nghe thử.');return;}
  if(voiceDailyQuotaBlocked){showToast('Gemini TTS đã hết quota Free Tier theo ngày. Không gửi thêm request.');return;}
  if(!voiceAvailability.gemini){showToast('Gemini TTS chưa sẵn sàng.');return;}

  button.disabled=true;
  button.textContent='Đang tạo mẫu...';
  output.classList.remove('hidden');
  meta.textContent='Gemini đang tạo audio mẫu...';
  audio.removeAttribute('src');
  audio.load();

  try{
    const data=await requestVoiceWithRetry({
      provider:'gemini',
      text,
      voice,
      languageCode:'vi-VN',
      sceneId:'voice_preview'
    },info=>{
      if(info.remaining){
        meta.textContent='Gemini đang giới hạn request · đợi '+info.remaining+' giây...';
      }else{
        meta.textContent='Gemini đang bận · chuẩn bị thử lại...';
      }
    });
    audio.src='data:'+(data.mime_type||'audio/wav')+';base64,'+data.b64_audio;
    meta.textContent=(data.voice||voice)+' · '+(data.model||'Gemini TTS')+
      (Number(data.duration_seconds)>0?' · '+Number(data.duration_seconds).toFixed(1)+' giây':'');
    audio.load();
    showToast('Đã tạo audio nghe thử.');
  }catch(err){
    meta.textContent=err.message||'Không thể tạo audio mẫu.';
    showToast(err.message||'Không thể tạo audio mẫu.');
  }finally{
    button.disabled=voiceDailyQuotaBlocked;
    button.textContent=voiceDailyQuotaBlocked?'Hết quota TTS':'Nghe thử';
  }
}

async function runVoiceBatch(){
  const button=document.getElementById('voiceBatchBtn');
  const scope=document.getElementById('voiceBatchScope').value;
  const confirmed=document.getElementById('voiceBatchConfirm').checked;
  if(!confirmed){showToast('Cần xác nhận trước khi tạo audio hàng loạt.');return;}
  if(voiceDailyQuotaBlocked){showToast('Gemini TTS đã hết quota Free Tier theo ngày. Batch không được chạy.');return;}
  if(!voiceAvailability.gemini){showToast('Gemini TTS chưa sẵn sàng.');return;}

  const targets=getVoiceBatchCandidates(scope);
  if(!targets.length){showToast('Không có scene cần tạo audio.');return;}

  const progress=document.getElementById('voiceBatchProgress');
  const label=document.getElementById('voiceBatchProgressLabel');
  const value=document.getElementById('voiceBatchProgressValue');
  const bar=document.getElementById('voiceBatchBar');
  const results=document.getElementById('voiceBatchResults');
  progress.classList.remove('hidden');
  results.innerHTML='';
  button.disabled=true;

  let success=0;
  let failed=0;
  const minBatchGapSeconds=21;

  let stoppedByDailyQuota=false;

  for(let i=0;i<targets.length;i++){
    if(voiceDailyQuotaBlocked){
      stoppedByDailyQuota=true;
      break;
    }
    if(i>0){
      await waitWithCountdown(minBatchGapSeconds,remaining=>{
        label.textContent='Đợi quota Gemini · scene tiếp theo sau '+remaining+' giây';
      });
    }
    const scene=targets[i];
    label.textContent='Scene '+(i+1)+'/'+targets.length+' · '+(scene.title||scene.id);
    const pct=Math.round((i/targets.length)*100);
    value.textContent=pct+'%';
    bar.style.width=pct+'%';

    const resultRow=document.createElement('div');
    resultRow.className='voice-batch-result running';
    const resultName=document.createElement('strong');
    resultName.textContent=String(scene.order||i+1).padStart(2,'0')+' · '+(scene.title||scene.id);
    const resultState=document.createElement('span');
    resultState.textContent='Đang tạo...';
    resultRow.append(resultName,resultState);
    results.appendChild(resultRow);

    const card=findSceneCard(scene.id);
    const sceneButton=card?.querySelector('.scene-voice-btn');
    if(!card || !sceneButton){
      failed+=1;
      resultRow.className='voice-batch-result fail';
      resultState.textContent='FAIL · thiếu scene UI';
      continue;
    }

    const ok=await generateSceneVoice(scene,card,sceneButton,{silent:true});
    if(ok){
      const saved=await saveProjectNow({silent:true});
      if(saved?.ok){
        success+=1;
        resultRow.className='voice-batch-result pass';
        resultState.textContent='PASS · ĐÃ LƯU';
      }else{
        failed+=1;
        resultRow.className='voice-batch-result fail';
        resultState.textContent='AUDIO OK · LƯU FAIL';
      }
    }else{
      failed+=1;
      resultRow.className='voice-batch-result fail';
      if(voiceDailyQuotaBlocked){
        resultState.textContent='DỪNG · HẾT QUOTA NGÀY';
        stoppedByDailyQuota=true;
      }else{
        resultState.textContent='TTS FAIL';
      }
    }

    renderVoiceWorkspace();
    renderAssetLibrary();
    const donePct=Math.round(((i+1)/targets.length)*100);
    value.textContent=donePct+'%';
    bar.style.width=donePct+'%';
    if(stoppedByDailyQuota) break;
  }

  label.textContent=stoppedByDailyQuota
    ? 'Đã dừng batch: Gemini TTS hết quota Free Tier theo ngày'
    : ('Hoàn tất: '+success+' thành công'+(failed?' · '+failed+' lỗi':''));
  document.getElementById('voiceBatchConfirm').checked=false;
  renderVoiceWorkspace();
  renderAssetLibrary();
  const finalSave=await saveProjectNow({silent:true});
  showToast(
    stoppedByDailyQuota
      ? ('Đã dừng batch vì hết quota TTS theo ngày. '+success+' scene đã hoàn tất trước khi dừng.')
      : ((scope==='test2'?'Kiểm thử batch':'Tạo audio hàng loạt')+
        ' hoàn tất: '+success+' scene'+(failed?', '+failed+' lỗi':'')+
        (finalSave?.ok?' · dữ liệu đã xác minh lưu.':' · CẢNH BÁO: lưu dự án thất bại.'))
  );
}


let assetLibraryFilter='all';

function downloadBase64Asset(base64,mime,filename){
  if(!base64){showToast('Asset chưa có dữ liệu để tải.');return;}
  try{
    const bytes=atob(base64);
    const buffer=new Uint8Array(bytes.length);
    for(let i=0;i<bytes.length;i++) buffer[i]=bytes.charCodeAt(i);
    const blob=new Blob([buffer],{type:mime||'application/octet-stream'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=filename;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch{
    showToast('Không thể tải asset này.');
  }
}

function findSceneCard(sceneId){
  return Array.from(sceneList.querySelectorAll('.scene-card'))
    .find(card=>card.dataset.sceneId===sceneId)||null;
}

function goToScene(sceneId){
  const card=findSceneCard(sceneId);
  if(!card){showToast('Không tìm thấy scene trên giao diện.');return;}
  card.scrollIntoView({behavior:'smooth',block:'center'});
  card.animate(
    [{boxShadow:'0 0 0 0 rgba(49,87,213,0)'},{boxShadow:'0 0 0 4px rgba(49,87,213,.18)'},{boxShadow:'0 0 0 0 rgba(49,87,213,0)'}],
    {duration:1200}
  );
}

function triggerSceneAsset(sceneId,type){
  const card=findSceneCard(sceneId);
  if(!card){showToast('Không tìm thấy scene để tạo asset.');return;}
  const button=card.querySelector(type==='image'?'.scene-image-btn':'.scene-voice-btn');
  if(button) button.click();
}

function clearSceneAsset(scene,type){
  if(type==='image'){
    scene.image_asset=null;
    scene.material_key='';
  }else{
    scene.audio_asset=null;
    scene.audio_duration_seconds=null;
  }
  renderScenes(currentScenes,{providerLabel:'Đã cập nhật'});
  renderAssetLibrary();
  updateRenderReadiness();
  scheduleAutosave();
  showToast(type==='image'?'Đã xóa ảnh của scene.':'Đã xóa audio của scene.');
}

function assetMatchesFilter(scene){
  const hasImage=Boolean(scene.image_asset?.b64_json);
  const hasAudio=Boolean(scene.audio_asset?.b64_audio);
  if(assetLibraryFilter==='image') return hasImage;
  if(assetLibraryFilter==='audio') return hasAudio;
  if(assetLibraryFilter==='missing') return !hasImage || !hasAudio;
  return true;
}

function renderAssetLibrary(){
  const grid=document.getElementById('assetLibraryGrid');
  const empty=document.getElementById('assetLibraryEmpty');
  if(!grid || !empty) return;

  const imageCount=currentScenes.filter(scene=>scene.image_asset?.b64_json).length;
  const audioCount=currentScenes.filter(scene=>scene.audio_asset?.b64_audio).length;
  document.getElementById('assetSceneCount').textContent=String(currentScenes.length);
  document.getElementById('assetImageCount').textContent=String(imageCount);
  document.getElementById('assetAudioCount').textContent=String(audioCount);
  document.getElementById('assetSubtitleState').textContent=currentSrt?'SRT':'—';

  grid.innerHTML='';
  const scenes=currentScenes.filter(assetMatchesFilter);
  if(!currentScenes.length || !scenes.length){
    empty.classList.remove('hidden');
    grid.classList.add('hidden');
    const strong=empty.querySelector('strong');
    const p=empty.querySelector('p');
    if(currentScenes.length && !scenes.length){
      strong.textContent='Không có asset phù hợp bộ lọc';
      p.textContent='Hãy chọn bộ lọc khác hoặc tạo thêm asset cho scene.';
    }else{
      strong.textContent='Thư viện đang trống';
      p.textContent='Sau khi chia cảnh, các scene và asset sẽ xuất hiện tại đây.';
    }
    return;
  }

  empty.classList.add('hidden');
  grid.classList.remove('hidden');

  scenes.forEach(scene=>{
    const hasImage=Boolean(scene.image_asset?.b64_json);
    const hasAudio=Boolean(scene.audio_asset?.b64_audio);
    const card=document.createElement('article');
    card.className='asset-card';

    const head=document.createElement('div');
    head.className='asset-card-head';
    const title=document.createElement('div');
    title.className='asset-card-title';
    title.innerHTML='<span>'+String(scene.order||0).padStart(2,'0')+'</span><div><strong></strong><small></small></div>';
    title.querySelector('strong').textContent=scene.title||scene.id;
    title.querySelector('small').textContent=(scene.duration_seconds||0)+' giây · '+scene.id;

    const state=document.createElement('div');
    state.className='asset-state';
    const imageBadge=document.createElement('span');
    imageBadge.textContent=hasImage?'Ảnh ✓':'Thiếu ảnh';
    imageBadge.className=hasImage?'ready':'';
    const audioBadge=document.createElement('span');
    audioBadge.textContent=hasAudio?'Audio ✓':'Thiếu audio';
    audioBadge.className=hasAudio?'ready':'';
    state.append(imageBadge,audioBadge);
    head.append(title,state);

    const body=document.createElement('div');
    body.className='asset-card-body';
    const preview=document.createElement('div');
    preview.className='asset-preview';
    if(hasImage){
      const img=document.createElement('img');
      img.alt='Ảnh '+(scene.title||scene.id);
      img.src='data:'+(scene.image_asset.mime_type||'image/jpeg')+';base64,'+scene.image_asset.b64_json;
      preview.appendChild(img);
    }else{
      const placeholder=document.createElement('div');
      placeholder.className='asset-preview-placeholder';
      placeholder.textContent='Chưa có ảnh cho scene này';
      preview.appendChild(placeholder);
    }

    const details=document.createElement('div');
    details.className='asset-details';
    const narration=document.createElement('p');
    narration.textContent=scene.narration||'';
    details.appendChild(narration);

    if(hasAudio){
      const audio=document.createElement('audio');
      audio.controls=true;
      audio.preload='metadata';
      audio.src='data:'+(scene.audio_asset.mime_type||'audio/wav')+';base64,'+scene.audio_asset.b64_audio;
      details.appendChild(audio);
    }

    const actions=document.createElement('div');
    actions.className='asset-actions';

    const goBtn=document.createElement('button');
    goBtn.textContent='Mở scene';
    goBtn.addEventListener('click',()=>goToScene(scene.id));
    actions.appendChild(goBtn);

    const imageBtn=document.createElement('button');
    imageBtn.className='primary-action';
    imageBtn.textContent=hasImage?'Tạo lại ảnh':'Tạo ảnh';
    imageBtn.addEventListener('click',()=>triggerSceneAsset(scene.id,'image'));
    actions.appendChild(imageBtn);

    const voiceBtn=document.createElement('button');
    voiceBtn.className='primary-action';
    voiceBtn.textContent=hasAudio?'Tạo lại audio':'Tạo audio';
    voiceBtn.addEventListener('click',()=>triggerSceneAsset(scene.id,'audio'));
    actions.appendChild(voiceBtn);

    if(hasImage){
      const downloadImage=document.createElement('button');
      downloadImage.textContent='Tải ảnh';
      downloadImage.addEventListener('click',()=>downloadBase64Asset(
        scene.image_asset.b64_json,
        scene.image_asset.mime_type||'image/jpeg',
        (scene.id||'scene')+(String(scene.image_asset.mime_type||'').includes('jpeg')?'.jpg':'.png')
      ));
      actions.appendChild(downloadImage);

      const clearImage=document.createElement('button');
      clearImage.className='danger';
      clearImage.textContent='Xóa ảnh';
      clearImage.addEventListener('click',()=>clearSceneAsset(scene,'image'));
      actions.appendChild(clearImage);
    }

    if(hasAudio){
      const downloadAudio=document.createElement('button');
      downloadAudio.textContent='Tải audio';
      downloadAudio.addEventListener('click',()=>downloadBase64Asset(
        scene.audio_asset.b64_audio,
        scene.audio_asset.mime_type||'audio/wav',
        (scene.id||'scene')+'.wav'
      ));
      actions.appendChild(downloadAudio);

      const clearAudio=document.createElement('button');
      clearAudio.className='danger';
      clearAudio.textContent='Xóa audio';
      clearAudio.addEventListener('click',()=>clearSceneAsset(scene,'audio'));
      actions.appendChild(clearAudio);
    }

    details.appendChild(actions);
    body.append(preview,details);
    card.append(head,body);
    grid.appendChild(card);
  });
}

function setSystemCard(name,configured,fields={}){
  const card=document.querySelector('.system-card[data-system="'+name+'"]');
  if(!card) return;
  card.classList.remove('ready','warn');
  card.classList.add(configured?'ready':'warn');
  const badge=card.querySelector('.system-badge');
  badge.textContent=configured?'READY':'CHƯA CẤU HÌNH';
  Object.entries(fields).forEach(([key,value])=>{
    const target=card.querySelector('[data-field="'+key+'"]');
    if(target) target.textContent=value||'—';
  });
}

async function refreshSystemStatus(){
  const button=document.getElementById('refreshSystemStatusBtn');
  if(button){button.disabled=true;button.textContent='Đang kiểm tra...';}
  try{
    const res=await fetch('/api/system-status',{headers:{accept:'application/json'}});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('HTTP '+res.status));
    setSystemCard('gemini',Boolean(data.providers?.gemini?.configured),{
      scriptModel:data.providers?.gemini?.scriptModel,
      imageModel:data.providers?.gemini?.imageModel,
      ttsModel:data.providers?.gemini?.ttsModel
    });
    setSystemCard('openai',Boolean(data.providers?.openai?.configured),{
      scriptModel:data.providers?.openai?.scriptModel,
      imageModel:data.providers?.openai?.imageModel
    });
    setSystemCard('render',Boolean(data.providers?.render?.configured));
  }catch(err){
    ['gemini','openai','render'].forEach(name=>setSystemCard(name,false));
    showToast('Không đọc được trạng thái hệ thống: '+(err?.message||'lỗi kết nối'));
  }finally{
    if(button){button.disabled=false;button.textContent='Kiểm tra lại';}
  }
}

const PROJECT_DB_NAME='ktn-ai-video-studio';
const PROJECT_DB_VERSION=2;
const PROJECT_STORE='projects';
const PROJECT_ASSET_STORE='assets';
const CURRENT_PROJECT_ID='current-draft';
let autosaveTimer=null;
let restoringProject=false;

function openProjectDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(PROJECT_DB_NAME,PROJECT_DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(PROJECT_STORE)){
        db.createObjectStore(PROJECT_STORE,{keyPath:'id'});
      }
      if(!db.objectStoreNames.contains(PROJECT_ASSET_STORE)){
        db.createObjectStore(PROJECT_ASSET_STORE,{keyPath:'id'});
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Không mở được bộ nhớ dự án.'));
  });
}

function assetRecordId(sceneId,type){
  return CURRENT_PROJECT_ID+':'+String(sceneId)+':'+type;
}

async function dbPutAsset(record){
  const db=await openProjectDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PROJECT_ASSET_STORE,'readwrite');
    tx.objectStore(PROJECT_ASSET_STORE).put(record);
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{const err=tx.error;db.close();reject(err);};
    tx.onabort=()=>{const err=tx.error;db.close();reject(err||new Error('Ghi asset bị hủy.'));};
  });
}

async function dbGetAsset(id){
  const db=await openProjectDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PROJECT_ASSET_STORE,'readonly');
    const req=tx.objectStore(PROJECT_ASSET_STORE).get(id);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();
    tx.onabort=()=>{const err=tx.error;db.close();reject(err||new Error('Đọc asset bị hủy.'));};
  });
}

async function dbDeleteAsset(id){
  const db=await openProjectDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PROJECT_ASSET_STORE,'readwrite');
    tx.objectStore(PROJECT_ASSET_STORE).delete(id);
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{const err=tx.error;db.close();reject(err);};
    tx.onabort=()=>{const err=tx.error;db.close();reject(err||new Error('Xóa asset bị hủy.'));};
  });
}

function stripAssetPayload(asset,type,sceneId){
  if(!asset) return null;
  const payloadKey=type==='image'?'b64_json':'b64_audio';
  const assetRef=assetRecordId(sceneId,type);
  const meta={...asset,asset_ref:assetRef};
  delete meta[payloadKey];
  return meta;
}

async function persistProjectBundle(project){
  const manifest={
    ...project,
    scenes:project.scenes.map(scene=>({
      ...scene,
      image_asset:stripAssetPayload(scene.image_asset,'image',scene.id),
      audio_asset:stripAssetPayload(scene.audio_asset,'audio',scene.id)
    }))
  };

  for(const scene of project.scenes){
    const imageId=assetRecordId(scene.id,'image');
    const audioId=assetRecordId(scene.id,'audio');

    if(scene.image_asset?.b64_json){
      await dbPutAsset({
        id:imageId,
        project_id:CURRENT_PROJECT_ID,
        scene_id:scene.id,
        type:'image',
        payload:scene.image_asset,
        updated_at:new Date().toISOString()
      });
    }else{
      await dbDeleteAsset(imageId).catch(()=>{});
    }

    if(scene.audio_asset?.b64_audio){
      await dbPutAsset({
        id:audioId,
        project_id:CURRENT_PROJECT_ID,
        scene_id:scene.id,
        type:'audio',
        payload:scene.audio_asset,
        updated_at:new Date().toISOString()
      });
    }else{
      await dbDeleteAsset(audioId).catch(()=>{});
    }
  }

  await dbPutProject(manifest);
  return manifest;
}

async function hydrateProjectAssets(project){
  if(!project || !Array.isArray(project.scenes)) return project;
  const hydratedScenes=[];

  for(const scene of project.scenes){
    const hydrated={...scene};

    if(scene.image_asset?.asset_ref && !scene.image_asset?.b64_json){
      const record=await dbGetAsset(scene.image_asset.asset_ref).catch(()=>null);
      if(record?.payload) hydrated.image_asset={...scene.image_asset,...record.payload};
    }

    if(scene.audio_asset?.asset_ref && !scene.audio_asset?.b64_audio){
      const record=await dbGetAsset(scene.audio_asset.asset_ref).catch(()=>null);
      if(record?.payload) hydrated.audio_asset={...scene.audio_asset,...record.payload};
    }

    hydratedScenes.push(hydrated);
  }

  return {...project,scenes:hydratedScenes};
}

function projectPersistenceStats(project){
  const scenes=Array.isArray(project?.scenes)?project.scenes:[];
  return {
    scenes:scenes.length,
    images:scenes.filter(scene=>scene.image_asset?.b64_json).length,
    audio:scenes.filter(scene=>scene.audio_asset?.b64_audio).length
  };
}

async function dbPutProject(project){
  const db=await openProjectDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PROJECT_STORE,'readwrite');
    tx.objectStore(PROJECT_STORE).put(project);
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{const err=tx.error;db.close();reject(err);};
    tx.onabort=()=>{const err=tx.error;db.close();reject(err||new Error('Ghi dự án bị hủy.'));};
  });
}

async function dbGetProject(id=CURRENT_PROJECT_ID){
  const db=await openProjectDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PROJECT_STORE,'readonly');
    const req=tx.objectStore(PROJECT_STORE).get(id);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();
  });
}

async function dbDeleteProject(id=CURRENT_PROJECT_ID){
  const db=await openProjectDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([PROJECT_STORE,PROJECT_ASSET_STORE],'readwrite');
    tx.objectStore(PROJECT_STORE).delete(id);
    const assetStore=tx.objectStore(PROJECT_ASSET_STORE);
    const cursorReq=assetStore.openCursor();
    cursorReq.onsuccess=()=>{
      const cursor=cursorReq.result;
      if(!cursor) return;
      if(String(cursor.key).startsWith(id+':')) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{const err=tx.error;db.close();reject(err);};
    tx.onabort=()=>{const err=tx.error;db.close();reject(err||new Error('Xóa dự án bị hủy.'));};
  });
}

function serializeProjectState({includeMaterialKeys=false}={}){
  return {
    schema_version:'ktn-ai-video-project-v1',
    id:CURRENT_PROJECT_ID,
    name:document.getElementById('projectName').value.trim()||'Dự án chưa đặt tên',
    updated_at:new Date().toISOString(),
    inputs:{
      topic:document.getElementById('topic').value,
      scriptLanguage:document.getElementById('scriptLanguage').value,
      scriptProvider:document.getElementById('scriptProvider').value,
      paragraphCount:Number(document.getElementById('paragraphCount').value||6),
      targetDuration:document.getElementById('targetDuration').value,
      extraInstruction:document.getElementById('extraInstruction').value
    },
    script:{
      title:scriptTitle.textContent||'Kịch bản AI',
      text:scriptResult.value||'',
      meta:scriptMeta.textContent||''
    },
    scenes:currentScenes.map(scene=>({
      id:scene.id,
      order:scene.order,
      title:scene.title,
      narration:scene.narration,
      duration_seconds:scene.duration_seconds,
      audio_duration_seconds:scene.audio_duration_seconds||null,
      visual_description:scene.visual_description,
      image_prompt:scene.image_prompt,
      image_asset:scene.image_asset||null,
      audio_asset:scene.audio_asset||null,
      material_key:includeMaterialKeys?(scene.material_key||null):null
    })),
    subtitles:{
      srt:currentSrt||'',
      maxChars:Number(document.getElementById('subtitleMaxChars').value||42),
      gap:Number(document.getElementById('subtitleGap').value||0.15)
    },
    settings:{
      voiceName:document.getElementById('voiceName').value,
      imageProvider:document.getElementById('imageProvider').value,
      renderAspect:document.getElementById('renderAspect').value,
      renderTransition:document.getElementById('renderTransition').value
    }
  };
}

function setAutosaveStatus(text,state=''){
  const el=document.getElementById('autosaveStatus');
  el.textContent=text;
  el.dataset.state=state;
}

async function saveProjectNow({silent=false}={}){
  if(restoringProject) return {ok:false,reason:'restoring'};
  try{
    setAutosaveStatus('Đang lưu...','saving');
    const project=serializeProjectState();
    const expected=projectPersistenceStats(project);
    await persistProjectBundle(project);

    const storedManifest=await dbGetProject();
    const stored=await hydrateProjectAssets(storedManifest);
    const actual=projectPersistenceStats(stored);

    if(
      actual.scenes!==expected.scenes ||
      actual.images!==expected.images ||
      actual.audio!==expected.audio
    ){
      throw new Error(
        'Xác minh lưu thất bại: cần '+expected.scenes+' scene / '+expected.images+' ảnh / '+expected.audio+
        ' audio nhưng đọc lại được '+actual.scenes+' scene / '+actual.images+' ảnh / '+actual.audio+' audio.'
      );
    }

    setAutosaveStatus(
      'Đã lưu · '+actual.scenes+' scene · '+actual.images+' ảnh · '+actual.audio+' audio',
      'saved'
    );
    if(!silent) showToast('Đã lưu và xác minh bản nháp trên trình duyệt.');
    return {ok:true,stats:actual};
  }catch(err){
    console.error('project_persistence_failed',{
      name:err?.name,
      message:err?.message
    });
    setAutosaveStatus('Lưu thất bại · '+(err?.name||'storage error'),'error');
    showToast('Không thể lưu dự án: '+(err?.message||'lỗi bộ nhớ trình duyệt'));
    return {ok:false,error:err};
  }
}

function scheduleAutosave(){
  if(restoringProject) return;
  clearTimeout(autosaveTimer);
  setAutosaveStatus('Có thay đổi chưa lưu','dirty');
  autosaveTimer=setTimeout(()=>saveProjectNow({silent:true}),800);
}

function restoreInput(id,value){
  const el=document.getElementById(id);
  if(!el || value===undefined || value===null) return;
  el.value=String(value);
}

async function restoreProject(project){
  if(!project || project.schema_version!=='ktn-ai-video-project-v1') return false;
  restoringProject=true;
  try{
    restoreInput('projectName',project.name||'Dự án chưa đặt tên');
    restoreInput('topic',project.inputs?.topic||'');
    restoreInput('scriptLanguage',project.inputs?.scriptLanguage||'vi');
    restoreInput('scriptProvider',project.inputs?.scriptProvider||'gemini');
    restoreInput('paragraphCount',project.inputs?.paragraphCount||6);
    restoreInput('targetDuration',project.inputs?.targetDuration||'60-90s');
    restoreInput('extraInstruction',project.inputs?.extraInstruction||'');

    scriptTitle.textContent=project.script?.title||'Kịch bản AI';
    scriptResult.value=project.script?.text||'';
    scriptMeta.textContent=project.script?.meta||'Đã khôi phục · bản nháp';

    currentScenes=Array.isArray(project.scenes)
      ? project.scenes.map(scene=>({...scene,material_key:''}))
      : [];
    currentSrt=String(project.subtitles?.srt||'');

    restoreInput('subtitleMaxChars',project.subtitles?.maxChars||42);
    restoreInput('subtitleGap',project.subtitles?.gap??0.15);
    restoreInput('voiceName',project.settings?.voiceName||'Kore');
    restoreInput('voiceWorkspaceVoice',project.settings?.voiceName||'Kore');
    restoreInput('imageProvider',project.settings?.imageProvider||'gemini');
    restoreInput('renderAspect',project.settings?.renderAspect||'16:9');
    restoreInput('renderTransition',project.settings?.renderTransition||'');

    if(scriptResult.value.trim()){
      scriptEmpty.classList.add('hidden');
      scriptDemo.classList.remove('hidden');
      selectScriptTab('script');
    }else{
      scriptEmpty.classList.remove('hidden');
      scriptDemo.classList.add('hidden');
    }

    if(currentScenes.length){
      renderScenes(currentScenes,{providerLabel:'Đã khôi phục'});
    }else{
      sceneList.innerHTML='';
      sceneList.classList.add('hidden');
      sceneEmpty.classList.remove('hidden');
    }

    if(currentSrt){
      subtitlePreview.textContent=currentSrt;
      subtitleMeta.textContent='Đã khôi phục SRT';
      subtitleEmpty.classList.add('hidden');
      subtitleOutput.classList.remove('hidden');
    }else{
      subtitleEmpty.classList.remove('hidden');
      subtitleOutput.classList.add('hidden');
    }

    activateScriptTools();
    updateRenderReadiness();
    updateImageProviderState();
    updateVoiceProviderState();
    renderAssetLibrary();
    renderVoiceWorkspace();
    setAutosaveStatus('Đã khôi phục bản nháp','saved');
    return true;
  }finally{
    restoringProject=false;
  }
}

async function loadAutosavedProject(){
  try{
    const manifest=await dbGetProject();
    if(manifest){
      const project=await hydrateProjectAssets(manifest);
      await restoreProject(project);
      showToast('Đã khôi phục bản nháp gần nhất.');
    }else{
      setAutosaveStatus('Chưa có bản nháp','');
    }
  }catch(err){
    setAutosaveStatus('Không đọc được bản nháp','error');
  }
}

async function startNewProject(){
  const hasWork=Boolean(scriptResult.value.trim() || currentScenes.length || document.getElementById('topic').value.trim());
  if(hasWork && !confirm('Tạo dự án mới? Bản nháp hiện tại sẽ bị xóa khỏi trình duyệt.')){
    return;
  }
  await dbDeleteProject().catch(()=>{});
  restoringProject=true;
  try{
    document.getElementById('projectName').value='Dự án chưa đặt tên';
    document.getElementById('topic').value='';
    document.getElementById('scriptLanguage').value='vi';
    document.getElementById('scriptProvider').value='gemini';
    document.getElementById('paragraphCount').value='6';
    document.getElementById('targetDuration').value='60-90s';
    document.getElementById('extraInstruction').value='';
    document.getElementById('imageProvider').value='ktn';
    scriptResult.value='';
    scriptTitle.textContent='Kịch bản AI';
    scriptMeta.textContent='Đã tạo · bản nháp';
    currentScenes=[];
    currentSrt='';
    currentSrt='';
    keywordList.innerHTML='';
    sceneList.innerHTML='';
    sceneList.classList.add('hidden');
    sceneEmpty.classList.remove('hidden');
    subtitlePreview.textContent='';
    subtitleOutput.classList.add('hidden');
    subtitleEmpty.classList.remove('hidden');
    scriptDemo.classList.add('hidden');
    scriptEmpty.classList.remove('hidden');
    selectScriptTab('script');
    activateScriptTools();
    updateRenderReadiness();
    renderAssetLibrary();
    renderVoiceWorkspace();
    setAutosaveStatus('Dự án mới','');
  }finally{
    restoringProject=false;
  }
  showToast('Đã tạo dự án mới.');
}

function exportProject(){
  const project=serializeProjectState({includeMaterialKeys:false});
  const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const safe=(project.name||'ktn-ai-video-project').replace(/[^a-zA-Z0-9À-ỹ_-]+/g,'-').replace(/^-+|-+$/g,'')||'ktn-ai-video-project';
  a.href=url;
  a.download=safe+'.json';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  showToast('Đã xuất file dự án JSON.');
}

async function importProjectFile(file){
  if(!file) return;
  try{
    const text=await file.text();
    const project=JSON.parse(text);
    if(project?.schema_version!=='ktn-ai-video-project-v1'){
      throw new Error('File không đúng định dạng dự án KTN AI Video Studio V1.');
    }
    await restoreProject(project);
    await saveProjectNow({silent:true});
    showToast('Đã nhập và khôi phục dự án.');
  }catch(err){
    showToast('Không thể nhập dự án: '+(err?.message||'file không hợp lệ'));
  }finally{
    document.getElementById('importProjectInput').value='';
  }
}

async function checkPersistenceHealth(){
  const text=document.getElementById('persistenceDiagnosticText');
  const button=document.getElementById('checkPersistenceBtn');
  if(button){button.disabled=true;button.textContent='Đang kiểm tra...';}
  try{
    const saved=await saveProjectNow({silent:true});
    const estimate=await navigator.storage?.estimate?.();
    const used=Number(estimate?.usage||0);
    const quota=Number(estimate?.quota||0);
    const usageText=quota
      ? ' · '+(used/1048576).toFixed(1)+'/'+(quota/1048576).toFixed(0)+' MB'
      : '';
    if(saved?.ok){
      text.textContent='PASS · '+saved.stats.scenes+' scene · '+saved.stats.audio+' audio'+usageText;
      text.style.color='#198754';
    }else{
      text.textContent='FAIL · không xác minh được IndexedDB'+usageText;
      text.style.color='#a23b3b';
    }
  }catch(err){
    text.textContent='FAIL · '+(err?.message||'lỗi bộ nhớ');
    text.style.color='#a23b3b';
  }finally{
    if(button){button.disabled=false;button.textContent='Kiểm tra lưu';}
  }
}

function bindAutosave(){
  [
    'projectName','topic','scriptLanguage','scriptProvider','paragraphCount',
    'targetDuration','extraInstruction','voiceName','imageProvider',
    'subtitleMaxChars','subtitleGap','renderAspect','renderTransition'
  ].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('input',scheduleAutosave);
    el.addEventListener('change',scheduleAutosave);
  });
  scriptResult.addEventListener('input',scheduleAutosave);
}

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
let providerAvailability={gemini:false,openai:false,ktn:false};
let imageProviderBlocked={gemini:false,openai:false,ktn:false};
let imageProviderBlockMessage={gemini:'',openai:'',ktn:''};
let voiceAvailability={gemini:false};
let voiceDailyQuotaBlocked=false;
let voiceDailyQuotaMessage='';

const showToast=(msg)=>{toast.textContent=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3200)};

async function refreshBackendStatus(){
  try{
    const [scriptRes,imageRes]=await Promise.all([
      fetch('/api/generate-script',{headers:{accept:'application/json'}}),
      fetch('/api/generate-image',{headers:{accept:'application/json'}})
    ]);
    const scriptData=await scriptRes.json().catch(()=>({}));
    const imageData=await imageRes.json().catch(()=>({}));
    providerAvailability={
      gemini:Boolean(scriptData.providers?.gemini || imageData.providers?.gemini),
      openai:Boolean(scriptData.providers?.openai || imageData.providers?.openai),
      ktn:Boolean(imageData.providers?.ktn)
    };
    const configured=[];
    if(providerAvailability.gemini) configured.push('Gemini');
    if(providerAvailability.openai) configured.push('OpenAI');
    if(providerAvailability.ktn) configured.push('KTN FLUX');

    const imageProvider=document.getElementById('imageProvider');
    if(imageProvider && !providerAvailability[imageProvider.value] && providerAvailability.ktn){
      imageProvider.value='ktn';
    }
    updateImageProviderState();
    if(configured.length){
      backendStatus.textContent='AI sẵn sàng · '+configured.join(' / ');
      backendStatus.className='preview-badge ready';
    }else{
      backendStatus.textContent='Chưa cấu hình provider';
      backendStatus.className='preview-badge warn';
    }
    voiceAvailability.gemini=Boolean(scriptData.providers?.gemini);
    updateVoiceProviderState();
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
  if(state){
    state.textContent=voiceAvailability.gemini?'Sẵn sàng':'Thiếu API key';
    state.style.color=voiceAvailability.gemini?'#198754':'#9b6b16';
  }
  renderVoiceWorkspace();
}

function markImageProviderBlocked(provider,message){
  imageProviderBlocked[provider]=true;
  imageProviderBlockMessage[provider]=String(message||'Nhà cung cấp ảnh hiện không khả dụng.');
  updateImageProviderState();
  document.querySelectorAll('.scene-image-btn').forEach(btn=>{
    if((document.getElementById('imageProvider')?.value||'gemini')===provider){
      btn.disabled=true;
      btn.textContent='Hết quota ảnh';
    }
  });
}

function resetImageProviderButtons(){
  const provider=document.getElementById('imageProvider')?.value||'ktn';
  const unavailable=!providerAvailability[provider];
  document.querySelectorAll('.scene-image-btn').forEach(btn=>{
    if(imageProviderBlocked[provider]){
      btn.disabled=true;
      btn.textContent='Hết quota ảnh';
    }else if(unavailable){
      btn.disabled=true;
      btn.textContent=provider==='ktn'?'Chưa nối worker':'Thiếu API key';
    }else{
      btn.disabled=false;
      if(['Hết quota ảnh','Chưa nối worker','Thiếu API key'].includes(btn.textContent)){
        btn.textContent='Tạo ảnh';
      }
    }
  });
}

function updateImageProviderState(){
  const provider=document.getElementById('imageProvider')?.value||'gemini';
  const state=document.getElementById('imageProviderState');
  const notice=document.getElementById('imageQuotaNotice');
  if(state){
    if(imageProviderBlocked[provider]){
      state.textContent='Hết quota / không khả dụng';
      state.style.color='#a23b3b';
    }else{
      state.textContent=providerAvailability[provider]
        ? 'Sẵn sàng'
        : (provider==='ktn'?'Chưa nối worker':'Thiếu API key');
      state.style.color=providerAvailability[provider]?'#198754':'#9b6b16';
    }
  }
  if(notice){
    const show=provider==='gemini' && imageProviderBlocked.gemini;
    notice.classList.toggle('hidden',!show);
    if(show){
      const detail=notice.querySelector('span');
      if(detail) detail.textContent=imageProviderBlockMessage.gemini+
        ' Hệ thống đã khóa tạo ảnh bằng Gemini trong phiên này.';
    }
  }
  resetImageProviderButtons();
}

async function generateSceneVoice(scene,card,button,{silent=false}={}){
  const text=String(scene.narration||'').trim();
  const voice=document.getElementById('voiceName').value||'Kore';
  const audioBox=card.querySelector('.scene-audio');
  const status=audioBox.querySelector('.scene-audio-status');
  if(!text){
    if(!silent) showToast('Scene này chưa có lời đọc.');
    return false;
  }
  if(voiceDailyQuotaBlocked){
    status.textContent='Đã hết quota Gemini TTS Free Tier theo ngày.';
    if(!silent) showToast('Gemini TTS đã hết quota theo ngày. Không gửi thêm request.');
    return false;
  }

  button.disabled=true;
  button.textContent='Đang tạo giọng...';
  audioBox.classList.remove('hidden');
  status.textContent='Gemini đang tạo giọng cho scene '+String(scene.order).padStart(2,'0')+'...';

  try{
    const data=await requestVoiceWithRetry({
      provider:'gemini',
      text,
      voice,
      languageCode:'vi-VN',
      sceneId:scene.id
    },info=>{
      if(info.remaining){
        status.textContent='Gemini giới hạn request · đợi '+info.remaining+' giây...';
      }else{
        status.textContent='Gemini đang bận · chuẩn bị thử lại...';
      }
    });

    const oldAudio=audioBox.querySelector('audio');
    if(oldAudio) oldAudio.remove();

    const audio=document.createElement('audio');
    audio.controls=true;
    audio.preload='metadata';
    audio.src='data:'+(data.mime_type||'audio/wav')+';base64,'+data.b64_audio;
    scene.audio_asset={
      b64_audio:data.b64_audio,
      mime_type:data.mime_type||'audio/wav',
      provider:data.provider||'gemini',
      providerLabel:data.providerLabel||'Gemini TTS',
      model:data.model||'',
      voice:data.voice||voice,
      duration_seconds:Number(data.duration_seconds)||null
    };
    const actualDuration=Number(data.duration_seconds);
    if(Number.isFinite(actualDuration) && actualDuration>0){
      scene.audio_duration_seconds=actualDuration;
      const durationBadge=card.querySelector('.scene-duration');
      if(durationBadge) durationBadge.textContent=actualDuration.toFixed(1)+' giây · audio';
    }
    status.textContent=(data.voice||voice)+' · '+(data.providerLabel||'Gemini TTS');
    audioBox.appendChild(audio);
    button.textContent='Tạo lại giọng';
    renderAssetLibrary();
    renderVoiceWorkspace();
    scheduleAutosave();
    if(!silent) showToast('Đã tạo giọng cho '+(scene.title||scene.id)+'.');
    return true;
  }catch(err){
    audioBox.classList.remove('hidden');
    status.textContent=err.message||'Không thể tạo giọng.';
    button.textContent='Thử lại giọng';
    if(!silent) showToast(err.message||'Không thể tạo giọng.');
    return false;
  }finally{
    button.disabled=voiceDailyQuotaBlocked;
    if(voiceDailyQuotaBlocked) button.textContent='Hết quota TTS';
  }
}

async function generateSceneImage(scene,card,button){
  const provider=document.getElementById('imageProvider').value;
  const imageBox=card.querySelector('.scene-image');
  const status=imageBox.querySelector('.scene-image-status');
  const prompt=String(scene.image_prompt||'').trim();
  if(!prompt){showToast('Scene này chưa có image prompt.');return;}
  if(!providerAvailability[provider]){
    showToast(provider==='ktn'?'KTN FLUX chưa nối Colab/GPU worker.':'Provider ảnh chưa cấu hình.');
    return;
  }
  if(imageProviderBlocked[provider]){
    showToast(imageProviderBlockMessage[provider]||'Nhà cung cấp ảnh hiện không khả dụng.');
    return;
  }

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
    const imageMime=data.mime_type||(provider==='gemini'?'image/jpeg':'image/png');
    img.src='data:'+imageMime+';base64,'+data.b64_json;
    scene.image_asset={
      b64_json:data.b64_json,
      mime_type:imageMime,
      provider:data.provider||provider,
      model:data.model||''
    };
    scene.material_key='';
    status.textContent='';
    imageBox.prepend(img);
    button.textContent='Tạo lại ảnh';
    updateRenderReadiness();
    renderAssetLibrary();

    const saved=await saveProjectNow({silent:true});
    if(!saved?.ok){
      throw new Error('Ảnh đã tạo nhưng lưu dự án chưa được xác minh. Không đánh dấu PASS.');
    }

    status.textContent='Đã lưu · '+(data.providerLabel||provider);
    showToast(
      'PASS · '+(scene.title||scene.id)+' · '+(data.providerLabel||provider)+
      ' · đã xác minh lưu '+saved.stats.images+' ảnh.'
    );
  }catch(err){
    imageBox.classList.remove('hidden');
    status.textContent=err.message||'Không thể tạo ảnh.';
    button.textContent='Thử lại';
    showToast(err.message||'Không thể tạo ảnh.');
  }finally{
    button.disabled=Boolean(imageProviderBlocked[provider]);
    if(imageProviderBlocked[provider]) button.textContent='Hết quota ảnh';
  }
}

function renderScenes(scenes,meta){
  currentScenes=scenes;
  sceneList.innerHTML='';
  scenes.forEach((scene,index)=>{
    const card=document.createElement('article');
    card.className='scene-card';
    card.dataset.sceneId=scene.id;

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

    if(scene.audio_asset?.b64_audio){
      const restoredAudio=document.createElement('audio');
      restoredAudio.controls=true;
      restoredAudio.preload='metadata';
      restoredAudio.src='data:'+(scene.audio_asset.mime_type||'audio/wav')+';base64,'+scene.audio_asset.b64_audio;
      audioStatus.textContent=(scene.audio_asset.voice||'Giọng đã lưu')+' · '+(scene.audio_asset.providerLabel||'Audio');
      audioBox.appendChild(restoredAudio);
      audioBox.classList.remove('hidden');
      voiceBtn.textContent='Tạo lại giọng';
    }

    const imageBox=document.createElement('div');
    imageBox.className='scene-image hidden';
    const imageStatus=document.createElement('div');
    imageStatus.className='scene-image-status';
    imageStatus.textContent='Chưa tạo ảnh';
    imageBox.appendChild(imageStatus);

    card.append(head,grid,audioBox,imageBox);
    voiceBtn.addEventListener('click',()=>generateSceneVoice(scene,card,voiceBtn));
    if(scene.image_asset?.b64_json){
      const restored=document.createElement('img');
      restored.alt='Ảnh '+(scene.title||scene.id);
      restored.src='data:'+(scene.image_asset.mime_type||'image/jpeg')+';base64,'+scene.image_asset.b64_json;
      imageStatus.textContent='';
      imageBox.prepend(restored);
      imageBox.classList.remove('hidden');
      imageBtn.textContent='Tạo lại ảnh';
    }
    imageBtn.addEventListener('click',()=>generateSceneImage(scene,card,imageBtn));
    const activeImageProvider=document.getElementById('imageProvider')?.value||'gemini';
    if(imageProviderBlocked[activeImageProvider]){
      imageBtn.disabled=true;
      imageBtn.textContent='Hết quota ảnh';
    }else if(!providerAvailability[activeImageProvider]){
      imageBtn.disabled=true;
      imageBtn.textContent=activeImageProvider==='ktn'?'Chưa nối worker':'Thiếu API key';
    }
    sceneList.appendChild(card);
  });
  sceneEmpty.classList.add('hidden');
  sceneList.classList.remove('hidden');
  subtitleBtn.disabled=scenes.length===0;
  subtitleEmpty.classList.remove('hidden');
  subtitleOutput.classList.add('hidden');
  currentSrt='';
  document.getElementById('sceneSection').scrollIntoView({behavior:'smooth',block:'start'});
  renderAssetLibrary();
  renderVoiceWorkspace();
  scheduleAutosave();
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
    if(btn.dataset.section==='voice'){
      renderVoiceWorkspace();
      document.getElementById('voiceSection').scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(btn.dataset.section==='settings'){
      document.getElementById('settingsSection').scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(btn.dataset.section==='library'){
      renderAssetLibrary();
      document.getElementById('librarySection').scrollIntoView({behavior:'smooth',block:'start'});
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
    scheduleAutosave();
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
    scheduleAutosave();
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
  renderAssetLibrary();
  scheduleAutosave();
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
document.getElementById('saveProjectBtn').addEventListener('click',()=>saveProjectNow());
document.getElementById('exportProjectBtn').addEventListener('click',exportProject);
document.getElementById('importProjectInput').addEventListener('change',e=>importProjectFile(e.target.files?.[0]));
document.getElementById('newProjectBtn').addEventListener('click',startNewProject);
document.getElementById('refreshSystemStatusBtn').addEventListener('click',refreshSystemStatus);
document.getElementById('checkPersistenceBtn').addEventListener('click',checkPersistenceHealth);
document.getElementById('refreshLibraryBtn').addEventListener('click',renderAssetLibrary);
document.querySelectorAll('[data-asset-filter]').forEach(button=>{
  button.addEventListener('click',()=>{
    assetLibraryFilter=button.dataset.assetFilter||'all';
    document.querySelectorAll('[data-asset-filter]').forEach(item=>item.classList.toggle('active',item===button));
    renderAssetLibrary();
  });
});
document.getElementById('imageProvider').addEventListener('change',async()=>{
  updateImageProviderState();
  await saveProjectNow({silent:true});
});
document.getElementById('voiceName').addEventListener('change',e=>syncVoiceSelectors(e.target));
document.getElementById('voiceWorkspaceVoice').addEventListener('change',e=>syncVoiceSelectors(e.target));
document.getElementById('voicePreviewBtn').addEventListener('click',previewVoice);
document.getElementById('voiceBatchConfirm').addEventListener('change',updateVoiceBatchButton);
document.getElementById('voiceBatchScope').addEventListener('change',updateVoiceBatchButton);
document.getElementById('voiceBatchBtn').addEventListener('click',runVoiceBatch);
document.getElementById('refreshVoiceWorkspaceBtn').addEventListener('click',renderVoiceWorkspace);
document.querySelectorAll('.quick-row button,.ghost,.icon-btn').forEach(btn=>btn.addEventListener('click',()=>showToast('Chức năng này sẽ được nối ở bước tương ứng.')));

activateScriptTools();
updateImageProviderState();
updateVoiceProviderState();
renderVoiceWorkspace();
updateRenderReadiness();
renderAssetLibrary();
bindAutosave();
refreshBackendStatus();
refreshRenderWorker();
refreshSystemStatus();
loadAutosavedProject();
