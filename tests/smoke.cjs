const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const context = await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  const root = path.resolve(__dirname, '..');
  const url = pathToFileURL(path.join(root, 'index.html')).href;
  const key = 'word-garden:v1';
  const readState = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
  const resetState = async state => {
    await page.evaluate(({key,state}) => localStorage.setItem(key,JSON.stringify(state)), {key,state});
    await page.goto(url);
  };
  const item = (correct,wrong,hint='') => ({id:'test-word',correct,wrong,hint,attempts:0,hits:0,streak:0,errors:0,lastSeen:0,isDemo:false});
  try {
    await page.goto(url);
    assert.equal(await page.title(),'字有进步 · 错字小花园');
    assert.equal(await page.locator('#stat-total').textContent(),'12');
    assert.equal(await page.locator('.seed-chip').count(),6);
    await page.screenshot({path:path.join(root,'preview.png'),fullPage:true});
    console.log('PASS: first load, demo data, dashboard');

    await page.locator('.page-heading [data-action="add"]').first().click();
    await page.locator('[name="correct"]').fill('坚定');
    await page.locator('[name="wrong"]').fill('坚订');
    await page.locator('[name="hint"]').fill('坚定不移，用定。');
    await page.locator('#word-form [type="submit"]').click();
    assert.equal(await page.locator('#stat-total').textContent(),'13');
    await page.reload();
    assert.equal(await page.locator('#stat-total').textContent(),'13');
    await page.locator('nav [href="#words"]').click();
    await page.locator('#word-search').fill('坚定');
    assert.equal(await page.locator('#word-table tr').count(),1);
    await page.locator('[data-edit]').click();
    await page.locator('[name="hint"]').fill('编辑后的提示');
    await page.locator('#word-form [type="submit"]').click();
    assert.ok((await page.locator('#word-table').textContent()).includes('编辑后的提示'));
    await page.locator('[data-delete]').click();
    assert.equal((await readState()).words.length,12);
    await page.locator('#word-search').fill('');
    console.log('PASS: add, edit, search, delete, persistence');

    await page.locator('[data-action="bulk"]').click();
    await page.locator('#bulk-text').fill('爱戴 | 爱带 | 尊敬爱戴\n再接再厉 | 再接再励 | 重复题');
    await page.locator('#bulk-save').click();
    assert.equal((await readState()).words.length,13);
    await page.locator('[data-action="bulk"]').click();
    await page.locator('#bulk-text').fill('测试 | 侧试 | 测试提示\n错误行');
    await page.locator('#bulk-save').click();
    assert.ok((await page.locator('#bulk-error').textContent()).includes('第 2 行'));
    assert.equal((await readState()).words.length,13);
    await page.locator('[data-close="bulk-dialog"]').first().click();
    console.log('PASS: atomic bulk entry and duplicate handling');

    await page.locator('nav [href="#home"]').click();
    await page.locator('#round-size').selectOption('5');
    await page.locator('[data-action="start-choice"]').first().click();
    for(let index=0;index<5;index++) {
      const buttons = page.locator('.answer-option');
      const labels = await buttons.locator('span').allTextContents();
      const state=await readState();
      const correct=labels.find(label => state.words.some(word => word.correct===label));
      const answer=index===0 ? labels.find(label=>label!==correct) : correct;
      await buttons.filter({hasText:answer}).click();
      assert.equal(await page.locator('#quiz-feedback').isVisible(),true);
      assert.equal(await buttons.first().isDisabled(),true);
      await page.locator('#next-question').click();
    }
    assert.equal(await page.locator('#quiz-summary').isVisible(),true);
    assert.equal((await readState()).history[0].correct,4);
    assert.equal((await readState()).history[0].total,5);
    await page.locator('#retry-mistakes').click();
    assert.equal(await page.locator('#quiz-number').textContent(),'1 / 1');
    await page.locator('#quit-quiz').click();
    console.log('PASS: choice game, feedback, scoring, incorrect-answer retry');

    const downloadPromise=page.waitForEvent('download');
    await page.locator('nav [href="#words"]').click();
    await page.locator('[data-action="export"]').click();
    const download=await downloadPromise;
    assert.ok(download.suggestedFilename().endsWith('.json'));
    const exported=JSON.parse(await require('node:fs/promises').readFile(await download.path(),'utf8'));
    assert.equal(exported.words.length,13);
    await page.locator('#import-file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([{correct:'坚持',wrong:'坚特',hint:'坚持不懈'}]))});
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).words.length===14,key);
    await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('导入失败'));
    assert.equal((await readState()).words.length,14);
    console.log('PASS: export, JSON import, malformed import');

    await resetState({version:1,words:[item('再接再厉','再接再励','继续努力，用厉。')],history:[]});
    for(let round=0;round<3;round++) {
      await page.locator('[data-action="start-type"]').click();
      await page.locator('#type-answer').fill('再接再厉');
      await page.locator('#type-submit').click();
      await page.locator('#next-question').click();
      await page.locator('#back-home').click();
    }
    assert.equal((await readState()).words[0].streak,3);
    assert.equal(await page.locator('#stat-mastered').textContent(),'1');
    await page.locator('[data-action="start-type"]').click();
    await page.locator('#type-answer').fill('错误答案');
    await page.locator('#type-submit').click();
    assert.equal((await readState()).words[0].streak,0);
    await page.locator('#quit-quiz').click();
    assert.equal((await readState()).history[0].interrupted,true);
    await page.locator('nav [href="#growth"]').click();
    assert.equal(await page.locator('.garden-item').count(),1);
    console.log('PASS: typing game, mastery, reset streak, interrupted round, growth');

    await resetState({version:1,words:[],history:[]});
    await page.locator('[data-action="start-choice"]').first().click();
    assert.equal(await page.locator('#editor-dialog').isVisible(),true);
    await page.locator('[name="correct"]').fill('相同');
    await page.locator('[name="wrong"]').fill('相同');
    await page.locator('#word-form [type="submit"]').click();
    assert.ok((await page.locator('#editor-error').textContent()).includes('不能相同'));
    await page.locator('[data-close="editor-dialog"]').first().click();
    await resetState({version:1,words:[item('<img src=x onerror=alert(1)>','测试错写','<script>alert(1)</script>')],history:[]});
    await page.locator('nav [href="#words"]').click();
    assert.equal(await page.locator('#word-table img,#word-table script').count(),0);
    console.log('PASS: empty-state handling, invalid pair validation, HTML escaping');

    await resetState({version:1,words:[item('已经','己经')],history:[]});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(root,'preview-mobile.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.locator('[data-action="start-type"]').click();
    assert.ok(await page.evaluate(()=>document.querySelector('#quiz-dialog').getBoundingClientRect().width<=window.innerWidth));
    await page.screenshot({path:path.join(root,'preview-game-mobile.png'),fullPage:true});
    console.log('PASS: mobile layout and game dialog');
    assert.deepEqual(errors,[]);
    console.log('ALL SMOKE TESTS PASSED; no browser runtime errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

