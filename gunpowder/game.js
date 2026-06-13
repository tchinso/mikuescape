(() => {
  const chart = window.CHART;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const audio = document.getElementById('audio');

  const difficultyEl = document.getElementById('difficulty');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const offsetEl = document.getElementById('offset');
  const offsetLabel = document.getElementById('offsetLabel');

  const scoreEl = document.getElementById('score');
  const comboEl = document.getElementById('combo');
  const accuracyEl = document.getElementById('accuracy');
  const judgeEl = document.getElementById('judge');
  const songTitleEl = document.getElementById('songTitle');
  const bpmEl = document.getElementById('bpm');
  const durationEl = document.getElementById('duration');
  const noteCountEl = document.getElementById('noteCount');
  const levelEl = document.getElementById('level');

  const keyToLane = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
  const laneLabels = ['D', 'F', 'J', 'K'];
  const judgeScore = { Perfect: 1000, Great: 700, Good: 400, Miss: 0 };
  const judgeWeight = { Perfect: 1, Great: 0.7, Good: 0.4, Miss: 0 };

  const state = {
    notes: [],
    running: false,
    paused: false,
    score: 0,
    combo: 0,
    maxCombo: 0,
    judged: 0,
    accWeight: 0,
    lastJudge: 'Ready',
    keyFlash: [0,0,0,0],
    startWallClock: 0,
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
    state.notes = cloneNotes();
    state.running = false;
    state.paused = false;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.judged = 0;
    state.accWeight = 0;
    state.lastJudge = 'Ready';
    state.keyFlash = [0,0,0,0];
    updateHud();
    updateInfo();
  }

  async function startGame() {
    if (!state.notes.length) resetGame();
    state.running = true;
    state.paused = false;
    state.lastJudge = 'Go';
    try {
      await audio.play();
    } catch (err) {
      state.lastJudge = 'Click Start again';
    }
    updateHud();
  }

  function pauseGame() {
    if (!state.running) return;
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

  function handleHit(lane) {
    if (!state.running || state.paused) return;
    const now = currentSongTime();
    let best = null;
    let bestDelta = Infinity;
    for (const note of state.notes) {
      if (note.hit || note.missed || note.lane !== lane) continue;
      const delta = Math.abs(note.time - now);
      if (delta < bestDelta) {
        best = note;
        bestDelta = delta;
      }
      if (note.time - now > layout.missWindow) break;
    }
    const judge = best ? judgeName(bestDelta) : null;
    if (!best || !judge) {
      state.lastJudge = 'Bad';
      state.combo = 0;
      state.keyFlash[lane] = 1;
      updateHud();
      return;
    }
    best.hit = true;
    state.judged += 1;
    state.accWeight += judgeWeight[judge];
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.score += judgeScore[judge] + state.combo * 2;
    state.lastJudge = `${judge} ${Math.round((now - best.time)*1000)}ms`;
    state.keyFlash[lane] = 1;
    updateHud();
  }

  function markMisses() {
    if (!state.running || state.paused) return;
    const now = currentSongTime();
    for (const note of state.notes) {
      if (note.hit || note.missed) continue;
      if (now - note.time > layout.missWindow) {
        note.missed = true;
        state.judged += 1;
        state.combo = 0;
        state.lastJudge = 'Miss';
      } else if (note.time - now > layout.approach + 0.25) {
        break;
      }
    }
  }

  function updateHud() {
    scoreEl.textContent = Math.floor(state.score).toLocaleString();
    comboEl.textContent = state.combo;
    const acc = state.judged ? (state.accWeight / state.judged) * 100 : 100;
    accuracyEl.textContent = `${acc.toFixed(2)}%`;
    judgeEl.textContent = state.lastJudge;
  }

  function draw() {
    markMisses();
    const w = canvas.width;
    const h = canvas.height;
    const laneW = layout.playW / layout.laneCount;
    ctx.clearRect(0, 0, w, h);

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#171b2c');
    bg.addColorStop(1, '#0b0e16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // playfield
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

    // receptor
    ctx.fillStyle = 'rgba(255, 207, 102, 0.18)';
    ctx.fillRect(layout.playX, layout.receptorY - 7, layout.playW, 14);
    ctx.strokeStyle = '#ffcf66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(layout.playX, layout.receptorY);
    ctx.lineTo(layout.playX + layout.playW, layout.receptorY);
    ctx.stroke();
    ctx.lineWidth = 1;

    // notes
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

    // lane labels and flashes
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
      ctx.fillText('Click Start', w/2, h/2 - 12);
      ctx.font = '500 16px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(245,247,255,0.74)';
      ctx.fillText('D  F  J  K', w/2, h/2 + 24);
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

  document.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    if (ev.code === 'Space') {
      ev.preventDefault();
      if (!state.running) startGame();
      else pauseGame();
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
  difficultyEl.addEventListener('change', resetGame);
  offsetEl.addEventListener('input', () => {
    offsetLabel.textContent = offsetEl.value;
  });

  audio.addEventListener('ended', () => {
    state.running = false;
    state.lastJudge = `Finished · Max ${state.maxCombo}`;
    updateHud();
  });
  audio.addEventListener('loadedmetadata', updateInfo);

  resetGame();
  draw();
})();
