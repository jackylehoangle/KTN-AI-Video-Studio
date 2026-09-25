const toast=document.getElementById('toast');
const backendStatus=document.getElementById('backendStatus');
const generateBtn=document.getElementById('generateBtn');
const generateBtnText=document.getElementById('generateBtnText');
const scriptEmpty=document.getElementById('scriptEmpty');
const scriptDemo=document.getElementById('scriptDemo');
const scriptResult=document.getElementById('scriptResult');
const scriptMeta=document.getElementById('scriptMeta');
const scriptTitle=document.getElementById('scriptTitle');

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

document.querySelectorAll('.nav-item[data-section]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
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

    scriptEmpty.classList.add('hidden');
    scriptDemo.classList.remove('hidden');
    scriptTitle.textContent=topic;
    scriptResult.value=data.script||'';
    scriptMeta.textContent='Đã tạo · '+(data.providerLabel||provider)+' · '+(data.model||'AI')+' · bản nháp';
    backendStatus.textContent='AI sẵn sàng · '+(data.providerLabel||provider);
    backendStatus.className='preview-badge ready';
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
    showToast('Đã giữ bản chỉnh sửa trong phiên hiện tại.');
  }
});

document.getElementById('keywordBtn').addEventListener('click',()=>showToast('Chức năng từ khóa sẽ được xử lý ở UI-FUNC-02.'));
document.querySelectorAll('.quick-row button,.ghost,.icon-btn').forEach(btn=>btn.addEventListener('click',()=>showToast('Chức năng này sẽ được nối ở bước tương ứng.')));

refreshBackendStatus();
