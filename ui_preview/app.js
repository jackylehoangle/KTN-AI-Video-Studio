
const PLATFORM_PRESETS={
  youtube_long:{
    label:'YouTube Long',
    hint:'Video dài có cấu trúc, ưu tiên chiều sâu và khả năng giữ chân người xem.',
    defaultDuration:'8-12m',
    paragraphCount:10,
    durations:[
      ['3-5m','3–5 phút · Mid-form'],
      ['8-12m','8–12 phút'],
      ['12-20m','12–20 phút'],
      ['20-30m','20–30 phút']
    ]
  },
  youtube_short:{
    label:'YouTube Short',
    hint:'Video dọc ngắn, hook rất sớm, một ý chính và payoff rõ trong tối đa khoảng 3 phút.',
    defaultDuration:'60-90s',
    paragraphCount:5,
    durations:[
      ['15-30s','15–30 giây'],
      ['30-60s','30–60 giây'],
      ['60-90s','60–90 giây'],
      ['90-180s','90–180 giây']
    ]
  },
  facebook_short:{
    label:'Facebook Short / Reels',
    hint:'Video ngắn dễ xem trên feed, ngôn ngữ trực tiếp, gần gũi và vào vấn đề nhanh.',
    defaultDuration:'30-60s',
    paragraphCount:4,
    durations:[
      ['15-30s','15–30 giây'],
      ['30-60s','30–60 giây'],
      ['60-90s','60–90 giây']
    ]
  }
};


const SCRIPT_MODEL_REGISTRY={
  gemini:{
    label:'Google Gemini',
    hint:'Gemini 3.8 Flash phù hợp mặc định cho tốc độ và chất lượng; Pro dùng khi cần reasoning sâu hơn.',
    models:[
      ['gemini-3.8-flash','Gemini 3.8 Flash · Khuyến nghị'],
      ['gemini-3.7-flash','Gemini 3.7 Flash'],
      ['gemini-3.1-pro-preview','Gemini 3.1 Pro · Preview'],
      ['gemini-3.6-flash','Gemini 3.6 Flash']
    ]
  },
  openai:{
    label:'OpenAI',
    hint:'Chọn giữa model mạnh, cân bằng và nhanh tùy độ dài/chất lượng kịch bản.',
    models:[
      ['gpt-6-astra','GPT-6 Astra · Chất lượng cao'],
      ['gpt-6.1-sol','GPT-6.1 Sol · Cân bằng'],
      ['gpt-6-luna','GPT-6 Luna · Nhanh / tiết kiệm'],
      ['gpt-5.6-sol','GPT-5.6 Sol · Ổn định']
    ]
  },
  anthropic:{
    label:'Anthropic Claude',
    hint:'Claude phù hợp long-form, biên tập giọng văn và các bài cần mạch lập luận dài.',
    models:[
      ['claude-fable-5','Claude Fable 5 · Cao cấp'],
      ['claude-opus-5','Claude Opus 5 · Reasoning'],
      ['claude-sonnet-5','Claude Sonnet 5 · Khuyến nghị'],
      ['claude-opus-4-8','Claude Opus 4.8'],
      ['claude-sonnet-4-6','Claude Sonnet 4.6']
    ]
  },
  xai:{
    label:'xAI Grok',
    hint:'Grok là provider bổ sung cho drafting và phân tích; model khả dụng phụ thuộc API key xAI.',
    models:[
      ['grok-4.7','Grok 4.7 · Khuyến nghị'],
      ['grok-4.6','Grok 4.6'],
      ['grok-4.5','Grok 4.5']
    ]
  }
};

function populateScriptModels(provider,preferred=''){
  const select=document.getElementById('scriptModel');
  const hint=document.getElementById('scriptModelHint');
  if(!select) return;
  const cfg=SCRIPT_MODEL_REGISTRY[provider]||SCRIPT_MODEL_REGISTRY.gemini;
  const current=String(preferred||select.value||'');
  select.innerHTML='';
  cfg.models.forEach(([value,label],index)=>{
    const option=document.createElement('option');
    option.value=value;
    option.textContent=label;
    select.appendChild(option);
    if(index===0) option.dataset.recommended='true';
  });
  if(cfg.models.some(([value])=>value===current)) select.value=current;
  else select.value=cfg.models[0]?.[0]||'';
  if(hint) hint.textContent=cfg.hint;
}

function selectedScriptModel(){
  return String(document.getElementById('scriptModel')?.value||'').trim();
}

function inferPlatformFromDuration(duration){
  return ['15-30s','30-60s','60-90s','90-180s'].includes(String(duration||''))
    ? 'youtube_short'
    : 'youtube_long';
}

function defaultAspectForPlatform(mode){
  return mode==='youtube_short' || mode==='facebook_short' ? '9:16' : '16:9';
}

function currentSceneAspect(){
  return document.getElementById('renderAspect')?.value || defaultAspectForPlatform(document.getElementById('platformMode')?.value);
}

function applySceneAspectClass(){
  if(!sceneList) return;
  sceneList.classList.remove('scene-aspect-16-9','scene-aspect-9-16','scene-aspect-1-1');
  sceneList.classList.add('scene-aspect-'+currentSceneAspect().replace(':','-'));
}

function configurePlatformMode(mode,preferredDuration='',updateParagraphCount=false){
  const preset=PLATFORM_PRESETS[mode]||PLATFORM_PRESETS.youtube_long;
  const durationSelect=document.getElementById('targetDuration');
  const hint=document.getElementById('platformHint');
  if(durationSelect){
    durationSelect.innerHTML='';
    preset.durations.forEach(([value,label])=>{
      const option=document.createElement('option');
      option.value=value;
      option.textContent=label;
      durationSelect.appendChild(option);
    });
    const allowed=preset.durations.some(([value])=>value===preferredDuration);
    durationSelect.value=allowed?preferredDuration:preset.defaultDuration;
  }
  if(hint) hint.textContent=preset.hint;
  if(updateParagraphCount){
    const paragraphCount=document.getElementById('paragraphCount');
    if(paragraphCount) paragraphCount.value=String(preset.paragraphCount);
    const renderAspect=document.getElementById('renderAspect');
    if(renderAspect) renderAspect.value=defaultAspectForPlatform(mode);
    applySceneAspectClass();
  }
}


const CHANNEL_PROFILE_STORAGE_KEY='ktn-ai-video-channel-profiles-v1';
let channelProfiles=[];

function makeChannelProfileId(){
  try{
    if(globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  }catch(_error){}
  return 'channel_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
}

function normalizeChannelProfile(profile={}){
  const now=new Date().toISOString();
  return {
    id:String(profile.id||makeChannelProfileId()),
    name:String(profile.name||'').trim(),
    primaryPlatform:['youtube','facebook','multi'].includes(profile.primaryPlatform)?profile.primaryPlatform:'youtube',
    niche:String(profile.niche||'').trim(),
    targetAudience:String(profile.targetAudience||'').trim(),
    defaultTone:String(profile.defaultTone||'natural'),
    defaultGoal:String(profile.defaultGoal||'educate'),
    defaultExpertise:String(profile.defaultExpertise||'general'),
    defaultCta:String(profile.defaultCta||'soft'),
    channelStyle:String(profile.channelStyle||'').trim(),
    narratorPersona:String(profile.narratorPersona||'').trim(),
    vocabularyStyle:String(profile.vocabularyStyle||'').trim(),
    openingStyle:String(profile.openingStyle||'').trim(),
    storytellingStyle:String(profile.storytellingStyle||'').trim(),
    forbiddenPhrases:String(profile.forbiddenPhrases||'').trim(),
    forbiddenContent:String(profile.forbiddenContent||'').trim(),
    defaultVoice:String(profile.defaultVoice||'Kore').trim()||'Kore',
    pronunciationNotes:String(profile.pronunciationNotes||'').trim(),
    createdAt:String(profile.createdAt||now),
    updatedAt:String(profile.updatedAt||now)
  };
}

function loadChannelProfiles(){
  try{
    const raw=JSON.parse(localStorage.getItem(CHANNEL_PROFILE_STORAGE_KEY)||'[]');
    channelProfiles=Array.isArray(raw)
      ? raw.map(normalizeChannelProfile).filter(item=>item.name)
      : [];
  }catch(_error){
    channelProfiles=[];
  }
}

function persistChannelProfiles(){
  localStorage.setItem(CHANNEL_PROFILE_STORAGE_KEY,JSON.stringify(channelProfiles));
}

function escapeChannelHtml(value){
  return String(value||'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function channelPlatformLabel(value){
  if(value==='facebook') return 'Facebook';
  if(value==='multi') return 'Đa nền tảng';
  return 'YouTube';
}

function getChannelProfileById(id){
  return channelProfiles.find(item=>item.id===String(id||''))||null;
}

function getSelectedChannelProfile(){
  return getChannelProfileById(document.getElementById('channelProfileSelect')?.value);
}

function channelProfileToBible(profile){
  if(!profile) return {};
  return {
    channelName:profile.name,
    primaryPlatform:profile.primaryPlatform,
    niche:profile.niche,
    channelStyle:profile.channelStyle,
    narratorPersona:profile.narratorPersona,
    vocabularyStyle:profile.vocabularyStyle,
    openingStyle:profile.openingStyle,
    storytellingStyle:profile.storytellingStyle,
    forbiddenPhrases:profile.forbiddenPhrases,
    fixedRules:profile.forbiddenContent,
    defaultVoice:profile.defaultVoice,
    pronunciationNotes:profile.pronunciationNotes
  };
}

function refreshChannelProfileSelect(preferredId=''){
  const select=document.getElementById('channelProfileSelect');
  if(!select) return;
  const current=String(preferredId||select.value||'');
  select.innerHTML='<option value="">— Chọn kênh trước khi viết —</option>';
  channelProfiles
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name,'vi'))
    .forEach(profile=>{
      const option=document.createElement('option');
      option.value=profile.id;
      option.textContent=profile.name+(profile.niche?' · '+profile.niche:'');
      select.appendChild(option);
    });
  if(getChannelProfileById(current)) select.value=current;
  else select.value='';
  renderSelectedChannelSummary();
}

function renderSelectedChannelSummary(){
  const box=document.getElementById('channelSelectedSummary');
  if(!box) return;
  const profile=getSelectedChannelProfile();
  if(!profile){
    box.innerHTML='<strong>Chưa chọn Channel Profile</strong><span>DNA kênh sẽ tự động được đưa vào AI khi tạo kịch bản.</span>';
    return;
  }
  box.innerHTML=
    '<strong>'+escapeChannelHtml(profile.name)+'</strong>'+
    '<span>'+escapeChannelHtml(channelPlatformLabel(profile.primaryPlatform))+
    (profile.niche?' · '+escapeChannelHtml(profile.niche):'')+
    (profile.targetAudience?' · Người xem: '+escapeChannelHtml(profile.targetAudience):'')+'</span>';
}

function applyChannelDefaults(profile){
  if(!profile) return;
  const mappings=[
    ['contentGoal',profile.defaultGoal],
    ['contentTone',profile.defaultTone],
    ['expertiseLevel',profile.defaultExpertise],
    ['ctaStyle',profile.defaultCta]
  ];
  mappings.forEach(([id,value])=>{
    const el=document.getElementById(id);
    if(el && value) el.value=value;
  });
  const voice=document.getElementById('voiceName');
  const workspace=document.getElementById('voiceWorkspaceVoice');
  if(profile.defaultVoice){
    if(voice) voice.value=profile.defaultVoice;
    if(workspace) workspace.value=profile.defaultVoice;
  }
}

function selectChannelProfile(id,{applyDefaults=true,autosave=true}={}){
  const select=document.getElementById('channelProfileSelect');
  const profile=getChannelProfileById(id);
  if(select) select.value=profile?.id||'';
  if(profile && applyDefaults) applyChannelDefaults(profile);
  renderSelectedChannelSummary();
  if(profile) renderVoiceWorkspace();
  if(autosave) scheduleAutosave();
  return profile;
}

function resetChannelEditor(profile=null){
  const item=profile?normalizeChannelProfile(profile):normalizeChannelProfile({id:'',name:''});
  const set=(id,value)=>{
    const el=document.getElementById(id);
    if(el) el.value=value??'';
  };
  set('channelProfileId',profile?.id||'');
  set('channelProfileName',profile?.name||'');
  set('channelPrimaryPlatform',profile?.primaryPlatform||'youtube');
  set('channelNiche',profile?.niche||'');
  set('channelTargetAudience',profile?.targetAudience||'');
  set('channelDefaultTone',profile?.defaultTone||'natural');
  set('channelDefaultGoal',profile?.defaultGoal||'educate');
  set('channelDefaultExpertise',profile?.defaultExpertise||'general');
  set('channelDefaultCta',profile?.defaultCta||'soft');
  set('channelProfileStyle',profile?.channelStyle||'');
  set('channelNarratorPersona',profile?.narratorPersona||'');
  set('channelVocabularyStyle',profile?.vocabularyStyle||'');
  set('channelOpeningStyle',profile?.openingStyle||'');
  set('channelStorytellingStyle',profile?.storytellingStyle||'');
  set('channelForbiddenPhrases',profile?.forbiddenPhrases||'');
  set('channelForbiddenContent',profile?.forbiddenContent||'');
  set('channelDefaultVoice',profile?.defaultVoice||'Kore');
  set('channelPronunciationNotes',profile?.pronunciationNotes||'');
  const mode=document.getElementById('channelEditorMode');
  const title=document.getElementById('channelEditorTitle');
  if(mode) mode.textContent=profile?'Chỉnh sửa Channel Profile':'Tạo Channel Profile';
  if(title) title.textContent=profile?.name||'Kênh mới';
  const duplicate=document.getElementById('duplicateChannelProfileBtn');
  const remove=document.getElementById('deleteChannelProfileBtn');
  if(duplicate) duplicate.disabled=!profile;
  if(remove) remove.disabled=!profile;
  return item;
}

function readChannelEditor(){
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  const existing=getChannelProfileById(value('channelProfileId'));
  return normalizeChannelProfile({
    id:existing?.id||makeChannelProfileId(),
    createdAt:existing?.createdAt,
    name:value('channelProfileName'),
    primaryPlatform:value('channelPrimaryPlatform'),
    niche:value('channelNiche'),
    targetAudience:value('channelTargetAudience'),
    defaultTone:value('channelDefaultTone'),
    defaultGoal:value('channelDefaultGoal'),
    defaultExpertise:value('channelDefaultExpertise'),
    defaultCta:value('channelDefaultCta'),
    channelStyle:value('channelProfileStyle'),
    narratorPersona:value('channelNarratorPersona'),
    vocabularyStyle:value('channelVocabularyStyle'),
    openingStyle:value('channelOpeningStyle'),
    storytellingStyle:value('channelStorytellingStyle'),
    forbiddenPhrases:value('channelForbiddenPhrases'),
    forbiddenContent:value('channelForbiddenContent'),
    defaultVoice:value('channelDefaultVoice'),
    pronunciationNotes:value('channelPronunciationNotes'),
    updatedAt:new Date().toISOString()
  });
}

function renderChannelProfileLibrary(){
  const count=document.getElementById('channelProfileCount');
  const empty=document.getElementById('channelProfileEmpty');
  const grid=document.getElementById('channelProfileGrid');
  if(count) count.textContent=channelProfiles.length+' kênh';
  if(!grid || !empty) return;
  if(!channelProfiles.length){
    grid.innerHTML='';
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.classList.remove('hidden');
  const selectedId=document.getElementById('channelProfileSelect')?.value||'';
  grid.innerHTML=channelProfiles
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name,'vi'))
    .map(profile=>{
      const selected=profile.id===selectedId?' selected':'';
      return '<article class="channel-profile-card'+selected+'" data-channel-id="'+escapeChannelHtml(profile.id)+'">'+
        '<div class="channel-profile-card-head"><h4>'+escapeChannelHtml(profile.name)+'</h4>'+
        '<span class="channel-platform-pill">'+escapeChannelHtml(channelPlatformLabel(profile.primaryPlatform))+'</span></div>'+
        '<p>'+escapeChannelHtml(profile.niche||'Chưa khai báo niche')+'</p>'+
        '<small>'+escapeChannelHtml(profile.targetAudience||'Chưa khai báo người xem')+'</small>'+
        '<div class="asset-actions">'+
          '<button data-channel-action="use" data-channel-id="'+escapeChannelHtml(profile.id)+'">Dùng kênh</button>'+
          '<button data-channel-action="edit" data-channel-id="'+escapeChannelHtml(profile.id)+'">Sửa</button>'+
          '<button data-channel-action="duplicate" data-channel-id="'+escapeChannelHtml(profile.id)+'">Nhân bản</button>'+
        '</div>'+
      '</article>';
    }).join('');

  grid.querySelectorAll('[data-channel-action]').forEach(button=>{
    button.addEventListener('click',event=>{
      event.stopPropagation();
      const id=button.dataset.channelId||'';
      if(button.dataset.channelAction==='use'){
        selectChannelProfile(id,{applyDefaults:true,autosave:true});
        renderChannelProfileLibrary();
        document.querySelector('.content-grid')?.scrollIntoView({behavior:'smooth',block:'start'});
      }else if(button.dataset.channelAction==='edit'){
        resetChannelEditor(getChannelProfileById(id));
      }else if(button.dataset.channelAction==='duplicate'){
        duplicateChannelProfile(id);
      }
    });
  });
  grid.querySelectorAll('.channel-profile-card').forEach(card=>{
    card.addEventListener('click',()=>resetChannelEditor(getChannelProfileById(card.dataset.channelId)));
  });
}

function saveChannelProfileFromEditor(){
  const profile=readChannelEditor();
  if(!profile.name){
    showToast('Hãy nhập tên kênh.');
    document.getElementById('channelProfileName')?.focus();
    return null;
  }
  if(!profile.niche){
    showToast('Hãy nhập chủ đề / niche của kênh.');
    document.getElementById('channelNiche')?.focus();
    return null;
  }
  if(!profile.targetAudience){
    showToast('Hãy nhập người xem mặc định của kênh.');
    document.getElementById('channelTargetAudience')?.focus();
    return null;
  }
  const index=channelProfiles.findIndex(item=>item.id===profile.id);
  if(index>=0) channelProfiles[index]=profile;
  else channelProfiles.push(profile);
  persistChannelProfiles();
  refreshChannelProfileSelect(profile.id);
  selectChannelProfile(profile.id,{applyDefaults:true,autosave:true});
  resetChannelEditor(profile);
  renderChannelProfileLibrary();
  showToast('Đã lưu Channel Profile: '+profile.name);
  return profile;
}

function duplicateChannelProfile(id){
  const source=getChannelProfileById(id);
  if(!source) return null;
  const copy=normalizeChannelProfile({
    ...source,
    id:makeChannelProfileId(),
    name:source.name+' · Bản sao',
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  });
  channelProfiles.push(copy);
  persistChannelProfiles();
  refreshChannelProfileSelect(copy.id);
  selectChannelProfile(copy.id,{applyDefaults:true,autosave:true});
  resetChannelEditor(copy);
  renderChannelProfileLibrary();
  showToast('Đã nhân bản kênh '+source.name+'.');
  return copy;
}

function deleteChannelProfile(id){
  const profile=getChannelProfileById(id);
  if(!profile) return;
  if(!confirm('Xóa Channel Profile “'+profile.name+'”? Các Project đang tham chiếu kênh này sẽ cần chọn lại kênh.')) return;
  channelProfiles=channelProfiles.filter(item=>item.id!==id);
  persistChannelProfiles();
  const selected=document.getElementById('channelProfileSelect')?.value;
  refreshChannelProfileSelect(selected===id?'':selected);
  resetChannelEditor();
  renderChannelProfileLibrary();
  scheduleAutosave();
  showToast('Đã xóa Channel Profile.');
}

function migrateLegacyChannelBible(project){
  const legacy=project?.inputs?.channelBible;
  if(!legacy?.channelName) return null;
  const existing=channelProfiles.find(item=>item.name.toLowerCase()===String(legacy.channelName).trim().toLowerCase());
  if(existing) return existing;
  const profile=normalizeChannelProfile({
    name:legacy.channelName,
    primaryPlatform:'youtube',
    niche:'Migrated profile',
    targetAudience:project?.inputs?.contentBrief?.targetAudience||'Người xem của kênh',
    defaultTone:project?.inputs?.contentBrief?.contentTone||'natural',
    defaultGoal:project?.inputs?.contentBrief?.contentGoal||'educate',
    defaultExpertise:project?.inputs?.contentBrief?.expertiseLevel||'general',
    defaultCta:project?.inputs?.contentBrief?.ctaStyle||'soft',
    channelStyle:legacy.channelStyle,
    narratorPersona:legacy.narratorPersona,
    vocabularyStyle:legacy.vocabularyStyle,
    openingStyle:legacy.openingStyle,
    storytellingStyle:legacy.storytellingStyle,
    forbiddenPhrases:legacy.forbiddenPhrases,
    forbiddenContent:project?.inputs?.contentBrief?.forbiddenContent||'',
    defaultVoice:project?.settings?.voiceName||'Kore'
  });
  channelProfiles.push(profile);
  persistChannelProfiles();
  return profile;
}

function ensureProjectChannelProfile(project){
  const requestedId=String(project?.inputs?.channelProfileId||'');
  let profile=getChannelProfileById(requestedId);
  if(!profile && project?.inputs?.channelProfileSnapshot){
    const snapshot=normalizeChannelProfile(project.inputs.channelProfileSnapshot);
    const sameName=channelProfiles.find(item=>item.name.toLowerCase()===snapshot.name.toLowerCase());
    profile=sameName||snapshot;
    if(!sameName){
      channelProfiles.push(profile);
      persistChannelProfiles();
    }
  }
  if(!profile) profile=migrateLegacyChannelBible(project);
  return profile;
}

function openChannelManager(profileId=''){
  const profile=getChannelProfileById(profileId);
  if(profile) resetChannelEditor(profile);
  renderChannelProfileLibrary();
  setWorkspace('channels');
}


const WORKSPACE_META={
  projects:{title:'Dự án',project:false},
  brief:{title:'Brief',project:true},
  script:{title:'Kịch bản',project:true},
  scene:{title:'Cảnh & hình ảnh',project:true},
  voice:{title:'Giọng đọc',project:true},
  subtitle:{title:'Phụ đề',project:true},
  export:{title:'Xuất video',project:true},
  channels:{title:'Kênh nội dung',project:false},
  library:{title:'Thư viện tài nguyên',project:false},
  settings:{title:'Cài đặt hệ thống',project:false}
};

function updateWorkspaceContext(){
  const projectName=document.getElementById('projectName')?.value?.trim()||'Dự án chưa đặt tên';
  const profile=getSelectedChannelProfile?.();
  const platformMode=document.getElementById('platformMode')?.value||'youtube_long';
  const duration=document.getElementById('targetDuration');
  const voice=document.getElementById('voiceName')?.value||'Kore';
  const scriptText=document.getElementById('scriptResult')?.value?.trim()||'';
  const sceneCount=Array.isArray(currentScenes)?currentScenes.length:0;

  const assign=(id,value)=>{
    const el=document.getElementById(id);
    if(el) el.textContent=value;
  };
  assign('workspaceProjectTitle',projectName);
  assign('inspectorProjectName',projectName);
  assign('inspectorChannel',profile?.name||'Chưa chọn');
  assign('inspectorPlatform',PLATFORM_PRESETS[platformMode]?.label||platformMode);
  assign('inspectorDuration',duration?.selectedOptions?.[0]?.textContent||duration?.value||'—');
  assign('inspectorVoice',voice);
  assign('inspectorScriptState',scriptText?(scriptText.split(/\s+/).filter(Boolean).length+' từ'):'Chưa có');
  assign('inspectorSceneState',String(sceneCount));
}

function setWorkspace(name,{updateHash=true}={}){
  let target=WORKSPACE_META[name]?name:'projects';
  let meta=WORKSPACE_META[target];
  if(meta.project && !activeProjectId){
    target='projects';
    meta=WORKSPACE_META.projects;
    showToast('Hãy tạo hoặc mở một dự án trước.');
  }

  document.body.dataset.activeWorkspace=target;
  document.querySelectorAll('[data-workspace-view]').forEach(view=>{
    view.classList.toggle('active',view.dataset.workspaceView===target);
  });
  document.querySelectorAll('[data-workspace-link]').forEach(link=>{
    link.classList.toggle('active',link.dataset.workspaceLink===target);
  });

  const pageTitle=document.getElementById('workspacePageTitle');
  if(pageTitle) pageTitle.textContent=meta.title;

  const inspector=document.getElementById('workspaceContextInspector');
  const main=document.querySelector('.main');
  const showInspector=Boolean(meta.project && target!=='brief');
  if(inspector){
    inspector.classList.toggle('hidden',!showInspector);
    if(!showInspector) inspector.classList.remove('collapsed');
  }
  if(main){
    main.classList.toggle('inspector-open',showInspector);
    if(!showInspector) main.classList.remove('inspector-compact');
  }

  if(target==='projects') renderProjectLibrary();
  if(target==='voice') renderVoiceWorkspace();
  if(target==='library') renderAssetLibrary();
  if(target==='channels') renderChannelProfileLibrary();
  if(target==='settings') refreshSystemStatus();
  if(target==='scene') activateScriptTools();

  updateWorkspaceContext();

  if(updateHash){
    const next='#'+target;
    if(location.hash!==next) history.pushState({workspace:target},'',next);
  }
  window.scrollTo({top:0,behavior:'instant'});
}

function workspaceFromLocation(){
  const raw=String(location.hash||'').replace(/^#/,'').trim();
  return WORKSPACE_META[raw]?raw:'projects';
}

function bindWorkspaceNavigation(){
  document.querySelectorAll('[data-workspace-link]').forEach(link=>{
    link.addEventListener('click',event=>{
      event.preventDefault();
      setWorkspace(link.dataset.workspaceLink||'brief');
    });
  });

  window.addEventListener('popstate',()=>setWorkspace(workspaceFromLocation(),{updateHash:false}));
  window.addEventListener('hashchange',()=>setWorkspace(workspaceFromLocation(),{updateHash:false}));

  const inspectorToggle=document.getElementById('toggleInspectorBtn');
  inspectorToggle?.addEventListener('click',()=>{
    const inspector=document.getElementById('workspaceContextInspector');
    const main=document.querySelector('.main');
    const collapsed=inspector?.classList.toggle('collapsed');
    main?.classList.toggle('inspector-compact',Boolean(collapsed));
    if(inspectorToggle) inspectorToggle.textContent=collapsed?'i':'×';
  });

  ['projectName','platformMode','targetDuration','voiceName','channelProfileSelect'].forEach(id=>{
    const el=document.getElementById(id);
    el?.addEventListener('input',updateWorkspaceContext);
    el?.addEventListener('change',updateWorkspaceContext);
  });

  const sceneList=document.getElementById('sceneList');
  if(sceneList){
    new MutationObserver(()=>updateWorkspaceContext()).observe(sceneList,{childList:true,subtree:false});
  }
  document.getElementById('scriptResult')?.addEventListener('input',updateWorkspaceContext);
}

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

  if(payload?.provider==='gemini' && voiceDailyQuotaBlocked){
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
        requestError.quotaScope==='day'
      ){
        if(payload?.provider==='gemini') markVoiceDailyQuotaBlocked(message);
        throw requestError;
      }
      if(requestError.retryable===false) throw requestError;

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

const GEMINI_FALLBACK_VOICES=[
  {id:'Kore',name:'Kore',provider:'gemini',type:'prebuilt',category:'prebuilt',description:'Rõ, chắc'},
  {id:'Achernar',name:'Achernar',provider:'gemini',type:'prebuilt',category:'prebuilt',description:'Nhẹ nhàng'},
  {id:'Aoede',name:'Aoede',provider:'gemini',type:'prebuilt',category:'prebuilt',description:'Thoáng, tự nhiên'},
  {id:'Charon',name:'Charon',provider:'gemini',type:'prebuilt',category:'prebuilt',description:'Thuyết minh'},
  {id:'Sulafat',name:'Sulafat',provider:'gemini',type:'prebuilt',category:'prebuilt',description:'Ấm'},
  {id:'Puck',name:'Puck',provider:'gemini',type:'prebuilt',category:'prebuilt',description:'Năng lượng'}
];

function getVoiceBatchCandidates(scope){
  const missing=currentScenes.filter(scene=>!scene.audio_asset?.b64_audio);
  if(scope==='all') return currentScenes.slice();
  if(scope==='test2') return missing.slice(0,2);
  if(scope==='failed') return currentScenes.filter(scene=>scene.voice_job_status==='fail');
  return missing;
}

function voiceProviderLabel(provider){
  return provider==='elevenlabs'?'ElevenLabs':'Gemini TTS';
}

function voiceTypeLabel(type){
  const value=String(type||'').toLowerCase();
  if(value.includes('replicated')) return 'Clone · Replicated';
  if(value.includes('cloned')) return 'Clone · Instant';
  if(value.includes('professional')) return 'Professional';
  if(value.includes('premade')||value.includes('prebuilt')) return 'Prebuilt';
  if(value.includes('prompted')) return 'Voice Design';
  return type||'Voice';
}

function providerVoices(provider){
  let voices=voiceLibrary.filter(item=>item.provider===provider);
  if(provider==='gemini'){
    const ids=new Set(voices.map(item=>item.id));
    voices=[...voices,...GEMINI_FALLBACK_VOICES.filter(item=>!ids.has(item.id))];
  }
  return voices;
}

function populateVoiceSelectors(provider=selectedVoiceProvider(),preferred=''){
  const voices=providerVoices(provider);
  const current=String(preferred||selectedVoiceId()||'');
  const selects=[
    document.getElementById('voiceName'),
    document.getElementById('voiceWorkspaceVoice')
  ].filter(Boolean);

  selects.forEach(select=>{
    select.innerHTML='';
    if(!voices.length){
      const option=document.createElement('option');
      option.value='';
      option.textContent='— Chưa có giọng khả dụng —';
      select.appendChild(option);
      return;
    }
    voices.forEach(item=>{
      const option=document.createElement('option');
      option.value=item.id;
      option.textContent=item.name+' · '+voiceTypeLabel(item.type);
      option.dataset.provider=item.provider;
      select.appendChild(option);
    });
    const value=voices.some(item=>item.id===current)?current:voices[0].id;
    select.value=value;
  });
}

async function refreshVoiceLibrary({preserveSelection=true,silent=false}={}){
  const provider=selectedVoiceProvider();
  const preferred=preserveSelection?selectedVoiceId():'';
  const empty=document.getElementById('voiceLibraryEmpty');
  if(empty){
    empty.classList.remove('hidden');
    empty.textContent='Đang đồng bộ Voice Library...';
  }
  try{
    const res=await fetch('/api/voices',{headers:{accept:'application/json'},cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('HTTP '+res.status));

    voiceLibrary=Array.isArray(data.voices)?data.voices:[];
    voiceAvailability.gemini=Boolean(data.providers?.gemini?.configured);
    voiceAvailability.elevenlabs=Boolean(data.providers?.elevenlabs?.configured);
    populateVoiceSelectors(provider,preferred);
    renderVoiceLibrary();
    updateVoiceProviderState();
    renderVoiceWorkspace();
    if(!silent) showToast('Đã đồng bộ Voice Library.');
    return data;
  }catch(error){
    voiceLibrary=[];
    populateVoiceSelectors(provider,preferred);
    renderVoiceLibrary();
    updateVoiceProviderState();
    if(empty) empty.textContent='Không thể đồng bộ Voice Library: '+(error?.message||'lỗi không xác định');
    if(!silent) showToast(error?.message||'Không thể đồng bộ Voice Library.');
    return null;
  }
}

function renderVoiceLibrary(){
  const provider=selectedVoiceProvider();
  const voices=providerVoices(provider);
  const grid=document.getElementById('voiceLibraryGrid');
  const empty=document.getElementById('voiceLibraryEmpty');
  const count=document.getElementById('voiceLibraryCount');
  if(count) count.textContent=voices.length+' giọng';
  if(!grid||!empty) return;

  if(!voices.length){
    grid.innerHTML='';
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.textContent=voiceAvailability[provider]
      ? 'Provider chưa trả về giọng nào.'
      : 'Provider chưa được cấu hình API key.';
    return;
  }

  empty.classList.add('hidden');
  grid.classList.remove('hidden');
  const selected=selectedVoiceId();

  grid.innerHTML=voices.map(item=>{
    const active=item.id===selected?' active':'';
    const canDelete=Boolean(item.owner && ['replicated','cloned','professional','prompted'].some(x=>String(item.type||item.category).toLowerCase().includes(x)));
    return '<article class="voice-library-card'+active+'" data-voice-id="'+escapeChannelHtml(item.id)+'">'+
      '<div><strong>'+escapeChannelHtml(item.name)+'</strong>'+
      '<span>'+escapeChannelHtml(voiceTypeLabel(item.type||item.category))+'</span></div>'+
      '<p>'+escapeChannelHtml(item.description||item.languageCode||voiceProviderLabel(item.provider))+'</p>'+
      '<div class="voice-library-actions">'+
        '<button data-voice-action="use">Dùng giọng</button>'+
        (item.previewUrl?'<a href="'+escapeChannelHtml(item.previewUrl)+'" target="_blank" rel="noopener">Nghe mẫu</a>':'')+
        (canDelete?'<button class="danger" data-voice-action="delete">Xóa</button>':'')+
      '</div>'+
    '</article>';
  }).join('');

  grid.querySelectorAll('[data-voice-action]').forEach(button=>{
    button.addEventListener('click',async event=>{
      event.stopPropagation();
      const card=button.closest('[data-voice-id]');
      const id=card?.dataset.voiceId||'';
      if(button.dataset.voiceAction==='use'){
        selectVoiceById(id);
      }else if(button.dataset.voiceAction==='delete'){
        await deleteRemoteVoice(id);
      }
    });
  });
  grid.querySelectorAll('.voice-library-card').forEach(card=>{
    card.addEventListener('click',()=>selectVoiceById(card.dataset.voiceId));
  });
}

function selectVoiceById(id){
  const quick=document.getElementById('voiceName');
  const workspace=document.getElementById('voiceWorkspaceVoice');
  if(quick && Array.from(quick.options).some(option=>option.value===id)) quick.value=id;
  if(workspace && Array.from(workspace.options).some(option=>option.value===id)) workspace.value=id;
  scheduleAutosave();
  renderVoiceLibrary();
  renderVoiceWorkspace();
  updateWorkspaceContext();
}

function syncVoiceSelectors(source){
  const value=source?.value||selectedVoiceId();
  selectVoiceById(value);
}

function updateVoiceProviderState(){
  const provider=selectedVoiceProvider();
  const available=Boolean(voiceAvailability[provider]);
  const state=document.getElementById('voiceProviderState');
  const status=document.getElementById('voiceWorkspaceStatus');
  const quotaBlocked=provider==='gemini' && voiceDailyQuotaBlocked;

  if(state){
    state.textContent=quotaBlocked
      ? 'Hết quota Gemini hôm nay'
      : (available?'Sẵn sàng':'Chưa cấu hình');
    state.style.color=quotaBlocked?'#a23b3b':(available?'#198754':'#9b6b16');
  }
  if(status){
    status.textContent=quotaBlocked
      ? 'Gemini TTS hết quota hôm nay'
      : (available?(voiceProviderLabel(provider)+' sẵn sàng'):(voiceProviderLabel(provider)+' chưa cấu hình'));
    status.style.background=quotaBlocked?'#fff0f0':(available?'#eaf8ef':'#fff7df');
    status.style.color=quotaBlocked?'#a23b3b':(available?'#198754':'#805d16');
  }

  const cloneButton=document.getElementById('openVoiceCloneBtn');
  if(cloneButton) cloneButton.disabled=!available;
}

function voiceTechnicalQa(scene){
  const hasAudio=Boolean(scene.audio_asset?.b64_audio);
  if(!hasAudio) return {pass:false,label:'THIẾU AUDIO',detail:'Chưa có file audio.'};
  const actual=Number(scene.audio_duration_seconds||scene.audio_asset?.duration_seconds||0);
  const target=Number(scene.duration_seconds||0);
  if(actual>0 && target>0){
    const ratio=actual/target;
    if(ratio<0.55 || ratio>1.85){
      return {
        pass:false,
        label:'CẦN KIỂM TRA',
        detail:'Audio '+actual.toFixed(1)+'s lệch đáng kể so với scene '+target.toFixed(1)+'s.'
      };
    }
  }
  return {
    pass:true,
    label:'TECH PASS',
    detail:actual>0?('Audio '+actual.toFixed(1)+'s · file hợp lệ'):'Có file audio · duration sẽ xác minh khi phát.'
  };
}

function setAudioQaApproved(scene,approved){
  scene.audio_qa_approved=Boolean(approved);
  scheduleAutosave();
  renderVoiceWorkspace();
}

function renderVoiceBatchQueue(){
  const results=document.getElementById('voiceBatchResults');
  if(!results) return;
  const ids=voiceBatchJob.queue.length
    ? voiceBatchJob.queue
    : currentScenes.filter(scene=>['queued','running','pass','fail','paused'].includes(scene.voice_job_status)).map(scene=>scene.id);

  results.innerHTML='';
  ids.forEach(id=>{
    const scene=currentScenes.find(item=>item.id===id);
    if(!scene) return;
    const state=scene.voice_job_status||'queued';
    const row=document.createElement('div');
    row.className='voice-batch-result '+state;
    const name=document.createElement('strong');
    name.textContent=String(scene.order||0).padStart(2,'0')+' · '+(scene.title||scene.id);
    const status=document.createElement('span');
    const labels={
      queued:'QUEUED',
      running:'ĐANG TẠO...',
      pass:'PASS',
      fail:'FAIL',
      paused:'PAUSED'
    };
    status.textContent=labels[state]||state.toUpperCase();
    if(scene.voice_job_error) status.title=scene.voice_job_error;
    row.append(name,status);
    results.appendChild(row);
  });
}

function updateVoiceBatchProgress(){
  const queueScenes=voiceBatchJob.queue.map(id=>currentScenes.find(scene=>scene.id===id)).filter(Boolean);
  const total=voiceBatchJob.total||queueScenes.length;
  const pass=queueScenes.filter(scene=>scene.voice_job_status==='pass').length;
  const fail=queueScenes.filter(scene=>scene.voice_job_status==='fail').length;
  const running=queueScenes.filter(scene=>scene.voice_job_status==='running').length;
  const queued=queueScenes.filter(scene=>['queued','paused'].includes(scene.voice_job_status)).length;
  const done=pass+fail;
  const pct=total?Math.round(done/total*100):0;

  const assign=(id,value)=>{const el=document.getElementById(id);if(el) el.textContent=value;};
  assign('voiceBatchProgressValue',pct+'%');
  assign('voiceQueueMetric',queued+' queued');
  assign('voiceRunningMetric',running+' running');
  assign('voicePassMetric',pass+' pass');
  assign('voiceFailMetric',fail+' fail');
  const bar=document.getElementById('voiceBatchBar');
  if(bar) bar.style.width=pct+'%';

  const label=document.getElementById('voiceBatchProgressLabel');
  if(label){
    if(voiceBatchJob.cancelled) label.textContent='Đã hủy batch';
    else if(voiceBatchJob.paused) label.textContent='Đã tạm dừng';
    else if(voiceBatchJob.running){
      const current=currentScenes.find(scene=>scene.id===voiceBatchJob.currentSceneId);
      label.textContent=current?'Đang tạo · Scene '+current.order+' · '+current.title:'Đang chạy batch...';
    }else if(total && done>=total) label.textContent='Hoàn tất · '+pass+' thành công'+(fail?' · '+fail+' lỗi':'');
    else label.textContent='Sẵn sàng';
  }

  document.getElementById('voiceBatchPauseBtn').disabled=!voiceBatchJob.running || voiceBatchJob.paused;
  document.getElementById('voiceBatchResumeBtn').disabled=!voiceBatchJob.running || !voiceBatchJob.paused;
  document.getElementById('voiceBatchCancelBtn').disabled=!voiceBatchJob.running;
  document.getElementById('voiceBatchRetryBtn').disabled=voiceBatchJob.running || currentScenes.every(scene=>scene.voice_job_status!=='fail');
  renderVoiceBatchQueue();
}

function renderVoiceWorkspace(){
  const provider=selectedVoiceProvider();
  const total=currentScenes.length;
  const ready=currentScenes.filter(scene=>scene.audio_asset?.b64_audio).length;
  const failed=currentScenes.filter(scene=>scene.voice_job_status==='fail').length;
  const missing=Math.max(0,total-ready);

  updateVoiceProviderState();

  const quotaNotice=document.getElementById('voiceDailyQuotaNotice');
  if(quotaNotice){
    const show=provider==='gemini' && voiceDailyQuotaBlocked;
    quotaNotice.classList.toggle('hidden',!show);
    const detail=quotaNotice.querySelector('span');
    if(detail && show){
      detail.textContent=voiceDailyQuotaMessage+
        ' Có thể chuyển sang provider khác nếu đã cấu hình.';
    }
  }

  const assign=(id,value)=>{const el=document.getElementById(id);if(el) el.textContent=String(value);};
  assign('voiceSceneTotal',total);
  assign('voiceSceneReady',ready);
  assign('voiceSceneMissing',missing);
  assign('voiceSceneFailed',failed);
  assign('voiceBatchSummary',ready+'/'+total+' audio');

  const list=document.getElementById('voiceSceneStatusList');
  const empty=document.getElementById('voiceSceneStatusEmpty');
  if(list) list.innerHTML='';

  if(!total){
    empty?.classList.remove('hidden');
    list?.classList.add('hidden');
  }else{
    empty?.classList.add('hidden');
    list?.classList.remove('hidden');

    currentScenes.forEach(scene=>{
      const hasAudio=Boolean(scene.audio_asset?.b64_audio);
      const qa=voiceTechnicalQa(scene);
      const row=document.createElement('div');
      row.className='voice-status-row voice-qa-row';

      const number=document.createElement('div');
      number.className='voice-status-number';
      number.textContent=String(scene.order||0).padStart(2,'0');

      const main=document.createElement('div');
      main.className='voice-status-main';
      const strong=document.createElement('strong');
      strong.textContent=scene.title||scene.id;
      const small=document.createElement('small');
      small.textContent=hasAudio
        ? ((scene.audio_asset.providerLabel||voiceProviderLabel(scene.audio_asset.provider))+' · '+(scene.audio_asset.voice||'Voice')+' · '+qa.detail)
        : (scene.voice_job_error||'Chưa có audio');
      main.append(strong,small);

      const stateWrap=document.createElement('div');
      stateWrap.className='voice-qa-badges';
      const technical=document.createElement('span');
      technical.className='voice-status-badge'+(qa.pass?' ready':'');
      technical.textContent=qa.label;
      const manual=document.createElement('span');
      manual.className='voice-status-badge'+(scene.audio_qa_approved?' approved':'');
      manual.textContent=scene.audio_qa_approved?'ĐÃ DUYỆT':'CHỜ DUYỆT';
      stateWrap.append(technical,manual);

      const controls=document.createElement('div');
      controls.className='voice-scene-actions';

      if(hasAudio){
        const audio=document.createElement('audio');
        audio.controls=true;
        audio.preload='metadata';
        audio.src='data:'+(scene.audio_asset.mime_type||'audio/wav')+';base64,'+scene.audio_asset.b64_audio;
        controls.appendChild(audio);

        const approve=document.createElement('button');
        approve.className=scene.audio_qa_approved?'approved':'';
        approve.textContent=scene.audio_qa_approved?'Bỏ duyệt':'Duyệt audio';
        approve.addEventListener('click',()=>setAudioQaApproved(scene,!scene.audio_qa_approved));
        controls.appendChild(approve);
      }

      const action=document.createElement('button');
      const blocked=provider==='gemini'&&voiceDailyQuotaBlocked;
      action.textContent=blocked?'Hết quota':(hasAudio?'Tạo lại':'Tạo audio');
      action.disabled=blocked || !voiceAvailability[provider] || voiceBatchJob.running;
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
      controls.appendChild(action);

      row.append(number,main,stateWrap,controls);
      list.appendChild(row);
    });
  }

  const previewButton=document.getElementById('voicePreviewBtn');
  if(previewButton) previewButton.disabled=!voiceAvailability[provider] || (provider==='gemini'&&voiceDailyQuotaBlocked) || voiceBatchJob.running;

  document.querySelectorAll('.scene-voice-btn').forEach(btn=>{
    const blocked=provider==='gemini'&&voiceDailyQuotaBlocked;
    btn.disabled=blocked || !voiceAvailability[provider] || voiceBatchJob.running;
    if(blocked) btn.textContent='Hết quota TTS';
  });

  updateVoiceBatchButton();
  updateVoiceBatchProgress();
}

function updateVoiceBatchButton(){
  const button=document.getElementById('voiceBatchBtn');
  const provider=selectedVoiceProvider();
  const confirmed=Boolean(document.getElementById('voiceBatchConfirm')?.checked);
  const scope=document.getElementById('voiceBatchScope')?.value||'missing';
  const candidates=getVoiceBatchCandidates(scope);
  const quotaBlocked=provider==='gemini'&&voiceDailyQuotaBlocked;
  if(!button) return;
  button.disabled=voiceBatchJob.running || !voiceAvailability[provider] || quotaBlocked || !confirmed || candidates.length===0;
  button.textContent=quotaBlocked
    ? 'Hết quota Gemini hôm nay'
    : (candidates.length?('▶ Chạy batch · '+candidates.length+' scene'):'Không có scene cần tạo');
}

async function previewVoice(){
  const button=document.getElementById('voicePreviewBtn');
  const text=document.getElementById('voicePreviewText')?.value.trim();
  const provider=selectedVoiceProvider();
  const voice=String(document.getElementById('voiceWorkspaceVoice')?.value||selectedVoiceId());
  const output=document.getElementById('voicePreviewOutput');
  const audio=document.getElementById('voicePreviewAudio');
  const meta=document.getElementById('voicePreviewMeta');

  if(!text){showToast('Hãy nhập câu nghe thử.');return;}
  if(!voiceAvailability[provider]){showToast(voiceProviderLabel(provider)+' chưa sẵn sàng.');return;}
  if(provider==='gemini'&&voiceDailyQuotaBlocked){showToast('Gemini TTS đã hết quota theo ngày.');return;}

  button.disabled=true;
  button.textContent='Đang tạo mẫu...';
  output?.classList.remove('hidden');
  if(meta) meta.textContent=voiceProviderLabel(provider)+' đang tạo audio mẫu...';
  audio?.removeAttribute('src');
  audio?.load();

  try{
    const data=await requestVoiceWithRetry({
      provider,
      text,
      voice,
      languageCode:'vi-VN',
      sceneId:'voice_preview',
      styleInstruction:voiceStyleInstruction(),
      voiceSettings:voiceRequestSettings()
    },info=>{
      if(meta) meta.textContent=info.remaining
        ? ('Provider giới hạn request · đợi '+info.remaining+' giây...')
        : 'Provider đang bận · chuẩn bị thử lại...';
    });
    if(audio){
      audio.src='data:'+(data.mime_type||'audio/wav')+';base64,'+data.b64_audio;
      audio.load();
    }
    if(meta){
      meta.textContent=(data.voice||voice)+' · '+(data.providerLabel||voiceProviderLabel(provider))+
        (Number(data.duration_seconds)>0?' · '+Number(data.duration_seconds).toFixed(1)+' giây':'');
    }
    showToast('Đã tạo audio nghe thử.');
  }catch(err){
    if(meta) meta.textContent=err.message||'Không thể tạo audio mẫu.';
    showToast(err.message||'Không thể tạo audio mẫu.');
  }finally{
    button.disabled=false;
    button.textContent='▶ Nghe thử';
    renderVoiceWorkspace();
  }
}

async function waitWhileVoicePaused(){
  while(voiceBatchJob.paused && !voiceBatchJob.cancelled){
    await wait(250);
  }
}

function initializeVoiceBatch(targets){
  voiceBatchJob={
    running:true,
    paused:false,
    cancelled:false,
    queue:targets.map(scene=>scene.id),
    currentSceneId:'',
    completed:0,
    failed:0,
    total:targets.length
  };
  targets.forEach(scene=>{
    scene.voice_job_status='queued';
    scene.voice_job_error='';
  });
  updateVoiceBatchProgress();
  renderVoiceWorkspace();
}

async function processVoiceBatch(){
  const provider=selectedVoiceProvider();
  const gapSeconds=provider==='gemini'?21:1;

  for(let index=0;index<voiceBatchJob.queue.length;index++){
    if(voiceBatchJob.cancelled) break;
    await waitWhileVoicePaused();
    if(voiceBatchJob.cancelled) break;

    const scene=currentScenes.find(item=>item.id===voiceBatchJob.queue[index]);
    if(!scene) continue;

    if(index>0 && gapSeconds>1){
      for(let remaining=gapSeconds;remaining>0;remaining--){
        if(voiceBatchJob.cancelled) break;
        await waitWhileVoicePaused();
        const label=document.getElementById('voiceBatchProgressLabel');
        if(label) label.textContent='Đợi quota · scene tiếp theo sau '+remaining+' giây';
        await wait(1000);
      }
    }
    if(voiceBatchJob.cancelled) break;

    scene.voice_job_status='running';
    voiceBatchJob.currentSceneId=scene.id;
    updateVoiceBatchProgress();
    renderVoiceWorkspace();

    const card=findSceneCard(scene.id);
    const sceneButton=card?.querySelector('.scene-voice-btn');
    if(!card || !sceneButton){
      scene.voice_job_status='fail';
      scene.voice_job_error='Không tìm thấy scene UI.';
      voiceBatchJob.failed+=1;
      updateVoiceBatchProgress();
      continue;
    }

    const ok=await generateSceneVoice(scene,card,sceneButton,{silent:true});
    if(ok){
      scene.voice_job_status='pass';
      voiceBatchJob.completed+=1;
      const saved=await saveProjectNow({silent:true});
      if(!saved?.ok){
        scene.voice_job_status='fail';
        scene.voice_job_error='Audio OK nhưng lưu dự án thất bại.';
        voiceBatchJob.failed+=1;
      }
    }else{
      scene.voice_job_status='fail';
      voiceBatchJob.failed+=1;
    }

    updateVoiceBatchProgress();
    renderVoiceWorkspace();
    renderAssetLibrary();

    if(provider==='gemini'&&voiceDailyQuotaBlocked) break;
  }

  voiceBatchJob.running=false;
  voiceBatchJob.paused=false;
  voiceBatchJob.currentSceneId='';
  await saveProjectNow({silent:true});
  document.getElementById('voiceBatchConfirm').checked=false;
  updateVoiceBatchProgress();
  renderVoiceWorkspace();

  if(voiceBatchJob.cancelled){
    showToast('Đã hủy batch. Audio hoàn thành trước đó vẫn được giữ.');
  }else if(provider==='gemini'&&voiceDailyQuotaBlocked){
    showToast('Batch dừng vì Gemini hết quota ngày. Có thể đổi provider rồi Retry lỗi.');
  }else{
    showToast('Batch hoàn tất · '+voiceBatchJob.completed+' thành công · '+voiceBatchJob.failed+' lỗi.');
  }
}

async function runVoiceBatch(){
  if(voiceBatchJob.running) return;
  const provider=selectedVoiceProvider();
  const scope=document.getElementById('voiceBatchScope')?.value||'missing';
  const confirmed=Boolean(document.getElementById('voiceBatchConfirm')?.checked);

  if(!confirmed){showToast('Cần xác nhận phạm vi batch trước khi chạy.');return;}
  if(!voiceAvailability[provider]){showToast(voiceProviderLabel(provider)+' chưa sẵn sàng.');return;}
  if(provider==='gemini'&&voiceDailyQuotaBlocked){showToast('Gemini TTS hết quota hôm nay. Hãy đổi provider hoặc chờ quota mới.');return;}

  const targets=getVoiceBatchCandidates(scope);
  if(!targets.length){showToast('Không có scene phù hợp phạm vi batch.');return;}

  initializeVoiceBatch(targets);
  await processVoiceBatch();
}

function pauseVoiceBatch(){
  if(!voiceBatchJob.running) return;
  voiceBatchJob.paused=true;
  const current=currentScenes.find(scene=>scene.id===voiceBatchJob.currentSceneId);
  if(current && current.voice_job_status==='running') current.voice_job_status='paused';
  updateVoiceBatchProgress();
}

function resumeVoiceBatch(){
  if(!voiceBatchJob.running) return;
  voiceBatchJob.paused=false;
  const current=currentScenes.find(scene=>scene.id===voiceBatchJob.currentSceneId);
  if(current && current.voice_job_status==='paused') current.voice_job_status='running';
  updateVoiceBatchProgress();
}

function cancelVoiceBatch(){
  if(!voiceBatchJob.running) return;
  voiceBatchJob.cancelled=true;
  voiceBatchJob.paused=false;
  currentScenes.forEach(scene=>{
    if(scene.voice_job_status==='queued'||scene.voice_job_status==='paused'){
      scene.voice_job_status='queued';
    }
  });
  updateVoiceBatchProgress();
}

function retryFailedVoiceBatch(){
  if(voiceBatchJob.running) return;
  const failed=currentScenes.filter(scene=>scene.voice_job_status==='fail');
  if(!failed.length){showToast('Không có scene lỗi để retry.');return;}
  document.getElementById('voiceBatchScope').value='failed';
  document.getElementById('voiceBatchConfirm').checked=true;
  runVoiceBatch();
}

function fileToBase64Payload(file){
  return new Promise((resolve,reject)=>{
    if(!file) return resolve(null);
    const maxBytes=20*1024*1024;
    if(file.size>maxBytes) return reject(new Error('File audio vượt quá 20 MB.'));
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error||new Error('Không đọc được file audio.'));
    reader.onload=()=>{
      const value=String(reader.result||'');
      const comma=value.indexOf(',');
      resolve({
        data:comma>=0?value.slice(comma+1):value,
        mime_type:file.type||'audio/wav'
      });
    };
    reader.readAsDataURL(file);
  });
}

function openVoiceCloneModal(){
  const provider=selectedVoiceProvider();
  document.getElementById('voiceCloneProvider').value=provider;
  document.getElementById('voiceCloneName').value='';
  document.getElementById('voiceCloneReferenceFile').value='';
  document.getElementById('voiceCloneConsentFile').value='';
  document.getElementById('voiceCloneDescription').value='';
  document.getElementById('voiceCloneConsentConfirmed').checked=false;
  document.getElementById('voiceCloneStatus').textContent='';
  updateVoiceCloneProviderUi();
  document.getElementById('voiceCloneModal')?.classList.remove('hidden');
}

function closeVoiceCloneModal(){
  document.getElementById('voiceCloneModal')?.classList.add('hidden');
}

function updateVoiceCloneProviderUi(){
  const provider=document.getElementById('voiceCloneProvider')?.value||'gemini';
  document.getElementById('geminiConsentAudioBlock')?.classList.toggle('hidden',provider!=='gemini');
}

async function createVoiceClone(){
  const button=document.getElementById('createVoiceCloneBtn');
  const status=document.getElementById('voiceCloneStatus');
  const provider=document.getElementById('voiceCloneProvider')?.value||'gemini';
  const name=document.getElementById('voiceCloneName')?.value.trim();
  const reference=document.getElementById('voiceCloneReferenceFile')?.files?.[0];
  const consent=document.getElementById('voiceCloneConsentFile')?.files?.[0];
  const description=document.getElementById('voiceCloneDescription')?.value.trim();
  const consentConfirmed=Boolean(document.getElementById('voiceCloneConsentConfirmed')?.checked);

  if(!name){showToast('Hãy đặt tên Voice Profile.');return;}
  if(!reference){showToast('Hãy chọn reference audio.');return;}
  if(provider==='gemini'&&!consent){showToast('Gemini yêu cầu consent audio của cùng người nói.');return;}
  if(!consentConfirmed){showToast('Cần xác nhận quyền sở hữu/sự đồng ý.');return;}

  button.disabled=true;
  button.textContent='Đang tạo clone...';
  if(status) status.textContent='Đang đọc audio và gửi tới '+voiceProviderLabel(provider)+'...';

  try{
    const [sourceAudio,consentAudio]=await Promise.all([
      fileToBase64Payload(reference),
      provider==='gemini'?fileToBase64Payload(consent):Promise.resolve(null)
    ]);
    const res=await fetch('/api/voices',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({
        action:'clone',
        provider,
        name,
        description,
        sourceAudio,
        consentAudio,
        consentConfirmed:true
      })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('HTTP '+res.status));
    if(status) status.textContent='PASS · '+data.voice?.name+' · '+data.voice?.id;
    await refreshVoiceLibrary({preserveSelection:false,silent:true});
    document.getElementById('voiceProvider').value=provider;
    populateVoiceSelectors(provider,data.voice?.id||'');
    selectVoiceById(data.voice?.id||'');
    closeVoiceCloneModal();
    showToast('Đã tạo Voice Clone: '+(data.voice?.name||name)+'.');
  }catch(error){
    if(status) status.textContent='FAIL · '+(error?.message||'Không thể clone giọng.');
    showToast(error?.message||'Không thể clone giọng.');
  }finally{
    button.disabled=false;
    button.textContent='Tạo Voice Clone';
  }
}

async function deleteRemoteVoice(voiceId){
  const provider=selectedVoiceProvider();
  const item=voiceLibrary.find(voice=>voice.provider===provider&&voice.id===voiceId);
  if(!item) return;
  if(!confirm('Xóa voice “'+item.name+'” khỏi '+voiceProviderLabel(provider)+'?')) return;
  try{
    const res=await fetch('/api/voices',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({action:'delete',provider,voiceId})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('HTTP '+res.status));
    await refreshVoiceLibrary({preserveSelection:false,silent:true});
    showToast('Đã xóa voice.');
  }catch(error){
    showToast(error?.message||'Không thể xóa voice.');
  }
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
    scene.audio_qa_approved=false;
    scene.voice_job_status='';
    scene.voice_job_error='';
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
    setSystemCard('anthropic',Boolean(data.providers?.anthropic?.configured),{
      scriptModel:data.providers?.anthropic?.scriptModel
    });
    setSystemCard('xai',Boolean(data.providers?.xai?.configured),{
      scriptModel:data.providers?.xai?.scriptModel
    });
    setSystemCard('elevenlabs',Boolean(data.providers?.elevenlabs?.configured),{
      ttsModel:data.providers?.elevenlabs?.ttsModel
    });
    setSystemCard('ktnImage',Boolean(data.providers?.ktnImage?.ready),{
      model:data.providers?.ktnImage?.model,
      gateway:data.providers?.ktnImage?.ready?'LIVE / HEALTH OK':data.providers?.ktnImage?.configured?'Đã cấu hình · chưa kết nối':'Chưa cấu hình',
      token:data.providers?.ktnImage?.tokenConfigured?'Đã cấu hình':'Chưa cấu hình'
    });
    setSystemCard('render',Boolean(data.providers?.render?.ready));
  }catch(err){
    ['gemini','openai','anthropic','xai','elevenlabs','ktnImage','render'].forEach(name=>setSystemCard(name,false));
    showToast('Không đọc được trạng thái hệ thống: '+(err?.message||'lỗi kết nối'));
  }finally{
    if(button){button.disabled=false;button.textContent='Kiểm tra lại';}
  }
}

const PROJECT_DB_NAME='ktn-ai-video-studio';
const PROJECT_DB_VERSION=2;
const PROJECT_STORE='projects';
const PROJECT_ASSET_STORE='assets';
const LEGACY_PROJECT_ID='current-draft';
const ACTIVE_PROJECT_STORAGE_KEY='ktn-ai-video-active-project-v2';
let activeProjectId='';
let activeProjectCreatedAt='';
try{activeProjectId=localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)||'';}catch(_error){}
let autosaveTimer=null;
let restoringProject=false;

function makeProjectId(){
  try{
    if(globalThis.crypto?.randomUUID) return 'project_'+globalThis.crypto.randomUUID();
  }catch(_error){}
  return 'project_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
}

function rememberActiveProject(id){
  activeProjectId=String(id||'').trim();
  try{
    if(activeProjectId) localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY,activeProjectId);
    else localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
  }catch(_error){}
  updateProjectNavigationState();
}

function updateProjectNavigationState(){
  const hasProject=Boolean(activeProjectId);
  document.querySelectorAll('.project-nav-item').forEach(button=>{
    button.disabled=!hasProject;
    button.classList.toggle('disabled',!hasProject);
  });
  const projectName=document.getElementById('projectName');
  if(projectName) projectName.disabled=!hasProject;
  const saveButton=document.getElementById('saveProjectBtn');
  const exportButton=document.getElementById('exportProjectBtn');
  if(saveButton) saveButton.disabled=!hasProject;
  if(exportButton) exportButton.disabled=!hasProject;
}

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

function assetRecordId(sceneId,type,projectId=activeProjectId){
  const id=String(projectId||'unsaved-project');
  return id+':'+String(sceneId)+':'+type;
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

function stripAssetPayload(asset,type,sceneId,projectId=activeProjectId){
  if(!asset) return null;
  const payloadKey=type==='image'?'b64_json':'b64_audio';
  const assetRef=assetRecordId(sceneId,type,projectId);
  const meta={...asset,asset_ref:assetRef};
  delete meta[payloadKey];
  return meta;
}

async function persistProjectBundle(project){
  const manifest={
    ...project,
    scenes:project.scenes.map(scene=>({
      ...scene,
      image_asset:stripAssetPayload(scene.image_asset,'image',scene.id,project.id),
      audio_asset:stripAssetPayload(scene.audio_asset,'audio',scene.id,project.id)
    }))
  };

  for(const scene of project.scenes){
    const imageId=assetRecordId(scene.id,'image',project.id);
    const audioId=assetRecordId(scene.id,'audio',project.id);

    if(scene.image_asset?.b64_json){
      await dbPutAsset({
        id:imageId,
        project_id:project.id,
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
        project_id:project.id,
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

function projectPersistenceFingerprint(project){
  const scenes=Array.isArray(project?.scenes)?project.scenes:[];
  const stable={
    schema_version:project?.schema_version||'',
    id:project?.id||'',
    name:project?.name||'',
    inputs:{
      topic:project?.inputs?.topic||'',
      platformMode:project?.inputs?.platformMode||'',
      scriptLanguage:project?.inputs?.scriptLanguage||'',
      scriptProvider:project?.inputs?.scriptProvider||'',
      scriptModel:project?.inputs?.scriptModel||'',
      paragraphCount:Number(project?.inputs?.paragraphCount||0),
      targetDuration:project?.inputs?.targetDuration||'',
      extraInstruction:project?.inputs?.extraInstruction||'',
      contentBrief:project?.inputs?.contentBrief||{},
      channelProfileId:project?.inputs?.channelProfileId||'',
      channelProfileSnapshot:project?.inputs?.channelProfileSnapshot||null
    },
    script:{
      title:project?.script?.title||'',
      text:project?.script?.text||'',
      meta:project?.script?.meta||'',
      workflow:project?.script?.workflow||null
    },
    scenes:scenes.map(scene=>({
      id:scene?.id||'',
      order:Number(scene?.order||0),
      title:scene?.title||'',
      purpose:scene?.purpose||'',
      narration:scene?.narration||'',
      duration_seconds:Number(scene?.duration_seconds||0),
      audio_duration_seconds:scene?.audio_duration_seconds==null?null:Number(scene.audio_duration_seconds),
      visual_intent:scene?.visual_intent||'',
      shot_type:scene?.shot_type||'',
      continuity_notes:scene?.continuity_notes||'',
      visual_description:scene?.visual_description||'',
      image_prompt:scene?.image_prompt||'',
      locked:Boolean(scene?.locked),
      visual_review_required:Boolean(scene?.visual_review_required),
      continuity_review_required:Boolean(scene?.continuity_review_required),
      qa_status:scene?.qa_status||'',
      voice_job_status:scene?.voice_job_status||'',
      voice_job_error:scene?.voice_job_error||'',
      audio_qa_approved:Boolean(scene?.audio_qa_approved),
      image_asset:scene?.image_asset ? {
        mime_type:scene.image_asset.mime_type||'',
        provider:scene.image_asset.provider||'',
        model:scene.image_asset.model||'',
        aspect_ratio:scene.image_asset.aspect_ratio||'',
        payload_length:String(scene.image_asset.b64_json||'').length
      } : null,
      audio_asset:scene?.audio_asset ? {
        mime_type:scene.audio_asset.mime_type||'',
        provider:scene.audio_asset.provider||'',
        model:scene.audio_asset.model||'',
        voice:scene.audio_asset.voice||'',
        duration_seconds:scene.audio_asset.duration_seconds==null?null:Number(scene.audio_asset.duration_seconds),
        payload_length:String(scene.audio_asset.b64_audio||'').length
      } : null
    })),
    subtitles:{
      srt:project?.subtitles?.srt||'',
      maxChars:Number(project?.subtitles?.maxChars||0),
      gap:Number(project?.subtitles?.gap||0)
    },
    settings:project?.settings||{}
  };
  return JSON.stringify(stable);
}

function validateImportedProjectV1(project){
  if(!project || typeof project!=='object'){
    throw new Error('File dự án phải là JSON object.');
  }
  if(project.schema_version!=='ktn-ai-video-project-v1'){
    throw new Error('File không đúng định dạng dự án KTN AI Video Studio V1.');
  }
  if(!project.inputs || typeof project.inputs!=='object'){
    throw new Error('Dự án thiếu inputs.');
  }
  if(!project.script || typeof project.script!=='object'){
    throw new Error('Dự án thiếu script state.');
  }
  if(!Array.isArray(project.scenes)){
    throw new Error('Dự án thiếu danh sách scenes.');
  }
  if(project.scenes.length>500){
    throw new Error('Dự án có quá nhiều scene (>500).');
  }
  const ids=new Set();
  project.scenes.forEach((scene,index)=>{
    if(!scene || typeof scene!=='object') throw new Error('Scene '+(index+1)+' không hợp lệ.');
    const id=String(scene.id||'').trim();
    if(!id) throw new Error('Scene '+(index+1)+' thiếu ID.');
    if(ids.has(id)) throw new Error('Dự án có scene ID bị trùng: '+id);
    ids.add(id);
  });
  if(project.subtitles && typeof project.subtitles!=='object'){
    throw new Error('Subtitle state không hợp lệ.');
  }
  if(project.settings && typeof project.settings!=='object'){
    throw new Error('Settings không hợp lệ.');
  }
  return true;
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

async function dbGetProject(id=activeProjectId){
  const db=await openProjectDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PROJECT_STORE,'readonly');
    const req=tx.objectStore(PROJECT_STORE).get(id);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();
  });
}

async function dbGetAllProjects(){
  const db=await openProjectDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PROJECT_STORE,'readonly');
    const req=tx.objectStore(PROJECT_STORE).getAll();
    req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();
  });
}

async function dbDeleteProject(id=activeProjectId){
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
    id:activeProjectId||makeProjectId(),
    name:document.getElementById('projectName').value.trim()||'Dự án chưa đặt tên',
    created_at:activeProjectCreatedAt||new Date().toISOString(),
    updated_at:new Date().toISOString(),
    inputs:{
      topic:document.getElementById('topic').value,
      platformMode:document.getElementById('platformMode').value,
      scriptLanguage:document.getElementById('scriptLanguage').value,
      scriptProvider:document.getElementById('scriptProvider').value,
      scriptModel:selectedScriptModel(),
      paragraphCount:Number(document.getElementById('paragraphCount').value||6),
      targetDuration:document.getElementById('targetDuration').value,
      extraInstruction:document.getElementById('extraInstruction').value,
      contentBrief:{
        targetAudience:document.getElementById('targetAudience').value,
        contentGoal:document.getElementById('contentGoal').value,
        contentTone:document.getElementById('contentTone').value,
        expertiseLevel:document.getElementById('expertiseLevel').value,
        anglePreference:document.getElementById('anglePreference').value,
        ctaStyle:document.getElementById('ctaStyle').value,
        sourceNotes:document.getElementById('sourceNotes').value,
        forbiddenContent:document.getElementById('forbiddenContent').value
      },
      channelProfileId:document.getElementById('channelProfileSelect').value,
      channelProfileSnapshot:getSelectedChannelProfile()
    },
    script:{
      title:scriptTitle.textContent||'Kịch bản AI',
      text:scriptResult.value||'',
      meta:scriptMeta.textContent||'',
      workflow:currentScriptWorkflow
    },
    scenes:currentScenes.map(scene=>({
      id:scene.id,
      order:scene.order,
      title:scene.title,
      purpose:scene.purpose||'other',
      narration:scene.narration,
      duration_seconds:scene.duration_seconds,
      audio_duration_seconds:scene.audio_duration_seconds||null,
      visual_intent:scene.visual_intent||'',
      shot_type:scene.shot_type||'',
      continuity_notes:scene.continuity_notes||'',
      visual_description:scene.visual_description,
      image_prompt:scene.image_prompt,
      locked:Boolean(scene.locked),
      visual_review_required:Boolean(scene.visual_review_required),
      continuity_review_required:Boolean(scene.continuity_review_required),
      qa_status:scene.qa_status||'pending',
      voice_job_status:scene.voice_job_status||'',
      voice_job_error:scene.voice_job_error||'',
      audio_qa_approved:Boolean(scene.audio_qa_approved),
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
      voiceProvider:selectedVoiceProvider(),
      voiceName:selectedVoiceId(),
      voiceStylePreset:document.getElementById('voiceStylePreset')?.value||'documentary',
      voiceSpeed:Number(document.getElementById('voiceSpeed')?.value||1),
      voiceStyleInstruction:document.getElementById('voiceStyleInstruction')?.value||'',
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
  if(!activeProjectId) return {ok:false,reason:'no-active-project'};
  try{
    setAutosaveStatus('Đang lưu...','saving');
    const project=serializeProjectState();
    const expected=projectPersistenceStats(project);
    const expectedFingerprint=projectPersistenceFingerprint(project);
    await persistProjectBundle(project);

    const storedManifest=await dbGetProject(project.id);
    const stored=await hydrateProjectAssets(storedManifest);
    const actual=projectPersistenceStats(stored);
    const actualFingerprint=projectPersistenceFingerprint(stored);

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
    if(actualFingerprint!==expectedFingerprint){
      throw new Error('Xác minh nội dung Project thất bại: dữ liệu đọc lại không khớp dữ liệu vừa lưu.');
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
  if(restoringProject || !activeProjectId) return;
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
    activeProjectCreatedAt=String(project.created_at||project.updated_at||new Date().toISOString());
    restoreInput('projectName',project.name||'Dự án chưa đặt tên');
    restoreInput('topic',project.inputs?.topic||'');
    const restoredDuration=project.inputs?.targetDuration||'60-90s';
    const restoredPlatform=project.inputs?.platformMode||inferPlatformFromDuration(restoredDuration);
    restoreInput('platformMode',restoredPlatform);
    configurePlatformMode(restoredPlatform,restoredDuration,false);
    restoreInput('scriptLanguage',project.inputs?.scriptLanguage||'vi');
    const restoredProvider=project.inputs?.scriptProvider||'gemini';
    restoreInput('scriptProvider',restoredProvider);
    populateScriptModels(restoredProvider,project.inputs?.scriptModel||'');
    restoreInput('paragraphCount',project.inputs?.paragraphCount||PLATFORM_PRESETS[restoredPlatform]?.paragraphCount||6);
    restoreInput('extraInstruction',project.inputs?.extraInstruction||'');
    restoreInput('targetAudience',project.inputs?.contentBrief?.targetAudience||'');
    restoreInput('contentGoal',project.inputs?.contentBrief?.contentGoal||'educate');
    restoreInput('contentTone',project.inputs?.contentBrief?.contentTone||'natural');
    restoreInput('expertiseLevel',project.inputs?.contentBrief?.expertiseLevel||'general');
    restoreInput('anglePreference',project.inputs?.contentBrief?.anglePreference||'');
    restoreInput('ctaStyle',project.inputs?.contentBrief?.ctaStyle||'soft');
    restoreInput('sourceNotes',project.inputs?.contentBrief?.sourceNotes||'');
    restoreInput('forbiddenContent',project.inputs?.contentBrief?.forbiddenContent||'');
    const restoredChannel=ensureProjectChannelProfile(project);
    refreshChannelProfileSelect(restoredChannel?.id||'');
    if(restoredChannel){
      selectChannelProfile(restoredChannel.id,{applyDefaults:false,autosave:false});
    }

    scriptTitle.textContent=project.script?.title||'Kịch bản AI';
    scriptResult.value=project.script?.text||'';
    scriptMeta.textContent=project.script?.meta||'Đã khôi phục · bản nháp';
    currentScriptWorkflow=project.script?.workflow&&typeof project.script.workflow==='object'
      ? {...emptyScriptWorkflow(),...project.script.workflow}
      : emptyScriptWorkflow();
    renderScriptWorkflowArtifacts();
    updateScriptStats();

    currentScenes=Array.isArray(project.scenes)
      ? project.scenes.map(scene=>({...scene,material_key:''}))
      : [];
    currentSrt=String(project.subtitles?.srt||'');

    restoreInput('subtitleMaxChars',project.subtitles?.maxChars||42);
    restoreInput('subtitleGap',project.subtitles?.gap??0.15);
    const restoredVoiceProvider=project.settings?.voiceProvider||'gemini';
    const restoredVoiceId=project.settings?.voiceName||'Kore';
    restoreInput('voiceProvider',restoredVoiceProvider);
    restoreInput('voiceStylePreset',project.settings?.voiceStylePreset||'documentary');
    restoreInput('voiceSpeed',project.settings?.voiceSpeed||1);
    restoreInput('voiceStyleInstruction',project.settings?.voiceStyleInstruction||'');
    await refreshVoiceLibrary({preserveSelection:false,silent:true});
    populateVoiceSelectors(restoredVoiceProvider,restoredVoiceId);
    selectVoiceById(restoredVoiceId);
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
      setSubtitleEditorValue(currentSrt,{updateMeta:true});
      subtitleMeta.textContent='Đã khôi phục SRT · '+validateSrtText(currentSrt).cues+' cue';
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

async function migrateLegacyProjectIfNeeded(){
  if(activeProjectId) return null;
  const legacy=await dbGetProject(LEGACY_PROJECT_ID).catch(()=>null);
  if(!legacy) return null;
  const hydrated=await hydrateProjectAssets(legacy);
  const newId=makeProjectId();
  rememberActiveProject(newId);
  activeProjectCreatedAt=String(legacy.created_at||legacy.updated_at||new Date().toISOString());
  const migrated={
    ...hydrated,
    id:newId,
    name:legacy.name && legacy.name!=='Dự án chưa đặt tên' ? legacy.name : 'Dự án đã khôi phục',
    created_at:activeProjectCreatedAt,
    updated_at:new Date().toISOString()
  };
  await persistProjectBundle(migrated);
  await dbDeleteProject(LEGACY_PROJECT_ID).catch(()=>{});
  return migrated;
}

async function loadAutosavedProject(){
  try{
    let project=null;
    if(activeProjectId){
      const manifest=await dbGetProject(activeProjectId);
      if(manifest) project=await hydrateProjectAssets(manifest);
      else rememberActiveProject('');
    }
    if(!project) project=await migrateLegacyProjectIfNeeded();

    if(project){
      rememberActiveProject(project.id);
      await restoreProject(project);
      setAutosaveStatus('Đã mở dự án','saved');
      await renderProjectLibrary();
      return true;
    }

    setNoActiveProjectState();
    if(document.body.dataset.activeWorkspace!=='projects') setWorkspace('projects');
    return false;
  }catch(err){
    setAutosaveStatus('Không đọc được dự án','error');
    setNoActiveProjectState();
    if(document.body.dataset.activeWorkspace!=='projects') setWorkspace('projects');
    return false;
  }
}


function setNoActiveProjectState(){
  rememberActiveProject('');
  activeProjectCreatedAt='';
  restoringProject=true;
  try{
    document.getElementById('projectName').value='Chưa mở dự án';
    document.getElementById('topic').value='';
    scriptResult.value='';
    currentScenes=[];
    currentSrt='';
    sceneList.innerHTML='';
    sceneList.classList.add('hidden');
    sceneEmpty.classList.remove('hidden');
    scriptDemo.classList.add('hidden');
    scriptEmpty.classList.remove('hidden');
    subtitleOutput.classList.add('hidden');
    subtitleEmpty.classList.remove('hidden');
    setAutosaveStatus('Chưa mở dự án','');
    activateScriptTools();
    updateScriptStats();
    updateWorkspaceContext();
  }finally{
    restoringProject=false;
  }
}

function resetProjectForm({name='Dự án mới',channelId='',platformMode='youtube_long'}={}){
  restoringProject=true;
  try{
    document.getElementById('projectName').value=name;
    document.getElementById('topic').value='';
    document.getElementById('platformMode').value=platformMode;
    configurePlatformMode(platformMode,'',true);
    document.getElementById('scriptLanguage').value='vi';
    document.getElementById('scriptProvider').value='gemini';
    populateScriptModels('gemini','gemini-3.8-flash');
    document.getElementById('extraInstruction').value='';
    document.getElementById('targetAudience').value='';
    document.getElementById('contentGoal').value='educate';
    document.getElementById('contentTone').value='natural';
    document.getElementById('expertiseLevel').value='general';
    document.getElementById('anglePreference').value='';
    document.getElementById('ctaStyle').value='soft';
    document.getElementById('sourceNotes').value='';
    document.getElementById('forbiddenContent').value='';
    document.getElementById('voiceProvider').value='gemini';
    document.getElementById('voiceStylePreset').value='documentary';
    document.getElementById('voiceSpeed').value='1';
    document.getElementById('voiceStyleInstruction').value='';
    populateVoiceSelectors('gemini','Kore');
    selectVoiceById('Kore');
    refreshChannelProfileSelect(channelId);
    if(channelId) selectChannelProfile(channelId,{applyDefaults:true,autosave:false});
    else{
      document.getElementById('channelProfileSelect').value='';
      renderSelectedChannelSummary();
    }
    document.getElementById('imageProvider').value='ktn';
    document.getElementById('renderAspect').value=platformMode==='youtube_long'?'16:9':'9:16';
    document.getElementById('renderTransition').value='';
    scriptResult.value='';
    currentScriptWorkflow=emptyScriptWorkflow();
    renderScriptWorkflowArtifacts();
    scriptTitle.textContent='Kịch bản AI';
    scriptMeta.textContent='Đã tạo · bản nháp';
    currentScenes=[];
    currentSrt='';
    keywordList.innerHTML='';
    sceneList.innerHTML='';
    sceneList.classList.add('hidden');
    sceneEmpty.classList.remove('hidden');
    setSubtitleEditorValue('');
    subtitleOutput.classList.add('hidden');
    subtitleEmpty.classList.remove('hidden');
    scriptDemo.classList.add('hidden');
    scriptEmpty.classList.remove('hidden');
    selectScriptTab('script');
    activateScriptTools();
    updateRenderReadiness();
    renderAssetLibrary();
    renderVoiceWorkspace();
    updateImageProviderState();
    updateWorkspaceContext();
  }finally{
    restoringProject=false;
  }
}

function populateNewProjectChannelSelect(){
  const select=document.getElementById('newProjectChannelSelect');
  if(!select) return;
  const current=select.value;
  select.innerHTML='<option value="">— Chọn sau —</option>';
  channelProfiles.slice().sort((a,b)=>a.name.localeCompare(b.name,'vi')).forEach(profile=>{
    const option=document.createElement('option');
    option.value=profile.id;
    option.textContent=profile.name;
    select.appendChild(option);
  });
  if(getChannelProfileById(current)) select.value=current;
}

function openNewProjectModal(){
  populateNewProjectChannelSelect();
  const modal=document.getElementById('newProjectModal');
  const name=document.getElementById('newProjectNameInput');
  const channel=document.getElementById('newProjectChannelSelect');
  const platform=document.getElementById('newProjectPlatformSelect');
  if(name) name.value='';
  if(channel) channel.value='';
  if(platform) platform.value='youtube_long';
  modal?.classList.remove('hidden');
  setTimeout(()=>name?.focus(),0);
}

function closeNewProjectModal(){
  document.getElementById('newProjectModal')?.classList.add('hidden');
}

async function createProjectFromModal(){
  const name=String(document.getElementById('newProjectNameInput')?.value||'').trim();
  const channelId=String(document.getElementById('newProjectChannelSelect')?.value||'');
  const platformMode=String(document.getElementById('newProjectPlatformSelect')?.value||'youtube_long');
  if(!name){
    showToast('Hãy đặt tên dự án trước khi tạo.');
    document.getElementById('newProjectNameInput')?.focus();
    return;
  }

  if(activeProjectId) await saveProjectNow({silent:true});

  const id=makeProjectId();
  rememberActiveProject(id);
  activeProjectCreatedAt=new Date().toISOString();
  resetProjectForm({name,channelId,platformMode});
  const saved=await saveProjectNow({silent:true});
  if(!saved?.ok){
    showToast('Không thể tạo vùng lưu trữ cho dự án mới.');
    return;
  }
  closeNewProjectModal();
  await renderProjectLibrary();
  setWorkspace('brief');
  showToast('Đã tạo dự án “'+name+'”.');
}

async function openProjectById(id){
  const target=String(id||'');
  if(!target) return;
  if(activeProjectId && activeProjectId!==target) await saveProjectNow({silent:true});
  const manifest=await dbGetProject(target);
  if(!manifest){
    showToast('Không tìm thấy dự án trong bộ nhớ.');
    await renderProjectLibrary();
    return;
  }
  const project=await hydrateProjectAssets(manifest);
  rememberActiveProject(target);
  await restoreProject(project);
  setWorkspace('brief');
  showToast('Đã mở dự án “'+project.name+'”.');
}

async function deleteStoredProject(id){
  const project=await dbGetProject(id).catch(()=>null);
  if(!project) return;
  if(!confirm('Xóa dự án “'+project.name+'” khỏi trình duyệt? Hành động này xóa cả asset cục bộ của dự án.')) return;
  await dbDeleteProject(id);
  if(activeProjectId===id) setNoActiveProjectState();
  await renderProjectLibrary();
  showToast('Đã xóa dự án.');
}

async function exportStoredProject(id){
  const manifest=await dbGetProject(id).catch(()=>null);
  if(!manifest){showToast('Không tìm thấy dự án để xuất.');return;}
  const project=await hydrateProjectAssets(manifest);
  downloadProjectJson(project);
}

function downloadProjectJson(project){
  const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const safe=(project.name||'ktn-ai-video-project').replace(/[^a-zA-Z0-9À-ỹ_-]+/g,'-').replace(/^-+|-+$/g,'')||'ktn-ai-video-project';
  a.href=url;
  a.download=safe+'.json';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

async function renderProjectLibrary(){
  const grid=document.getElementById('projectLibraryGrid');
  const empty=document.getElementById('projectLibraryEmpty');
  const count=document.getElementById('projectLibraryCount');
  const storage=document.getElementById('projectLibraryStorage');
  if(!grid||!empty) return;

  let projects=(await dbGetAllProjects()).filter(project=>project.id!==LEGACY_PROJECT_ID);
  projects=projects.sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
  if(count) count.textContent=String(projects.length);

  try{
    const estimate=await navigator.storage?.estimate?.();
    const used=Number(estimate?.usage||0);
    if(storage) storage.textContent=used>=1048576?(used/1048576).toFixed(1)+' MB':Math.round(used/1024)+' KB';
  }catch(_error){if(storage) storage.textContent='—';}

  if(!projects.length){
    grid.innerHTML='';
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.classList.remove('hidden');
  grid.innerHTML=projects.map(project=>{
    const profile=getChannelProfileById(project.inputs?.channelProfileId);
    const sceneCount=Array.isArray(project.scenes)?project.scenes.length:0;
    const hasScript=Boolean(project.script?.text);
    const updated=project.updated_at?new Date(project.updated_at).toLocaleString('vi-VN'):'—';
    const active=project.id===activeProjectId?' active':'';
    return '<article class="project-card'+active+'" data-project-id="'+escapeChannelHtml(project.id)+'">'+
      '<div class="project-card-top">'+
        '<div><span class="project-card-state">'+(active?'ĐANG MỞ':'PROJECT')+'</span>'+
        '<h3>'+escapeChannelHtml(project.name||'Dự án chưa đặt tên')+'</h3></div>'+
        '<span class="channel-platform-pill">'+escapeChannelHtml(PLATFORM_PRESETS[project.inputs?.platformMode]?.label||'Video')+'</span>'+
      '</div>'+
      '<p>'+escapeChannelHtml(project.inputs?.topic||'Chưa có chủ đề')+'</p>'+
      '<div class="project-card-meta">'+
        '<span>'+escapeChannelHtml(profile?.name||project.inputs?.channelProfileSnapshot?.name||'Chưa chọn kênh')+'</span>'+
        '<span>'+(hasScript?'Có kịch bản':'Chưa có kịch bản')+'</span>'+
        '<span>'+sceneCount+' scene</span>'+
      '</div>'+
      '<small>Cập nhật '+escapeChannelHtml(updated)+'</small>'+
      '<div class="project-card-actions">'+
        '<button class="primary-lite" data-project-action="open">Mở dự án</button>'+
        '<button data-project-action="export">Xuất</button>'+
        '<button class="danger" data-project-action="delete">Xóa</button>'+
      '</div>'+
    '</article>';
  }).join('');

  grid.querySelectorAll('[data-project-action]').forEach(button=>{
    button.addEventListener('click',event=>{
      event.stopPropagation();
      const card=button.closest('[data-project-id]');
      const id=card?.dataset.projectId||'';
      if(button.dataset.projectAction==='open') openProjectById(id);
      if(button.dataset.projectAction==='export') exportStoredProject(id);
      if(button.dataset.projectAction==='delete') deleteStoredProject(id);
    });
  });
}

async function startNewProject(){
  openNewProjectModal();
}

function exportProject(){
  if(!activeProjectId){showToast('Chưa mở dự án để xuất.');return;}
  const project=serializeProjectState({includeMaterialKeys:false});
  downloadProjectJson(project);
  showToast('Đã xuất file dự án JSON.');
}

async function importProjectFile(file){
  if(!file) return;
  try{
    const maxImportBytes=250*1024*1024;
    if(Number(file.size||0)>maxImportBytes){
      throw new Error('File dự án vượt quá 250 MB.');
    }
    const text=await file.text();
    const imported=JSON.parse(text);
    validateImportedProjectV1(imported);

    if(activeProjectId){
      const currentSaved=await saveProjectNow({silent:true});
      if(!currentSaved?.ok) throw new Error('Không thể xác minh dự án đang mở trước khi import.');
    }

    const id=makeProjectId();
    const project={
      ...imported,
      id,
      created_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
      scenes:imported.scenes.map(scene=>({...scene,material_key:null}))
    };
    rememberActiveProject(id);
    activeProjectCreatedAt=project.created_at;
    await restoreProject(project);
    const saved=await saveProjectNow({silent:true});
    if(!saved?.ok) throw new Error('Import đọc được nhưng không xác minh được dữ liệu sau khi lưu.');
    await renderProjectLibrary();
    showToast('PASS · Đã nhập, lưu và xác minh dự án.');
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
      text.textContent='PASS · nội dung khớp · '+saved.stats.scenes+' scene · '+saved.stats.images+' ảnh · '+saved.stats.audio+' audio'+usageText;
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
    'projectName','topic','platformMode','scriptLanguage','scriptProvider','scriptModel','paragraphCount',
    'targetDuration','extraInstruction','targetAudience','contentGoal','contentTone',
    'expertiseLevel','anglePreference','ctaStyle','sourceNotes','forbiddenContent',
    'channelProfileSelect','voiceProvider','voiceName','voiceWorkspaceVoice',
    'voiceStylePreset','voiceSpeed','voiceStyleInstruction','imageProvider',
    'subtitleMaxChars','subtitleGap','renderAspect','renderTransition'
  ].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('input',scheduleAutosave);
    el.addEventListener('change',scheduleAutosave);
  });
  scriptResult.addEventListener('input',()=>{
    updateScriptStats();
    updateWorkspaceContext();
    scheduleAutosave();
  });
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
const RENDER_TASK_STORAGE_KEY='ktn-ai-video-active-render-task-v1';
let activeRenderTaskId='';
try{
  activeRenderTaskId=localStorage.getItem(RENDER_TASK_STORAGE_KEY)||'';
}catch(_error){
  activeRenderTaskId='';
}

function rememberRenderTask(taskId){
  activeRenderTaskId=String(taskId||'').trim();
  try{
    if(activeRenderTaskId) localStorage.setItem(RENDER_TASK_STORAGE_KEY,activeRenderTaskId);
    else localStorage.removeItem(RENDER_TASK_STORAGE_KEY);
  }catch(_error){}
}

function clearRenderTask(){
  rememberRenderTask('');
}

let currentScriptProvider='gemini';
let currentScriptWorkflow={
  version:'v1-multipass',
  status:'idle',
  angle:null,
  outline:null,
  hook:'',
  sections:[],
  draft:'',
  rewritten:'',
  qa:null,
  repaired:false,
  final:'',
  provider:'',
  model:'',
  startedAt:'',
  completedAt:''
};
let currentScenes=[];
let sceneViewMode='board';
let providerAvailability={gemini:false,openai:false,ktn:false};
let providerConfiguredState={gemini:false,openai:false,ktn:false};
let imageProviderBlocked={gemini:false,openai:false,ktn:false};
let imageProviderBlockMessage={gemini:'',openai:'',ktn:''};
let voiceAvailability={gemini:false,elevenlabs:false};
let voiceLibrary=[];
let voiceDailyQuotaBlocked=false;
let voiceDailyQuotaMessage='';
let voiceBatchJob={
  running:false,
  paused:false,
  cancelled:false,
  queue:[],
  currentSceneId:'',
  completed:0,
  failed:0,
  total:0
};

const showToast=(msg)=>{toast.textContent=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3200)};

async function refreshBackendStatus(){
  try{
    const [scriptRes,imageRes,statusRes]=await Promise.all([
      fetch('/api/generate-script',{headers:{accept:'application/json'}}),
      fetch('/api/generate-image',{headers:{accept:'application/json'}}),
      fetch('/api/system-status',{headers:{accept:'application/json'}})
    ]);
    const scriptData=await scriptRes.json().catch(()=>({}));
    const imageData=await imageRes.json().catch(()=>({}));
    const statusData=await statusRes.json().catch(()=>({}));
    const providerConfigured=(value)=>Boolean(
      typeof value==='object' ? value?.configured : value
    );
    providerConfiguredState={
      gemini:Boolean(providerConfigured(scriptData.providers?.gemini) || imageData.providers?.gemini),
      openai:Boolean(providerConfigured(scriptData.providers?.openai) || imageData.providers?.openai),
      ktn:Boolean(statusData.providers?.ktnImage?.configured || imageData.providers?.ktn)
    };
    providerAvailability={
      gemini:providerConfiguredState.gemini,
      openai:providerConfiguredState.openai,
      anthropic:providerConfigured(scriptData.providers?.anthropic),
      xai:providerConfigured(scriptData.providers?.xai),
      ktn:Boolean(statusData.providers?.ktnImage?.ready)
    };
    const configured=[];
    if(providerAvailability.gemini) configured.push('Gemini');
    if(providerAvailability.openai) configured.push('OpenAI');
    if(providerAvailability.anthropic) configured.push('Claude');
    if(providerAvailability.xai) configured.push('Grok');
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
    voiceAvailability.gemini=providerConfigured(scriptData.providers?.gemini);
    updateVoiceProviderState();
  }catch(e){
    backendStatus.textContent='Không kết nối được AI';
    backendStatus.className='preview-badge error';
  }
}

function updateScriptStats(){
  const text=String(scriptResult?.value||'').trim();
  const words=text?text.split(/\s+/).filter(Boolean).length:0;
  const chars=text.length;
  const paragraphs=text?text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean).length:0;
  const minutes=words?Math.max(1,Math.round((words/145)*10)/10):0;
  const assign=(id,value)=>{
    const el=document.getElementById(id);
    if(el) el.textContent=String(value);
  };
  assign('scriptWordCount',words.toLocaleString('vi-VN'));
  assign('scriptCharacterCount',chars.toLocaleString('vi-VN'));
  assign('scriptParagraphMetric',paragraphs);
  assign('scriptEstimatedDuration',minutes?minutes.toLocaleString('vi-VN')+' phút':'0 phút');
}

function activateScriptTools(){
  const hasScript=Boolean(scriptResult.value.trim());
  keywordBtn.disabled=!hasScript;
  sceneBtn.disabled=!hasScript;
  subtitleBtn.disabled=currentScenes.length===0;
  updateScriptStats();
  const sceneCountChip=document.getElementById('sceneCountChip');
  if(sceneCountChip) sceneCountChip.textContent=currentScenes.length+' cảnh';
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
      btn.textContent=provider==='ktn'
        ? (providerConfiguredState.ktn?'Runtime offline':'Chưa cấu hình')
        : 'Thiếu API key';
    }else{
      btn.disabled=false;
      if(['Hết quota ảnh','Chưa nối worker','Runtime offline','Chưa cấu hình','Thiếu API key'].includes(btn.textContent)){
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
        : (provider==='ktn'
          ? (providerConfiguredState.ktn?'Đã cấu hình · runtime offline':'Chưa cấu hình')
          : 'Thiếu API key');
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

function selectedVoiceProvider(){
  return String(document.getElementById('voiceProvider')?.value||'gemini');
}

function selectedVoiceId(){
  return String(document.getElementById('voiceName')?.value||document.getElementById('voiceWorkspaceVoice')?.value||'Kore');
}

function voiceStyleInstruction(){
  const preset=String(document.getElementById('voiceStylePreset')?.value||'documentary');
  const custom=String(document.getElementById('voiceStyleInstruction')?.value||'').trim();
  const profile=getSelectedChannelProfile?.();
  const presets={
    documentary:'Giọng tài liệu điềm tĩnh, rõ nghĩa, tiết chế cảm xúc; có nhịp nghỉ tự nhiên.',
    cinematic:'Giọng cinematic có chiều sâu, cảm xúc có kiểm soát, nhấn vào các turning point; tránh kịch quá mức.',
    conversational:'Giọng trò chuyện gần gũi như đang nói với một người; tự nhiên và không đọc như quảng cáo.',
    energetic:'Giọng sáng, giàu năng lượng, nhịp nhanh vừa phải nhưng vẫn rõ từ.',
    expert:'Giọng chuyên gia rõ ràng, chắc, có trọng âm hợp lý; không lên lớp.',
    custom:''
  };
  return [
    presets[preset]||'',
    profile?.pronunciationNotes?('Quy tắc phát âm: '+profile.pronunciationNotes):'',
    custom
  ].filter(Boolean).join(' ');
}

function voiceRequestSettings(){
  return {
    speed:Number(document.getElementById('voiceSpeed')?.value||1),
    stability:0.52,
    similarity_boost:0.78,
    style:document.getElementById('voiceStylePreset')?.value==='cinematic'?0.22:0.08
  };
}

async function generateSceneVoice(scene,card,button,{silent=false}={}){
  const text=String(scene.narration||'').trim();
  const provider=selectedVoiceProvider();
  const voice=selectedVoiceId();
  const audioBox=card?.querySelector('.scene-audio');
  const status=audioBox?.querySelector('.scene-audio-status');

  if(!text){
    if(!silent) showToast('Scene này chưa có lời đọc.');
    return false;
  }
  if(!voiceAvailability[provider]){
    if(status) status.textContent='Provider giọng chưa sẵn sàng.';
    if(!silent) showToast('Voice provider '+provider+' chưa được cấu hình/sẵn sàng.');
    return false;
  }
  if(provider==='gemini' && voiceDailyQuotaBlocked){
    if(status) status.textContent='Đã hết quota Gemini TTS theo ngày.';
    if(!silent) showToast('Gemini TTS đã hết quota theo ngày. Có thể chuyển sang ElevenLabs nếu đã cấu hình.');
    return false;
  }

  if(button){
    button.disabled=true;
    button.textContent='Đang tạo giọng...';
  }
  if(audioBox) audioBox.classList.remove('hidden');
  if(status) status.textContent=(provider==='gemini'?'Gemini':'ElevenLabs')+' đang tạo audio scene '+String(scene.order).padStart(2,'0')+'...';
  scene.voice_job_status='running';
  scene.voice_job_error='';

  try{
    const data=await requestVoiceWithRetry({
      provider,
      text,
      voice,
      languageCode:'vi-VN',
      sceneId:scene.id,
      styleInstruction:voiceStyleInstruction(),
      voiceSettings:voiceRequestSettings()
    },info=>{
      if(!status) return;
      if(info.remaining){
        status.textContent='Provider đang giới hạn request · đợi '+info.remaining+' giây...';
      }else{
        status.textContent='Provider đang bận · chuẩn bị thử lại...';
      }
    });

    if(audioBox){
      const oldAudio=audioBox.querySelector('audio');
      if(oldAudio) oldAudio.remove();
      const audio=document.createElement('audio');
      audio.controls=true;
      audio.preload='metadata';
      audio.src='data:'+(data.mime_type||'audio/wav')+';base64,'+data.b64_audio;
      audioBox.appendChild(audio);
    }

    scene.audio_asset={
      b64_audio:data.b64_audio,
      mime_type:data.mime_type||'audio/wav',
      provider:data.provider||provider,
      providerLabel:data.providerLabel||(provider==='gemini'?'Gemini TTS':'ElevenLabs TTS'),
      model:data.model||'',
      voice:data.voice||voice,
      duration_seconds:Number(data.duration_seconds)||null,
      created_at:data.createdAt||new Date().toISOString()
    };
    scene.audio_qa_approved=false;
    scene.voice_job_status='pass';
    scene.voice_job_error='';

    const actualDuration=Number(data.duration_seconds);
    if(Number.isFinite(actualDuration) && actualDuration>0){
      scene.audio_duration_seconds=actualDuration;
      const durationBadge=card?.querySelector('.scene-duration');
      if(durationBadge) durationBadge.textContent=actualDuration.toFixed(1)+' giây · audio';
    }
    if(status) status.textContent=(data.voice||voice)+' · '+(data.providerLabel||provider);
    if(button) button.textContent='Tạo lại giọng';

    renderAssetLibrary();
    renderVoiceWorkspace();
    scheduleAutosave();
    if(!silent) showToast('Đã tạo giọng cho '+(scene.title||scene.id)+'.');
    return true;
  }catch(err){
    scene.voice_job_status='fail';
    scene.voice_job_error=String(err?.message||'Không thể tạo giọng.');
    if(audioBox) audioBox.classList.remove('hidden');
    if(status) status.textContent=scene.voice_job_error;
    if(button) button.textContent='Thử lại giọng';
    if(!silent) showToast(scene.voice_job_error);
    return false;
  }finally{
    const providerBlocked=provider==='gemini' && voiceDailyQuotaBlocked;
    if(button){
      button.disabled=providerBlocked || !voiceAvailability[provider];
      if(providerBlocked) button.textContent='Hết quota TTS';
    }
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
        aspectRatio:currentSceneAspect()
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
      model:data.model||'',
      aspect_ratio:currentSceneAspect()
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


const SCENE_PURPOSE_LABELS={
  hook:'Hook',context:'Context',tension:'Tension',explanation:'Explanation',
  evidence:'Evidence',example:'Example',transition:'Transition',
  payoff:'Payoff',cta:'CTA',other:'Other'
};

function normalizeSceneClient(scene,index=0){
  return {
    ...scene,
    id:String(scene?.id||('scene_'+String(index+1).padStart(3,'0'))),
    order:Number(scene?.order)||index+1,
    title:String(scene?.title||('Cảnh '+(index+1))).trim(),
    purpose:String(scene?.purpose||'other').trim().toLowerCase(),
    narration:String(scene?.narration||'').trim(),
    duration_seconds:Math.max(2,Math.min(60,Number(scene?.duration_seconds)||5)),
    visual_intent:String(scene?.visual_intent||scene?.visual_description||'').trim(),
    shot_type:String(scene?.shot_type||'').trim(),
    continuity_notes:String(scene?.continuity_notes||'').trim(),
    visual_description:String(scene?.visual_description||'').trim(),
    image_prompt:String(scene?.image_prompt||'').trim(),
    locked:Boolean(scene?.locked),
    visual_review_required:Boolean(scene?.visual_review_required),
    continuity_review_required:Boolean(scene?.continuity_review_required),
    qa_status:String(scene?.qa_status||'pending')
  };
}

function normalizeCurrentSceneOrder(){
  currentScenes=currentScenes.map((scene,index)=>({...normalizeSceneClient(scene,index),order:index+1}));
}

function sceneQa(scene){
  const imageRatioOk=!scene.image_asset?.b64_json ||
    !scene.image_asset?.aspect_ratio ||
    scene.image_asset.aspect_ratio===currentSceneAspect();
  const checks=[
    ['Narration',Boolean(String(scene.narration||'').trim())],
    ['Duration',Number(scene.duration_seconds)>=2 && Number(scene.duration_seconds)<=60],
    ['Purpose',Boolean(scene.purpose && scene.purpose!=='other')],
    ['Visual intent',Boolean(String(scene.visual_intent||'').trim())],
    ['Shot',Boolean(String(scene.shot_type||'').trim())],
    ['Visual prompt',Boolean(String(scene.visual_description||'').trim() && String(scene.image_prompt||'').trim())],
    ['Visual review',!scene.visual_review_required],
    ['Continuity review',!scene.continuity_review_required],
    ['Image ratio',imageRatioOk]
  ];
  const pass=checks.filter(([,ok])=>ok).length;
  return {
    pass,
    total:checks.length,
    score:Math.round(pass/checks.length*100),
    ready:pass===checks.length,
    checks
  };
}

function updateSceneQaSummary(){
  const chip=document.getElementById('sceneQaChip');
  const count=document.getElementById('sceneCountChip');
  const ready=currentScenes.filter(scene=>sceneQa(scene).ready).length;
  if(chip) chip.textContent='QA '+ready+'/'+currentScenes.length;
  if(count) count.textContent=currentScenes.length+' cảnh';
}

function setSceneView(mode){
  sceneViewMode=mode==='list'?'list':'board';
  sceneList.classList.toggle('scene-list-mode',sceneViewMode==='list');
  document.getElementById('sceneBoardViewBtn')?.classList.toggle('active',sceneViewMode==='board');
  document.getElementById('sceneListViewBtn')?.classList.toggle('active',sceneViewMode==='list');
  try{localStorage.setItem('ktn-scene-view-mode',sceneViewMode);}catch(_error){}
}

function sceneById(id){
  return currentScenes.find(scene=>scene.id===String(id||''))||null;
}

function openSceneEditor(scene){
  if(!scene) return;
  const set=(id,value)=>{const el=document.getElementById(id);if(el) el.value=value??'';};
  set('sceneEditorId',scene.id);
  set('sceneEditorSceneTitle',scene.title);
  set('sceneEditorPurpose',scene.purpose||'other');
  set('sceneEditorNarration',scene.narration);
  set('sceneEditorDuration',scene.duration_seconds);
  set('sceneEditorShotType',scene.shot_type);
  set('sceneEditorVisualIntent',scene.visual_intent);
  set('sceneEditorContinuity',scene.continuity_notes);
  set('sceneEditorVisualDescription',scene.visual_description);
  set('sceneEditorImagePrompt',scene.image_prompt);
  const locked=document.getElementById('sceneEditorLocked');
  if(locked) locked.checked=Boolean(scene.locked);
  document.getElementById('sceneEditorModal')?.classList.remove('hidden');
}

function closeSceneEditor(){
  document.getElementById('sceneEditorModal')?.classList.add('hidden');
}

function saveSceneEditor(){
  const id=document.getElementById('sceneEditorId')?.value;
  const index=currentScenes.findIndex(scene=>scene.id===id);
  if(index<0) return closeSceneEditor();
  const value=id=>String(document.getElementById(id)?.value||'').trim();
  const scene=currentScenes[index];
  currentScenes[index]={
    ...scene,
    title:value('sceneEditorSceneTitle')||scene.title,
    purpose:value('sceneEditorPurpose')||'other',
    narration:value('sceneEditorNarration'),
    duration_seconds:Math.max(2,Math.min(60,Number(value('sceneEditorDuration'))||scene.duration_seconds||5)),
    shot_type:value('sceneEditorShotType'),
    visual_intent:value('sceneEditorVisualIntent'),
    continuity_notes:value('sceneEditorContinuity'),
    visual_description:value('sceneEditorVisualDescription'),
    image_prompt:value('sceneEditorImagePrompt'),
    locked:Boolean(document.getElementById('sceneEditorLocked')?.checked),
    visual_review_required:false,
    continuity_review_required:false,
    qa_status:'reviewed'
  };
  renderScenes(currentScenes,{providerLabel:'Đã chỉnh sửa'});
  closeSceneEditor();
  scheduleAutosave();
  showToast('Đã cập nhật scene.');
}

function moveScene(id,direction){
  const index=currentScenes.findIndex(scene=>scene.id===id);
  const target=index+direction;
  if(index<0 || target<0 || target>=currentScenes.length) return;
  [currentScenes[index],currentScenes[target]]=[currentScenes[target],currentScenes[index]];
  normalizeCurrentSceneOrder();
  const affected=new Set([index-1,index,index+1,target-1,target,target+1]);
  affected.forEach(i=>{
    if(i>=0 && i<currentScenes.length) currentScenes[i].continuity_review_required=true;
  });
  renderScenes(currentScenes,{providerLabel:'Đã sắp xếp · cần rà continuity'});
  scheduleAutosave();
}

function splitScene(id){
  const index=currentScenes.findIndex(scene=>scene.id===id);
  if(index<0) return;
  const scene=currentScenes[index];
  const text=String(scene.narration||'').trim();
  const sentences=text.match(/[^.!?…]+[.!?…]?/g)?.map(x=>x.trim()).filter(Boolean)||[];
  if(sentences.length<2){
    showToast('Scene cần ít nhất 2 câu để tách tự động.');
    return;
  }
  const midpoint=Math.ceil(sentences.length/2);
  const left=sentences.slice(0,midpoint).join(' ');
  const right=sentences.slice(midpoint).join(' ');
  const baseDuration=Math.max(4,Number(scene.duration_seconds)||8);
  const first={...scene,narration:left,duration_seconds:Math.max(2,Math.round(baseDuration/2)),title:scene.title+' · A',image_asset:null,audio_asset:null,material_key:'',locked:false,visual_review_required:true,continuity_review_required:true,qa_status:'pending'};
  const second={...scene,id:'scene_'+Date.now().toString(36),narration:right,duration_seconds:Math.max(2,baseDuration-Math.round(baseDuration/2)),title:scene.title+' · B',image_asset:null,audio_asset:null,material_key:'',locked:false,visual_review_required:true,continuity_review_required:true,qa_status:'pending'};
  currentScenes.splice(index,1,first,second);
  normalizeCurrentSceneOrder();
  renderScenes(currentScenes,{providerLabel:'Đã tách scene'});
  scheduleAutosave();
}

function mergeSceneWithNext(id){
  const index=currentScenes.findIndex(scene=>scene.id===id);
  if(index<0 || index>=currentScenes.length-1){
    showToast('Không có scene kế tiếp để gộp.');
    return;
  }
  const a=currentScenes[index], b=currentScenes[index+1];
  if((a.locked||b.locked) && !confirm('Một trong hai scene đang khóa. Vẫn gộp scene?')) return;
  const merged={
    ...a,
    title:a.title+' + '+b.title,
    narration:[a.narration,b.narration].filter(Boolean).join(' '),
    duration_seconds:Math.min(60,Number(a.duration_seconds||0)+Number(b.duration_seconds||0)),
    visual_intent:[a.visual_intent,b.visual_intent].filter(Boolean).join(' · '),
    continuity_notes:[a.continuity_notes,b.continuity_notes].filter(Boolean).join(' · '),
    visual_description:[a.visual_description,b.visual_description].filter(Boolean).join(' '),
    image_prompt:[a.image_prompt,b.image_prompt].filter(Boolean).join(', '),
    image_asset:null,audio_asset:null,material_key:'',locked:false,
    visual_review_required:true,continuity_review_required:true,qa_status:'pending'
  };
  currentScenes.splice(index,2,merged);
  normalizeCurrentSceneOrder();
  renderScenes(currentScenes,{providerLabel:'Đã gộp scene'});
  scheduleAutosave();
}

function toggleSceneLock(id){
  const scene=sceneById(id);
  if(!scene) return;
  scene.locked=!scene.locked;
  renderScenes(currentScenes,{providerLabel:scene.locked?'Đã khóa':'Đã mở khóa'});
  scheduleAutosave();
}

function renderScenes(scenes,meta){
  currentScenes=(Array.isArray(scenes)?scenes:[]).map((scene,index)=>normalizeSceneClient(scene,index));
  normalizeCurrentSceneOrder();
  sceneList.innerHTML='';
  sceneList.classList.toggle('scene-list-mode',sceneViewMode==='list');
  applySceneAspectClass();

  currentScenes.forEach((scene,index)=>{
    const qa=sceneQa(scene);
    scene.qa_status=qa.ready?'pass':'needs_review';

    const card=document.createElement('article');
    card.className='scene-card storyboard-card'+(scene.locked?' scene-locked':'')+(qa.ready?' scene-qa-pass':' scene-qa-warn');
    card.dataset.sceneId=scene.id;

    const imageBox=document.createElement('div');
    imageBox.className='scene-image storyboard-media';
    const imageStatus=document.createElement('div');
    imageStatus.className='scene-image-status storyboard-placeholder';
    imageStatus.innerHTML='<span>▦</span><strong>Chưa có hình ảnh</strong><small>Scene '+String(scene.order||index+1).padStart(2,'0')+'</small>';
    imageBox.appendChild(imageStatus);

    if(scene.image_asset?.b64_json){
      const restored=document.createElement('img');
      restored.alt='Ảnh '+(scene.title||scene.id);
      restored.src='data:'+(scene.image_asset.mime_type||'image/jpeg')+';base64,'+scene.image_asset.b64_json;
      imageStatus.innerHTML='<small>Ảnh đã lưu</small>';
      imageBox.prepend(restored);
    }

    const head=document.createElement('div');
    head.className='scene-card-head storyboard-head';

    const idx=document.createElement('div');
    idx.className='scene-index';
    const num=document.createElement('span');
    num.className='scene-number';
    num.textContent=String(scene.order||index+1).padStart(2,'0');

    const titleWrap=document.createElement('div');
    const title=document.createElement('h3');
    title.textContent=escapeText(scene.title||('Cảnh '+(index+1)));
    const sub=document.createElement('small');
    sub.textContent=escapeText(scene.id);
    titleWrap.append(title,sub);
    idx.append(num,titleWrap);

    const metaWrap=document.createElement('div');
    metaWrap.className='scene-card-meta';
    const purpose=document.createElement('span');
    purpose.className='scene-purpose-chip';
    purpose.textContent=SCENE_PURPOSE_LABELS[scene.purpose]||'Other';
    const qaChip=document.createElement('span');
    qaChip.className='scene-card-qa '+(qa.ready?'ready':'warn');
    qaChip.textContent='QA '+qa.score+'%';
    const lockChip=document.createElement('span');
    lockChip.className='scene-lock-chip'+(scene.locked?' locked':'');
    lockChip.textContent=scene.locked?'🔒':'';
    const duration=document.createElement('span');
    duration.className='scene-duration';
    duration.textContent=(scene.audio_duration_seconds||scene.duration_seconds||0)+' giây';
    metaWrap.append(purpose,qaChip,lockChip,duration);
    head.append(idx,metaWrap);

    const intent=document.createElement('p');
    intent.className='scene-visual-intent-preview';
    intent.textContent=scene.visual_intent?('Visual intent: '+scene.visual_intent):'Visual intent chưa được xác định.';

    const narration=document.createElement('p');
    narration.className='scene-narration-preview';
    narration.textContent=escapeText(scene.narration||'Chưa có lời đọc.');

    const details=document.createElement('details');
    details.className='scene-details';
    const summary=document.createElement('summary');
    summary.textContent='Chi tiết & QA';
    const grid=document.createElement('div');
    grid.className='scene-grid';

    const fields=[
      ['Mục đích',SCENE_PURPOSE_LABELS[scene.purpose]||scene.purpose,'',false],
      ['Shot type',scene.shot_type,'',false],
      ['Lời đọc',scene.narration,'full',false],
      ['Visual intent',scene.visual_intent,'full',false],
      ['Continuity',scene.continuity_notes||'Không có yêu cầu continuity riêng.','full',false],
      ['Mô tả hình ảnh',scene.visual_description,'full',false],
      ['Image prompt',scene.image_prompt,'full',true]
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

    const qaBox=document.createElement('div');
    qaBox.className='scene-qa-checklist full';
    qa.checks.forEach(([label,ok])=>{
      const item=document.createElement('span');
      item.className=ok?'pass':'fail';
      item.textContent=(ok?'✓ ':'○ ')+label;
      qaBox.appendChild(item);
    });
    grid.appendChild(qaBox);
    details.append(summary,grid);

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
    }

    const editActions=document.createElement('div');
    editActions.className='scene-edit-actions';
    const makeAction=(label,action,disabled=false)=>{
      const button=document.createElement('button');
      button.type='button';
      button.textContent=label;
      button.disabled=disabled;
      button.dataset.sceneEditAction=action;
      return button;
    };
    const editBtn=makeAction('Sửa','edit');
    const lockBtn=makeAction(scene.locked?'Mở khóa':'Khóa','lock');
    const upBtn=makeAction('↑','up',index===0);
    const downBtn=makeAction('↓','down',index===currentScenes.length-1);
    const splitBtn=makeAction('Tách','split');
    const mergeBtn=makeAction('Gộp tiếp','merge',index===currentScenes.length-1);
    editActions.append(editBtn,lockBtn,upBtn,downBtn,splitBtn,mergeBtn);

    editBtn.addEventListener('click',()=>openSceneEditor(scene));
    lockBtn.addEventListener('click',()=>toggleSceneLock(scene.id));
    upBtn.addEventListener('click',()=>moveScene(scene.id,-1));
    downBtn.addEventListener('click',()=>moveScene(scene.id,1));
    splitBtn.addEventListener('click',()=>splitScene(scene.id));
    mergeBtn.addEventListener('click',()=>mergeSceneWithNext(scene.id));

    const assetActions=document.createElement('div');
    assetActions.className='scene-actions storyboard-actions';
    const voiceBtn=document.createElement('button');
    voiceBtn.className='scene-voice-btn';
    voiceBtn.textContent=scene.audio_asset?.b64_audio?'Tạo lại giọng':'Tạo giọng';
    const imageBtn=document.createElement('button');
    imageBtn.className='scene-image-btn';
    imageBtn.textContent=scene.image_asset?.b64_json?'Tạo lại ảnh':'Tạo ảnh';
    assetActions.append(voiceBtn,imageBtn);

    card.append(imageBox,head,intent,narration,details,audioBox,editActions,assetActions);

    voiceBtn.addEventListener('click',()=>generateSceneVoice(scene,card,voiceBtn));
    imageBtn.addEventListener('click',()=>generateSceneImage(scene,card,imageBtn));

    const activeImageProvider=document.getElementById('imageProvider')?.value||'gemini';
    if(imageProviderBlocked[activeImageProvider]){
      imageBtn.disabled=true;
      imageBtn.textContent='Hết quota ảnh';
    }else if(!providerAvailability[activeImageProvider]){
      imageBtn.disabled=true;
      imageBtn.textContent=activeImageProvider==='ktn'
        ? (providerConfiguredState.ktn?'Runtime offline':'Chưa cấu hình')
        : 'Thiếu API key';
    }

    sceneList.appendChild(card);
  });

  sceneEmpty.classList.toggle('hidden',currentScenes.length>0);
  sceneList.classList.toggle('hidden',currentScenes.length===0);
  subtitleBtn.disabled=currentScenes.length===0;
  if(currentScenes.length){
    subtitleEmpty.classList.remove('hidden');
    subtitleOutput.classList.add('hidden');
    currentSrt='';
  }
  setSceneView(sceneViewMode);
  updateSceneQaSummary();
  renderAssetLibrary();
  renderVoiceWorkspace();
  updateWorkspaceContext();
  scheduleAutosave();
  if(meta?.providerLabel) showToast('Storyboard cập nhật · '+currentScenes.length+' cảnh · '+meta.providerLabel+'.');
}

async function analyzeScript(action){
  const script=scriptResult.value.trim();
  const provider=document.getElementById('scriptProvider').value||currentScriptProvider;
  const model=selectedScriptModel();
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
      body:JSON.stringify({
        action,script,provider,model,language,
        platformMode:document.getElementById('platformMode')?.value||'youtube_long',
        topic:document.getElementById('topic').value.trim()
      })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('HTTP '+res.status));

    if(action==='keywords'){
      renderKeywords(data.keywords||[],data);
    }else{
      const incoming=(data.scenes||[]).map((scene,index)=>normalizeSceneClient(scene,index));
      const lockedByOrder=new Map(
        currentScenes.filter(scene=>scene.locked).map(scene=>[Number(scene.order),scene])
      );
      const merged=incoming.map((scene,index)=>lockedByOrder.get(index+1)||scene);
      for(const [order,locked] of lockedByOrder.entries()){
        if(order>merged.length) merged.push(locked);
      }
      renderScenes(merged,data);
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
    if(btn.dataset.section==='channels'){
      renderChannelProfileLibrary();
      document.getElementById('channelProfilesSection').scrollIntoView({behavior:'smooth',block:'start'});
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

function emptyScriptWorkflow(){
  return {
    version:'v1-multipass',
    status:'idle',
    angle:null,
    outline:null,
    hook:'',
    sections:[],
    draft:'',
    rewritten:'',
    qa:null,
    repaired:false,
    final:'',
    provider:'',
    model:'',
    startedAt:'',
    completedAt:''
  };
}

function setScriptStage(stage,state,label=''){
  const map={
    angle:'sqStageAngle',
    outline:'sqStageOutline',
    draft:'sqStageDraft',
    rewrite:'sqStageRewrite',
    qa:'sqStageQa'
  };
  const el=document.getElementById(map[stage]);
  if(!el) return;
  el.classList.remove('running','pass','fail');
  if(state) el.classList.add(state);
  const small=el.querySelector('small');
  if(small) small.textContent=label||({running:'Đang chạy',pass:'PASS',fail:'FAIL'}[state]||'Chờ');
}

function setScriptWorkflowProgress(percent,label){
  const pct=Math.max(0,Math.min(100,Math.round(Number(percent)||0)));
  const bar=document.getElementById('scriptWorkflowBar');
  const value=document.getElementById('scriptWorkflowProgressValue');
  const text=document.getElementById('scriptWorkflowProgressLabel');
  if(bar) bar.style.width=pct+'%';
  if(value) value.textContent=pct+'%';
  if(text) text.textContent=label||'';
}

function renderScriptWorkflowArtifacts(){
  const panel=document.getElementById('scriptQualityPanel');
  if(!panel) return;
  const hasData=Boolean(
    currentScriptWorkflow?.status!=='idle' ||
    currentScriptWorkflow?.angle ||
    currentScriptWorkflow?.outline ||
    currentScriptWorkflow?.qa
  );
  panel.classList.toggle('hidden',!hasData);
  if(!hasData) return;

  const angle=currentScriptWorkflow.angle||{};
  const outline=currentScriptWorkflow.outline||{};
  const qa=currentScriptWorkflow.qa||{};
  const assign=(id,value)=>{
    const el=document.getElementById(id);
    if(el) el.textContent=value??'';
  };

  assign('scriptAngleTitle',angle.angle||'—');
  assign('scriptAngleSummary',angle.viewer_question?('Câu hỏi trung tâm: '+angle.viewer_question):'Chưa có Angle.');
  assign('scriptAnglePromise',angle.promise?('Lời hứa nội dung: '+angle.promise):'');
  assign('scriptOutlineTitle',outline.title||'—');

  const list=document.getElementById('scriptOutlineList');
  if(list){
    list.innerHTML='';
    (Array.isArray(outline.sections)?outline.sections:[]).forEach((section,index)=>{
      const row=document.createElement('div');
      const num=document.createElement('span');
      num.textContent=String(index+1).padStart(2,'0');
      const body=document.createElement('div');
      const strong=document.createElement('strong');
      strong.textContent=section.title||('Phần '+(index+1));
      const small=document.createElement('small');
      small.textContent=section.purpose||section.viewer_question||'';
      body.append(strong,small);
      row.append(num,body);
      list.appendChild(row);
    });
  }

  const score=Number(qa.score);
  assign('scriptQaScore',Number.isFinite(score)?score:'—');
  assign('scriptQaDecision',qa.decision||'Chưa chấm');
  const qaDetails=document.getElementById('scriptQaDetails');
  if(qaDetails){
    const show=Boolean(qa && Object.keys(qa).length);
    qaDetails.classList.toggle('hidden',!show);
    assign('scriptQaProblems',Array.isArray(qa.problems)&&qa.problems.length?qa.problems.join(' · '):'Không có lỗi lớn được ghi nhận.');
    assign('scriptQaPlan',Array.isArray(qa.rewrite_plan)&&qa.rewrite_plan.length?qa.rewrite_plan.join(' · '):(qa.decision||'—'));
  }
}

function collectScriptWorkflowInput(){
  const topic=document.getElementById('topic').value.trim();
  const platformMode=document.getElementById('platformMode').value;
  const provider=document.getElementById('scriptProvider').value;
  const model=selectedScriptModel();
  const language=document.getElementById('scriptLanguage').value;
  const paragraphs=Number(document.getElementById('paragraphCount').value||6);
  const duration=document.getElementById('targetDuration').value;
  const extraInstruction=document.getElementById('extraInstruction').value.trim();
  const contentBrief={
    targetAudience:document.getElementById('targetAudience').value.trim(),
    contentGoal:document.getElementById('contentGoal').value,
    contentTone:document.getElementById('contentTone').value,
    expertiseLevel:document.getElementById('expertiseLevel').value,
    anglePreference:document.getElementById('anglePreference').value.trim(),
    ctaStyle:document.getElementById('ctaStyle').value,
    sourceNotes:document.getElementById('sourceNotes').value.trim(),
    forbiddenContent:document.getElementById('forbiddenContent').value.trim()
  };
  const channelProfile=getSelectedChannelProfile();
  if(!topic) throw new Error('Hãy nhập chủ đề video trước.');
  if(!channelProfile) throw new Error('Hãy chọn Channel Profile trước khi AI viết kịch bản.');

  contentBrief.targetAudience=contentBrief.targetAudience||channelProfile.targetAudience;
  contentBrief.contentGoal=contentBrief.contentGoal||channelProfile.defaultGoal;
  contentBrief.contentTone=contentBrief.contentTone||channelProfile.defaultTone;
  contentBrief.expertiseLevel=contentBrief.expertiseLevel||channelProfile.defaultExpertise;
  contentBrief.ctaStyle=contentBrief.ctaStyle||channelProfile.defaultCta;
  contentBrief.forbiddenContent=[channelProfile.forbiddenContent,contentBrief.forbiddenContent]
    .filter(Boolean).join('; ');

  if(!contentBrief.targetAudience) throw new Error('Channel Profile hoặc Content Brief cần có người xem mục tiêu.');

  return {
    topic,platformMode,provider,model,language,paragraphs,duration,extraInstruction,
    contentBrief,
    channelBible:channelProfileToBible(channelProfile)
  };
}

async function callScriptWorkflowStage(stage,base,workflow={}){
  const res=await fetch('/api/script-workflow',{
    method:'POST',
    headers:{'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify({...base,stage,workflow})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||('Script workflow HTTP '+res.status));
  return data;
}

function resetDownstreamAfterScript(){
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
}

async function runProfessionalScriptWorkflow(){
  let base;
  try{
    base=collectScriptWorkflowInput();
  }catch(error){
    showToast(error.message);
    return;
  }

  currentScriptWorkflow=emptyScriptWorkflow();
  currentScriptWorkflow.status='running';
  currentScriptWorkflow.provider=base.provider;
  currentScriptWorkflow.model=base.model;
  currentScriptWorkflow.startedAt=new Date().toISOString();

  ['angle','outline','draft','rewrite','qa'].forEach(stage=>setScriptStage(stage,'','Chờ'));
  setScriptWorkflowProgress(0,'Khởi tạo Script Quality Pipeline...');
  renderScriptWorkflowArtifacts();

  generateBtn.disabled=true;
  generateBtnText.innerHTML='<span class="loading-dot"></span>Đang chạy multi-pass...';
  backendStatus.textContent='Script Quality Pipeline đang xử lý...';
  backendStatus.className='preview-badge';

  try{
    setScriptStage('angle','running');
    setScriptWorkflowProgress(5,'Đang tìm Angle tốt nhất...');
    const angleResult=await callScriptWorkflowStage('angle',base,{});
    currentScriptWorkflow.angle=angleResult.output;
    setScriptStage('angle','pass');
    setScriptWorkflowProgress(12,'Angle PASS');
    renderScriptWorkflowArtifacts();

    setScriptStage('outline','running');
    const outlineResult=await callScriptWorkflowStage('outline',base,{angle:currentScriptWorkflow.angle});
    const outline=outlineResult.output||{};
    if(!Array.isArray(outline.sections)||!outline.sections.length){
      throw new Error('Outline không có section hợp lệ.');
    }
    currentScriptWorkflow.outline=outline;
    setScriptStage('outline','pass');
    setScriptWorkflowProgress(22,'Outline PASS · '+outline.sections.length+' phần');
    renderScriptWorkflowArtifacts();

    setScriptStage('draft','running','Hook');
    const hookResult=await callScriptWorkflowStage('hook',base,{
      angle:currentScriptWorkflow.angle,
      outline:currentScriptWorkflow.outline
    });
    currentScriptWorkflow.hook=String(hookResult.output||'').trim();
    if(!currentScriptWorkflow.hook) throw new Error('Hook rỗng.');

    currentScriptWorkflow.sections=[];
    let rolling=[currentScriptWorkflow.hook];
    for(let i=0;i<outline.sections.length;i++){
      const section=outline.sections[i];
      const nextSection=outline.sections[i+1]||null;
      const previousEnding=rolling.join('\n\n').slice(-2200);
      setScriptStage('draft','running','Phần '+(i+1)+'/'+outline.sections.length);
      const pct=28+Math.round(((i+1)/outline.sections.length)*38);
      setScriptWorkflowProgress(pct,'Đang viết '+(section.title||('phần '+(i+1)))+'...');
      const sectionResult=await callScriptWorkflowStage('section',base,{
        angle:currentScriptWorkflow.angle,
        outline:currentScriptWorkflow.outline,
        section,
        nextSection,
        previousEnding
      });
      const text=String(sectionResult.output||'').trim();
      if(!text) throw new Error('Section '+(i+1)+' rỗng.');
      currentScriptWorkflow.sections.push({
        id:section.id||('s'+(i+1)),
        title:section.title||('Phần '+(i+1)),
        text
      });
      rolling.push(text);
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    currentScriptWorkflow.draft=[currentScriptWorkflow.hook,...currentScriptWorkflow.sections.map(x=>x.text)]
      .filter(Boolean).join('\n\n');
    setScriptStage('draft','pass',outline.sections.length+' phần');
    setScriptWorkflowProgress(68,'Draft hoàn tất');

    setScriptStage('rewrite','running');
    const rewriteResult=await callScriptWorkflowStage('rewrite',base,{
      angle:currentScriptWorkflow.angle,
      outline:currentScriptWorkflow.outline,
      script:currentScriptWorkflow.draft
    });
    currentScriptWorkflow.rewritten=String(rewriteResult.output||'').trim();
    if(!currentScriptWorkflow.rewritten) throw new Error('Humanize trả về nội dung rỗng.');
    setScriptStage('rewrite','pass');
    setScriptWorkflowProgress(82,'Humanize PASS');

    setScriptStage('qa','running');
    let qaResult=await callScriptWorkflowStage('qa',base,{
      angle:currentScriptWorkflow.angle,
      outline:currentScriptWorkflow.outline,
      script:currentScriptWorkflow.rewritten
    });
    currentScriptWorkflow.qa=qaResult.output||{};
    let finalScript=currentScriptWorkflow.rewritten;
    let score=Number(currentScriptWorkflow.qa?.score)||0;

    if(score<80 || String(currentScriptWorkflow.qa?.decision||'').toUpperCase()!=='PASS'){
      setScriptWorkflowProgress(91,'QA '+score+'/100 · đang sửa vòng cuối...');
      const repairResult=await callScriptWorkflowStage('repair',base,{
        angle:currentScriptWorkflow.angle,
        outline:currentScriptWorkflow.outline,
        script:finalScript,
        qa:currentScriptWorkflow.qa
      });
      finalScript=String(repairResult.output||'').trim();
      if(!finalScript) throw new Error('Repair trả về nội dung rỗng.');
      currentScriptWorkflow.repaired=true;

      qaResult=await callScriptWorkflowStage('qa',base,{
        angle:currentScriptWorkflow.angle,
        outline:currentScriptWorkflow.outline,
        script:finalScript
      });
      currentScriptWorkflow.qa=qaResult.output||currentScriptWorkflow.qa;
      score=Number(currentScriptWorkflow.qa?.score)||score;
    }

    currentScriptWorkflow.final=finalScript;
    currentScriptWorkflow.status='complete';
    currentScriptWorkflow.completedAt=new Date().toISOString();
    setScriptStage('qa','pass',(score||0)+'/100');
    setScriptWorkflowProgress(100,'Hoàn tất · QA '+(score||0)+'/100');
    renderScriptWorkflowArtifacts();

    currentScriptProvider=base.provider;
    scriptEmpty.classList.add('hidden');
    scriptDemo.classList.remove('hidden');
    scriptTitle.textContent=base.topic;
    scriptResult.value=finalScript;
    updateScriptStats();
    scriptMeta.textContent='Multi-pass · '+(PLATFORM_PRESETS[base.platformMode]?.label||base.platformMode)+
      ' · '+(SCRIPT_MODEL_REGISTRY[base.provider]?.label||base.provider)+' · '+base.model+
      ' · QA '+(score||0)+'/100'+(currentScriptWorkflow.repaired?' · repaired':'');
    backendStatus.textContent='AI sẵn sàng · QA '+(score||0)+'/100';
    backendStatus.className='preview-badge '+(score>=80?'ready':'warn');

    resetDownstreamAfterScript();
    selectScriptTab('script');
    activateScriptTools();
    scheduleAutosave();
    updateWorkspaceContext();
    showToast('Đã tạo kịch bản Multi-pass · QA '+(score||0)+'/100.');
  }catch(err){
    currentScriptWorkflow.status='failed';
    const running=document.querySelector('.script-stage.running');
    if(running){
      running.classList.remove('running');
      running.classList.add('fail');
      const small=running.querySelector('small');
      if(small) small.textContent='FAIL';
    }
    setScriptWorkflowProgress(
      Number(document.getElementById('scriptWorkflowProgressValue')?.textContent?.replace('%',''))||0,
      err.message||'Script Quality Pipeline thất bại.'
    );
    renderScriptWorkflowArtifacts();
    backendStatus.textContent='Script Quality Pipeline cần kiểm tra';
    backendStatus.className='preview-badge warn';
    showToast(err.message||'Không thể tạo kịch bản Multi-pass.');
  }finally{
    generateBtn.disabled=false;
    generateBtnText.textContent='✦ Tạo kịch bản chất lượng';
  }
}

generateBtn.addEventListener('click',runProfessionalScriptWorkflow);

document.getElementById('goToSceneFromScriptBtn').addEventListener('click',()=>setWorkspace('scene'));

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
    updateScriptStats();
    updateWorkspaceContext();
    scheduleAutosave();
    showToast('Đã giữ bản chỉnh sửa trong phiên hiện tại.');
  }
});

keywordBtn.addEventListener('click',()=>analyzeScript('keywords'));
sceneBtn.addEventListener('click',()=>analyzeScript('scenes'));
document.getElementById('sceneBoardViewBtn').addEventListener('click',()=>setSceneView('board'));
document.getElementById('sceneListViewBtn').addEventListener('click',()=>setSceneView('list'));
document.getElementById('closeSceneEditorBtn').addEventListener('click',closeSceneEditor);
document.getElementById('sceneEditorCancelBtn').addEventListener('click',closeSceneEditor);
document.getElementById('sceneEditorSaveBtn').addEventListener('click',saveSceneEditor);
document.getElementById('sceneEditorModal').addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeSceneEditor();
});
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

function parseSrtTimestamp(value){
  const match=String(value||'').trim().match(/^(\d{2,}):(\d{2}):(\d{2}),(\d{3})$/);
  if(!match) return null;
  const h=Number(match[1]),m=Number(match[2]),sec=Number(match[3]),ms=Number(match[4]);
  if(m>59||sec>59) return null;
  return (((h*60+m)*60)+sec)*1000+ms;
}

function validateSrtText(text){
  const raw=String(text||'').replace(/\r\n/g,'\n').trim();
  const maxChars=Math.max(20,Math.min(84,Number(document.getElementById('subtitleMaxChars')?.value||42)));
  if(!raw) return {ready:false,cues:0,durationMs:0,errors:['SRT đang trống.'],warnings:[]};

  const blocks=raw.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
  const errors=[];
  const warnings=[];
  let previousEnd=-1;
  let durationMs=0;

  blocks.forEach((block,index)=>{
    const lines=block.split('\n').map(x=>x.trimEnd());
    const expected=index+1;
    const cueNumber=Number(lines[0]);
    if(!Number.isInteger(cueNumber) || cueNumber!==expected){
      errors.push('Cue '+expected+': số thứ tự phải liên tục từ 1.');
    }

    const timing=String(lines[1]||'').match(/^(.+?)\s+-->\s+(.+)$/);
    if(!timing){
      errors.push('Cue '+expected+': thiếu timeline hợp lệ.');
      return;
    }
    const startMs=parseSrtTimestamp(timing[1]);
    const endMs=parseSrtTimestamp(timing[2]);
    if(startMs===null||endMs===null){
      errors.push('Cue '+expected+': timestamp sai định dạng HH:MM:SS,mmm.');
      return;
    }
    if(endMs<=startMs) errors.push('Cue '+expected+': thời gian kết thúc phải lớn hơn bắt đầu.');
    if(previousEnd>=0 && startMs<previousEnd) errors.push('Cue '+expected+': timeline bị chồng lên cue trước.');
    const cueDuration=Math.max(0,endMs-startMs);
    if(cueDuration>0 && cueDuration<500) warnings.push('Cue '+expected+': thời lượng dưới 0,5 giây.');
    previousEnd=Math.max(previousEnd,endMs);
    durationMs=Math.max(durationMs,endMs);

    const textLines=lines.slice(2).filter(x=>x.trim());
    if(!textLines.length){
      errors.push('Cue '+expected+': thiếu nội dung phụ đề.');
    }
    textLines.forEach((line,lineIndex)=>{
      if(line.length>maxChars){
        warnings.push('Cue '+expected+' dòng '+(lineIndex+1)+': '+line.length+' ký tự > '+maxChars+'.');
      }
    });
  });

  return {
    ready:errors.length===0,
    cues:blocks.length,
    durationMs,
    errors,
    warnings
  };
}

function renderSubtitleQa({toastOnResult=false}={}){
  const qa=validateSrtText(currentSrt);
  const badge=document.getElementById('subtitleQaBadge');
  const details=document.getElementById('subtitleQaDetails');
  if(badge){
    badge.classList.remove('ready','warn','fail');
    if(!currentSrt){
      badge.textContent='Chưa có SRT';
    }else if(!qa.ready){
      badge.textContent='SRT FAIL';
      badge.classList.add('fail');
    }else if(qa.warnings.length){
      badge.textContent='PASS · '+qa.warnings.length+' cảnh báo';
      badge.classList.add('warn');
    }else{
      badge.textContent='SRT PASS';
      badge.classList.add('ready');
    }
  }
  if(details){
    const messages=[
      ...qa.errors.map(x=>'FAIL · '+x),
      ...qa.warnings.map(x=>'WARN · '+x)
    ];
    details.textContent=messages.length
      ? messages.slice(0,12).join('\n')
      : (currentSrt?'PASS · Timeline hợp lệ · '+qa.cues+' cue · '+formatSrtTime(qa.durationMs/1000):'');
    details.classList.toggle('hidden',!currentSrt);
  }
  if(toastOnResult){
    showToast(!qa.ready
      ? 'SRT chưa hợp lệ · '+qa.errors.length+' lỗi.'
      : ('SRT PASS · '+qa.cues+' cue'+(qa.warnings.length?' · '+qa.warnings.length+' cảnh báo':'')));
  }
  return qa;
}

function setSubtitleEditorValue(value,{updateMeta=false}={}){
  currentSrt=String(value||'');
  if(subtitlePreview) subtitlePreview.value=currentSrt;
  const qa=renderSubtitleQa();
  if(updateMeta && currentSrt){
    subtitleMeta.textContent=qa.cues+' câu · '+formatSrtTime(qa.durationMs/1000);
  }
  return qa;
}

function splitSubtitleText(text,maxChars){
  const cleaned=String(text||'').replace(/\s+/g,' ').trim();
  if(!cleaned) return [];
  const limit=Math.max(20,Math.min(84,Number(maxChars)||42));
  const sentences=cleaned.match(/[^.!?…]+[.!?…]?/g)||[cleaned];
  const chunks=[];
  for(const sentenceRaw of sentences){
    const sentence=sentenceRaw.trim();
    if(!sentence) continue;
    if(sentence.length<=limit){chunks.push(sentence);continue;}
    const words=sentence.split(' ');
    let line='';
    for(const word of words){
      const next=line?line+' '+word:word;
      if(next.length>limit && line){chunks.push(line);line=word;}
      else line=next;
    }
    if(line) chunks.push(line);
  }
  return chunks;
}

function buildSrt(){
  if(!currentScenes.length){showToast('Cần chia cảnh trước khi tạo phụ đề.');return;}
  const maxChars=Math.max(20,Math.min(84,Number(document.getElementById('subtitleMaxChars').value||42)));
  const gap=Math.max(0,Math.min(2,Number(document.getElementById('subtitleGap').value||0)));
  const subtitleScenes=currentScenes.map(scene=>({
    scene,
    chunks:splitSubtitleText(scene.narration,maxChars)
  })).filter(item=>item.chunks.length);

  if(!subtitleScenes.length){
    showToast('Không có narration để tạo phụ đề.');
    return;
  }

  let cursor=0;
  let cue=1;
  const blocks=[];

  subtitleScenes.forEach((item,sceneIndex)=>{
    const {scene,chunks}=item;
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

    cursor+=duration;
    if(sceneIndex<subtitleScenes.length-1) cursor+=gap;
  });

  setSubtitleEditorValue(blocks.join('\n\n')+'\n',{updateMeta:true});
  subtitleMeta.textContent=(cue-1)+' câu · '+formatSrtTime(cursor)+' · '+subtitleScenes.length+' cảnh';
  subtitleEmpty.classList.add('hidden');
  subtitleOutput.classList.remove('hidden');
  document.getElementById('subtitleSection').scrollIntoView({behavior:'smooth',block:'start'});
  updateRenderReadiness();
  renderAssetLibrary();
  scheduleAutosave();
  const qa=renderSubtitleQa();
  showToast(qa.ready
    ? 'Đã tạo SRT · '+(cue-1)+' cue · QA PASS.'
    : 'Đã tạo SRT nhưng cần sửa '+qa.errors.length+' lỗi trước khi render.');
}

subtitleBtn.addEventListener('click',buildSrt);
subtitlePreview.addEventListener('input',()=>{
  currentSrt=subtitlePreview.value;
  const qa=renderSubtitleQa();
  subtitleMeta.textContent=qa.cues
    ? qa.cues+' câu · '+formatSrtTime(qa.durationMs/1000)+' · đã chỉnh sửa'
    : 'SRT đang chỉnh sửa';
  updateRenderReadiness();
  renderAssetLibrary();
  scheduleAutosave();
});
document.getElementById('validateSrtBtn').addEventListener('click',()=>renderSubtitleQa({toastOnResult:true}));
document.getElementById('downloadSrtBtn').addEventListener('click',()=>{
  if(!currentSrt){showToast('Chưa có nội dung SRT để tải.');return;}
  const qa=validateSrtText(currentSrt);
  if(!qa.ready){
    showToast('SRT có '+qa.errors.length+' lỗi cấu trúc. Hãy sửa trước khi tải.');
    return;
  }
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
  const subtitleQa=validateSrtText(currentSrt);
  const subtitlesReady=!currentSrt || subtitleQa.ready;
  setReadiness(
    'subtitles',
    Boolean(currentSrt)&&subtitleQa.ready,
    !currentSrt?'Tùy chọn':(subtitleQa.ready?'SRT hợp lệ':'SRT có '+subtitleQa.errors.length+' lỗi')
  );
  document.getElementById('renderBtn').disabled=!(
    hasScript && hasScenes && imagesReady && subtitlesReady && renderWorkerAvailable
  );
}

function buildRenderManifest(){
  const maxDuration=currentScenes.reduce((max,scene)=>Math.max(max,Math.ceil(Number(scene.audio_duration_seconds||scene.duration_seconds||5))),1);
  return {
    version:'ktn-render-manifest-v1',
    topic:document.getElementById('topic').value.trim(),
    script:scriptResult.value.trim(),
    voice:{
      provider:selectedVoiceProvider(),
      voice:selectedVoiceId(),
      languageCode:'vi-VN',
      stylePreset:document.getElementById('voiceStylePreset')?.value||'documentary',
      speed:Number(document.getElementById('voiceSpeed')?.value||1)
    },
    video:{
      aspect:document.getElementById('renderAspect').value,
      transition:document.getElementById('renderTransition').value||null,
      maxClipDuration:maxDuration,
      subtitles:Boolean(currentSrt)
    },
    subtitle_srt:currentSrt||'',
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
    renderWorkerAvailable=Boolean(res.ok && data.ready);
    status.textContent=renderWorkerAvailable?'Render worker sẵn sàng':data.configured?'Render worker chưa phản hồi':'Chưa cấu hình render worker';
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
    if(activeRenderTaskId){
      label.textContent='Tiếp tục theo dõi render đang chạy...';
      value.textContent='35%';
      bar.style.width='35%';
      await pollRenderTask(activeRenderTaskId);
      return;
    }
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
    rememberRenderTask(data.task_id);
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

  // Colab CPU + Edge TTS + MoviePy có thể cần lâu hơn nhiều so với 6 phút.
  // Theo dõi tối đa khoảng 60 phút; task_id được lưu để có thể tiếp tục sau reload.
  for(let attempt=0;attempt<1800;attempt++){
    await new Promise(resolve=>setTimeout(resolve,2000));
    const res=await fetch('/api/render-video?task_id='+encodeURIComponent(taskId),{headers:{accept:'application/json'}});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||'Không đọc được trạng thái render.');

    const p=Math.max(35,Math.min(99,Number(data.progress)||35));
    label.textContent=data.state_label||'Đang render video...';
    value.textContent=p+'%'; bar.style.width=p+'%';

    if(data.state==='failed'){
      clearRenderTask();
      throw new Error(data.error||'MPT render thất bại.');
    }
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
      clearRenderTask();
      button.disabled=false;
      return;
    }
  }

  label.textContent='Render vẫn đang chạy trên worker';
  result.textContent='Giao diện đã dừng theo dõi sau thời gian dài, nhưng task vẫn được giữ. Bấm Xuất MP4 để tiếp tục theo dõi cùng task, không tạo task mới.';
  button.disabled=false;
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
document.getElementById('saveProjectBtn').addEventListener('click',()=>{
  if(!activeProjectId){openNewProjectModal();return;}
  saveProjectNow();
});
document.getElementById('exportProjectBtn').addEventListener('click',exportProject);
document.getElementById('importProjectInput').addEventListener('change',e=>importProjectFile(e.target.files?.[0]));
document.getElementById('newProjectBtn').addEventListener('click',startNewProject);
document.getElementById('newProjectFromLibraryBtn').addEventListener('click',openNewProjectModal);
document.getElementById('newProjectEmptyBtn').addEventListener('click',openNewProjectModal);
document.getElementById('closeNewProjectModalBtn').addEventListener('click',closeNewProjectModal);
document.getElementById('cancelNewProjectBtn').addEventListener('click',closeNewProjectModal);
document.getElementById('confirmNewProjectBtn').addEventListener('click',createProjectFromModal);
document.getElementById('newProjectModal').addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeNewProjectModal();
});
document.getElementById('newProjectNameInput').addEventListener('keydown',e=>{
  if(e.key==='Enter') createProjectFromModal();
});
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
document.getElementById('scriptProvider').addEventListener('change',e=>{
  populateScriptModels(e.target.value,'');
  scheduleAutosave();
});
document.getElementById('scriptModel').addEventListener('change',scheduleAutosave);

document.getElementById('platformMode').addEventListener('change',e=>{
  configurePlatformMode(e.target.value,'',true);
  if(currentScenes.length) renderScenes(currentScenes,{providerLabel:'Đã đổi định dạng video'});
  scheduleAutosave();
});
document.getElementById('renderAspect').addEventListener('change',()=>{
  applySceneAspectClass();
  if(currentScenes.length) renderScenes(currentScenes,{providerLabel:'Đã đổi tỷ lệ khung hình'});
  scheduleAutosave();
});

document.getElementById('channelProfileSelect').addEventListener('change',e=>{
  selectChannelProfile(e.target.value,{applyDefaults:true,autosave:true});
  renderChannelProfileLibrary();
  updateWorkspaceContext();
});
document.getElementById('openChannelManagerBtn').addEventListener('click',()=>openChannelManager(document.getElementById('channelProfileSelect').value));
document.getElementById('newChannelProfileBtn').addEventListener('click',()=>{
  resetChannelEditor();
  document.getElementById('channelProfileName')?.focus();
});
document.getElementById('cancelChannelEditBtn').addEventListener('click',()=>resetChannelEditor());
document.getElementById('saveChannelProfileBtn').addEventListener('click',saveChannelProfileFromEditor);
document.getElementById('duplicateChannelProfileBtn').addEventListener('click',()=>{
  const id=document.getElementById('channelProfileId').value;
  if(id) duplicateChannelProfile(id);
});
document.getElementById('deleteChannelProfileBtn').addEventListener('click',()=>{
  const id=document.getElementById('channelProfileId').value;
  if(id) deleteChannelProfile(id);
});

document.getElementById('imageProvider').addEventListener('change',async()=>{
  updateImageProviderState();
  await saveProjectNow({silent:true});
});
document.getElementById('voiceProvider').addEventListener('change',async e=>{
  const provider=e.target.value||'gemini';
  populateVoiceSelectors(provider,'');
  renderVoiceLibrary();
  updateVoiceProviderState();
  renderVoiceWorkspace();
  scheduleAutosave();
});
document.getElementById('voiceName').addEventListener('change',e=>syncVoiceSelectors(e.target));
document.getElementById('voiceWorkspaceVoice').addEventListener('change',e=>syncVoiceSelectors(e.target));
document.getElementById('voiceStylePreset').addEventListener('change',scheduleAutosave);
document.getElementById('voiceSpeed').addEventListener('change',scheduleAutosave);
document.getElementById('voiceStyleInstruction').addEventListener('input',scheduleAutosave);

document.getElementById('voicePreviewBtn').addEventListener('click',previewVoice);
document.getElementById('voiceBatchConfirm').addEventListener('change',updateVoiceBatchButton);
document.getElementById('voiceBatchScope').addEventListener('change',updateVoiceBatchButton);
document.getElementById('voiceBatchBtn').addEventListener('click',runVoiceBatch);
document.getElementById('voiceBatchPauseBtn').addEventListener('click',pauseVoiceBatch);
document.getElementById('voiceBatchResumeBtn').addEventListener('click',resumeVoiceBatch);
document.getElementById('voiceBatchRetryBtn').addEventListener('click',retryFailedVoiceBatch);
document.getElementById('voiceBatchCancelBtn').addEventListener('click',cancelVoiceBatch);

document.getElementById('refreshVoiceWorkspaceBtn').addEventListener('click',async()=>{
  await refreshVoiceLibrary({preserveSelection:true,silent:true});
  renderVoiceWorkspace();
});
document.getElementById('refreshVoiceLibraryBtn').addEventListener('click',()=>refreshVoiceLibrary({preserveSelection:true}));
document.getElementById('openVoiceCloneBtn').addEventListener('click',openVoiceCloneModal);
document.getElementById('closeVoiceCloneBtn').addEventListener('click',closeVoiceCloneModal);
document.getElementById('cancelVoiceCloneBtn').addEventListener('click',closeVoiceCloneModal);
document.getElementById('createVoiceCloneBtn').addEventListener('click',createVoiceClone);
document.getElementById('voiceCloneProvider').addEventListener('change',updateVoiceCloneProviderUi);
document.getElementById('voiceCloneModal').addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeVoiceCloneModal();
});
try{sceneViewMode=localStorage.getItem('ktn-scene-view-mode')||'board';}catch(_error){}
loadChannelProfiles();
refreshChannelProfileSelect();
renderChannelProfileLibrary();
resetChannelEditor();
populateScriptModels(document.getElementById('scriptProvider')?.value||'gemini','');
populateVoiceSelectors(document.getElementById('voiceProvider')?.value||'gemini','Kore');
bindWorkspaceNavigation();
updateProjectNavigationState();
configurePlatformMode(document.getElementById('platformMode')?.value||'youtube_long',document.getElementById('targetDuration')?.value||'8-12m',false);
activateScriptTools();
updateImageProviderState();
updateVoiceProviderState();
renderVoiceWorkspace();
updateRenderReadiness();
renderAssetLibrary();
renderProjectLibrary();
bindAutosave();
refreshBackendStatus();
refreshVoiceLibrary({preserveSelection:true,silent:true});
refreshRenderWorker();
refreshSystemStatus();
loadAutosavedProject();
setWorkspace(workspaceFromLocation(),{updateHash:false});
updateWorkspaceContext();
