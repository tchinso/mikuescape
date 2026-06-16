import * as THREE from "three";

export const GOTHIC_FLOOR = 2;

const GOTHIC_AUDIO_URL = new URL("../../assets/musics/kuroiyume.mp3", import.meta.url).href;
const GOTHIC_KEYS = ["Z", "X", "C", "V", "B", "N", "M"];
const GOTHIC_KEY_INDEX = new Map(GOTHIC_KEYS.map((key, index) => [key, index]));
const GOTHIC_CODE_TO_KEY = new Map(GOTHIC_KEYS.map((key) => [`Key${key}`, key]));
const GOTHIC_SEQUENCE_LENGTHS = [
  1,
  2,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  8,
  9,
];
const GOTHIC_STEP_SECONDS = 0.41;
const GOTHIC_BETWEEN_SECONDS = 0.34;
const GOTHIC_MISTAKE_FLASH_SECONDS = 0.45;
const TILE_Z = 0;
const BASE_WIDTH = 45;
const BASE_DEPTH = 25;
const CHARACTER_PAD_WIDTH = 26;
const CHARACTER_PAD_DEPTH = 6.2;
const CHARACTER_STAND_OFFSET = 2.1;
const PLAYER_PAD_Z = TILE_Z + BASE_DEPTH / 2 + CHARACTER_PAD_DEPTH / 2;
const GOTHIC_PAD_Z = TILE_Z - BASE_DEPTH / 2 - CHARACTER_PAD_DEPTH / 2;
const CENTER_GUIDE_DEPTH = PLAYER_PAD_Z - GOTHIC_PAD_Z - 0.8;
const TILE_X = [-18, -12, -6, 0, 6, 12, 18];

export const GOTHIC_START_POSITION = new THREE.Vector3(0, 0, PLAYER_PAD_Z + CHARACTER_STAND_OFFSET);
export const GOTHIC_RECRUIT_POSITION = new THREE.Vector3(0, 0, GOTHIC_PAD_Z - CHARACTER_STAND_OFFSET);

export function createGothicMemory({
  dom,
  createTextSprite,
  getCurrentFloor,
  getPlayer,
  getCurrentRecruit,
  isEscapeComplete,
  clearPointerTarget,
  resetTrail,
  showMessage,
  showPopup,
  updateHud,
  openExit,
  recruitCurrent,
}) {
  const audio = new Audio(GOTHIC_AUDIO_URL);
  audio.preload = "auto";

  let stage = null;
  let debugApiInstalled = false;
  const state = {
    status: "ready",
    roundIndex: 0,
    sequence: [],
    inputIndex: 0,
    showIndex: -1,
    showTimer: 0,
    betweenTimer: 0,
    mistakeTimer: 0,
    activeTile: -1,
    tileFlash: Array.from({ length: GOTHIC_KEYS.length }, () => 0),
  };

  audio.addEventListener("ended", () => {
    if (state.status !== "cleared" && state.status !== "ready" && state.status !== "failed") {
      fail("노래가 끝났습니다. 처음부터 다시 해요.");
    }
  });

  function createStage() {
    const group = new THREE.Group();
    group.name = "floor-2-gothic-memory";

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: "#111827",
      roughness: 0.7,
      metalness: 0.08,
      transparent: true,
      opacity: 0.82,
      emissive: "#1e1b4b",
      emissiveIntensity: 0.1,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(BASE_WIDTH, 0.04, BASE_DEPTH), baseMaterial);
    base.position.set(0, 0.035, TILE_Z);
    base.receiveShadow = true;
    group.add(base);

    const sideMaterial = new THREE.MeshBasicMaterial({
      color: "#38bdf8",
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const gothicPadMaterial = sideMaterial.clone();
    const playerPadMaterial = sideMaterial.clone();
    const gothicPad = new THREE.Mesh(new THREE.BoxGeometry(CHARACTER_PAD_WIDTH, 0.055, CHARACTER_PAD_DEPTH), gothicPadMaterial);
    gothicPad.position.set(0, 0.08, GOTHIC_PAD_Z);
    group.add(gothicPad);

    const playerPad = new THREE.Mesh(new THREE.BoxGeometry(CHARACTER_PAD_WIDTH, 0.055, CHARACTER_PAD_DEPTH), playerPadMaterial);
    playerPad.position.set(0, 0.08, PLAYER_PAD_Z);
    group.add(playerPad);

    const guideMaterial = new THREE.MeshBasicMaterial({
      color: "#7dd3fc",
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    const centerGuide = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.075, CENTER_GUIDE_DEPTH), guideMaterial);
    centerGuide.position.set(0, 0.09, 0);
    group.add(centerGuide);

    const tileGeometry = new THREE.BoxGeometry(5.15, 0.16, 8.1);
    const shapeGeometry = new THREE.CircleGeometry(1.55, 4);
    const tileColors = ["#38bdf8", "#facc15", "#f472b6", "#a78bfa", "#34d399", "#fb7185", "#60a5fa"];
    const tiles = GOTHIC_KEYS.map((key, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: "#182033",
        roughness: 0.56,
        metalness: 0.12,
        emissive: tileColors[index],
        emissiveIntensity: 0.06,
      });
      const mesh = new THREE.Mesh(tileGeometry, material);
      mesh.position.set(TILE_X[index], 0.16, TILE_Z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const shapeMaterial = new THREE.MeshBasicMaterial({
        color: tileColors[index],
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const shape = new THREE.Mesh(shapeGeometry, shapeMaterial);
      shape.rotation.x = -Math.PI / 2;
      shape.rotation.z = Math.PI / 4;
      shape.position.set(TILE_X[index], 0.265, TILE_Z);
      shape.visible = false;
      group.add(shape);

      const label = createTextSprite(key, tileColors[index], 0.94);
      label.position.set(TILE_X[index], 1.08, TILE_Z + 0.15);
      label.scale.set(1.45, 0.44, 1);
      group.add(label);

      return {
        key,
        mesh,
        material,
        shape,
        shapeMaterial,
        label,
        color: tileColors[index],
      };
    });

    const playerLabel = createTextSprite("MIKU", "#38bdf8", 0.88);
    playerLabel.position.set(0, 1.05, PLAYER_PAD_Z);
    playerLabel.scale.set(2.0, 0.48, 1);
    group.add(playerLabel);

    const gothicLabel = createTextSprite("GOTHIC", "#a78bfa", 0.88);
    gothicLabel.position.set(0, 1.05, GOTHIC_PAD_Z);
    gothicLabel.scale.set(2.25, 0.48, 1);
    group.add(gothicLabel);

    const startLabel = createTextSprite("Z START", "#38bdf8", 0.9);
    startLabel.position.set(0, 1.42, PLAYER_PAD_Z + 3.9);
    startLabel.scale.set(2.3, 0.5, 1);
    group.add(startLabel);

    group.visible = false;
    stage = {
      group,
      tiles,
      gothicPad,
      playerPad,
      gothicPadMaterial,
      playerPadMaterial,
      centerGuide,
      startLabel,
    };
    installDebugApi();
    return stage;
  }

  function showIntroPopup() {
    showPopup(
      "2층 기억 대결",
      "Gothic이 보여주는 순서를 기억해 주세요. 미쿠 쪽 바닥이 빛나면 같은 순서로 눌러요.",
      "확인",
    );
  }

  function goalText() {
    if (state.status === "cleared") {
      return "문으로 이동";
    }
    if (state.status === "presenting") {
      return "Gothic 차례";
    }
    if (state.status === "input") {
      return "미쿠 차례";
    }
    if (state.status === "between" || state.status === "starting") {
      return "다음 문제";
    }
    if (state.status === "retrying") {
      return "다시 도전";
    }
    if (state.status === "failed") {
      return "처음부터 재도전";
    }
    return "Z로 시작";
  }

  function updateVisibility() {
    if (!stage) {
      return;
    }

    const visible = getCurrentFloor() === GOTHIC_FLOOR
      && !isEscapeComplete()
      && state.status !== "cleared";
    stage.group.visible = visible;
    dom.gothicHud.classList.toggle("hidden", !visible);
  }

  function reset(options = {}) {
    audio.pause();
    resetAudioTime();

    state.status = "ready";
    state.roundIndex = 0;
    state.sequence = [];
    state.inputIndex = 0;
    state.showIndex = -1;
    state.showTimer = 0;
    state.betweenTimer = 0;
    state.mistakeTimer = 0;
    state.activeTile = -1;
    state.tileFlash.fill(0);

    if (options.placePlayer) {
      placePlayerAtStart();
    }

    arrangeActors();
    updateVisibility();
    updateGothicHud();
    updateHud();
  }

  function isPlaying() {
    return getCurrentFloor() === GOTHIC_FLOOR
      && (state.status === "starting"
        || state.status === "presenting"
        || state.status === "input"
        || state.status === "between");
  }

  function locksPlayerMovement() {
    return getCurrentFloor() === GOTHIC_FLOOR
      && !isEscapeComplete()
      && state.status !== "cleared";
  }

  function isCleared() {
    return state.status === "cleared";
  }

  function handleKeyDown(event) {
    if (getCurrentFloor() !== GOTHIC_FLOOR || state.status === "cleared") {
      return false;
    }

    const key = getGothicKeyFromEvent(event);
    if (!key) {
      return false;
    }

    event.preventDefault();
    if (event.repeat) {
      return true;
    }

    if (state.status === "ready" || state.status === "failed") {
      if (key === "Z") {
        start();
      } else {
        showMessage("미쿠 쪽에서 Z로 시작합니다.", 1300);
      }
      return true;
    }

    if (state.status === "input") {
      handleInput(key);
      return true;
    }

    return true;
  }

  async function start() {
    if (state.status !== "ready" && state.status !== "failed") {
      return;
    }

    placePlayerAtStart();
    arrangeActors();
    state.status = "starting";
    state.roundIndex = 0;
    state.sequence = [];
    state.inputIndex = 0;
    state.tileFlash.fill(0);
    updateGothicHud();
    updateHud();

    resetAudioTime();
    try {
      await audio.play();
      beginRound();
      showMessage("기억 대결 시작", 900);
    } catch (error) {
      console.warn("Kuroiyume playback was blocked.", error);
      state.status = "ready";
      updateGothicHud();
      updateHud();
      showPopup("오디오 재생 확인", "브라우저가 음악 재생을 막았습니다. 화면을 클릭한 뒤 Z를 다시 눌러 주세요.", "확인");
    }
  }

  function beginRound() {
    if (state.roundIndex >= GOTHIC_SEQUENCE_LENGTHS.length) {
      complete();
      return;
    }

    state.status = "presenting";
    state.sequence = makeSequence(GOTHIC_SEQUENCE_LENGTHS[state.roundIndex]);
    state.inputIndex = 0;
    state.showIndex = 0;
    state.showTimer = GOTHIC_STEP_SECONDS;
    activatePresentationTile();
    updateGothicHud();
    updateHud();
  }

  function makeSequence(length) {
    const sequence = [];
    let previousKey = "";
    for (let index = 0; index < length; index += 1) {
      let nextKey = GOTHIC_KEYS[Math.floor(Math.random() * GOTHIC_KEYS.length)];
      if (GOTHIC_KEYS.length > 1) {
        while (nextKey === previousKey) {
          nextKey = GOTHIC_KEYS[Math.floor(Math.random() * GOTHIC_KEYS.length)];
        }
      }
      sequence.push(nextKey);
      previousKey = nextKey;
    }
    return sequence;
  }

  function activatePresentationTile() {
    const key = state.sequence[state.showIndex];
    const tileIndex = GOTHIC_KEY_INDEX.get(key) ?? -1;
    state.activeTile = tileIndex;
    if (tileIndex >= 0) {
      state.tileFlash[tileIndex] = 1;
    }
  }

  function handleInput(key) {
    const tileIndex = GOTHIC_KEY_INDEX.get(key) ?? -1;
    if (tileIndex >= 0) {
      state.tileFlash[tileIndex] = 1;
    }

    const expected = state.sequence[state.inputIndex];
    if (key !== expected) {
      retryPreviousRound();
      return;
    }

    state.inputIndex += 1;
    if (state.inputIndex < state.sequence.length) {
      updateGothicHud();
      return;
    }

    state.roundIndex += 1;
    state.activeTile = -1;

    if (state.roundIndex >= GOTHIC_SEQUENCE_LENGTHS.length) {
      complete();
      return;
    }

    state.status = "between";
    state.betweenTimer = GOTHIC_BETWEEN_SECONDS;
    updateGothicHud();
    updateHud();
  }

  function update(dt, elapsed) {
    updateVisibility();
    if (getCurrentFloor() !== GOTHIC_FLOOR || isEscapeComplete()) {
      return;
    }

    arrangeActors();
    updateStageMaterials(dt, elapsed);

    if (state.status === "presenting") {
      state.showTimer -= dt;
      if (state.showTimer <= 0) {
        state.showIndex += 1;
        if (state.showIndex >= state.sequence.length) {
          state.status = "input";
          state.activeTile = -1;
          updateGothicHud();
          updateHud();
        } else {
          state.showTimer += GOTHIC_STEP_SECONDS;
          activatePresentationTile();
          updateGothicHud();
        }
      }
    } else if (state.status === "between") {
      state.betweenTimer -= dt;
      if (state.betweenTimer <= 0) {
        beginRound();
      }
    } else if (state.status === "retrying") {
      state.mistakeTimer -= dt;
      if (state.mistakeTimer <= 0) {
        beginRound();
      }
    }

    updateGothicHud();
  }

  function updateStageMaterials(dt, elapsed) {
    if (!stage) {
      return;
    }

    const gothicActive = state.status === "presenting";
    const playerActive = state.status === "input";
    const readyPulse = state.status === "ready" || state.status === "failed";
    const mistakeFlash = state.status === "retrying"
      ? THREE.MathUtils.clamp(state.mistakeTimer / GOTHIC_MISTAKE_FLASH_SECONDS, 0, 1)
      : 0;

    stage.gothicPadMaterial.color.set(mistakeFlash > 0 ? "#fca5a5" : "#38bdf8");
    stage.playerPadMaterial.color.set(mistakeFlash > 0 ? "#fca5a5" : "#38bdf8");
    stage.gothicPadMaterial.opacity = mistakeFlash > 0
      ? 0.34 + mistakeFlash * 0.26
      : gothicActive
        ? 0.5 + Math.sin(elapsed * 9) * 0.08
        : 0.08;
    stage.playerPadMaterial.opacity = mistakeFlash > 0
      ? 0.34 + mistakeFlash * 0.26
      : playerActive
        ? 0.5 + Math.sin(elapsed * 9) * 0.08
        : readyPulse
          ? 0.18 + Math.sin(elapsed * 4.4) * 0.04
          : 0.08;
    stage.startLabel.visible = readyPulse;

    stage.tiles.forEach((tile, index) => {
      const flash = state.tileFlash[index];
      const isActive = state.activeTile === index;
      tile.material.emissiveIntensity = 0.06 + flash * 0.48 + (isActive ? 0.36 : 0);
      tile.mesh.position.y = 0.16 + Math.max(flash, isActive ? 1 : 0) * 0.08;
      tile.shape.visible = isActive || flash > 0.05;
      tile.shapeMaterial.opacity = isActive ? 0.86 : flash * 0.62;
      tile.shape.scale.setScalar(1 + Math.max(flash, isActive ? 1 : 0) * 0.18);
      state.tileFlash[index] = Math.max(0, flash - dt * 4.4);
    });
  }

  function arrangeActors() {
    const player = getPlayer();
    if (player && locksPlayerMovement()) {
      if (player.group.position.distanceTo(GOTHIC_START_POSITION) > 0.05) {
        placePlayerAtStart();
      } else {
        player.group.rotation.y = Math.PI;
        player.previousPosition.copy(player.group.position);
      }
    }

    const recruit = getCurrentRecruit();
    if (!recruit || getCurrentFloor() !== GOTHIC_FLOOR || state.status === "cleared") {
      return;
    }

    recruit.group.position.copy(GOTHIC_RECRUIT_POSITION);
    recruit.group.rotation.y = 0;
    recruit.previousPosition.copy(recruit.group.position);
  }

  function placePlayerAtStart() {
    const player = getPlayer();
    if (!player) {
      return;
    }

    player.group.position.copy(GOTHIC_START_POSITION);
    player.group.rotation.y = Math.PI;
    player.previousPosition.copy(player.group.position);
    clearPointerTarget();
    resetTrail();
  }

  function fail(message) {
    if (state.status === "failed" || state.status === "cleared") {
      return;
    }

    state.status = "failed";
    state.activeTile = -1;
    state.tileFlash.fill(0);
    audio.pause();
    resetAudioTime();
    updateGothicHud();
    updateHud();
    showPopup(
      "2층 실패",
      message,
      "처음부터",
      () => {
        reset({ placePlayer: true });
        showMessage("Z로 다시 시작", 1200);
      },
    );
  }

  function retryPreviousRound() {
    if (state.status !== "input") {
      return;
    }

    state.roundIndex = Math.max(0, state.roundIndex - 1);
    state.status = "retrying";
    state.sequence = [];
    state.inputIndex = 0;
    state.showIndex = -1;
    state.showTimer = 0;
    state.betweenTimer = 0;
    state.mistakeTimer = GOTHIC_MISTAKE_FLASH_SECONDS;
    state.activeTile = -1;
    state.tileFlash.fill(0);
    updateGothicHud();
    updateHud();
  }

  function complete() {
    if (state.status === "cleared") {
      return;
    }

    state.status = "cleared";
    state.activeTile = -1;
    state.tileFlash.fill(0);
    audio.pause();
    updateGothicHud();
    updateVisibility();
    updateHud();

    const recruitName = getCurrentRecruit()?.def.name ?? "Gothic";
    if (getCurrentRecruit()) {
      recruitCurrent();
    } else {
      openExit();
    }

    showPopup(
      "2층 성공",
      `${recruitName}이 동료가 되었습니다. 이제 문으로 나갈 수 있어요.`,
      "확인",
    );
  }

  function updateGothicHud() {
    const totalRounds = GOTHIC_SEQUENCE_LENGTHS.length;
    const currentRound = Math.min(state.roundIndex + 1, totalRounds);
    const currentLength = state.sequence.length || GOTHIC_SEQUENCE_LENGTHS[Math.min(state.roundIndex, totalRounds - 1)];
    const timeRatio = getSongTimeRatio();

    dom.gothicSong.textContent = "Kuroiyume · 기억 대결";
    dom.gothicStatus.textContent = goalText();
    dom.gothicProgressFill.style.width = `${timeRatio * 100}%`;
    dom.gothicProgressFill.style.background = getSongGaugeBackground(timeRatio);
    dom.gothicRound.textContent = `${currentRound} / ${totalRounds}`;
    dom.gothicLength.textContent = `${currentLength}`;
    dom.gothicInput.textContent = state.status === "input"
      ? `${state.inputIndex} / ${state.sequence.length}`
      : state.status === "presenting"
        ? `${Math.min(state.showIndex + 1, state.sequence.length)} / ${state.sequence.length}`
        : "-";
    dom.gothicKeys.textContent = GOTHIC_KEYS.join(" ");
    updateDebugDataset();
  }

  function updateDebugDataset() {
    if (!isDeveloperCookieEnabled()) {
      return;
    }

    dom.gothicHud.dataset.status = state.status;
    dom.gothicHud.dataset.roundIndex = `${state.roundIndex}`;
    dom.gothicHud.dataset.sequence = state.sequence.join("");
    dom.gothicHud.dataset.inputIndex = `${state.inputIndex}`;
  }

  function getSongTimeRatio() {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      return 1;
    }

    const remaining = Math.max(0, audio.duration - audio.currentTime);
    return THREE.MathUtils.clamp(remaining / audio.duration, 0, 1);
  }

  function getSongGaugeBackground(ratio) {
    if (ratio > 0.62) {
      return "linear-gradient(90deg, #22c55e, #84cc16)";
    }
    if (ratio > 0.38) {
      return "linear-gradient(90deg, #facc15, #fde047)";
    }
    if (ratio > 0.18) {
      return "linear-gradient(90deg, #fb923c, #facc15)";
    }
    return "linear-gradient(90deg, #ef4444, #fb7185)";
  }

  function resetAudioTime() {
    try {
      audio.currentTime = 0;
    } catch {
      // Metadata may not be available yet.
    }
  }

  function getGothicKeyFromEvent(event) {
    const codeKey = GOTHIC_CODE_TO_KEY.get(event.code);
    if (codeKey) {
      return codeKey;
    }

    const key = event.key.toUpperCase();
    return GOTHIC_KEY_INDEX.has(key) ? key : "";
  }

  function installDebugApi() {
    if (debugApiInstalled || typeof window === "undefined" || !isDeveloperCookieEnabled()) {
      return;
    }

    window.__ruruworldGothicMemory = {
      getState: () => ({
        status: state.status,
        roundIndex: state.roundIndex,
        sequence: [...state.sequence],
        inputIndex: state.inputIndex,
        showIndex: state.showIndex,
        totalRounds: GOTHIC_SEQUENCE_LENGTHS.length,
      }),
    };
    debugApiInstalled = true;
  }

  return {
    createStage,
    update,
    updateVisibility,
    reset,
    isPlaying,
    isCleared,
    locksPlayerMovement,
    handleKeyDown,
    showIntroPopup,
    goalText,
    arrangeActors,
  };
}

function isDeveloperCookieEnabled() {
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .some((cookie) => cookie === "developer=true");
}
