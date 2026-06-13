(() => {
  const chart = window.CHART;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const audio = document.getElementById('audio');

  const $ = (id) => document.getElementById(id);
  const difficultyEl = $('difficulty');
  const startBtn = $('startBtn');
  const pauseBtn = $('pauseBtn');
  const restartBtn = $('restartBtn');
  const offsetEl = $('offset');
  const offsetLabel = $('offsetLabel');

  const scoreEl = $('score');
  const lifeEl = $('life');
  const comboEl = $('combo');
  const accuracyEl = $('accuracy');
  const judgeEl = $('judge');
  const songTitleEl = $('songTitle');
  const bpmEl = $('bpm');
  const durationEl = $('duration');
  const noteCountEl = $('noteCount');
  const levelEl = $('level');

  const keyToLane = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
  const laneLabels = ['D', 'F', 'J', 'K'];
  const JUDGES = ['Perfect', 'Great', 'Good', 'Bad', 'Miss'];
  const DEFAULT_BALANCE = {
    maxLife: 100,
    startLife: 80,
    comboStep: 10,
    comboBonus: 50,
    score: { Perfect: 1000, Great: 700, Good: 400, Bad: 0, Miss: 0 },
    life: { Perfect: 2, Great: 1, Good: 0, Bad: -6, Miss: -10 },
    weight: { Perfect: 1, Great: 0.7, Good: 0.4, Bad: 0, Miss: 0 },
  };

  const balanceIds = {
    maxLife: 'maxLife', startLife: 'startLife', comboStep: 'comboStep', comboBonus: 'comboBonus',
    score: { Perfect: 'scorePerfect', Great: 'scoreGreat', Good: 'scoreGood', Bad: 'scoreBad', Miss: 'scoreMiss' },
    life: { Perfect: 'lifePerfect', Great: 'lifeGreat', Good: 'lifeGood', Bad: 'lifeBad', Miss: 'lifeMiss' },
    weight: { Perfect: 'weightPerfect', Great: 'weightGreat', Good: 'weightGood', Bad: 'weightBad', Miss: 'weightMiss' },
  };

  const state = {
    notes: [],
    running: false,
    paused: false,
    failed: false,
    score: 0,
    life: DEFAULT_BALANCE.startLife,
    combo: 0,
    maxCombo: 0,
    judged: 0,
    accWeight: 0,
    counts: { Perfect: 0, Great: 0, Good: 0, Bad: 0, Miss: 0 },
    lastJudge: 'Ready',
    keyFlash: [0,0,0,0],
  };

  const layout = {
    laneCount: 4,
    playX: 58,
    playY: 70,
    playW: 404,
    playH: 590,
    receptorY: 610,
    noteH: 18,
    approach: 1.65,
    missWindow: 0.180,
  };

  function num(id, fallback = 0) {
    const el = $(id);
    const value = Number(el?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function readBalance() {
    const balance = {
      maxLife: Math.max(1, num(balanceIds.maxLife, DEFAULT_BALANCE.maxLife)),
      startLife: Math.max(1, num(balanceIds.startLife, DEFAULT_BALANCE.startLife)),
      comboStep: Math.max(1, Math.floor(num(balanceIds.comboStep, DEFAULT_BALANCE.comboStep))),
      comboBonus: num(balanceIds.comboBonus, DEFAULT_BALANCE.comboBonus),
      score: {}, life: {}, weight: {},
    };
    for (const judge of JUDGES) {
      balance.score[judge] = num(balanceIds.score[judge], DEFAULT_BALANCE.score[judge]);
      balance.life[judge] = num(balanceIds.life[judge], DEFAULT_BALANCE.life[judge]);
      balance.weight[judge] = num(balanceIds.weight[judge], DEFAULT_BALANCE.weight[judge]);
    }
    balance.startLife = Math.min(balance.startLife, balance.maxLife);
    return balance;
  }

  function writeBalance(balance) {
    $(balanceIds.maxLife).value = balance.maxLife;
    $(balanceIds.startLife).value = balance.startLife;
    $(balanceIds.comboStep).value = balance.comboStep;
    $(balanceIds.comboBonus).value = balance.comboBonus;
    for (const judge of JUDGES) {
      $(balanceIds.score[judge]).value = balance.score[judge];
      $(balanceIds.life[judge]).value = balance.life[judge];
      $(balanceIds.weight[judge]).value = balance.weight[judge];
    }
  }

  function selectedDifficulty() {
    return chart.difficulties[difficultyEl.value] || chart.difficulties.hard;
  }

  function cloneNotes() {
    return selectedDifficulty().notes.map((note, index) => ({
      index,
      time: Number(note.time),
      lane: Number(note.lane),
      type: note.type || 'tap',
      hit: false,
      missed: false,
    }));
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateInfo() {
    const diff = selectedDifficulty();
    songTitleEl.textContent = chart.title || 'Song';
    bpmEl.textContent = chart.bpm;
    durationEl.textContent = formatTime(chart.duration || audio.duration || 0);
    noteCountEl.textContent = diff.notes.length;
    levelEl.textContent = diff.level ?? '-';
  }

  function resetGame() {
    audio.pause();
    audio.currentTime = 0;
    const balance = readBalance();
    state.notes = cloneNotes();
    state.running = false;
    state.paused = false;
    state.failed = false;
    state.score = 0;
    state.life = balance.startLife;
    state.combo = 0;
    state.maxCombo = 0;
    state.judged = 0;
    state.accWeight = 0;
    state.counts = { Perfect: 0, Great: 0, Good: 0, Bad: 0, Miss: 0 };
    state.lastJudge = 'Ready';
    state.keyFlash = [0,0,0,0];
    updateHud();
    updateInfo();
  }

  async function startGame() {
    if (!state.notes.length || state.failed) resetGame();
    state.running = true;
    state.paused = false;
    state.lastJudge = 'Go';
    try { await audio.play(); }
    catch (err) { state.lastJudge = 'Click Start again'; }
    updateHud();
  }

  function pauseGame() {
    if (!state.running || state.failed) return;
    if (audio.paused) {
      audio.play();
      state.paused = false;
      state.lastJudge = 'Resume';
    } else {
      audio.pause();
      state.paused = true;
      state.lastJudge = 'Pause';
    }
    updateHud();
  }

  function currentSongTime() {
    return audio.currentTime + Number(offsetEl.value) / 1000;
  }

  function judgeName(deltaAbs) {
    if (deltaAbs <= 0.045) return 'Perfect';
    if (deltaAbs <= 0.090) return 'Great';
    if (deltaAbs <= 0.135) return 'Good';
    return null;
  }

  function comboBonusFor(combo, balance) {
    if (combo < balance.comboStep) return 0;
    return Math.floor(combo / balance.comboStep) * balance.comboBonus;
  }

  function applyJudge(judge, note = null, deltaMs = null) {
    const balance = readBalance();
    if (note) note.hit = true;
    const comboContinues = judge === 'Perfect' || judge === 'Great';
    if (comboContinues) {
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
    } else {
      state.combo = 0;
    }
    state.score += balance.score[judge] + (comboContinues ? comboBonusFor(state.combo, balance) : 0);
    state.life = Math.max(0, Math.min(balance.maxLife, state.life + balance.life[judge]));
    state.judged += 1;
    state.accWeight += balance.weight[judge];
    state.counts[judge] += 1;
    state.lastJudge = deltaMs === null ? judge : `${judge} ${deltaMs}ms`;
    if (state.life <= 0) failGame();
    updateHud();
  }

  function failGame() {
    state.failed = true;
    state.running = false;
    state.paused = false;
    audio.pause();
    state.lastJudge = `Failed · Max ${state.maxCombo}`;
  }

  function handleHit(lane) {
    if (!state.running || state.paused || state.failed) return;
    const now = currentSongTime();
    let best = null;
    let bestDelta = Infinity;
    for (const note of state.notes) {
      if (note.hit || note.missed || note.lane !== lane) continue;
      const delta = Math.abs(note.time - now);
      if (delta < bestDelta) { best = note; bestDelta = delta; }
      if (note.time - now > layout.missWindow) break;
    }
    const judge = best ? judgeName(bestDelta) : null;
    state.keyFlash[lane] = 1;
    if (!best || !judge) {
      applyJudge('Bad');
      return;
    }
    applyJudge(judge, best, Math.round((now - best.time) * 1000));
  }

  function markMisses() {
    if (!state.running || state.paused || state.failed) return;
    const now = currentSongTime();
    for (const note of state.notes) {
      if (note.hit || note.missed) continue;
      if (now - note.time > layout.missWindow) {
        note.missed = true;
        applyJudge('Miss');
      } else if (note.time - now > layout.approach + 0.25) {
        break;
      }
    }
  }

  function updateHud() {
    const balance = readBalance();
    scoreEl.textContent = Math.floor(state.score).toLocaleString();
    lifeEl.textContent = `${Math.ceil(state.life)}/${balance.maxLife}`;
    comboEl.textContent = state.combo;
    const acc = state.judged ? (state.accWeight / state.judged) * 100 : 100;
    accuracyEl.textContent = `${acc.toFixed(2)}%`;
    judgeEl.textContent = state.lastJudge;
  }

  function draw() {
    markMisses();
    const w = canvas.width, h = canvas.height;
    const laneW = layout.playW / layout.laneCount;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#171b2c');
    bg.addColorStop(1, '#0b0e16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    roundRect(ctx, layout.playX, layout.playY, layout.playW, layout.playH, 16, true, false);

    for (let i = 0; i < layout.laneCount; i++) {
      const x = layout.playX + i * laneW;
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.018)';
      ctx.fillRect(x, layout.playY, laneW, layout.playH);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(x, layout.playY);
      ctx.lineTo(x, layout.playY + layout.playH);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.strokeRect(layout.playX, layout.playY, layout.playW, layout.playH);

    const balance = readBalance();
    const lifeRatio = Math.max(0, Math.min(1, state.life / balance.maxLife));
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(ctx, layout.playX, 32, layout.playW, 14, 7, true, false);
    ctx.fillStyle = lifeRatio < 0.25 ? '#ff6f91' : '#75e6a0';
    roundRect(ctx, layout.playX, 32, layout.playW * lifeRatio, 14, 7, true, false);

    ctx.fillStyle = 'rgba(255, 207, 102, 0.18)';
    ctx.fillRect(layout.playX, layout.receptorY - 7, layout.playW, 14);
    ctx.strokeStyle = '#ffcf66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(layout.playX, layout.receptorY);
    ctx.lineTo(layout.playX + layout.playW, layout.receptorY);
    ctx.stroke();
    ctx.lineWidth = 1;

    const now = currentSongTime();
    for (const note of state.notes) {
      if (note.hit || note.missed) continue;
      const dt = note.time - now;
      if (dt < -0.25) continue;
      if (dt > layout.approach + 0.20) break;
      const y = layout.receptorY - (dt / layout.approach) * (layout.receptorY - layout.playY);
      const x = layout.playX + note.lane * laneW + 8;
      const nw = laneW - 16;
      const alpha = Math.max(0.25, 1 - Math.max(0, dt - layout.approach + 0.25));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffcf66';
      roundRect(ctx, x, y - layout.noteH / 2, nw, layout.noteH, 7, true, false);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + 8, y - 2, nw - 16, 4);
      ctx.globalAlpha = 1;
    }

    for (let i = 0; i < layout.laneCount; i++) {
      const x = layout.playX + i * laneW;
      if (state.keyFlash[i] > 0) {
        ctx.fillStyle = `rgba(255, 207, 102, ${0.28 * state.keyFlash[i]})`;
        ctx.fillRect(x, layout.playY, laneW, layout.playH);
        state.keyFlash[i] *= 0.82;
      }
      ctx.fillStyle = '#f5f7ff';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(laneLabels[i], x + laneW / 2, layout.receptorY + 48);
    }

    if (!state.running) {
      ctx.fillStyle = 'rgba(0,0,0,0.48)';
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#f5f7ff';
      ctx.textAlign = 'center';
      ctx.font = '800 30px system-ui, sans-serif';
      ctx.fillText(state.failed ? 'Failed' : 'Click Start', w/2, h/2 - 12);
      ctx.font = '500 16px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(245,247,255,0.74)';
      ctx.fillText(state.failed ? 'Restart로 다시 시작' : 'D  F  J  K', w/2, h/2 + 24);
    }

    if (state.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#f5f7ff';
      ctx.textAlign = 'center';
      ctx.font = '800 30px system-ui, sans-serif';
      ctx.fillText('Paused', w/2, h/2);
    }
    requestAnimationFrame(draw);
  }

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function rateValues() {
    return {
      Perfect: num('ratePerfect', 0),
      Great: num('rateGreat', 0),
      Good: num('rateGood', 0),
      Bad: num('rateBad', 0),
      Miss: num('rateMiss', 0),
    };
  }

  function updateRateTotal() {
    const rates = rateValues();
    const total = Object.values(rates).reduce((a,b) => a + b, 0);
    const el = $('rateTotal');
    el.textContent = `합계: ${total.toFixed(1)}%` + (Math.abs(total - 100) > 0.01 ? ' · 자동 정규화해서 계산함' : '');
    el.classList.toggle('warn', Math.abs(total - 100) > 0.01);
  }

  function weightedJudge(rates, rng) {
    const total = Math.max(0.0001, Object.values(rates).reduce((a,b) => a + Math.max(0,b), 0));
    let roll = rng() * total;
    for (const judge of JUDGES) {
      roll -= Math.max(0, rates[judge]);
      if (roll <= 0) return judge;
    }
    return 'Miss';
  }

  function makeRng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function simulateOnce(seed) {
    const balance = readBalance();
    const rates = rateValues();
    const rng = makeRng(seed);
    const notes = selectedDifficulty().notes;
    const sim = {
      score: 0, life: balance.startLife, combo: 0, maxCombo: 0, judged: 0, accWeight: 0,
      counts: { Perfect: 0, Great: 0, Good: 0, Bad: 0, Miss: 0 },
      failedAt: null,
    };
    for (let i = 0; i < notes.length; i++) {
      const judge = weightedJudge(rates, rng);
      const comboContinues = judge === 'Perfect' || judge === 'Great';
      if (comboContinues) {
        sim.combo += 1;
        sim.maxCombo = Math.max(sim.maxCombo, sim.combo);
      } else {
        sim.combo = 0;
      }
      sim.score += balance.score[judge] + (comboContinues ? comboBonusFor(sim.combo, balance) : 0);
      sim.life = Math.max(0, Math.min(balance.maxLife, sim.life + balance.life[judge]));
      sim.judged += 1;
      sim.accWeight += balance.weight[judge];
      sim.counts[judge] += 1;
      if (sim.life <= 0) {
        sim.failedAt = i + 1;
        break;
      }
    }
    sim.clear = sim.failedAt === null;
    sim.acc = sim.judged ? (sim.accWeight / sim.judged) * 100 : 100;
    return sim;
  }

  function runSimulation() {
    updateRateTotal();
    const trials = Math.max(10, Math.min(5000, Math.floor(num('simTrials', 500))));
    const results = [];
    for (let i = 0; i < trials; i++) results.push(simulateOnce(12345 + i * 97));
    const clears = results.filter(r => r.clear);
    const avg = (arr, fn) => arr.length ? arr.reduce((a, x) => a + fn(x), 0) / arr.length : 0;
    const clearRate = clears.length / results.length * 100;
    const avgScore = avg(results, r => r.score);
    const avgAcc = avg(results, r => r.acc);
    const avgMaxCombo = avg(results, r => r.maxCombo);
    const failed = results.filter(r => !r.clear);
    const avgFailAt = avg(failed, r => r.failedAt || selectedDifficulty().notes.length);
    const noteCount = selectedDifficulty().notes.length;
    const advice = clearRate >= 90 ? '관대한 편이라 초견 클리어용으로 좋아 보여.'
      : clearRate >= 65 ? '적당히 긴장감 있는 난이도야. 기본값 후보로 꽤 좋아 보여.'
      : clearRate >= 35 ? '실패가 자주 나와서 하드/챌린지 쪽에 가까워 보여.'
      : '많이 빡빡해. 라이프 감소를 줄이거나 시작 라이프를 올리는 쪽이 좋아 보여.';
    $('simResult').innerHTML = `
      <div>클리어율 <span class="big">${clearRate.toFixed(1)}%</span> · ${trials}회 기준</div>
      <div>평균 점수 <code>${Math.round(avgScore).toLocaleString()}</code> / 평균 Acc <code>${avgAcc.toFixed(2)}%</code> / 평균 Max Combo <code>${Math.round(avgMaxCombo)}</code></div>
      <div>${failed.length ? `실패 시 평균 ${avgFailAt.toFixed(1)} / ${noteCount} 노트 지점에서 탈락` : '실패 케이스 없음'}</div>
      <div class="sub small">${advice}</div>
    `;
  }

  function setRates(p, g, good, bad, miss) {
    $('ratePerfect').value = p;
    $('rateGreat').value = g;
    $('rateGood').value = good;
    $('rateBad').value = bad;
    $('rateMiss').value = miss;
    updateRateTotal();
  }

  function copyBalance() {
    const text = JSON.stringify(readBalance(), null, 2);
    navigator.clipboard?.writeText(text).then(() => {
      $('simResult').innerHTML = '<div>설정 JSON을 클립보드에 복사했어.</div><pre>' + text.replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s])) + '</pre>';
    }).catch(() => {
      $('simResult').innerHTML = '<div>클립보드 복사가 막혔어. 아래 JSON을 직접 복사하면 돼.</div><pre>' + text.replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s])) + '</pre>';
    });
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    if (ev.code === 'Space') {
      ev.preventDefault();
      if (!state.running) startGame(); else pauseGame();
      return;
    }
    const lane = keyToLane[ev.code];
    if (lane !== undefined) {
      ev.preventDefault();
      handleHit(lane);
    }
  });

  startBtn.addEventListener('click', startGame);
  pauseBtn.addEventListener('click', pauseGame);
  restartBtn.addEventListener('click', () => { resetGame(); startGame(); });
  difficultyEl.addEventListener('change', () => { resetGame(); runSimulation(); });
  offsetEl.addEventListener('input', () => { offsetLabel.textContent = offsetEl.value; });

  $('resetBalanceBtn').addEventListener('click', () => { writeBalance(DEFAULT_BALANCE); resetGame(); runSimulation(); });
  $('applyBalanceBtn').addEventListener('click', () => { resetGame(); $('simResult').innerHTML = '<div>현재 밸런스를 게임에 적용했어. Start를 누르면 새 규칙으로 시작해.</div>'; });
  $('exportBalanceBtn').addEventListener('click', copyBalance);
  $('runSimBtn').addEventListener('click', runSimulation);
  $('presetEasyBtn').addEventListener('click', () => { setRates(70, 20, 6, 1, 3); runSimulation(); });
  $('presetMidBtn').addEventListener('click', () => { setRates(55, 25, 10, 3, 7); runSimulation(); });
  $('presetHardBtn').addEventListener('click', () => { setRates(35, 25, 18, 7, 15); runSimulation(); });
  $('strictPresetBtn').addEventListener('click', () => {
    writeBalance({ maxLife: 100, startLife: 70, comboStep: 10, comboBonus: 40,
      score: { Perfect: 1000, Great: 650, Good: 300, Bad: 0, Miss: 0 },
      life: { Perfect: 1, Great: 0, Good: -2, Bad: -8, Miss: -12 },
      weight: { Perfect: 1, Great: 0.7, Good: 0.35, Bad: 0, Miss: 0 } });
    resetGame(); runSimulation();
  });
  $('softPresetBtn').addEventListener('click', () => {
    writeBalance({ maxLife: 100, startLife: 90, comboStep: 10, comboBonus: 50,
      score: { Perfect: 1000, Great: 750, Good: 500, Bad: 0, Miss: 0 },
      life: { Perfect: 2, Great: 1, Good: 0, Bad: -4, Miss: -7 },
      weight: { Perfect: 1, Great: 0.75, Good: 0.5, Bad: 0, Miss: 0 } });
    resetGame(); runSimulation();
  });
  for (const id of ['ratePerfect','rateGreat','rateGood','rateBad','rateMiss','simTrials']) {
    $(id).addEventListener('input', updateRateTotal);
  }
  document.querySelectorAll('.balance-panel input').forEach(input => input.addEventListener('change', updateHud));

  audio.addEventListener('ended', () => {
    state.running = false;
    state.lastJudge = `Finished · Max ${state.maxCombo}`;
    updateHud();
  });
  audio.addEventListener('loadedmetadata', updateInfo);

  writeBalance(DEFAULT_BALANCE);
  updateRateTotal();
  resetGame();
  runSimulation();
  draw();
})();
