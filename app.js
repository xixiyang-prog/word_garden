(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const KEY = 'word-garden:v1';
  const MAX_WORDS = 2000;
  const images = window.WordGardenImages;
  const disk = window.WordGardenDisk;
  const demo = [
    ['再接再厉', '再接再励', '“厉”有磨炼的意思，继续努力用“厉”。'],
    ['迫不及待', '迫不急待', '已经来不及等待了，用“及”。'],
    ['专心致志', '专心至志', '“致”是集中、尽的意思，把心思全放在一件事上。'],
    ['川流不息', '穿流不息', '像河川里的流水一样不停，用“川”。'],
    ['一筹莫展', '一愁莫展', '“筹”指计策，一点计策也施展不出。'],
    ['谈笑风生', '谈笑风声', '有说有笑，兴致勃勃，用“生”。'],
    ['名副其实', '名付其实', '“副”表示符合，名声与实际相符合。'],
    ['五彩斑斓', '五彩班斓', '色彩丰富，注意“斑”中间是“文”。'],
    ['已经', '己经', '“已经”的“已”读 yǐ；“自己”的“己”读 jǐ。'],
    ['即使', '既使', '表示假设时用“即使”，不要和“既然”混淆。'],
    ['按部就班', '按步就班', '“部”是门类，按一定的条理和步骤办事。'],
    ['恍然大悟', '晃然大悟', '“恍”带竖心旁，表示一下子明白过来。']
  ];
  const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const clean = (text) => typeof text === 'string' ? text.normalize('NFKC').trim() : '';
  const escapeHTML = (text) => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  const nonnegative = (n) => Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 1000000000) : 0;
  const makeWord = (correct, wrong, hint = '', isDemo = false) => ({id:uid(), correct, wrong, wrongType:'text', wrongImage:'', hint, isDemo, attempts:0, hits:0, streak:0, errors:0, lastSeen:0});
  function validateWord(item) {
    if (!item || typeof item !== 'object') return '每组题目需要包含正确写法和常见错写。';
    const correct = clean(item.correct), wrong = clean(item.wrong);
    if (item.wrongType !== undefined && !['text','image'].includes(item.wrongType)) return '错写方式只支持文字或图片。';
    if (!correct || (!images.isImage(item) && !wrong)) return '正确写法和常见错写都不能为空。';
    if (images.isImage(item) && !images.validImage(item.wrongImage)) return '请上传有效的错写图片。';
    if (!images.isImage(item) && correct === wrong) return '正确写法和常见错写不能相同。';
    if ([correct, wrong].some(t => [...t].length > 30 || /[\r\n]/.test(t))) return '词语请限制在 30 个字以内，且不要换行。';
    if (item.hint !== undefined && typeof item.hint !== 'string') return '记忆提示必须是文字。';
    if (clean(item.hint).length > 200) return '记忆提示请限制在 200 字以内。';
    return '';
  }
  function normalizeWord(item, regenerateID = false) {
    const word = makeWord(clean(item.correct), clean(item.wrong), clean(item.hint), item.isDemo === true);
    if (images.isImage(item)) {word.wrongType='image';word.wrongImage=item.wrongImage;word.wrong='';}
    if (!regenerateID && typeof item.id === 'string' && /^[\w-]{1,100}$/.test(item.id)) word.id = item.id;
    word.attempts = nonnegative(item.attempts);
    word.hits = Math.min(word.attempts, nonnegative(item.hits));
    word.errors = word.attempts - word.hits;
    word.streak = Math.min(word.hits, nonnegative(item.streak));
    word.lastSeen = Number.isFinite(item.lastSeen) && item.lastSeen > 0 ? item.lastSeen : 0;
    return word;
  }
  let initialWarning = '';
  function load() {
    if(disk.needsReconnect())return {version:1,words:[],history:[]};
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return {version:1, words:demo.map(d => makeWord(...d, true)), history:[]};
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.words) || data.words.length > MAX_WORDS) throw new Error('格式不支持');
      const keys = new Set(), ids = new Set();
      const words = [];
      for (const item of data.words) {
        if (validateWord(item)) continue;
        const key = images.key({...item,correct:clean(item.correct),wrong:clean(item.wrong)});
        if (keys.has(key)) continue;
        keys.add(key);
        const word = normalizeWord(item);
        if (ids.has(word.id)) word.id = uid();
        ids.add(word.id);
        words.push(word);
      }
      const history = Array.isArray(data.history) ? data.history.filter(h => h && ['choice','type'].includes(h.mode) && Number.isFinite(h.date) && Number.isSafeInteger(h.total) && h.total > 0 && Number.isSafeInteger(h.correct) && h.correct >= 0 && h.correct <= h.total).slice(0,50) : [];
      return {version:1, words, history, review:window.ReviewBank.normalize(data.review)};
    } catch (e) {
      initialWarning = '本地记录暂时无法读取。请先导出当前内容备份；本次使用临时题库，不会自动覆盖旧记录。';
      return {version:1, words:demo.map(d => makeWord(...d, true)), history:[]};
    }
  }
  let state = load(), filter = 'all', editID = null, quiz = null, toastTimer, committing=false;
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
  }
  async function save() {
    if (initialWarning && !disk.isFile()) {
      toast('当前为临时模式，请转存本地文件或导出备份。');
      disk.markUnsaved(initialWarning);return false;
    }
    const ok=await disk.persist(JSON.stringify(state));
    if(ok)initialWarning='';
    else toast('无法保存，请查看上方“保存位置”。未保存的输入仍保留，可转存本地文件后重试。');
    return ok;
  }
  async function validateDataset(data) {
    if(Array.isArray(data))data={version:1,words:data,history:[]};
    if(!data || data.version!==1 || !Array.isArray(data.words) || data.words.length>MAX_WORDS)throw new Error('题库格式无效、版本不支持或超过 '+MAX_WORDS+' 组');
    const words=[],keys=new Set(),ids=new Set();
    for(let i=0;i<data.words.length;i++){
      const item=data.words[i],error=validateWord(item);
      if(error)throw new Error('第 '+(i+1)+' 组：'+error);
      if(images.isImage(item))await images.verify(item.wrongImage);
      const word=normalizeWord(item);
      if(keys.has(images.key(word)))continue;
      keys.add(images.key(word));
      if(ids.has(word.id))word.id=uid();
      ids.add(word.id);words.push(word);
    }
    const history=Array.isArray(data.history)?data.history.filter(h=>h&&['choice','type'].includes(h.mode)&&Number.isFinite(h.date)&&Number.isSafeInteger(h.total)&&h.total>0&&Number.isSafeInteger(h.correct)&&h.correct>=0&&h.correct<=h.total).slice(0,50):[];
    return {version:1,words,history,review:window.ReviewBank.normalize(data.review)};
  }
  const mastered = (word) => word.streak >= 3;
  const plant = (word) => mastered(word) ? '🌼' : word.streak >= 1 ? '🌿' : '🌱';
  function render() {
    const total = state.words.length, grown = state.words.filter(mastered).length;
    const attempts = state.words.reduce((a,w) => a+w.attempts, 0), hits = state.words.reduce((a,w) => a+w.hits, 0);
    $('#nav-count').textContent = total;
    $('#stat-total').textContent = total;
    $('#stat-pending').textContent = total-grown;
    $('#stat-mastered').textContent = grown;
    $('#stat-accuracy').textContent = attempts ? Math.round(hits/attempts*100)+'%' : '—';
    $('#stat-answers').textContent = attempts ? '已经认真练习 '+attempts+' 次' : '还没有练习记录';
    $('#preview-count').textContent = total+' 个';
    $('#preview-list').innerHTML = total ? state.words.slice(0,6).map(w => '<div class="seed-chip"><span>'+plant(w)+'</span>'+escapeHTML(w.correct)+'<small>'+(mastered(w)?'已掌握':'待巩固')+'</small></div>').join('') : '<p class="no-history">还没有题目，添加第一个易错字吧。</p>';
    renderWords();
    $('#growth-heading').textContent = grown ? grown+' 个易错词，已经开花了' : '慢慢来，每次练习都有意义';
    $('#growth-bar').style.width = (total ? grown/total*100 : 0)+'%';
    $('#growth-description').textContent = '共 '+total+' 个词语 · 已掌握 '+grown+' 个 · 还在成长 '+(total-grown)+' 个';
    $('#growth-garden').innerHTML = total ? state.words.map(w => '<article class="garden-item"><span class="plant" aria-hidden="true">'+plant(w)+'</span><strong>'+escapeHTML(w.correct)+'</strong><small>连续答对 '+Math.min(w.streak,3)+' / 3 次</small><div class="stage-dots" aria-hidden="true">'+[1,2,3].map(n => '<i class="'+(w.streak>=n?'filled':'')+'"></i>').join('')+'</div></article>').join('') : '<p class="no-history">添加词语，种下第一颗小种子。</p>';
    $('#history-list').innerHTML = state.history.length ? state.history.map(h => '<div class="history-item"><div><strong>'+(h.mode==='choice'?'火眼金睛':'错字修理铺')+(h.interrupted?' · 提前结束':'')+'</strong><small>'+escapeHTML(new Date(h.date).toLocaleString('zh-CN'))+'</small></div><span>'+h.correct+' / '+h.total+' 答对</span></div>').join('') : '<p class="no-history">还没有练习记录，来完成第一轮小游戏吧。</p>';
  }
  function filteredWords() {
    const search = clean($('#word-search').value).toLowerCase();
    return state.words.filter(w => (filter==='all' || (filter==='mastered'?mastered(w):!mastered(w))) && [w.correct,w.wrong,w.hint].some(t => t.toLowerCase().includes(search)));
  }
  function renderWords() {
    const words = filteredWords();
    $('#word-count').textContent = '共 '+words.length+' 个词语';
    $('#word-table').innerHTML = words.map(w => '<tr><td><strong>'+escapeHTML(w.correct)+'</strong><small>常见错写：'+(images.isImage(w)?'手写图片':escapeHTML(w.wrong))+(w.isDemo?' · 示例':'')+'</small>'+images.imageHTML(w,'table-word-image')+'</td><td>'+escapeHTML(w.hint || '还没有提示')+'</td><td><span class="status-pill '+(mastered(w)?'mastered':'')+'">'+(mastered(w)?'✿ 已掌握':'🌱 连对 '+w.streak+'/3')+'</span></td><td><button class="row-action" data-edit="'+escapeHTML(w.id)+'" aria-label="编辑'+escapeHTML(w.correct)+'">编辑</button><button class="row-action delete" data-delete="'+escapeHTML(w.id)+'" aria-label="删除'+escapeHTML(w.correct)+'">删除</button></td></tr>').join('');
    $('#words-empty').hidden = words.length > 0;
    $('#words-empty h3').textContent = state.words.length ? '没有找到符合条件的词语' : '这里还没有小种子';
    $('#words-empty p').textContent = state.words.length ? '试试其他搜索词，或切换上方的筛选。' : '添加一组正确写法和常见错写，就能开始游戏。';
  }
  function route() {
    const name = ['home','words','growth','study'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
    $$('.view').forEach(el => { el.hidden = el.id !== 'view-'+name; });
    $$('.nav-link').forEach(el => { const active = el.dataset.view === name; el.classList.toggle('active',active); if (active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
    $('#page-label').textContent = {home:'复习乐园',words:'我的错字本',growth:'成长记录',study:'四上知识岛'}[name];
  }
  function openEditor(id = null) {
    if(disk.needsReconnect()){disk.show();return;}
    editID = id;
    $('#word-form').reset();
    $('#editor-error').textContent = '';
    $('#editor-title').textContent = id ? '照料这颗小种子' : '添加一颗小种子';
    images.reset(id ? state.words.find(w => w.id === id) : null);
    if (id) {
      const word = state.words.find(w => w.id === id);
      if (!word) return;
      for (const key of ['correct','wrong','hint']) $('#word-form').elements[key].value = word[key];
    }
    $('#editor-dialog').showModal();
    $('#word-form').elements.correct.focus();
  }
  $('#word-form').addEventListener('submit', async event => {
    event.preventDefault();
    if(committing||disk.isBusy()){toast('正在保存或切换题库，请稍候。');return;}
    const form = event.currentTarget;
    const imageData=images.read();
    if(imageData.busy){$('#editor-error').textContent='图片正在处理，请稍候再保存。';return;}
    const word = {correct:clean(form.elements.correct.value),wrong:imageData.wrongType==='image'?'':clean(form.elements.wrong.value),hint:clean(form.elements.hint.value),wrongType:imageData.wrongType,wrongImage:imageData.wrongImage};
    let error = validateWord(word);
    if (!error && state.words.some(w => w.id !== editID && images.key(w)===images.key(word))) error = '这组词语已经在错字本里了。';
    if (!error && !editID && state.words.length>=MAX_WORDS) error = '题库最多支持 '+MAX_WORDS+' 组，请先整理题库。';
    if (error) { $('#editor-error').textContent = error; return; }
    const previousWords=state.words.map(w=>({...w}));
    committing=true;
    try {
    if (editID) {
      const old = state.words.find(w => w.id===editID);
      const changed = images.key(old)!==images.key(word);
      Object.assign(old, changed ? {...makeWord(word.correct,word.wrong,word.hint),...word,id:editID} : word);
      old.isDemo = false;
    } else state.words.push({...makeWord(word.correct,word.wrong,word.hint),...word});
    if(!await save()){state.words=previousWords;$('#editor-error').textContent='空间不足或无法保存。可以转存到本地文件，完成后再次保存；输入和图片仍保留在此。';return;}
    render(); $('#editor-dialog').close(); toast(editID?'已更新这颗小种子。':'已加入错字本，可以开始复习啦。');
    } finally {committing=false;}
  });
  $('#bulk-save').addEventListener('click', async () => {
    if(committing||disk.isBusy()){toast('正在保存或切换题库，请稍候。');return;}
    const lines = $('#bulk-text').value.split(/\r?\n/).map((text,index) => ({text:text.trim(),index:index+1})).filter(l => l.text);
    if (!lines.length) { $('#bulk-error').textContent='请先输入至少一组词语。'; return; }
    const candidates = [];
    for (const line of lines) {
      const parts = line.text.split(/[|｜\t]/).map(clean);
      const word = {correct:parts[0],wrong:parts[1],hint:parts[2] || ''};
      const error = parts.length<2 || parts.length>3 ? '请用 | 分成两列或三列。' : validateWord(word);
      if (error) { $('#bulk-error').textContent='第 '+line.index+' 行：'+error; return; }
      candidates.push(word);
    }
    const previousWords=[...state.words];
    const result = mergeWords(candidates, false);
    if (result.error) { $('#bulk-error').textContent=result.error; return; }
    committing=true;
    try {
      if(!await save()){state.words=previousWords;$('#bulk-error').textContent='无法保存。请转存本地文件后重试，本批内容仍保留。';return;}
      render(); $('#bulk-dialog').close(); toast('新增 '+result.added+' 组，跳过 '+result.skipped+' 组重复词语。');
    } finally {committing=false;}
  });
  function mergeWords(items, preserveProgress) {
    const keys = new Set(state.words.map(w => images.key(w))), fresh=[];
    let skipped=0;
    for (const item of items) {
      const key = images.key({...item,correct:clean(item.correct),wrong:clean(item.wrong)});
      if (keys.has(key)) { skipped++; continue; }
      keys.add(key);
      fresh.push(preserveProgress ? normalizeWord(item,true) : makeWord(item.correct,item.wrong,item.hint));
    }
    if (state.words.length+fresh.length>MAX_WORDS) return {error:'合并后超过 '+MAX_WORDS+' 组，请减少导入数量。'};
    state.words.push(...fresh);
    return {added:fresh.length,skipped};
  }
  function exportWords() {
    const data = {...state,exportedAt:new Date().toISOString()};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a'); link.href=url; link.download='字有进步-题库备份-'+new Date().toLocaleDateString('sv-SE')+'.json'; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('已导出错字题库、三科复习进度和学习记录。');
  }
  $('#import-file').addEventListener('change', async event => {
    const file=event.target.files[0];
    if (!file) return;
    if(committing||disk.isBusy()){toast('正在保存或切换题库，请稍候。');event.target.value='';return;}
    committing=true;
    try {
      if (file.size>20*1024*1024) throw new Error('请选择小于 20 MB 的题库文件。');
      const data=JSON.parse(await file.text());
      const items=Array.isArray(data) ? data : data && data.words;
      if (!Array.isArray(data) && data.version!==undefined && data.version!==1) throw new Error('暂不支持该版本题库。');
      if (!Array.isArray(items) || !items.length || items.length>MAX_WORDS) throw new Error('文件需包含 1～'+MAX_WORDS+' 组题目。');
      for (let i=0;i<items.length;i++) {
        const error=validateWord(items[i]); if(error) throw new Error('第 '+(i+1)+' 组：'+error);
        if(images.isImage(items[i])) {
          try {await images.verify(items[i].wrongImage);} catch(e) {throw new Error('第 '+(i+1)+' 组图片无法读取：'+e.message);}
        }
      }
      const previousWords=[...state.words];
      const result=mergeWords(items,true);
      if(result.error) throw new Error(result.error);
      if(!await save()){state.words=previousWords;throw new Error('无法保存，未加入新题目。请切换本地文件后重新导入。');}
      render(); toast('导入 '+result.added+' 组，跳过 '+result.skipped+' 组已存在的题目。');
    } catch(e) { toast('导入失败：'+(e instanceof SyntaxError?'不是有效的 JSON 题库文件。':e.message)); }
    finally { committing=false;event.target.value=''; }
  });
  const shuffle = items => { const result=[...items]; for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];} return result; };
  function startQuiz(mode, ids = null) {
    if(disk.needsReconnect()){disk.show();return;}
    if (!state.words.length) { toast('先添加至少一组易错词语吧。'); openEditor(); return; }
    const candidates=ids ? ids.map(id=>state.words.find(w=>w.id===id)).filter(Boolean) : [...shuffle(state.words.filter(w=>!mastered(w))).sort((a,b)=>a.streak-b.streak || b.errors-a.errors),...shuffle(state.words.filter(mastered))];
    const size=Number($('#round-size').value);
    const queue=candidates.slice(0,ids?candidates.length:size).map(w=>({...w}));
    if(!queue.length) return;
    quiz={mode,queue,index:0,correct:0,mistakes:[],answered:false,logged:false};
    $('#quiz-body').hidden=false; $('#quiz-summary').hidden=true;
    $('#quiz-mode').textContent=mode==='choice'?'火眼金睛 · 认一认':'错字修理铺 · 改一改';
    if(!$('#quiz-dialog').open) $('#quiz-dialog').showModal();
    renderQuestion();
  }
  function renderQuestion() {
    const word=quiz.queue[quiz.index];
    const questionMode=images.isImage(word)?'type':quiz.mode;
    quiz.answered=false;
    $('#quiz-number').textContent=(quiz.index+1)+' / '+quiz.queue.length;
    $('#quiz-progress-bar').style.width=(quiz.index/quiz.queue.length*100)+'%';
    $('#quiz-context').textContent=images.isImage(word)?'看图纠错 · 认一认学生的手写字':questionMode==='choice'?'仔细看一看，选择正确的写法':'把这个词语里的错别字修好';
    $('#quiz-question').textContent=images.isImage(word)?'这组字应该怎么写？':questionMode==='choice'?'哪个词语写对了？':word.wrong;
    $('#quiz-word-image').innerHTML=images.imageHTML(word,'quiz-word-image');
    $('#quiz-word-image').hidden=!images.isImage(word);
    $('#quiz-instruction').textContent=questionMode==='choice'?'只有一个是正确答案，选中它吧。':'输入完整的正确词语，再确认答案。';
    $('#quiz-options').hidden=questionMode!=='choice';
    $('#type-form').hidden=questionMode!=='type';
    $('#quiz-feedback').hidden=true; $('#next-question').hidden=true;
    $('#quiz-score').textContent='本轮已答对 '+quiz.correct+' 题';
    $('#quiz-options').replaceChildren();
    if(questionMode==='choice') {
      shuffle([word.correct,word.wrong]).forEach((text,index)=>{
        const btn=document.createElement('button'); btn.className='answer-option';
        const badge=document.createElement('small');badge.textContent=index?'B':'A';
        const label=document.createElement('span');label.textContent=text;
        btn.append(badge,label); btn.addEventListener('click',()=>answer(text,btn));
        $('#quiz-options').append(btn);
      });
      $('#quiz-options button').focus();
    } else { $('#type-answer').value=''; $('#type-answer').disabled=false; $('#type-submit').disabled=false; $('#type-answer').focus(); }
  }
  async function answer(value, chosen=null) {
    if(!quiz || quiz.answered || quiz.logged) return;
    if(committing||disk.isBusy()){toast('正在保存或切换题库，请稍候。');return;}
    const word=quiz.queue[quiz.index], correct=clean(value)===word.correct;
    quiz.answered=true;
    const entry=state.words.find(w=>w.id===word.id);
    if(entry){entry.attempts++;entry.lastSeen=Date.now();if(correct){entry.hits++;entry.streak++;}else{entry.errors++;entry.streak=0;}}
    if(correct) quiz.correct++; else quiz.mistakes.push(word);
    $$('#quiz-options button').forEach(btn=>{btn.disabled=true;if(btn.querySelector('span').textContent===word.correct)btn.classList.add('right');});
    if(chosen && !correct) chosen.classList.add('wrong');
    $('#type-answer').disabled=true;$('#type-submit').disabled=true;
    const feedback=$('#quiz-feedback'); feedback.classList.toggle('incorrect',!correct);
    feedback.innerHTML='<strong>'+(correct?'答对了！又长出一点小进步。':'没关系，记住这次就有进步。')+'</strong><p>正确写法：<b>'+escapeHTML(word.correct)+'</b></p>'+(word.hint?'<p>记忆提示：'+escapeHTML(word.hint)+'</p>':'')+(entry && mastered(entry)?'<p>🌼 连续答对 3 次，这个词已经开花啦！</p>':'');
    feedback.hidden=false;
    $('#quiz-score').textContent='本轮已答对 '+quiz.correct+' 题';
    $('#next-question').textContent=quiz.index===quiz.queue.length-1?'看看本轮收获 →':'下一题 →';$('#next-question').hidden=true;
    $('#quiz-progress-bar').style.width=((quiz.index+1)/quiz.queue.length*100)+'%';
    await save();render();
    if(quiz){$('#next-question').hidden=false;$('#next-question').focus();}
  }
  async function logRound(interrupted=false) {
    if(!quiz || quiz.logged) return;
    const total=quiz.index+(quiz.answered?1:0);
    if(total){state.history.unshift({mode:quiz.mode,date:Date.now(),total,correct:quiz.correct,interrupted});state.history=state.history.slice(0,50);}
    quiz.logged=true; await save();render();
  }
  async function finishQuiz() {
    const round=quiz;
    await logRound();
    if(quiz!==round)return;
    $('#quiz-body').hidden=true;$('#quiz-summary').hidden=false;
    $('#quiz-number').textContent='本轮完成';$('#quiz-progress-bar').style.width='100%';
    const total=quiz.queue.length, mistakes=quiz.mistakes;
    $('#quiz-summary').innerHTML='<div class="summary-art" aria-hidden="true">'+(mistakes.length?'🌱':'🌼')+'</div><h2 class="summary-heading">'+(mistakes.length?'练习，就是成长的养分':'好棒，全部答对啦！')+'</h2><p class="summary-sub">'+(mistakes.length?'没记住的词，再见一次就会更熟悉。':'把今天的小进步，留给下一次的自信。')+'</p><div class="summary-score"><div><strong>'+quiz.correct+'/'+total+'</strong><small>本轮答对</small></div><div><strong>'+Math.round(quiz.correct/total*100)+'%</strong><small>正确率</small></div></div>'+(mistakes.length?'<div class="summary-mistakes"><strong>这几个词，再照顾一下</strong>'+mistakes.map(w=>'<div class="summary-word"><span>'+(images.isImage(w)?images.imageHTML(w,'summary-word-image'):escapeHTML(w.wrong))+'</span><span>'+escapeHTML(w.correct)+'</span></div>').join('')+'</div>':'')+'<div class="summary-actions">'+(mistakes.length?'<button class="button primary" id="retry-mistakes">再练本轮错题</button>':'<button class="button primary" id="play-again">再玩一轮</button>')+'<button class="button secondary" id="back-home">返回乐园</button></div>';
    $('#retry-mistakes')?.addEventListener('click',()=>startQuiz(quiz.mode,quiz.mistakes.map(w=>w.id)));
    $('#play-again')?.addEventListener('click',()=>startQuiz(quiz.mode));
    $('#back-home').addEventListener('click',()=>{$('#quiz-dialog').close();location.hash='home';quiz=null;});
    $('#quiz-summary button').focus();
  }
  async function quitQuiz() {
    if(quiz && !quiz.logged){if(!confirm('结束本轮练习吗？已回答题目的进度会保留。'))return;await logRound(true);}
    $('#quiz-dialog').close();quiz=null;
  }
  $('#quit-quiz').addEventListener('click',quitQuiz);
  $('#quiz-dialog').addEventListener('cancel',event=>{event.preventDefault();quitQuiz();});
  $('#type-form').addEventListener('submit',event=>{event.preventDefault();if(!clean($('#type-answer').value)){toast('先输入你的答案吧。');return;}answer($('#type-answer').value);});
  $('#next-question').addEventListener('click',()=>{if(!quiz?.answered)return;if(quiz.index===quiz.queue.length-1)finishQuiz();else{quiz.index++;renderQuestion();}});
  document.addEventListener('click',async event=>{
    const close=event.target.closest('[data-close]');if(close){$('#'+close.dataset.close).close();return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(disk.needsReconnect()&&action){disk.show();return;}
    if((committing||disk.isBusy())&&(action||event.target.closest('[data-edit],[data-delete]'))){toast('正在保存或切换题库，请稍候。');return;}
    if(action==='add')openEditor();
    if(action==='start-choice')startQuiz('choice');
    if(action==='start-type')startQuiz('type');
    if(action==='bulk'){$('#bulk-text').value='';$('#bulk-error').textContent='';$('#bulk-dialog').showModal();$('#bulk-text').focus();}
    if(action==='export')exportWords();
    if(action==='worksheet')window.WordGardenWorksheet.open(state.words, filteredWords());
    if(action==='import')$('#import-file').click();
    if(action==='remove-demo'){
      const count=state.words.filter(w=>w.isDemo && !w.attempts).length;
      if(!count){toast('没有未练习过的示例题。');return;}
      if(confirm('移除 '+count+' 组未练习的示例题？你添加的题目和练过的示例不受影响。')){
        const previousWords=[...state.words];committing=true;
        try{state.words=state.words.filter(w=>!w.isDemo||w.attempts);if(!await save()){state.words=previousWords;return;}render();toast('示例已移除，添加自己的词语吧。');}finally{committing=false;}
      }
    }
    const edit=event.target.closest('[data-edit]');if(edit)openEditor(edit.dataset.edit);
    const del=event.target.closest('[data-delete]');
    if(del){const word=state.words.find(w=>w.id===del.dataset.delete);if(word && confirm('删除“'+word.correct+'”及它的练习进度？')){
      const previousWords=[...state.words];committing=true;
      try{state.words=state.words.filter(w=>w.id!==word.id);if(!await save()){state.words=previousWords;return;}render();toast('已移除这组词语。');}finally{committing=false;}
    }}
    const filterBtn=event.target.closest('[data-filter]');if(filterBtn){filter=filterBtn.dataset.filter;$$('[data-filter]').forEach(el=>el.classList.toggle('active',el===filterBtn));renderWords();}
  });
  $('#word-search').addEventListener('input',renderWords);
  window.addEventListener('hashchange',route);
  window.addEventListener('storage',event=>{if(event.key===KEY&&!disk.isFile())toast('另一个页面更新了题库。请导出本页未保存内容后刷新，避免覆盖。');});
  disk.configure({
    snapshot:()=>JSON.stringify({...state,exportedAt:new Date().toISOString()}),
    busy:()=>committing,
    persisted:()=>{initialWarning='';},
    hasUnsaved:()=>disk.status().dirty||$('#editor-dialog').open||$('#bulk-dialog').open||!!quiz||!!window.KnowledgeReview?.active(),
    validate:validateDataset,
    apply(next){
      state=next;initialWarning='';quiz=null;editID=null;filter='all';
      for(const id of ['editor-dialog','bulk-dialog','quiz-dialog'])if($('#'+id).open)$('#'+id).close();
      $('#word-search').value='';
      $$('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter==='all'));
      window.KnowledgeReview?.reset();render();
    }
  });
  window.WordGardenStudy={
    read:()=>window.ReviewBank.normalize(state.review),
    blocked:()=>committing||disk.isBusy()||disk.needsReconnect(),
    async commit(review){
      if(committing||disk.isBusy()||disk.needsReconnect()){toast('请先完成保存或重新打开本地题库。');return false;}
      committing=true;
      // Keep failed answer saves in memory so the existing local-file retry can recover them.
      try {state.review=window.ReviewBank.normalize(review);return await save();}
      finally {committing=false;}
    },
    backup:exportWords, validate:validateDataset,
    async restore(data){
      if(this.blocked())return false;
      const next=await validateDataset(data);
      if(this.blocked())return false;
      committing=true;
      const previous=state;
      try {state=next;if(!await save()){state=previous;return false;}window.KnowledgeReview?.reset();render();return true;}
      finally {committing=false;}
    },
    toast, route
  };
  $('#today-date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
  render();route();
  if(initialWarning){toast(initialWarning);disk.markUnsaved(initialWarning);}else if(!disk.needsReconnect())void save();
})();

