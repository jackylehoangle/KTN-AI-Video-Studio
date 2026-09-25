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

let currentScriptProvider='gemini';

const showToast=(msg)=>{toast.textContent=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3200)};

async function refreshBackendStatus(){
  try{
    const res=await fetch('/api/generate-script',{headers:{'accept':'application/json'}});
    const data=await res.json();
    const configured=[];
    if(data.providers?.gemini) configured.push('Gemini');
    if(data.providers?.openai) configured.push('OpenAI');
    if(configured.length){
      backendStatus.textContent='AI sẵn sàng · '+configured.join(' / ');
      backendStatus.className='preview-badge ready';
    }else{
      backendStatus.textContent='Chưa cấu hình API key';
      backendStatus.className='preview-badge warn';
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

function renderScenes(scenes,meta){
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

    const duration=document.createElement('span');
    duration.className='scene-duration';
    duration.textContent=(scene.duration_seconds||scene.duration_estimate_seconds||0)+' giây';
    head.append(idx,duration);

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

    card.append(head,grid);
    sceneList.appendChild(card);
  });
  sceneEmpty.classList.add('hidden');
  sceneList.classList.remove('hidden');
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
    sceneList.innerHTML='';
    sceneList.classList.add('hidden');
    sceneEmpty.classList.remove('hidden');
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
document.querySelectorAll('.quick-row button,.ghost,.icon-btn').forEach(btn=>btn.addEventListener('click',()=>showToast('Chức năng này sẽ được nối ở bước tương ứng.')));

activateScriptTools();
refreshBackendStatus();
