(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const MAX_IMAGE_LENGTH = 500000;
  let draft = '', busy = false, generation = 0;
  const wrongInput = $('#word-form').elements.wrong;
  $('#quiz-question').insertAdjacentHTML('afterend','<div id="quiz-word-image" class="quiz-image-frame" hidden></div>');
  const textField = wrongInput.closest('label');
  textField.id = 'wrong-text-field';
  textField.insertAdjacentHTML('beforebegin', '<fieldset class="entry-mode"><legend>常见错写的录入方式</legend><label><input type="radio" name="wrongType" value="text" checked>文字</label><label><input type="radio" name="wrongType" value="image">图片</label></fieldset>');
  textField.insertAdjacentHTML('afterend', '<div id="wrong-image-field" hidden><label for="wrong-image-file">上传学生的错写图片 <span>*</span></label><input id="wrong-image-file" type="file" accept="image/png,image/jpeg,image/webp"><p class="image-help">支持 JPG、PNG、WebP（原图不超过 10 MB），也可在此弹窗粘贴截图。请先裁成单字或完整词语，不要上传整页作业。</p><div id="wrong-image-preview" hidden><img id="wrong-image-thumbnail" alt="学生的手写错字图片"><button type="button" class="text-link" id="remove-wrong-image">移除图片</button></div><p id="wrong-image-status" class="image-status" role="status"></p></div>');
  const isImage = word => word?.wrongType === 'image';
  const validImage = data => typeof data === 'string' && data.length <= MAX_IMAGE_LENGTH && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data);
  function imageHTML(word, className = '') {
    // Never interpolate an arbitrary URL from a backup into an image source.
    return isImage(word) && validImage(word.wrongImage)
      ? '<img class="wrong-word-image '+className+'" src="'+word.wrongImage+'" alt="学生的手写错字图片">'
      : '';
  }
  function loadImage(src) {
    return new Promise((resolve,reject) => {
      const image = new Image();
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 24000000) { reject(new Error('图片过大或无效，请先裁剪为单个词语后再上传。')); return; }
        resolve(image);
      };
      image.onerror = () => reject(new Error('无法读取图片，请换用 JPG、PNG 或 WebP 文件。'));
      image.src = src;
    });
  }
  function refresh() {
    const imageMode = $('#word-form').elements.wrongType.value === 'image';
    textField.hidden = imageMode;
    wrongInput.required = !imageMode;
    wrongInput.disabled = imageMode;
    $('#wrong-image-field').hidden = !imageMode;
    $('#wrong-image-preview').hidden = !draft;
    $('#wrong-image-thumbnail').src = draft || '';
    $('#word-form [type="submit"]').disabled = busy;
  }
  async function selectFile(file) {
    const ticket = ++generation;
    busy = false; refresh();
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { $('#wrong-image-status').textContent = '只支持 JPG、PNG 或 WebP 图片，请不要使用 SVG、GIF 或其他文件。'; return; }
    if (file.size > 10 * 1024 * 1024) { $('#wrong-image-status').textContent = '原图请小于 10 MB，请先裁剪后再上传。'; return; }
    busy = true; refresh();
    $('#wrong-image-status').textContent = '正在处理图片，请稍候…';
    const objectURL = URL.createObjectURL(file);
    try {
      const image = await loadImage(objectURL);
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1,Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1,Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      let data = canvas.toDataURL('image/jpeg', .86);
      for (const quality of [.75,.6,.45]) {
        if (data.length <= MAX_IMAGE_LENGTH) break;
        data = canvas.toDataURL('image/jpeg',quality);
      }
      if (!validImage(data)) throw new Error('图片仍然太大，请先裁剪到需要复习的字词，再上传。');
      if (ticket !== generation) return;
      draft = data;
      $('#wrong-image-status').textContent = '图片已就绪 · '+canvas.width+' × '+canvas.height+' · 约 '+Math.ceil(data.length * .75 / 1024)+' KB。请确认笔画清晰。';
      $('#editor-error').textContent = '';
    } catch (error) {
      if (ticket === generation) $('#wrong-image-status').textContent = error.message;
    } finally {
      URL.revokeObjectURL(objectURL);
      if (ticket === generation) {busy = false;refresh();}
    }
  }
  $('#word-form').addEventListener('change', event => {
    if (event.target.name === 'wrongType') refresh();
  });
  $('#wrong-image-file').addEventListener('change', event => {
    void selectFile(event.target.files[0]); event.target.value = '';
  });
  $('#word-form').addEventListener('paste', event => {
    if ($('#word-form').elements.wrongType.value !== 'image') return;
    const file = [...(event.clipboardData?.items || [])].find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();
    if (file) { event.preventDefault(); void selectFile(file); }
  });
  $('#remove-wrong-image').addEventListener('click', () => {
    generation++; draft = ''; busy = false; $('#wrong-image-status').textContent = ''; refresh();
  });
  $('#editor-dialog').addEventListener('close', () => {generation++;busy=false;refresh();});
  window.WordGardenImages = {
    isImage, validImage, imageHTML,
    key(word) { return JSON.stringify([word.correct, isImage(word) ? 'image' : 'text', isImage(word) ? word.wrongImage : word.wrong]); },
    async verify(data) { if (!validImage(data)) throw new Error('图片格式无效或过大。'); await loadImage(data); },
    reset(word) {
      generation++; busy = false; draft = isImage(word) ? word.wrongImage : '';
      $('#word-form').elements.wrongType.value = isImage(word) ? 'image' : 'text';
      $('#wrong-image-file').value = ''; $('#wrong-image-status').textContent = draft ? '已保留原图片。可重新上传替换。' : '';
      refresh();
    },
    read() {
      const wrongType = $('#word-form').elements.wrongType.value;
      return {wrongType, wrongImage:wrongType === 'image' ? draft : '', busy};
    }
  };
  refresh();
})();

