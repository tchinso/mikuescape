(() => {
  const chart = window.CHART;
  chart.difficulties = chart.difficulties || {};
  if (!chart.difficulties.manual) {
    chart.difficulties.manual = { name: 'Manual Edit', level: 'Edit', notes: [] };
  }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const audio = document.getElementById('audio');

  const difficultyEl = document.getElementById('difficulty');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const offsetEl = document.getElementById('offset');
  const offsetLabel = document.getElementById('offsetLabel');

  const recordStartBtn = document.getElementById('recordStartBtn');
  const recordHereBtn = document.getElementById('recordHereBtn');
  const stopRecordBtn = document.getElementById('stopRecordBtn');
  const playManualBtn = document.getElementById('playManualBtn');
  const undoNoteBtn = document.getElementById('undoNoteBtn');
  const clearManualBtn = document.getElementById('clearManualBtn');
  const snapSelect = document.getElementById('snapSelect');
  const recordOffsetEl = document.getElementById('recordOffset');
  const recordOffsetLabel = document.getElementById('recordOffsetLabel');
  const copyChartBtn = document.getElementById('copyChartBtn');
  const downloadJsonBtn = document.getElementById('downloadJsonBtn');
  const downloadJsBtn = document.getElementById('downloadJsBtn');
  const manualCountEl = document.getElementById('manualCount');
  const editorStatusEl = document.getElementById('editorStatus');
  const chartTextEl = document.getElementById('chartText');

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
    recording: false,
    paused: false,
    score: 0,
    combo: 0,
    maxCombo: 0,
    judged: 0,
    accWeight: 0,
    lastJudge: 'Ready',
    keyFlash: [0,0,0,0],
    editorHistory: [],
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
    return chart.difficulties[difficultyEl.value] || chart.difficulties.hard || chart.difficulties.manual;
  }

  function manualDifficulty() {
    return chart.difficulties.manual;
  }

  function sanitizeNote(note) {
    return {
      time: roundTime(Number(note.time)),
      lane: Math.max(0, Math.min(3, Number(note.lane))),
      type: note.type || 'tap',
    };
  }

  function roundTime(value) {
    return Number(Math.max(0, value).toFixed(3));
  }

  function sortNotes(notes) {
    notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  }

  function cloneNotes() {
    const diff = selectedDifficulty();
    return (diff.notes || []).map((note, index) => ({
      index,
      time: Number(note.time),
      lane: Number(note.lane),
      type: note.type || 'tap',
      hit: false,
      missed: false,
    }));
  }

  function rebuildStateNotes() {
    state.notes = cloneNotes();
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
    noteCountEl.textContent = (diff.notes || []).length;
    levelEl.textContent = diff.level ?? '-';
    manualCountEl.textContent = (manualDifficulty().notes || []).length;
  }

  function resetScoreOnly() {
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.judged = 0;
    state.accWeight = 0;
    state.lastJudge = 'Ready';
    state.keyFlash = [0,0,0,0];
  }

  function resetGame() {
    audio.pause();
    audio.currentTime = 0;
    state.running = false;
    state.recording = false;
    state.paused = false;
    resetScoreOnly();
    rebuildStateNotes();
    updateHud();
    updateInfo();
    updateExportText();
  }

  async function startGame() {
    stopRecordSilent();
    rebuildStateNotes();
    resetScoreOnly();
    state.running = true;
    state.paused = false;
    state.lastJudge = 'Go';
    try {
      await audio.play();
    } catch (err) {
      state.running = false;
      state.lastJudge = 'Click Start again';
    }
    updateHud();
  }

  function pauseGame() {
    if (!state.running && !state.recording) return;
    if (audio.paused) {
      audio.play();
      state.paused = false;
      state.lastJudge = state.recording ? 'REC' : 'Resume';
      setEditorStatus(state.recording ? 'Recording resumed' : 'Ready');
    } else {
      audio.pause();
      state.paused = true;
      state.lastJudge = 'Pause';
      setEditorStatus(state.recording ? 'Recording paused' : 'Paused');
    }
    updateHud();
  }

  function currentSongTime() {
    return audio.currentTime + Number(offsetEl.value) / 1000;
  }

  function recordSongTime() {
    const raw = audio.currentTime + Number(recordOffsetEl.value) / 1000;
    return applySnap(raw);
  }

  function applySnap(time) {
    const snap = snapSelect.value;
    if (snap === 'none') return roundTime(time);
    const bpm = Number(chart.bpm) || 120;
    const beat = 60 / bpm;
    const division = Number(snap);
    const step = beat * 4 / division;
    const anchor = Number(chart.offset) || 0;
    const snapped = anchor + Math.round((time - anchor) / step) * step;
    return roundTime(snapped);
  }

  function judgeName(deltaAbs) {
    if (deltaAbs <= 0.045) return 'Perfect';
    if (deltaAbs <= 0.090) return 'Great';
    if (deltaAbs <= 0.135) return 'Good';
    return null;
  }

  function handleHit(lane) {
    if (state.recording) {
      recordNote(lane);
      return;
    }
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

  function recordNote(lane) {
    if (state.paused) return;
    const notes = manualDifficulty().notes;
    const time = recordSongTime();
    const dupe = notes.some(note => note.lane === lane && Math.abs(Number(note.time) - time) < 0.030);
    state.keyFlash[lane] = 1;
    if (dupe) {
      state.lastJudge = `Dup ${laneLabels[lane]}`;
      setEditorStatus(`Duplicate skipped · ${laneLabels[lane]} @ ${time.toFixed(3)}s`);
      updateHud();
      return;
    }

    const note = { time, lane, type: 'tap' };
    notes.push(note);
    sortNotes(notes);
    state.editorHistory.push({ time, lane });
    rebuildStateNotes();
    state.lastJudge = `REC ${laneLabels[lane]}`;
    setEditorStatus(`Added ${laneLabels[lane]} @ ${time.toFixed(3)}s`);
    updateHud();
    updateInfo();
    updateExportText();
  }

  function markMisses() {
    if (!state.running || state.paused || state.recording) return;
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
    scoreEl.textContent = state.recording ? 'REC' : Math.floor(state.score).toLocaleString();
    comboEl.textContent = state.recording ? (manualDifficulty().notes || []).length : state.combo;
    const acc = state.judged ? (state.accWeight / state.judged) * 100 : 100;
    accuracyEl.textContent = state.recording ? formatTime(audio.currentTime || 0) : `${acc.toFixed(2)}%`;
    judgeEl.textContent = state.lastJudge;
  }

  function draw() {
    markMisses();
    const w = canvas.width;
    const h = canvas.height;
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

    ctx.fillStyle = state.recording ? 'rgba(255, 111, 145, 0.18)' : 'rgba(255, 207, 102, 0.18)';
    ctx.fillRect(layout.playX, layout.receptorY - 7, layout.playW, 14);
    ctx.strokeStyle = state.recording ? '#ff6f91' : '#ffcf66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(layout.playX, layout.receptorY);
    ctx.lineTo(layout.playX + layout.playW, layout.receptorY);
    ctx.stroke();
    ctx.lineWidth = 1;

    const now = state.recording ? audio.currentTime : currentSongTime();
    drawNotes(now, laneW);
    drawLaneLabels(laneW);
    drawOverlay(w, h);

    requestAnimationFrame(draw);
  }

  function drawNotes(now, laneW) {
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
      ctx.fillStyle = state.recording ? '#ff6f91' : '#ffcf66';
      roundRect(ctx, x, y - layout.noteH / 2, nw, layout.noteH, 7, true, false);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + 8, y - 2, nw - 16, 4);
      ctx.globalAlpha = 1;
    }
  }

  function drawLaneLabels(laneW) {
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
  }

  function drawOverlay(w, h) {
    if (!state.running && !state.recording) {
      ctx.fillStyle = 'rgba(0,0,0,0.48)';
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#f5f7ff';
      ctx.textAlign = 'center';
      ctx.font = '800 30px system-ui, sans-serif';
      ctx.fillText('Click Start or Record', w/2, h/2 - 12);
      ctx.font = '500 16px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(245,247,255,0.74)';
      ctx.fillText('D  F  J  K', w/2, h/2 + 24);
    }

    if (state.recording) {
      ctx.fillStyle = 'rgba(255,111,145,0.90)';
      ctx.textAlign = 'left';
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.fillText('● RECORDING', layout.playX, layout.playY - 20);
    }

    if (state.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#f5f7ff';
      ctx.textAlign = 'center';
      ctx.font = '800 30px system-ui, sans-serif';
      ctx.fillText('Paused', w/2, h/2);
    }
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

  async function startRecording(fromStart) {
    audio.pause();
    state.running = false;
    state.recording = true;
    state.paused = false;
    difficultyEl.value = 'manual';
    rebuildStateNotes();
    if (fromStart) audio.currentTime = 0;
    state.lastJudge = 'REC';
    setEditorStatus(fromStart ? 'Recording from start' : `Recording from ${formatTime(audio.currentTime)}`);
    updateInfo();
    updateHud();
    try {
      await audio.play();
    } catch (err) {
      state.recording = false;
      state.lastJudge = 'Click Record again';
      setEditorStatus('Audio play was blocked by browser');
      updateHud();
    }
  }

  function stopRecordSilent() {
    if (!state.recording) return;
    state.recording = false;
    state.paused = false;
  }

  function stopRecording() {
    if (!state.recording) return;
    audio.pause();
    state.recording = false;
    state.paused = false;
    state.lastJudge = 'Record Stop';
    setEditorStatus('Recording stopped');
    updateHud();
    updateInfo();
    updateExportText();
  }

  function undoManualNote() {
    const notes = manualDifficulty().notes;
    if (!notes.length) return;
    const last = state.editorHistory.pop();
    let index = -1;
    if (last) {
      index = notes.findLastIndex(note => note.lane === last.lane && Math.abs(Number(note.time) - last.time) < 0.001);
    }
    if (index < 0) index = notes.length - 1;
    const [removed] = notes.splice(index, 1);
    sortNotes(notes);
    rebuildStateNotes();
    state.lastJudge = 'Undo';
    setEditorStatus(`Removed ${laneLabels[removed.lane]} @ ${Number(removed.time).toFixed(3)}s`);
    updateHud();
    updateInfo();
    updateExportText();
  }

  function clearManualNotes() {
    if (!manualDifficulty().notes.length) return;
    const ok = window.confirm('Manual Edit 채보를 전부 지울까?');
    if (!ok) return;
    manualDifficulty().notes = [];
    state.editorHistory = [];
    rebuildStateNotes();
    state.lastJudge = 'Clear';
    setEditorStatus('Manual chart cleared');
    updateHud();
    updateInfo();
    updateExportText();
  }

  function buildExportChart() {
    const exported = JSON.parse(JSON.stringify(chart));
    for (const diff of Object.values(exported.difficulties || {})) {
      diff.notes = (diff.notes || []).map(sanitizeNote);
      sortNotes(diff.notes);
    }
    exported.generator = exported.generator || {};
    exported.generator.manual_editor = {
      note: 'Manual Edit notes were recorded in the browser by pressing D/F/J/K.',
      updated_at_local: new Date().toISOString(),
    };
    return exported;
  }

  function updateExportText() {
    const exported = buildExportChart();
    chartTextEl.value = JSON.stringify(exported, null, 2);
    manualCountEl.textContent = (manualDifficulty().notes || []).length;
  }

  async function copyChartJson() {
    updateExportText();
    try {
      await navigator.clipboard.writeText(chartTextEl.value);
      setEditorStatus('chart.json copied');
    } catch (err) {
      chartTextEl.focus();
      chartTextEl.select();
      setEditorStatus('Select text and copy manually');
    }
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadChartJson() {
    updateExportText();
    downloadText('chart.json', chartTextEl.value + '\n');
    setEditorStatus('chart.json download started');
  }

  function downloadChartJs() {
    const exported = buildExportChart();
    const text = 'window.CHART = ' + JSON.stringify(exported) + ';\n';
    downloadText('chart.js', text);
    setEditorStatus('chart.js download started');
  }

  function setEditorStatus(message) {
    editorStatusEl.textContent = message;
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    if (ev.code === 'Space') {
      ev.preventDefault();
      if (!state.running && !state.recording) startGame();
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
  difficultyEl.addEventListener('change', () => {
    if (!state.recording && !state.running) resetGame();
    else rebuildStateNotes();
    updateInfo();
    updateExportText();
  });
  offsetEl.addEventListener('input', () => {
    offsetLabel.textContent = offsetEl.value;
  });

  recordStartBtn.addEventListener('click', () => startRecording(true));
  recordHereBtn.addEventListener('click', () => startRecording(false));
  stopRecordBtn.addEventListener('click', stopRecording);
  playManualBtn.addEventListener('click', () => {
    stopRecording();
    difficultyEl.value = 'manual';
    resetGame();
    startGame();
  });
  undoNoteBtn.addEventListener('click', undoManualNote);
  clearManualBtn.addEventListener('click', clearManualNotes);
  recordOffsetEl.addEventListener('input', () => {
    recordOffsetLabel.textContent = recordOffsetEl.value;
  });
  snapSelect.addEventListener('change', () => {
    setEditorStatus(`Snap: ${snapSelect.options[snapSelect.selectedIndex].textContent}`);
  });
  copyChartBtn.addEventListener('click', copyChartJson);
  downloadJsonBtn.addEventListener('click', downloadChartJson);
  downloadJsBtn.addEventListener('click', downloadChartJs);

  audio.addEventListener('ended', () => {
    if (state.recording) {
      state.recording = false;
      state.paused = false;
      state.lastJudge = 'Record End';
      setEditorStatus('Recording ended');
    } else {
      state.running = false;
      state.lastJudge = `Finished · Max ${state.maxCombo}`;
    }
    updateHud();
    updateInfo();
    updateExportText();
  });
  audio.addEventListener('loadedmetadata', updateInfo);
  audio.addEventListener('timeupdate', () => {
    if (state.recording) updateHud();
  });

  resetGame();
  draw();
})();
