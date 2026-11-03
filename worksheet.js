(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const images = window.WordGardenImages;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  const shuffle = items => { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };
  const STYLE = [
    '*{box-sizing:border-box}body{margin:0;background:#edf0e9;color:#222;font-family:"Microsoft YaHei","PingFang SC",sans-serif;line-height:1.6}',
    '.toolbar{position:sticky;top:0;z-index:1;background:#fff;border-bottom:1px solid #dce2d5;padding:14px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:13px}.toolbar p{margin:0;flex:1;min-width:200px;color:#63705c}.toolbar button{border:1px solid #ccd6c5;border-radius:7px;padding:9px 15px;cursor:pointer;background:white;font:inherit}.toolbar button:first-of-type{background:#365e48;color:white;border-color:#365e48}',
    '.sheet{width:210mm;min-height:297mm;margin:20px auto;background:white;padding:15mm 18mm;box-shadow:0 5px 20px #0000000c}.brand{font-size:10px;letter-spacing:2px;color:#666}h1{font-size:23px;line-height:1.5;margin:9px 0 14px;overflow-wrap:anywhere}h2{font-size:18px;margin:0 0 15px}.student-meta{display:flex;gap:20px;flex-wrap:wrap;font-size:12px;border-bottom:2px solid #333;padding-bottom:12px}.instruction{font-size:12px;color:#444;margin:14px 0 12px}.questions{list-style:none;padding:0;margin:0}.question{break-inside:avoid;page-break-inside:avoid;min-height:24mm;border-bottom:1px solid #ddd;padding:9px 0 11px}.prompt{display:flex;align-items:baseline;gap:9px}.number{font-size:12px;color:#666;flex-shrink:0}.word{font-size:17px;overflow-wrap:anywhere}.write-line{display:block;border-bottom:1px solid #888;width:90%;height:25px;margin:3px 0 0 auto}.choices{display:flex;gap:26px;margin:7px 0 0 24px;flex-wrap:wrap;font-size:16px}.choices span{overflow-wrap:anywhere;max-width:100%}.page-foot{margin-top:15px;color:#777;font-size:10px;text-align:right}.answer-intro{font-size:12px;color:#555;margin:0 0 16px}.answer-item{break-inside:avoid;page-break-inside:avoid;border-bottom:1px solid #ddd;padding:12px 0;overflow-wrap:anywhere}.answer-item strong{font-size:15px}.answer-item p{font-size:12px;color:#555;margin:5px 0 0}.answer-item .original{font-size:11px;color:#777}.answers h1{border-bottom:2px solid #333;padding-bottom:12px}',
    '@media(max-width:820px){.sheet{width:calc(100% - 24px);min-height:0;padding:25px 22px;margin:12px auto}.question{min-height:90px}.student-meta{gap:12px}}',
    '.wrong-word-image{max-width:145mm;max-height:20mm;object-fit:contain;display:block;background:white;margin:4px 0}.image-question{min-height:44mm}.image-question .prompt{align-items:flex-start}.image-question .write-line{height:23px}.answer-item .wrong-word-image{max-height:15mm;max-width:110mm}',
    '@page{size:A4;margin:15mm 18mm}@media print{html,body{margin:0;background:#fff;font-size:12pt}.toolbar{display:none!important}.sheet{width:auto;min-height:0;padding:0;margin:0;box-shadow:none;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}.question{min-height:24mm}.image-question{min-height:44mm}.student-meta{gap:20px}a{color:inherit}}'
  ].join('\n');
  let sourceWords = [], visibleIDs = new Set();
  const markup = '<dialog id="worksheet-dialog" class="form-dialog"><form id="worksheet-form"><div class="dialog-top"><span class="eyebrow">PRACTICE ON PAPER</span><button type="button" class="icon-button" data-close="worksheet-dialog" aria-label="关闭">×</button></div><h2>导出复习练习单</h2><p class="dialog-description">生成 A4 练习单，可打印、另存为 PDF 或下载为独立网页。</p><label>练习单标题<input id="worksheet-title" maxlength="60" value="错别字巩固练习" required></label><label>题目范围<select id="worksheet-scope"><option value="filtered">当前筛选结果</option><option value="all">全部词语</option><option value="pending">待巩固的词语</option><option value="errors">曾答错的词语</option></select></label><div class="worksheet-fields"><label>练习形式<select id="worksheet-format"><option value="correction">改错题：写出正确词语</option><option value="choice">选择题：圈出正确写法</option></select></label><label>题目数量<select id="worksheet-limit"><option value="10">最多 10 题</option><option value="20" selected>最多 20 题</option><option value="40">最多 40 题</option><option value="all">全部符合条件的题目</option></select></label></div><label class="worksheet-check"><input id="worksheet-random" type="checkbox" checked>随机排列题目</label><label class="worksheet-check"><input id="worksheet-answers" type="checkbox" checked>附教师答案（另起一页）</label><label class="worksheet-check"><input id="worksheet-hints" type="checkbox" checked>在教师答案中附上记忆提示</label><p id="worksheet-count" class="worksheet-count" aria-live="polite"></p><p class="worksheet-note">学生练习页不显示答案或提示。打印时可按页码仅打印练习页；导出不会更改学习记录。</p><p id="worksheet-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button secondary" data-close="worksheet-dialog">取消</button><button type="submit" class="button primary" id="worksheet-generate">生成练习单 ↗</button></div></form></dialog>';
  document.body.insertAdjacentHTML('beforeend', markup);
  $('.tool-buttons').insertAdjacentHTML('beforeend', '<button class="button primary" data-action="worksheet">导出练习单</button>');
  function getCandidates() {
    return sourceWords.filter(word => {
      switch ($('#worksheet-scope').value) {
        case 'all': return true;
        case 'pending': return word.streak < 3;
        case 'errors': return word.errors > 0;
        default: return visibleIDs.has(word.id);
      }
    });
  }
  function requestedCount() {
    const count = getCandidates().length;
    return $('#worksheet-limit').value === 'all' ? count : Math.min(count, Number($('#worksheet-limit').value));
  }
  function updateCount() {
    const count = requestedCount();
    const pageSize = getCandidates().some(images.isImage) ? 4 : 8;
    $('#worksheet-count').textContent = '符合条件 '+getCandidates().length+' 组，本次生成 '+count+' 题 · 练习页 '+Math.ceil(count/pageSize)+' 页（不含答案）'+(pageSize===4?' · 图片题以看图改错出题，每页最多 4 题':'');
    $('#worksheet-generate').disabled = count === 0;
    $('#worksheet-hints').disabled = !$('#worksheet-answers').checked;
    $('#worksheet-error').textContent = count ? '' : '此范围暂无题目，请切换范围或先添加词语。';
  }
  function worksheetRuntime() {
    document.querySelector('#print-sheet').addEventListener('click', () => window.print());
    document.querySelector('#download-sheet').addEventListener('click', () => {
      const html = '<!doctype html>\n' + document.documentElement.outerHTML;
      const url = URL.createObjectURL(new Blob([html], {type:'text/html;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = document.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-') + '.html';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  function buildDocument(words, settings) {
    // Generate options once so the student sheet and answer key always agree.
    const questions = words.map(word => {
      const options = settings.format === 'choice' && !images.isImage(word) ? shuffle([word.correct, word.wrong]) : [];
      return {...word, options, answerLetter: options.indexOf(word.correct) === 0 ? 'A' : 'B'};
    });
    const pages = [];
    const pageSize = settings.pageSize;
    const totalPages = Math.ceil(questions.length / pageSize);
    for (let start = 0; start < questions.length; start += pageSize) {
      const items = questions.slice(start, start + pageSize).map((word, index) => {
        const number = start + index + 1;
        if (images.isImage(word)) {
          return '<li class="question image-question"><div class="prompt"><span class="number">'+number+'.</span><div>看图写出正确词语：'+images.imageHTML(word)+'</div></div><span class="write-line" aria-label="书写正确词语"></span></li>';
        }
        if (settings.format === 'choice') {
          return '<li class="question"><div class="prompt"><span class="number">'+number+'.</span><span>圈出正确的写法：</span></div><div class="choices">'+word.options.map((text,i) => '<span>'+String.fromCharCode(65+i)+'. '+escapeHTML(text)+'</span>').join('')+'</div></li>';
        }
        return '<li class="question"><div class="prompt"><span class="number">'+number+'.</span><span class="word">'+escapeHTML(word.wrong)+'</span></div><span class="write-line" aria-label="书写正确词语"></span></li>';
      }).join('');
      pages.push('<section class="sheet student-sheet"><div class="brand">字有进步 · 纸上也能有进步</div><h1>'+escapeHTML(settings.title)+'</h1><div class="student-meta"><span>姓名：____________</span><span>班级：____________</span><span>日期：____________</span></div><p class="instruction">'+(settings.format === 'choice' ? '文字题请圈出正确写法；图片题请在横线上写出完整的正确词语。' : '请找出词语或图片中的错别字，在横线上写出完整的正确词语。')+' 本份共 '+questions.length+' 题。</p><ol class="questions">'+items+'</ol><div class="page-foot">练习页 '+(pages.length+1)+' / '+totalPages+'</div></section>');
    }
    if (settings.answers) {
      pages.push('<section class="sheet answers"><div class="brand">教师参考 · 请与学生练习页分开发放</div><h1>'+escapeHTML(settings.title)+' · 参考答案</h1><p class="answer-intro">与前方练习题号一一对应。'+(settings.hints ? '下列提示来自老师录入的题库。' : '')+'</p>'+questions.map((word,index) => '<div class="answer-item"><strong>'+(index+1)+'. '+(settings.format === 'choice' && !images.isImage(word) ? word.answerLetter+' · ' : '')+escapeHTML(word.correct)+'</strong><div class="original">常见错写：'+(images.isImage(word)?images.imageHTML(word):escapeHTML(word.wrong))+'</div>'+(settings.hints && word.hint ? '<p class="answer-hint">记忆提示：'+escapeHTML(word.hint)+'</p>' : '')+'</div>').join('')+'</section>');
    }
    const script = '(' + worksheetRuntime.toString() + ')();';
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHTML(settings.title)+'</title><style>'+STYLE+'</style></head><body><div class="toolbar"><p>练习共 '+questions.length+' 题，'+totalPages+' 个练习页'+(settings.answers?'，后附教师答案':'，不含答案')+'。打印建议：A4、缩放 100%，关闭页眉页脚；仅发练习时选择第 1～'+totalPages+' 页。</p><button id="print-sheet" type="button">打印 / 另存为 PDF</button><button id="download-sheet" type="button">下载练习单 HTML</button></div>'+pages.join('')+'<script>'+script+'</'+'script></body></html>';
  }
  $('#worksheet-form').addEventListener('change', updateCount);
  $('#worksheet-form').addEventListener('submit', event => {
    event.preventDefault();
    const count = requestedCount();
    if (!count) { updateCount(); return; }
    const title = $('#worksheet-title').value.trim();
    if (!title) { $('#worksheet-error').textContent = '请填写练习单标题。'; $('#worksheet-title').focus(); return; }
    const pageSize = getCandidates().some(images.isImage) ? 4 : 8;
    if (count > 100 && !confirm('将生成 '+count+' 题，约 '+Math.ceil(count/pageSize)+' 个练习页，确定继续吗？')) return;
    let candidates = getCandidates();
    if ($('#worksheet-random').checked) candidates = shuffle(candidates);
    const settings = {title, pageSize, format:$('#worksheet-format').value, answers:$('#worksheet-answers').checked, hints:$('#worksheet-hints').checked};
    const content = buildDocument(candidates.slice(0,count), settings);
    const preview = window.open('', '_blank');
    if (!preview) { $('#worksheet-error').textContent = '新窗口被浏览器拦截了。请允许此页面打开弹出窗口后重试。'; return; }
    try {
      preview.opener = null;
      preview.document.open(); preview.document.write(content); preview.document.close();
      $('#worksheet-dialog').close();
    } catch (error) {
      preview.close();
      $('#worksheet-error').textContent = '无法生成预览，请检查浏览器是否允许打开本地页面。';
    }
  });
  window.WordGardenWorksheet = {
    open(words, filteredWords) {
      sourceWords = words.map(word => ({...word}));
      visibleIDs = new Set(filteredWords.map(word => word.id));
      updateCount();
      $('#worksheet-dialog').showModal();
      $('#worksheet-title').focus();
    }
  };
})();

