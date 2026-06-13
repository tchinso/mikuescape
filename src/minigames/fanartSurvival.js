import * as THREE from "three";

export const FANART_FLOOR = 12;
export const FANART_START_POSITION = new THREE.Vector3(0, 0, 0);
export const FANART_SPEED_MULTIPLIER = 5;

const FANART_AUDIO_URL = new URL("../../assets/musics/fanarts.mp3", import.meta.url).href;
const FANART_START_RADIUS = 5.2;
const FANART_MAX_HEALTH = 100;
const FANART_HEALTH_DRAIN_PER_SECOND = FANART_MAX_HEALTH / 6;
const FANART_HEAL_AMOUNT = 20;
const FANART_PICKUP_RADIUS = 2.95;
const FANART_INITIAL_MEDICINE_COUNT = 10;
const FANART_ACTIVE_MEDICINE_LIMIT = 21;
const FANART_SPAWN_INTERVAL = 0.7;
const FANART_MEDICINE_MIN_SPACING = 8.5;
const FANART_MEDICINE_PLAYER_SAFE_RADIUS = 7.5;
const FANART_VISIBLE_SPAWN_ATTEMPTS = 22;
const FANART_ANYWHERE_SPAWN_ATTEMPTS = 18;
const FANART_MEDICINE_SPAWNS = [
  [-33, -34],
  [-17, -36],
  [0, -34],
  [18, -35],
  [34, -31],
  [-36, -18],
  [-20, -20],
  [12, -22],
  [31, -17],
  [-35, 1],
  [-14, 3],
  [14, 1],
  [35, 4],
  [-31, 18],
  [-8, 19],
  [11, 18],
  [31, 21],
  [-34, 34],
  [-17, 31],
  [2, 34],
  [20, 32],
  [35, 30],
  [-25, -4],
  [25, -2],
];

const scratchSpawnPoint = new THREE.Vector3();
const scratchFallbackPoint = new THREE.Vector3();
const scratchProjectedPoint = new THREE.Vector3();

export function createFanartSurvival({
  roomHalf,
  camera,
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
  const audio = new Audio(FANART_AUDIO_URL);
  audio.preload = "auto";

  let stage = null;
  const state = {
    status: "ready",
    health: FANART_MAX_HEALTH,
    spawnTimer: 0,
    spawnCursor: 0,
    collected: 0,
    activeCount: 0,
  };

  audio.addEventListener("ended", () => {
    complete();
  });

  function createStage() {
    const group = new THREE.Group();
    group.name = "floor-12-fanart-survival";

    const padMaterial = new THREE.MeshBasicMaterial({
      color: "#22d3ee",
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const pad = new THREE.Mesh(new THREE.CircleGeometry(FANART_START_RADIUS, 64), padMaterial);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.045;
    group.add(pad);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#a7f3d0",
      transparent: true,
      opacity: 0.74,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(FANART_START_RADIUS, 0.08, 10, 96), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.09;
    group.add(ring);

    const label = createTextSprite("E START", "#22d3ee", 0.92);
    label.position.set(0, 1.3, 0);
    label.scale.set(2.1, 0.54, 1);
    group.add(label);

    const geometries = {
      horizontal: new THREE.BoxGeometry(1.22, 0.16, 0.34),
      vertical: new THREE.BoxGeometry(0.34, 0.16, 1.22),
      ring: new THREE.TorusGeometry(1.15, 0.035, 8, 40),
      halo: new THREE.CircleGeometry(1.35, 32),
    };
    const materials = {
      plus: new THREE.MeshBasicMaterial({ color: "#f8fafc" }),
      ring: new THREE.MeshBasicMaterial({
        color: "#86efac",
        transparent: true,
        opacity: 0.58,
      }),
      halo: new THREE.MeshBasicMaterial({
        color: "#22c55e",
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      }),
    };

    const medicineItems = Array.from({ length: FANART_ACTIVE_MEDICINE_LIMIT }, () => {
      const medicine = createMedicine(geometries, materials);
      group.add(medicine.group);
      return medicine;
    });

    group.visible = false;
    stage = {
      group,
      pad,
      padMaterial,
      ring,
      ringMaterial,
      label,
      medicineItems,
    };
    return stage;
  }

  function createMedicine(geometries, materials) {
    const group = new THREE.Group();
    group.name = "healing-medicine-plus";
    group.visible = false;

    const halo = new THREE.Mesh(geometries.halo, materials.halo);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.055;
    group.add(halo);

    const horizontal = new THREE.Mesh(geometries.horizontal, materials.plus);
    horizontal.position.y = 0.44;
    group.add(horizontal);

    const vertical = new THREE.Mesh(geometries.vertical, materials.plus);
    vertical.position.y = 0.44;
    group.add(vertical);

    const ring = new THREE.Mesh(geometries.ring, materials.ring);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);

    return {
      group,
      active: false,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function showIntroPopup() {
    showPopup(
      "12층 생존전",
      "치료약을 모으며 미쿠를 지켜 주세요. 가운데 원 안에서 E를 누르면 시작합니다.",
      "확인",
    );
  }

  function goalText() {
    if (state.status === "cleared") {
      return "문으로 이동";
    }
    if (state.status === "playing") {
      return `치료약 생존 중 ${Math.ceil(state.health)}%`;
    }
    if (state.status === "failed") {
      return "처음부터 재도전";
    }
    return "중앙 원에서 E";
  }

  function updateVisibility() {
    if (!stage) {
      return;
    }

    const visible = getCurrentFloor() === FANART_FLOOR
      && !isEscapeComplete()
      && state.status !== "cleared";
    stage.group.visible = visible;
    dom.survivalHud.classList.toggle("hidden", !visible);
  }

  function reset(options = {}) {
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Metadata may not be available yet on the first reset.
    }

    state.status = "ready";
    state.health = FANART_MAX_HEALTH;
    state.spawnTimer = 0;
    state.spawnCursor = 0;
    state.collected = 0;
    hideMedicines();

    if (options.placePlayer) {
      const player = getPlayer();
      if (player) {
        player.group.position.copy(FANART_START_POSITION);
        player.group.rotation.y = Math.PI;
        player.previousPosition.copy(player.group.position);
        clearPointerTarget();
        resetTrail();
      }
    }

    updateVisibility();
    updateSurvivalHud();
    updateHud();
  }

  function isPlaying() {
    return getCurrentFloor() === FANART_FLOOR && state.status === "playing";
  }

  function isCleared() {
    return state.status === "cleared";
  }

  function isPlayerAtStart() {
    const player = getPlayer();
    return Boolean(player && player.group.position.distanceTo(FANART_START_POSITION) <= FANART_START_RADIUS);
  }

  function handleKeyDown(event) {
    if (getCurrentFloor() !== FANART_FLOOR) {
      return false;
    }

    const isStartKey = event.code === "KeyE" || event.key.toLowerCase() === "e";
    if (!isStartKey) {
      return false;
    }

    event.preventDefault();
    if (event.repeat) {
      return true;
    }

    if (state.status === "ready" || state.status === "failed") {
      if (isPlayerAtStart()) {
        start();
      } else {
        showMessage("가운데 원 안으로 들어가 E를 눌러주세요.", 1800);
      }
    }

    return true;
  }

  async function start() {
    const player = getPlayer();
    if (!player || (state.status !== "ready" && state.status !== "failed")) {
      return;
    }

    state.status = "ready";
    state.health = FANART_MAX_HEALTH;
    state.spawnTimer = FANART_SPAWN_INTERVAL;
    state.spawnCursor = 0;
    state.collected = 0;
    hideMedicines();
    clearPointerTarget();
    player.previousPosition.copy(player.group.position);
    resetTrail();

    try {
      audio.currentTime = 0;
    } catch {
      // The browser can still begin playback from the start once metadata loads.
    }

    try {
      await audio.play();
      state.status = "playing";
      spawnInitialMedicines();
      updateHud();
      updateSurvivalHud();
      showMessage("치료약 생존전 시작", 1000);
    } catch (error) {
      console.warn("FanArt playback was blocked.", error);
      state.status = "ready";
      hideMedicines();
      updateHud();
      updateSurvivalHud();
      showPopup("오디오 재생 확인", "브라우저가 음악 재생을 막았습니다. 화면을 클릭한 뒤 가운데 원 안에서 E를 다시 눌러주세요.", "확인");
    }
  }

  function update(dt, elapsed) {
    updateVisibility();
    if (getCurrentFloor() !== FANART_FLOOR || isEscapeComplete()) {
      return;
    }

    updateStageMaterials(dt, elapsed);

    if (state.status === "playing") {
      state.health = THREE.MathUtils.clamp(
        state.health - FANART_HEALTH_DRAIN_PER_SECOND * dt,
        0,
        FANART_MAX_HEALTH,
      );

      checkMedicinePickups();

      state.spawnTimer -= dt;
      while (state.spawnTimer <= 0) {
        spawnMedicine();
        state.spawnTimer += FANART_SPAWN_INTERVAL;
      }

      if (state.health <= 0) {
        fail();
        return;
      }
    }

    updateSurvivalHud();
  }

  function updateStageMaterials(dt, elapsed) {
    if (!stage) {
      return;
    }

    const atStart = state.status !== "playing" && isPlayerAtStart();
    stage.padMaterial.opacity = atStart
      ? 0.26 + Math.sin(elapsed * 6.2) * 0.06
      : 0.14 + Math.sin(elapsed * 2.2) * 0.025;
    stage.ringMaterial.opacity = atStart
      ? 0.86 + Math.sin(elapsed * 7.4) * 0.1
      : 0.58 + Math.sin(elapsed * 2.8) * 0.06;
    stage.ring.rotation.z += dt * (state.status === "playing" ? 1.2 : 0.45);
    stage.label.visible = state.status !== "playing";

    for (const item of stage.medicineItems) {
      if (!item.active) {
        continue;
      }
      item.group.position.y = Math.sin(elapsed * 3.5 + item.phase) * 0.08;
      item.group.rotation.y += dt * 2.3;
      const pulse = 1 + Math.sin(elapsed * 4.2 + item.phase) * 0.055;
      item.group.scale.setScalar(pulse);
    }
  }

  function spawnInitialMedicines() {
    for (let i = 0; i < FANART_INITIAL_MEDICINE_COUNT; i += 1) {
      spawnMedicine();
    }
  }

  function spawnMedicine() {
    if (!stage || state.activeCount >= FANART_ACTIVE_MEDICINE_LIMIT) {
      return false;
    }

    const inactive = stage.medicineItems.find((item) => !item.active);
    if (!inactive) {
      return false;
    }

    const point = getNextMedicinePoint();
    inactive.group.position.copy(point);
    inactive.group.position.y = 0;
    inactive.group.rotation.y = Math.random() * Math.PI * 2;
    inactive.group.scale.setScalar(1);
    inactive.active = true;
    inactive.group.visible = true;
    state.activeCount += 1;
    return true;
  }

  function getNextMedicinePoint() {
    for (let attempt = 0; attempt < FANART_VISIBLE_SPAWN_ATTEMPTS; attempt += 1) {
      makeRandomSpawnPoint(scratchSpawnPoint);
      if (isMedicinePointUsable(scratchSpawnPoint, FANART_MEDICINE_MIN_SPACING, true)) {
        return scratchSpawnPoint;
      }
    }

    for (let attempt = 0; attempt < FANART_ANYWHERE_SPAWN_ATTEMPTS; attempt += 1) {
      makeRandomSpawnPoint(scratchSpawnPoint);
      if (isMedicinePointUsable(scratchSpawnPoint, FANART_MEDICINE_MIN_SPACING, false)) {
        return scratchSpawnPoint;
      }
    }

    for (let attempt = 0; attempt < FANART_MEDICINE_SPAWNS.length; attempt += 1) {
      const index = state.spawnCursor % FANART_MEDICINE_SPAWNS.length;
      state.spawnCursor += 1;
      const [x, z] = FANART_MEDICINE_SPAWNS[index];
      scratchFallbackPoint.set(x, 0, z);
      if (isMedicinePointUsable(scratchFallbackPoint, 5.5, false)) {
        return scratchFallbackPoint;
      }
    }

    return getFarthestMedicinePoint();
  }

  function makeRandomSpawnPoint(target) {
    const player = getPlayer();
    const origin = player?.group.position ?? FANART_START_POSITION;
    const angle = Math.random() * Math.PI * 2;
    const radius = THREE.MathUtils.randFloat(10, 28);
    target.set(
      THREE.MathUtils.clamp(origin.x + Math.cos(angle) * radius, -roomHalf + 3, roomHalf - 3),
      0,
      THREE.MathUtils.clamp(origin.z + Math.sin(angle) * radius, -roomHalf + 3, roomHalf - 3),
    );
    return target;
  }

  function isMedicinePointUsable(point, minSpacing, requireVisible) {
    const player = getPlayer();
    if (player && flatDistance(point, player.group.position) < FANART_MEDICINE_PLAYER_SAFE_RADIUS) {
      return false;
    }

    if (requireVisible && !isPointInCameraView(point)) {
      return false;
    }

    for (const item of stage.medicineItems) {
      if (item.active && flatDistance(item.group.position, point) < minSpacing) {
        return false;
      }
    }
    return true;
  }

  function getFarthestMedicinePoint() {
    let bestPoint = FANART_MEDICINE_SPAWNS[0];
    let bestScore = -Infinity;
    const player = getPlayer();

    for (const point of FANART_MEDICINE_SPAWNS) {
      scratchFallbackPoint.set(point[0], 0, point[1]);
      const playerDistance = player ? flatDistance(scratchFallbackPoint, player.group.position) : 20;
      if (playerDistance < FANART_MEDICINE_PLAYER_SAFE_RADIUS) {
        continue;
      }

      let nearestMedicine = 20;
      for (const item of stage.medicineItems) {
        if (!item.active) {
          continue;
        }
        nearestMedicine = Math.min(nearestMedicine, flatDistance(item.group.position, scratchFallbackPoint));
      }

      const visibleBonus = isPointInCameraView(scratchFallbackPoint) ? 6 : 0;
      const score = nearestMedicine + Math.min(playerDistance, 20) * 0.35 + visibleBonus;
      if (score > bestScore) {
        bestPoint = point;
        bestScore = score;
      }
    }

    scratchFallbackPoint.set(bestPoint[0], 0, bestPoint[1]);
    return scratchFallbackPoint;
  }

  function isPointInCameraView(point) {
    scratchProjectedPoint.set(point.x, 0.4, point.z).project(camera);
    return scratchProjectedPoint.z >= -1
      && scratchProjectedPoint.z <= 1
      && scratchProjectedPoint.x >= -0.9
      && scratchProjectedPoint.x <= 0.9
      && scratchProjectedPoint.y >= -0.92
      && scratchProjectedPoint.y <= 0.82;
  }

  function checkMedicinePickups() {
    const player = getPlayer();
    if (!player || !stage) {
      return;
    }

    for (const item of stage.medicineItems) {
      if (!item.active || flatDistance(item.group.position, player.group.position) > FANART_PICKUP_RADIUS) {
        continue;
      }

      item.active = false;
      item.group.visible = false;
      item.group.scale.setScalar(1);
      state.activeCount = Math.max(0, state.activeCount - 1);
      state.collected += 1;
      state.health = THREE.MathUtils.clamp(
        state.health + FANART_HEAL_AMOUNT,
        0,
        FANART_MAX_HEALTH,
      );
    }
  }

  function hideMedicines() {
    if (!stage) {
      state.activeCount = 0;
      return;
    }

    for (const item of stage.medicineItems) {
      item.active = false;
      item.group.visible = false;
      item.group.scale.setScalar(1);
    }
    state.activeCount = 0;
  }

  function fail() {
    if (state.status !== "playing") {
      return;
    }

    state.status = "failed";
    state.health = 0;
    audio.pause();
    hideMedicines();
    updateHud();
    updateSurvivalHud();
    showPopup(
      "12층 생존 실패",
      "미쿠의 체력이 0이 되었습니다. 치료약 생존전을 처음부터 다시 시작해야 합니다.",
      "처음부터",
      () => {
        reset({ placePlayer: true });
        showMessage("중앙 원에서 E로 다시 시작", 1600);
      },
    );
  }

  function complete() {
    if (getCurrentFloor() !== FANART_FLOOR || state.status !== "playing") {
      return;
    }

    if (state.health <= 0) {
      fail();
      return;
    }

    state.status = "cleared";
    hideMedicines();
    updateSurvivalHud();
    updateHud();

    const recruitName = getCurrentRecruit()?.def.name ?? "12층 동료";
    if (getCurrentRecruit()) {
      recruitCurrent();
    } else {
      openExit();
    }

    showPopup(
      "치료약 수집 성공",
      `FanArt가 끝날 때까지 버텼습니다. ${recruitName}가 동료로 합류했고 12층 문이 열렸습니다.`,
      "확인",
    );
  }

  function updateSurvivalHud() {
    const health = Math.max(0, state.health);
    dom.survivalSong.textContent = "FanArt · 치료약 생존";
    dom.survivalStatus.textContent = goalText();
    dom.survivalHealthText.textContent = `${Math.ceil(health)} / ${FANART_MAX_HEALTH}`;
    dom.survivalHealthFill.style.width = `${health}%`;
    dom.survivalHealthFill.classList.toggle("danger", health <= 24);
    dom.survivalMeds.textContent = `${state.collected}개`;
    dom.survivalTime.textContent = formatSongTime(getTimeRemaining());
    dom.survivalHint.textContent = state.status === "playing" ? "플러스 밟기" : "중앙 원 E";
  }

  function getTimeRemaining() {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      return null;
    }
    return Math.max(0, audio.duration - audio.currentTime);
  }

  return {
    createStage,
    update,
    updateVisibility,
    reset,
    isPlaying,
    isCleared,
    handleKeyDown,
    showIntroPopup,
    goalText,
  };
}

function formatSongTime(seconds) {
  if (seconds === null) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function flatDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}
