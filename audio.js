/*
 * audio.js — Arcade music & SFX engine (shared, no assets)
 * Include with:  <script src="../audio.js"></script>  before </head>
 * - Picks a melody deterministically from the page <title> (override with <body data-tune="N">).
 * - Starts music on the first user gesture (pointer/keyboard), autoplay-safe.
 * - Injects a floating 🔊 mute button (no HTML changes needed).
 * - Exposes window.Arcade.sfx('name') for game sound effects.
 */
(function () {
  'use strict';

  var NOTE = {
    C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00, A3:220.00, B3:246.94,
    C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
    C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77,
    C6:1046.5, D6:1174.7, E6:1318.5
  };

  // Each melody: bpm + a 16-step single-voice line (null = rest) + a bass note per bar.
  var MELODIES = [
    { bpm:126, mel:['C5','E5','G5','C6','G5','E5','C5','E5','A4','C5','E5','A5','E5','C5','A4','C5'], bass:['C3','A2','F2','G2'] },
    { bpm:112, mel:['E5','G5','A5','G5','E5','D5','C5','D5','E5','G5','A5','C6','G5','E5','D5','C5'], bass:['C3','A2','F2','G2'] },
    { bpm:100, mel:['A4','C5','E5','D5','C5','B4','A4','C5','E5','G5','A5','E5','D5','C5','B4','A4'], bass:['A2','F2','C3','E3'] },
    { bpm:120, mel:['C5','D5','E5','G5','E5','D5','E5','C5','D5','E5','F5','A5','G5','E5','D5','C5'], bass:['C3','G2','F2','G2'] },
    { bpm:138, mel:['G5','E5','C5','G4','A4','C5','E5','G5','A5','G5','E5','C5','D5','E5','D5','B4'], bass:['C3','A2','F2','G2'] },
    { bpm:96,  mel:['E5',null,'G5',null,'A5','B5','A5','G5','E5',null,'D5',null,'C5','D5','E5',null], bass:['C3','G2','A2','E3'] },
    { bpm:144, mel:['C5','D5','E5','C5','G4','C5','D5','E5','F5','E5','D5','B4','G4','A4','B4','C5'], bass:['C3','A2','G2','C3'] },
    { bpm:108, mel:['A4','B4','C5','B4','A4','G4','A4','B4','C5','E5','D5','C5','B4','C5','D5','B4'], bass:['A2','F2','G2','E3'] },
    { bpm:118, mel:['G4','C5','E5','G5','E5','C5','G4','A4','F4','A4','C5','F5','C5','A4','F4','G4'], bass:['C3','F2','G2','C3'] },
    { bpm:132, mel:['D5','A4','C5','D5','F5','D5','C5','A4','G4','B4','D5','G5','D5','B4','G4','A4'], bass:['D3','B2','G2','A2'] },
    { bpm:90,  mel:['E5','D5','C5','D5','E5','E5','E5',null,'D5','D5','D5',null,'E5','G5','G5',null], bass:['C3','G2','C3','G2'] },
    { bpm:150, mel:['E5','G5','A5','B5','C6','B5','A5','G5','E5','G5','A5','B5','A5','G5','E5','D5'], bass:['A2','C3','F2','E3'] }
  ];

  var Arcade = window.Arcade = {};
  var actx = null, timer = null, playing = false, stepIdx = 0, tune = 0, muted = false;

  function hashStr(s) {
    var h = 0, i;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function pickTune() {
    var t = document.body && document.body.getAttribute('data-tune');
    if (t !== null && !isNaN(parseInt(t, 10))) return parseInt(t, 10) % MELODIES.length;
    var title = (document.title || '').toLowerCase();
    return hashStr(title) % MELODIES.length;
  }

  function ensureCtx() {
    if (!actx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) actx = new C();
    }
    if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    return actx;
  }

  function beep(freq, t, dur, type, vol) {
    var c = ensureCtx(); if (!c) return;
    type = type || 'square'; vol = vol == null ? 0.05 : vol;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function scheduleStep() {
    var m = MELODIES[tune];
    var step = 60 / m.bpm / 2; // eighth notes
    var now = actx.currentTime + 0.03;
    var note = m.mel[stepIdx % m.mel.length];
    if (note) beep(NOTE[note], now, step * 0.85, 'square', 0.045);
    if (stepIdx % 4 === 0) { // bass on each beat
      var bass = m.bass[(stepIdx / 4) % m.bass.length];
      if (bass) beep(NOTE[bass], now, step * 3.2, 'triangle', 0.09);
    }
    stepIdx++;
  }

  function start() {
    if (playing || muted) return;
    if (!ensureCtx()) return;
    playing = true; stepIdx = 0;
    var m = MELODIES[tune];
    var stepMs = (60 / m.bpm / 2) * 1000;
    scheduleStep();
    timer = setInterval(scheduleStep, stepMs);
  }
  function stop() { playing = false; if (timer) { clearInterval(timer); timer = null; } }

  function injectButton() {
    if (document.getElementById('arcade-mute')) return;
    var b = document.createElement('button');
    b.id = 'arcade-mute';
    b.textContent = '🔊';
    b.title = 'Musique';
    b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;width:36px;height:36px;' +
      'border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.45);' +
      'color:#fff;font-size:16px;line-height:1;cursor:pointer;padding:0;' +
      '-webkit-tap-highlight-color:transparent;';
    b.onclick = function (e) {
      e.stopPropagation(); muted = !muted;
      if (muted) { stop(); b.textContent = '🔇'; }
      else { b.textContent = '🔊'; start(); }
    };
    (document.body || document.documentElement).appendChild(b);
  }

  Arcade.toggle = function () {
    muted = !muted;
    if (muted) stop(); else start();
    var b = document.getElementById('arcade-mute');
    if (b) b.textContent = muted ? '🔇' : '🔊';
    return muted;
  };

  // --- Sound effects ---
  var SFX = {
    correct: function (t) { beep(NOTE.C5, t, 0.08, 'square', 0.06); beep(NOTE.E5, t + 0.07, 0.08, 'square', 0.06); beep(NOTE.G5, t + 0.14, 0.12, 'square', 0.06); },
    wrong:   function (t) { beep(NOTE.E3, t, 0.16, 'sawtooth', 0.07); beep(NOTE.C3, t + 0.12, 0.2, 'sawtooth', 0.07); },
    click:   function (t) { beep(NOTE.A5, t, 0.04, 'square', 0.05); },
    tick:    function (t) { beep(NOTE.B5, t, 0.03, 'square', 0.04); },
    win:     function (t) { ['C5','E5','G5','C6','E6'].forEach(function (n, i) { beep(NOTE[n], t + i * 0.09, 0.14, 'square', 0.06); }); },
    lose:    function (t) { ['G5','E5','C5','G4'].forEach(function (n, i) { beep(NOTE[n], t + i * 0.13, 0.16, 'sawtooth', 0.06); }); },
    coin:    function (t) { beep(NOTE.B5, t, 0.05, 'square', 0.06); beep(NOTE.E6, t + 0.05, 0.12, 'square', 0.06); },
    jump:    function (t) { beep(NOTE.C5, t, 0.06, 'square', 0.05); beep(NOTE.E5, t + 0.05, 0.09, 'square', 0.05); },
    hit:     function (t) { beep(NOTE.G3, t, 0.1, 'sawtooth', 0.08); },
    pop:     function (t) { beep(NOTE.C6, t, 0.05, 'square', 0.06); beep(NOTE.A5, t + 0.04, 0.06, 'square', 0.05); },
    whoosh:  function (t) { beep(NOTE.A3, t, 0.18, 'triangle', 0.07); }
  };
  Arcade.sfx = function (name) {
    if (muted) return;
    var c = ensureCtx(); if (!c) return;
    var fn = SFX[name] || SFX.click;
    fn(c.currentTime + 0.01);
  };

  // Autoplay-safe: start on first user gesture.
  function firstGesture() {
    if (!muted) start();
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      document.removeEventListener(ev, firstGesture);
    });
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, firstGesture, { passive: true });
  });

  tune = pickTune();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectButton);
  else injectButton();
})();
