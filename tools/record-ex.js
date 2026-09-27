// EX の録画（動画素材用）。使い方: node tools/record-ex.js [学年名] → sh tools/mux-ex.sh
// 映像は puppeteer の screencast（1080x1920、html を zoom:2）、音は WebAudio の出力を MediaRecorder で横取りして録る。
// screencast は実際の取り込み fps と書き込み fps（25）がずれるので、同期は mux-ex.sh で画面内の横幅バナーを目印に合わせる。
// 必要: npm i puppeteer-core（このフォルダかどこかで）、Google Chrome、ffmpeg
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'rec');
fs.mkdirSync(OUT, { recursive: true });
const GRADE = process.argv[2] || '三年级上';
(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await p.evaluateOnNewDocument(g => {
    localStorage.setItem('hisuan.gradeName', g);
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dst, ...rest) {
      const r = orig.call(this, dst, ...rest);
      if (dst instanceof AudioDestinationNode) {
        const c = this.context;
        c.__tap ||= c.createMediaStreamDestination();
        orig.call(this, c.__tap);
      }
      return r;
    };
  }, GRADE);
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.addStyleTag({ content: 'html{zoom:2} #app{max-width:none;height:960px}' });
  const w = ms => new Promise(r => setTimeout(r, ms));
  const answer = async (untilMode, pace) => {
    for (;;) {
      const st = await p.evaluate(() => ({ m: G.mode, d: G.locked || !G.prob ? null : (G.prob.slots[G.k]?.d ?? null) }));
      if (st.m !== untilMode) return;
      if (st.d != null) { await p.click(`.key[data-k="${st.d}"]`); await w(pace()); } else await w(50);
    }
  };
  // 本編は録画外でさっと解く
  await p.click('#go');
  await p.evaluate(() => { SFX.on(); });
  await w(900);
  await answer('base', () => 120);
  await w(2200);
  // 録音開始 → 録画開始
  await p.evaluate(() => {
    const c = SFX.ctx; c.__tap ||= c.createMediaStreamDestination(); /* 無音区間を MediaRecorder が飛ばさないよう、聞こえない直流を録音側にだけ流す */ const k = c.createConstantSource(); k.offset.value = 0.0005; k.connect(c.__tap); k.start();
    window.__chunks = []; window.__rec = new MediaRecorder(c.__tap.stream, { mimeType: 'audio/webm;codecs=opus' });
    __rec.ondataavailable = e => __chunks.push(e.data); __rec.start(); window.__audioT0 = Date.now();
  });
  const rec = await p.screencast({ path: `${OUT}/ex_video.webm` });
  const videoT0 = Date.now();
  await w(1200);                      // 結果画面を少し見せる
  await p.click('#toEx');
  await w(900);
  await answer('ex', () => 260 + Math.random() * 180);   // 人が押す速さ
  await w(4500);                      // 「结束！」→ 最終結果
  await rec.stop();
  const audioT0 = await p.evaluate(() => new Promise(res => { __rec.onstop = async () => {
    const buf = await new Blob(__chunks).arrayBuffer(); let s = ''; const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    res({ t0: __audioT0, b64: btoa(s) }); }; __rec.stop(); }));
  fs.writeFileSync(`${OUT}/ex_audio.webm`, Buffer.from(audioT0.b64, 'base64'));
  console.log(await p.evaluate(() => ({ exOk: G.exOk, exMiss: G.exMiss, dopa: fmt(G.dopa) })));
  await b.close();
})();
