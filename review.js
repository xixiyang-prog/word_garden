(() => {
  'use strict';
  const B=window.ReviewBank, store=window.WordGardenStudy, disk=window.WordGardenDisk;
  const $=s=>document.querySelector(s);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shuffle=a=>{const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
  let subject='chinese',unit='all',skill='all',scope='all',session=null,saving=false,printHTML='';
  const units=()=>B.units.filter(u=>u.subject===subject);
  const skills=()=>units().filter(u=>unit==='all'||u.id===unit).flatMap(u=>u.skills);
  const skillName=id=>B.units.flatMap(u=>u.skills).find(s=>s.id===id)?.name||'';
  const subjectName=id=>B.subjects.find(s=>s.id===id).name;
  const typeName=q=>({choice:'辨析选择',input:'动笔填空',order:'顺序拼搭',written:'表达与思考 · 自评'}[q.type]);
  const statusClass=s=>({'未开始':'new','练习中':'learning','待巩固':'weak','基本掌握':'ready'}[s]);
  function filtered(data=store.read()){
    return B.questions.filter(q=>q.subject===subject&&(unit==='all'||q.unit===unit)&&(skill==='all'||q.skill===skill)&&
      (scope==='all'||(scope==='mistakes'?data.records[q.id]?.wrong:data.records[q.id]?.attempts&&data.records[q.id].due<=Date.now())));
  }
  $('nav').insertAdjacentHTML('afterbegin','<a class="nav-link" href="#study" data-view="study"><svg><use href="#target"/></svg>四上知识岛</a>');
  $('#view-home').insertAdjacentHTML('afterbegin','<a class="study-entry" href="#study"><span class="study-entry-icon">✦</span><div><small>四年级上册 · 第1—4单元</small><strong>三科知识岛，开始重点复习</strong><p>语文 · 数学 · 英语 / 知识点闯关 / 错题复练 / 可打印练习</p></div><span aria-hidden="true">→</span></a>');
  $('footer').insertAdjacentHTML('beforebegin',`<section id="view-study" class="view" hidden>
    <div class="page-heading"><div><div class="eyebrow">SMALL STEPS, BIG DISCOVERIES</div><h1>四上知识岛 <span class="heading-spark">✦</span></h1><p>不刷简单重复题，把每个“为什么”弄明白。</p></div><span class="study-edition">单人复习 · 前四单元</span></div>
    <div class="study-hero"><div><span class="pill">你的专属探险地图</span><h2>找到难点，<br>再往前走一小步。</h2><p>从一轮小诊断开始，或带着错题再出发。<br>每次5—10题，不计时，不排名。</p><div class="study-actions"><button class="button primary" id="study-daily">今日三科挑战 →</button><button class="button secondary" id="study-all-errors">三科错题复练</button></div><small>今日挑战每科最多3题，优先到期错题，再选未练内容。</small></div><div class="study-orbit" aria-hidden="true"><span>文</span><span>× ÷</span><span>Aa</span><b>探索<br>思考<br>成长</b></div></div>
    <div id="study-stats" class="study-stats"></div>
    <div class="study-tabs" role="group" aria-label="选择复习科目">${B.subjects.map(s=>`<button class="study-tab" data-subject="${s.id}"><span>${s.icon}</span><strong>${s.name}</strong><small>${s.edition}</small></button>`).join('')}</div>
    <section class="study-workbench" aria-labelledby="study-filter-title"><div class="section-title"><div><h2 id="study-filter-title">选择今天的探险范围</h2><p>切换单元查看重点，点击知识点可单独练习。</p></div><span id="study-question-count" class="study-count"></span></div>
    <div class="study-filters"><label>单元<select id="study-unit" aria-label="复习单元"></select></label><label>知识点<select id="study-skill" aria-label="复习知识点"></select></label><label>练习范围<select id="study-scope"><option value="all">全部重点题</option><option value="mistakes">当前错题</option><option value="due">到期复习</option></select></label><label>每轮题数<select id="study-size"><option value="5">5题</option><option value="10" selected>10题</option><option value="20">20题</option></select></label></div>
    <div class="study-actions"><button class="button primary" id="study-start">开始重点闯关</button><button class="button secondary" id="study-diagnose">知识点小诊断</button><button class="button secondary" id="study-print">生成打印练习</button></div><p class="study-note" id="study-filter-note"></p></section>
    <div class="section-title"><div><h2 id="study-map-title">单元知识地图</h2><p>徽章是复习提示，不代表正式学习测评。</p></div><span class="study-count">36个知识点 · 144道自编题</span></div><div id="study-map" class="study-map"></div>
    <section class="study-workbench"><div class="section-title"><div><h2>复习足迹</h2><p>三科记录随上方“保存位置”保存，与错字本一起备份。</p></div><div class="study-actions"><button class="button secondary" id="study-export">导出完整备份</button><button class="button secondary" id="study-import">恢复完整备份</button></div></div><div id="study-history"></div></section>
    <p class="study-note study-boundary">依据你提供的教材目录组织，自编题并非出版社配套试题。英语情境用于主题迁移，不保证与课文逐句一致。开放题需学生或家长核对，不作AI自动批改。建议结合课堂进度核对使用。</p>
    <input type="file" accept=".json,application/json" id="study-import-file" hidden>
  </section>`);
  document.body.insertAdjacentHTML('beforeend',`<dialog id="study-dialog" class="study-dialog" aria-labelledby="study-round-title"><div class="quiz-top"><span id="study-round-title"></span><span id="study-round-number"></span><button type="button" id="study-quit" class="icon-button" aria-label="结束三科练习">×</button></div><div class="quiz-progress"><div id="study-progress"></div></div><div id="study-play"></div><div id="study-feedback" class="study-feedback" role="status" hidden></div><button type="button" class="button primary" id="study-next" hidden>下一题 →</button><div id="study-summary" hidden></div></dialog>
    <dialog id="study-print-dialog" class="study-print-dialog" aria-labelledby="study-print-title"><div class="dialog-top"><h2 id="study-print-title">复习练习单</h2><button type="button" class="icon-button" data-close="study-print-dialog" aria-label="关闭打印练习">×</button></div><p class="study-note">使用当前科目、单元和知识点筛选。打印不影响学习进度。</p><div class="study-print-controls"><label>题量<select id="study-print-size"><option value="10">10题</option><option value="20">20题</option><option value="all">全部筛选题</option></select></label><label><input type="checkbox" id="study-print-answers" checked>附独立答案页</label><label><input type="checkbox" id="study-print-random" checked>随机题序</label><button class="button secondary" id="study-print-refresh">更新预览</button><button class="button primary" id="study-print-go">打印 / 保存PDF</button><button class="button secondary" id="study-print-download">下载离线HTML</button></div><p id="study-print-message" class="study-note" role="status"></p><iframe id="study-print-frame" title="复习练习单预览" sandbox="allow-same-origin allow-modals"></iframe></dialog>`);
  function renderFilters(){
    $('#study-unit').innerHTML='<option value="all">前四单元</option>'+units().map(u=>`<option value="${u.id}">第${u.number}单元 · ${esc(u.title)}</option>`).join('');
    $('#study-unit').value=unit;
    $('#study-skill').innerHTML='<option value="all">全部重点知识点</option>'+skills().map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    $('#study-skill').value=skill;
  }
  function render(){
    const data=store.read(),allSkills=B.units.flatMap(u=>u.skills),seen=Object.values(data.records).filter(r=>r.attempts).length,
      weak=B.questions.filter(q=>data.records[q.id]?.wrong).length,due=B.questions.filter(q=>data.records[q.id]?.attempts&&data.records[q.id].due<=Date.now()).length,
      ready=allSkills.filter(s=>B.status(data,s.id)==='基本掌握').length;
    $('#study-stats').innerHTML=[['已探索题目',seen,' / 144'],['待巩固错题',weak,'题'],['到期复习',due,'题'],['基本掌握知识点',ready,' / 36']].map(([name,n,suffix])=>`<article><small>${name}</small><strong>${n}<span>${suffix}</span></strong></article>`).join('');
    document.querySelectorAll('[data-subject]').forEach(el=>{el.classList.toggle('selected',el.dataset.subject===subject);el.setAttribute('aria-pressed',String(el.dataset.subject===subject));});
    $('#study-question-count').textContent=filtered(data).length+'题可练';
    $('#study-filter-note').textContent=scope==='due'?'到期复习：答错可立即重练；答对后按1、3、7、14天间隔安排。':scope==='mistakes'?'当前错题：最近一次未答对或自评仍需练习的题目；答对后转入间隔复习。':'小诊断按当前筛选的每个知识点抽取最多2题，优先客观题；正式闯关按题数设置出题。';
    $('#study-map-title').textContent=subjectName(subject)+' · 单元知识地图';
    $('#study-map').innerHTML=units().filter(u=>unit==='all'||u.id===unit).map(u=>{
      const qs=B.questions.filter(q=>q.unit===u.id),count=qs.filter(q=>data.records[q.id]?.attempts).length;
      return `<article class="study-unit-card"><div class="study-unit-heading"><span>UNIT ${String(u.number).padStart(2,'0')}</span><small>${count}/${qs.length}题已探索</small></div><h3>${esc(u.title)}</h3><div class="study-unit-track"><i style="width:${count/qs.length*100}%"></i></div>${u.skills.map(s=>{
        const status=B.status(data,s.id);
        return `<div class="study-skill-row"><div><strong>${esc(s.name)}</strong><span class="study-state ${statusClass(status)}">${status}</span><p>${esc(s.focus)}</p></div><button class="study-skill-start" data-skill-start="${s.id}" aria-label="练习${esc(s.name)}">练一练 →</button></div>`;
      }).join('')}<details class="study-preview"><summary>查看本单元题目与解析（练习前先别看答案）</summary>${qs.map(q=>`<div><small>${typeName(q)} · ${esc(skillName(q.skill))}</small><p>${esc(q.prompt)}</p><details><summary>答案与核对要点</summary><p>${esc(q.answer)}</p><p>${esc(q.explanation)}</p>${q.rubric?'<p>'+q.rubric.map(esc).join('；')+'</p>':''}</details></div>`).join('')}</details></article>`;
    }).join('');
    $('#study-history').innerHTML=data.history.length?data.history.slice(0,8).map(h=>`<div class="history-item"><div><strong>${esc(h.label)}${h.interrupted?' · 提前结束':''}</strong><small>${esc(new Date(h.date).toLocaleString('zh-CN'))}</small></div><span>${h.correct}/${h.total} 答对/自评达标</span></div>`).join(''):'<p class="study-empty">还没有三科复习记录，从一次小诊断开始吧。</p>';
  }
  const score=(q,data)=>{const r=data.records[q.id];return r?.wrong?0:r?.attempts&&r.due<=Date.now()?1:!r?.attempts?2:3;};
  function prioritize(qs,data){return shuffle(qs).sort((a,b)=>score(a,data)-score(b,data));}
  function canStart(){if(store.blocked()||saving){store.toast('请先完成保存或在“保存位置”重新打开本地题库。');return false;}return true;}
  function start(qs,label,limit=Number($('#study-size').value)){
    if(!canStart())return;
    if(!qs.length){store.toast('当前范围没有题目，试试“全部重点题”或其他单元。');return;}
    session={queue:qs.slice(0,limit),index:0,results:[],label,answered:false,order:[],saved:true};
    $('#study-round-title').textContent=label;$('#study-summary').hidden=true;$('#study-play').hidden=false;
    $('#study-dialog').showModal();question();
  }
  function question(){
    const q=session.queue[session.index];session.answered=false;session.order=[];
    $('#study-round-number').textContent=(session.index+1)+' / '+session.queue.length;
    $('#study-progress').style.width=session.index/session.queue.length*100+'%';
    $('#study-feedback').hidden=true;$('#study-next').hidden=true;
    $('#study-play').innerHTML=`<div class="study-question-meta"><span>${esc(subjectName(q.subject))} · ${esc(skillName(q.skill))}</span><small>${typeName(q)}</small></div><h2>${esc(q.prompt)}</h2><div id="study-answer-area"></div>`;
    const area=$('#study-answer-area');
    if(q.type==='choice'){
      area.className='study-options';
      shuffle(q.options).forEach((text,i)=>{const btn=document.createElement('button');btn.className='study-option';btn.innerHTML=`<small>${String.fromCharCode(65+i)}</small><span>${esc(text)}</span>`;btn.addEventListener('click',()=>grade(text===q.answer,text));area.append(btn);});
    } else if(q.type==='order'){
      area.innerHTML='<p class="study-note">依次点击词块或句子进行拼搭。点击已选内容可撤回该步及其后内容。</p><div id="study-order-answer" class="study-order-answer" aria-live="polite"></div><div id="study-order-parts" class="study-order-parts"></div><button type="button" class="button primary" id="study-order-submit">确认顺序</button>';
      let parts=shuffle(q.parts.map((text,i)=>({text,i})));
      if(parts.every((p,i)=>p.i===i))parts.push(parts.shift());
      parts.forEach(p=>{const btn=document.createElement('button');btn.className='study-part';btn.textContent=p.text;btn.dataset.part=p.i;btn.addEventListener('click',()=>{if(session.answered)return;session.order.push(p.i);btn.disabled=true;renderOrder(q);});$('#study-order-parts').append(btn);});
      $('#study-order-submit').addEventListener('click',()=>{if(session.order.length!==q.parts.length){store.toast('先把所有词块或句子放入顺序。');return;}grade(session.order.every((v,i)=>v===i),session.order.map(i=>q.parts[i]).join(' → '));});
    } else {
      area.innerHTML=`<form id="study-answer-form"><label for="study-answer">${q.type==='written'?'先写出你的思路，再查看参考答案':'输入答案'}</label>${q.type==='written'?'<textarea id="study-answer" rows="4" maxlength="2000" required placeholder="写下思路或答案；开放题由你或家长核对。"></textarea>':'<input id="study-answer" maxlength="200" required autocomplete="off" placeholder="'+(q.subject==='math'?'填数字，无需重复题目给出的单位':'输入单词或答案')+'">'}<button class="button primary" type="submit">${q.type==='written'?'查看参考答案并自评':'确认答案'}</button></form>`;
      $('#study-answer-form').addEventListener('submit',event=>{event.preventDefault();const value=$('#study-answer').value.trim();if(!value)return;
        if(q.type==='written')showRubric(q,value);else grade(q.accepted.some(a=>normalizeAnswer(a)===normalizeAnswer(value)),value);
      });
    }
    if(q.type!=='written'){const skip=document.createElement('button');skip.className='text-link study-skip';skip.textContent='暂时不会，看看解析';skip.addEventListener('click',()=>grade(false,'暂时不会'));area.append(skip);}
    $('#study-play button, #study-play input, #study-play textarea')?.focus();
  }
  function normalizeAnswer(value){return String(value).normalize('NFKC').toLowerCase().trim().replace(/[.!。！]+$/,'').replace(/\s+/g,' ');}
  function renderOrder(q){
    $('#study-order-answer').replaceChildren();
    session.order.forEach((n,index)=>{const btn=document.createElement('button');btn.className='study-part chosen';btn.textContent=q.parts[n];btn.addEventListener('click',()=>{if(session.answered)return;const removed=session.order.splice(index);removed.forEach(i=>{$(`[data-part="${i}"]`).disabled=false;});renderOrder(q);});$('#study-order-answer').append(btn);});
  }
  function showRubric(q,value){
    if(session.answered)return;
    $('#study-answer').readOnly=true;$('#study-answer-form button').disabled=true;
    $('#study-feedback').hidden=false;$('#study-feedback').className='study-feedback';
    $('#study-feedback').innerHTML=`<strong>参考答案不唯一，请按要点核对</strong><p>${esc(q.answer)}</p><ul>${q.rubric.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><p>不是自动评分。达到以上要点选“基本做到”，有遗漏选“还需练习”。</p><div class="study-actions"><button class="button primary" id="study-self-good">基本做到</button><button class="button secondary" id="study-self-again">还需练习</button></div>`;
    $('#study-self-good').addEventListener('click',()=>grade(true,value));$('#study-self-again').addEventListener('click',()=>grade(false,value));
    $('#study-self-good').focus();
  }
  async function grade(correct,value){
    if(!session||session.answered||saving)return;
    if(!canStart())return;
    const round=session,q=round.queue[round.index];round.answered=true;saving=true;
    round.results.push({id:q.id,correct,answer:value});
    $('#study-play').querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true);
    const feedback=$('#study-feedback');feedback.hidden=false;feedback.className='study-feedback '+(correct?'':'needs-work');
    feedback.innerHTML=`<strong>${q.type==='written'?(correct?'已记录：基本做到':'已记录：还需练习'):(correct?'答对了，思路更清楚了！':'这次先记住关键一步。')}</strong><p>${q.type==='written'?'参考答案':'正确答案'}：${esc(q.answer)}</p><p>${esc(q.explanation)}</p>${q.rubric?'<ul>'+q.rubric.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul>':''}<p class="study-save-state">正在保存答题记录…</p>`;
    try {round.saved=await store.commit(B.mark(store.read(),q,correct,value));}
    finally {saving=false;}
    if(session!==round)return;
    $('.study-save-state').textContent=round.saved?'进度已保存。'+(correct?'稍后会安排间隔复习。':'本题已加入错题复练。'):'保存失败：答案暂留本页，请先在“保存位置”重试或导出完整备份。';
    $('#study-progress').style.width=(round.index+1)/round.queue.length*100+'%';
    $('#study-next').textContent=round.index===round.queue.length-1?'查看本轮收获 →':'下一题 →';$('#study-next').hidden=false;$('#study-next').focus();render();
  }
  async function logRound(interrupted){
    if(!session||session.logged||!session.results.length)return;
    const round=session,data=store.read();
    data.history.unshift({date:Date.now(),total:round.results.length,correct:round.results.filter(r=>r.correct).length,label:round.label,interrupted});
    data.history=data.history.slice(0,50);round.logged=true;saving=true;
    try {round.saved=await store.commit(data);}finally {saving=false;}
    render();
  }
  async function finish(){
    if(saving||!session)return;
    await logRound(false);
    const round=session;if(!round)return;
    $('#study-play').hidden=true;$('#study-feedback').hidden=true;$('#study-next').hidden=true;$('#study-summary').hidden=false;
    const errors=round.results.filter(r=>!r.correct),auto=round.results.filter(r=>B.byId.get(r.id).type!=='written'),self=round.results.length-auto.length;
    $('#study-round-number').textContent='本轮完成';
    $('#study-summary').innerHTML=`<div class="study-summary-symbol">${errors.length?'✦':'✿'}</div><h2>又向前走了一小步</h2><p>客观题答对 ${auto.filter(r=>r.correct).length}/${auto.length}题${self?' · 开放题自评 '+self+'题':''}</p><p>${errors.length?'有'+errors.length+'道题值得再想一想。':'本轮没有待巩固题。隔天换个角度再试试！'}</p>${errors.length?'<div class="study-summary-errors">'+errors.map(r=>{const q=B.byId.get(r.id);return '<p><strong>'+esc(skillName(q.skill))+'</strong><br>'+esc(q.prompt)+'</p>';}).join('')+'</div>':''}<p class="study-note">${round.saved?'已保存本轮记录。':'本轮有未保存内容，请先重试保存或导出备份。'}</p><div class="study-actions">${errors.length?'<button class="button primary" id="study-retry">再练本轮错题</button>':''}<button class="button secondary" id="study-finish-close">返回知识地图</button></div>`;
    $('#study-retry')?.addEventListener('click',()=>{if(!canStart())return;$('#study-dialog').close();session=null;start(errors.map(r=>B.byId.get(r.id)),'本轮错题复练',errors.length);});
    $('#study-finish-close').addEventListener('click',()=>{$('#study-dialog').close();session=null;});
    $('#study-summary button').focus();
  }
  async function quit(){if(saving){store.toast('正在保存，请稍候。');return;}if(session&&!session.logged&&session.results.length&&!confirm('结束本轮？已答题目会保存，未答题目不记错。'))return;await logRound(true);$('#study-dialog').close();session=null;}
  $('#study-next').addEventListener('click',()=>{if(saving||!session?.answered)return;if(session.index===session.queue.length-1)void finish();else{session.index++;question();}});
  $('#study-quit').addEventListener('click',quit);$('#study-dialog').addEventListener('cancel',e=>{e.preventDefault();void quit();});
  document.querySelectorAll('[data-subject]').forEach(btn=>btn.addEventListener('click',()=>{subject=btn.dataset.subject;unit='all';skill='all';renderFilters();render();}));
  $('#study-unit').addEventListener('change',e=>{unit=e.target.value;skill='all';renderFilters();render();});
  $('#study-skill').addEventListener('change',e=>{skill=e.target.value;render();});$('#study-scope').addEventListener('change',e=>{scope=e.target.value;render();});
  $('#study-start').addEventListener('click',()=>start(prioritize(filtered(),store.read()),subjectName(subject)+' · 重点闯关'));
  $('#study-diagnose').addEventListener('click',()=>{
    const pool=filtered(),queue=skills().filter(s=>skill==='all'||s.id===skill).flatMap(s=>shuffle(pool.filter(q=>q.skill===s.id&&q.type!=='written')).slice(0,2));
    start(queue,subjectName(subject)+' · 知识点小诊断',queue.length);
  });
  $('#study-daily').addEventListener('click',()=>{const data=store.read(),queue=B.subjects.flatMap(s=>prioritize(B.questions.filter(q=>q.subject===s.id),data).slice(0,3));start(shuffle(queue),'今日三科挑战',queue.length);});
  $('#study-all-errors').addEventListener('click',()=>{const data=store.read();start(prioritize(B.questions.filter(q=>data.records[q.id]?.wrong),data),'三科错题复练');});
  $('#study-map').addEventListener('click',e=>{const id=e.target.closest('[data-skill-start]')?.dataset.skillStart;if(id){const data=store.read();start(prioritize(B.questions.filter(q=>q.skill===id),data),skillName(id),4);}});
  $('#study-export').addEventListener('click',()=>store.backup());
  $('#study-import').addEventListener('click',()=>{if(canStart())$('#study-import-file').click();});
  $('#study-import-file').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>200*1024*1024)throw new Error('文件超过200MB');
      const data=await store.validate(JSON.parse(await file.text()));
      if(!confirm('恢复完整备份会替换当前错字本、三科进度和学习记录，不是合并。建议先导出当前备份。继续吗？'))return;
      if(await store.restore(data)){store.toast('已恢复完整备份。');render();}
    }catch(error){store.toast('恢复失败：'+error.message);}finally{e.target.value='';}
  });
  function printable(qs,answers){
    const title='四上重点复习 · '+subjectName(subject),pages=[];
    const questionHTML=(q,i)=>`<article><h3>${i+1}. ${esc(q.prompt)}</h3><p class="tag">${esc(skillName(q.skill))} · ${typeName(q)}</p>${q.type==='choice'?'<div class="options">'+q.options.map((t,j)=>String.fromCharCode(65+j)+'. '+esc(t)).join('　　')+'</div>':q.type==='order'?'<p>'+shuffle(q.parts).map((t,j)=>`(${j+1}) ${esc(t)}`).join('　')+'</p><p>正确序号：________________________</p>':'<div class="lines '+(q.type==='written'?'long':'')+'"></div>'}</article>`;
    for(let i=0;i<qs.length;i+=4)pages.push(`<section class="sheet"><h1>${esc(title)}</h1><p>姓名：__________　日期：__________　练习第${pages.length+1}页</p><p class="note">自编练习 · 不计时，先写思路；开放题答案可不同。</p>${qs.slice(i,i+4).map((q,j)=>questionHTML(q,i+j)).join('')}</section>`);
    const studentPages=pages.length;
    if(answers)for(let i=0;i<qs.length;i+=5)pages.push(`<section class="sheet answer-sheet"><h1>参考答案与核对要点</h1><p class="note">学生题目为前${studentPages}页，本页起为答案。开放题不要求与示例逐字相同。</p>${qs.slice(i,i+5).map((q,j)=>`<article><h3>${i+j+1}. ${esc(skillName(q.skill))}</h3><p>${esc(q.answer)}</p><p>${esc(q.explanation)}</p>${q.rubric?'<p>核对：'+q.rubric.map(esc).join('；')+'</p>':''}</article>`).join('')}</section>`);
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>*{box-sizing:border-box}body{font-family:"Microsoft YaHei",sans-serif;margin:0;background:#e8eae5;color:#222;line-height:1.6}.sheet{width:210mm;min-height:297mm;padding:15mm 17mm;margin:12px auto;background:white;break-after:page}.sheet:last-child{break-after:auto}h1{font-size:21px;border-bottom:2px solid #365e48;padding-bottom:8px}h3{font-size:14px;margin:0 0 5px;font-weight:500}p{font-size:12px;white-space:pre-wrap}.note,.tag{font-size:10px;color:#666}article{border-bottom:1px solid #ddd;padding:12px 0;break-inside:avoid}.options{font-size:12px;line-height:2}.lines{height:22mm;background:repeating-linear-gradient(transparent 0,transparent 8mm,#ddd 8.1mm,transparent 8.3mm)}.lines.long{height:35mm}@page{size:A4;margin:0}@media print{body{background:white}.sheet{margin:0;width:100%;min-height:0;box-shadow:none}}@media screen and (max-width:820px){.sheet{width:100%;padding:24px;min-height:0}}</style></head><body>${pages.join('')}</body></html>`;
  }
  function updatePrint(){
    const raw=filtered(),pool=$('#study-print-random').checked?shuffle(raw):raw,n=$('#study-print-size').value;
    const qs=pool.slice(0,n==='all'?pool.length:Number(n));
    if(!qs.length){printHTML='';$('#study-print-frame').srcdoc='<p>当前范围没有题目，请更换筛选。</p>';}
    else{printHTML=printable(qs,$('#study-print-answers').checked);$('#study-print-frame').srcdoc=printHTML;}
    $('#study-print-message').textContent=qs.length?'已生成'+qs.length+'题。学生题目每页最多4题；答案单独起页。打印前请预览分页，选择A4并关闭浏览器页眉页脚。':'当前范围没有题目。';
    $('#study-print-go').disabled=!qs.length;$('#study-print-download').disabled=!qs.length;
  }
  $('#study-print').addEventListener('click',()=>{updatePrint();$('#study-print-dialog').showModal();});
  $('#study-print-refresh').addEventListener('click',updatePrint);
  ['study-print-size','study-print-answers','study-print-random'].forEach(id=>$('#'+id).addEventListener('change',updatePrint));
  $('#study-print-go').addEventListener('click',()=>{if(printHTML){$('#study-print-frame').contentWindow.focus();$('#study-print-frame').contentWindow.print();}});
  $('#study-print-download').addEventListener('click',()=>{if(!printHTML)return;const url=URL.createObjectURL(new Blob([printHTML],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='四上重点复习-'+subjectName(subject)+'-'+B.day(Date.now())+'.html';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  window.KnowledgeReview={active:()=>!!session,reset(){session=null;$('#study-dialog').close();$('#study-print-dialog').close();render();}};
  window.addEventListener('hashchange',()=>{if(location.hash==='#study')render();});
  window.addEventListener('focus',render);
  renderFilters();render();store.route();
})();
