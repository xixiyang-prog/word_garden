(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const LOCAL_KEY='word-garden:v1';
  const MODE_KEY='word-garden:file-mode';
  const WINDOW_MARKER='word-garden:file-mode';
  let pending=window.name===WINDOW_MARKER;
  try {pending=pending||sessionStorage.getItem(MODE_KEY)==='local';} catch(e) {}
  let handle=null, dirty=false, operation=false, pendingWrites=0, queue=Promise.resolve(), hooks=null;
  const supported=typeof window.showSaveFilePicker==='function' && typeof window.showOpenFilePicker==='function';
  $('.main-content').insertAdjacentHTML('afterbegin','<section class="storage-strip" aria-label="数据保存位置"><span id="storage-indicator">●</span><div><strong id="storage-status">浏览器保存</strong><p id="storage-detail">题库和图片保存在当前浏览器，可随时转存本地文件。</p></div><button class="button secondary" id="storage-settings">保存位置</button></section>');
  document.body.insertAdjacentHTML('beforeend','<dialog id="storage-dialog" class="form-dialog"><div class="dialog-top"><span class="eyebrow">KEEP YOUR WORDS SAFE</span><button type="button" class="icon-button" data-close="storage-dialog" aria-label="关闭">×</button></div><h2>选择保存位置</h2><p class="dialog-description">本地文件包含题目、图片和学习记录，不受浏览器小容量缓存的限制。</p><div class="storage-actions"><button type="button" class="button primary" id="storage-create">将当前题库存到本地文件</button><button type="button" class="button secondary" id="storage-open">打开已有本地题库</button><button type="button" class="button secondary" id="storage-retry">立即保存当前本地文件</button><button type="button" class="text-link" id="storage-browser">切回浏览器保存</button></div><p class="storage-note">第一次请选一个便于找到的 JSON 文件。以后在同一文件中自动更新；重新打开网页后，需要再次“打开已有本地题库”。仅打开文件不会改写原文件。一次只在一个页面使用同一文件。</p><p id="storage-support" class="storage-note"></p><p id="storage-message" class="storage-message" role="status"></p><div class="dialog-actions"><button type="button" class="button secondary" data-close="storage-dialog">完成</button></div></dialog>');
  $('#editor-error').insertAdjacentHTML('afterend','<button type="button" class="text-link" id="editor-localfile" hidden>浏览器空间不足？转存到本地文件</button>');
  $('#bulk-error').insertAdjacentHTML('afterend','<button type="button" class="text-link" id="bulk-localfile" hidden>无法保存？选择本地文件保存</button>');
  function markMode(local) {
    // A tab marker also works when browser storage itself is unavailable.
    if(local)window.name=WINDOW_MARKER;else if(window.name===WINDOW_MARKER)window.name='';
    try {if(local)sessionStorage.setItem(MODE_KEY,'local');else sessionStorage.removeItem(MODE_KEY);} catch(e) {}
  }
  function render(message='') {
    const busy=operation||pendingWrites>0;
    $('#storage-status').textContent=handle ? (busy?'正在写入本地文件…':dirty?'本地文件有未保存内容':'已保存到本地文件') : pending?'请重新打开本地题库':dirty?'浏览器无法保存':'浏览器保存';
    $('#storage-detail').textContent=handle ? handle.name+' · 题目、图片和学习记录均写入此文件。关闭前请确认显示“已保存”。' : pending?'上次使用了本地文件。本页暂不加载旧浏览器题库，请先重新打开文件，或选择切回浏览器保存。':'题库和图片保存在当前浏览器，可转存到电脑上的 JSON 文件。';
    $('.storage-strip').classList.toggle('storage-warning',dirty||pending);
    $('#storage-indicator').textContent=dirty||pending?'!':'●';
    $('#storage-retry').hidden=!handle;
    $('#storage-create').disabled=!supported||busy||pending;
    $('#storage-open').disabled=!supported||busy;
    $('#storage-retry').disabled=busy;
    $('#storage-browser').disabled=busy;
    $('#storage-support').textContent=supported?'本浏览器支持直接读写你选择的本地文件。':'此浏览器暂不支持直接读写本地文件。请改用桌面版 Edge / Chrome，或先使用“导出备份”下载题库；不会静默切换成未保存模式。';
    $('#editor-localfile').hidden=!dirty||!!handle||pending;
    $('#bulk-localfile').hidden=!dirty||!!handle||pending;
    if(message)$('#storage-message').textContent=message;
    const footer=document.querySelector('footer>span:last-child');
    if(footer)footer.textContent=handle?'数据保存在所选本地文件，请定期另存备份。':pending?'请重新打开本地文件后继续学习。':'数据保存在此浏览器，可在“保存位置”转存本地文件。';
    document.querySelectorAll('.local-label').forEach(el=>{el.textContent=handle?'● 本地文件保存':pending?'● 本地文件待打开':'● 浏览器保存 · 无需登录';});
  }
  async function write(target,text) {
    let writable;
    try {writable=await target.createWritable();await writable.write(text);await writable.close();}
    catch(error) {if(writable)try{await writable.abort();}catch(e){}throw error;}
  }
  function showSettings() {if(!$('#storage-dialog').open)$('#storage-dialog').showModal();render();}
  async function operationRun(task) {
    if(operation||pendingWrites||hooks?.busy()){render('正在保存题库，请稍候再切换保存位置。');return;}
    operation=true;render();
    try {await task();}
    catch(error) {
      if(error.name!=='AbortError')render('操作未完成：'+error.message+'。当前题库仍保留在页面中，请重试或导出备份。');
    } finally {operation=false;render();}
  }
  const types=[{description:'字有进步题库（JSON）',accept:{'application/json':['.json']}}];
  $('#storage-create').addEventListener('click',()=>operationRun(async()=>{
    const target=await window.showSaveFilePicker({suggestedName:'字有进步-本地题库.json',types});
    const text=hooks.snapshot();
    await write(target,text);
    handle=target;pending=false;dirty=false;markMode(true);
    hooks.persisted();
    render('已写入 '+target.name+'。后续操作会自动更新此文件。添加弹窗里的未保存内容请再次点击“保存到错字本”。');
  }));
  $('#storage-open').addEventListener('click',()=>operationRun(async()=>{
    if(hooks.hasUnsaved() && !confirm('当前页面或添加弹窗有未保存内容。打开文件会切换到该文件的题库，确定继续吗？请先保存或导出重要内容。'))return;
    const [target]=await window.showOpenFilePicker({multiple:false,types});
    if(!target)return;
    if(typeof target.requestPermission==='function' && await target.requestPermission({mode:'readwrite'})!=='granted')throw new Error('没有获得文件读写权限');
    const file=await target.getFile();
    if(file.size>200*1024*1024)throw new Error('本地题库超过 200 MB，请分成多个文件');
    let data;
    try {data=JSON.parse(await file.text());}catch(e){throw new Error('不是有效的 JSON 题库');}
    // Validate completely before replacing the currently displayed collection.
    const next=await hooks.validate(data);
    hooks.apply(next);
    handle=target;pending=false;dirty=false;markMode(true);
    render('已打开 '+target.name+'。修改后将自动写入此文件；原浏览器题库不被覆盖。');
  }));
  $('#storage-retry').addEventListener('click',async()=>{
    if(operation||pendingWrites)return;
    const ok=await window.WordGardenDisk.persist(hooks.snapshot());
    if(ok)render('当前题目、图片和学习记录已全部写入本地文件。');
  });
  $('#storage-browser').addEventListener('click',()=>operationRun(async()=>{
    if(!confirm(pending?'切回之前的浏览器题库？本地文件不会修改。':'将当前题库复制回浏览器保存？本地文件会保留。'))return;
    if(pending) {
      const raw=localStorage.getItem(LOCAL_KEY);
      const next=raw ? await hooks.validate(JSON.parse(raw)) : {version:1,words:[],history:[]};
      hooks.apply(next);
    } else {
      try {localStorage.setItem(LOCAL_KEY,hooks.snapshot());}
      catch(e) {throw new Error('浏览器空间不足或无法保存，请继续使用本地文件');}
    }
    handle=null;pending=false;dirty=false;markMode(false);
    hooks.persisted();
    render('已切回浏览器保存。本地文件未删除。');
  }));
  $('#storage-settings').addEventListener('click',showSettings);
  $('#editor-localfile').addEventListener('click',showSettings);
  $('#bulk-localfile').addEventListener('click',showSettings);
  window.addEventListener('beforeunload',event=>{
    if(dirty||pendingWrites){event.preventDefault();event.returnValue='';}
  });
  window.WordGardenDisk={
    configure(callbacks){hooks=callbacks;render();},
    needsReconnect(){return pending;},
    isBusy(){return operation;},
    isFile(){return !!handle;},
    async persist(text) {
      if(pending){render('请先重新打开本地文件，或切回浏览器保存。');return false;}
      if(!handle) {
        try {localStorage.setItem(LOCAL_KEY,text);dirty=false;render();return true;}
        catch(e) {dirty=true;render('浏览器空间不足或无法保存。点击“将当前题库存到本地文件”，选择位置后继续。未保存的添加内容仍保留在弹窗中。');return false;}
      }
      const target=handle;
      pendingWrites++;dirty=true;render();
      const job=queue.then(()=>write(target,text));
      queue=job.catch(()=>{});
      try {
        await job;
        // Only the latest queued snapshot may mark the file clean.
        if(pendingWrites===1)dirty=false;
        return true;
      } catch(e) {
        dirty=true;render('本地文件写入失败：'+e.message+'。页面保留当前内容，请重试、另存文件或导出备份。');return false;
      } finally {pendingWrites--;render();}
    },
    show:showSettings,
    markUnsaved(message){dirty=true;render(message);},
    status(){return {file:!!handle,pending,dirty,busy:operation||pendingWrites>0};}
  };
  render();
})();

