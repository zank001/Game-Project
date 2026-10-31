/* main.js — boot: generate the world, show title, run the game loop. */
'use strict';
(async function boot() {
  const $ = (id) => document.getElementById(id);
  const tips = S77.TIPS;
  let tipI = 0;
  const tipTimer = setInterval(() => { $('ldTip').textContent = '💡 ' + tips[tipI++ % tips.length]; }, 2600);
  $('ldTip').textContent = '💡 ' + tips[0];

  const world = new S77.World(77);
  try {
    await world.generate((msg, frac) => { $('ldMsg').textContent = msg + '...'; $('ldBar').style.width = Math.round(frac * 100) + '%'; });
  } catch (e) {
    $('ldMsg').textContent = 'เกิดข้อผิดพลาดในการสร้างโลก: ' + e.message;
    throw e;
  }
  const canvas = $('view');
  const renderer = new S77.Renderer(canvas, world);
  renderer.buildMapCanvas();
  const game = new S77.Game(world, renderer);
  S77.game = game; // handy for debugging & Phase-2 modules
  S77.UI.init(game);
  S77.setupTouch(canvas);
  window.addEventListener('resize', () => renderer.resize());
  clearInterval(tipTimer);

  // title-screen camera: drift over a town at golden hour
  const showcase = ['chiangmai', 'bangkok', 'ayutthaya', 'phuket', 'nakhonphanom', 'sukhothai'];
  let demo = world.towns[S77.PROV_BY_KEY[S77.U.pick(showcase)].idx];
  game.camera.x = demo.cx - 6; game.camera.y = demo.cy + 2;
  game.time.total = 17.4 * 60;
  renderer.setSeason(S77.seasonOf(game.time.month()));

  $('loading').classList.add('done');
  setTimeout(() => ($('loading').hidden = true), 600);

  const startHud = () => { $('title').hidden = true; $('hud').hidden = false; document.body.classList.add('playing'); };
  S77.UI.title(game, !!S77.Game.readSave('auto'), () => {
    S77.UI.charCreate(game, (opt) => {
      game.newGame(opt);
      renderer.setSeason(S77.seasonOf(game.time.month()));
      startHud();
      setTimeout(() => S77.UI.toast('👋 ยินดีต้อนรับ ' + opt.name + '! เดินด้วย WASD/ลูกศร กด E เพื่อโต้ตอบ', 'info'), 800);
      setTimeout(() => S77.UI.toast('💡 ลองเดินไปที่ตลาดหรือร้านสะดวกซื้อหาอะไรกิน แล้วไปสำนักงานจัดหางาน', 'info'), 4500);
    });
  }, () => {
    const d = S77.Game.readSave('auto');
    if (!d) return;
    game.load(d);
    renderer.setSeason(S77.seasonOf(game.time.month()));
    startHud();
    S77.UI.toast('📂 ยินดีต้อนรับกลับ ' + d.player.name, 'info');
  });

  // autosave every 2 real minutes while playing
  setInterval(() => { if (game.player && !S77.UI.modalOpen()) game.save('auto', true); }, 120000);
  window.addEventListener('beforeunload', () => { if (game.player) game.save('auto', true); });

  let last = performance.now();
  const ctx = canvas.getContext('2d');
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try {
      if (game.player) game.update(dt);
      else { game.time.realSec += dt; game.camera.x += dt * 0.7; game.camera.y -= dt * 0.25; }
      renderer.render(game, dt);
      S77.UI.drawOverlay(ctx, game);
      S77.UI.updateHud(game, dt);
    } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
