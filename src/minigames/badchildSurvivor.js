import * as THREE from "three";

export const BADCHILD_FLOOR = 1;
export const BADCHILD_START_POSITION = new THREE.Vector3(0, 0, 26);

const BADCHILD_AUDIO_URL = new URL("../../assets/musics/badchild.mp3", import.meta.url).href;
const START_RADIUS = 5.2;
const PLAYER_HIT_RADIUS = 0.72;
const PUZZLE_POOL_SIZE = 110;
const LASER_POOL_SIZE = 20;
const CIRCLE_POOL_SIZE = 12;
const CIRCLE_ONLY_TARGET_COUNT = 10;
const FEATHER_POOL_SIZE = 90;
const LASER_WARNING_SECONDS = 0.75;
const LASER_ACTIVE_SECONDS = 0.34;
const PUZZLE_WARMUP_END = 17;
const PUZZLE_SPAWN_END = 76;
const PUZZLE_RAIN_END = 77;
const PUZZLE_PEAK_DENSITY = 0.9;
const PUZZLE_MIN_INTERVAL = 0.12 / PUZZLE_PEAK_DENSITY;
const FINAL_PUZZLE_REFERENCE_TIME = 45;
const EDGE_LASER_MARGIN = 1.6;
const EDGE_LASER_INSET = 5.8;
const LASER_ONLY_END = 137;
const CIRCLE_ONLY_END = 172;
const LASER_CIRCLE_END = 210;

const scratchForward = new THREE.Vector2();
const scratchNormal = new THREE.Vector2();
const scratchPlayer = new THREE.Vector2();

export function createBadchildSurvivor({
  roomHalf,
  dom,
  createTextSprite,
  getCurrentFloor,
  getPlayer,
  getCurrentRecruit,
  getDeveloperStartSeconds = () => 0,
  isEscapeComplete,
  clearPointerTarget,
  resetTrail,
  showMessage,
  showPopup,
  updateHud,
  openExit,
  recruitCurrent,
}) {
  const audio = new Audio(BADCHILD_AUDIO_URL);
  audio.preload = "auto";

  let stage = null;
  const state = {
    status: "ready",
    puzzleTimer: 0,
    laserTimer: 0,
    circleTimer: 0,
    featherTimer: 0,
    survivedSeconds: 0,
  };

  audio.addEventListener("ended", () => {
    complete();
  });
  audio.addEventListener("loadedmetadata", () => {
    if (state.status !== "playing") {
      resetAudioTime(getStartSeconds());
      updateBulletHud();
    }
  });

  function createStage() {
    const group = new THREE.Group();
    group.name = "floor-1-badchild-survivor";

    const padMaterial = new THREE.MeshBasicMaterial({
      color: "#22d3ee",
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const pad = new THREE.Mesh(new THREE.CircleGeometry(START_RADIUS, 64), padMaterial);
    pad.rotation.x = -Math.PI / 2;
    pad.position.copy(BADCHILD_START_POSITION);
    pad.position.y = 0.052;
    group.add(pad);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#e0f2fe",
      transparent: true,
      opacity: 0.72,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(START_RADIUS, 0.08, 10, 96), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(BADCHILD_START_POSITION);
    ring.position.y = 0.105;
    group.add(ring);

    const label = createTextSprite("E START", "#22d3ee", 0.92);
    label.position.set(BADCHILD_START_POSITION.x, 1.3, BADCHILD_START_POSITION.z);
    label.scale.set(2.1, 0.54, 1);
    group.add(label);

    const puzzlePieces = createPuzzlePieces(group);
    const lasers = createLasers(group);
    const circles = createCircles(group);
    const feathers = createFeathers(group);

    group.visible = false;
    stage = {
      group,
      pad,
      padMaterial,
      ring,
      ringMaterial,
      label,
      puzzlePieces,
      lasers,
      circles,
      feathers,
    };
    return stage;
  }

  function createPuzzlePieces(group) {
    const bodyGeometry = new THREE.BoxGeometry(1.05, 0.16, 0.72);
    const nubGeometry = new THREE.CylinderGeometry(0.18, 0.18, 0.18, 12);
    const colors = ["#f9a8d4", "#facc15", "#67e8f9", "#c4b5fd", "#86efac"];

    return Array.from({ length: PUZZLE_POOL_SIZE }, (_, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: colors[index % colors.length],
        roughness: 0.42,
        metalness: 0.08,
        emissive: colors[index % colors.length],
        emissiveIntensity: 0.12,
      });
      const itemGroup = new THREE.Group();
      itemGroup.visible = false;

      const body = new THREE.Mesh(bodyGeometry, material);
      body.position.y = 0.34;
      body.castShadow = true;
      itemGroup.add(body);

      const nubA = new THREE.Mesh(nubGeometry, material);
      nubA.position.set(0.26, 0.44, -0.39);
      nubA.castShadow = true;
      itemGroup.add(nubA);

      const nubB = new THREE.Mesh(nubGeometry, material);
      nubB.position.set(-0.52, 0.44, 0.06);
      nubB.castShadow = true;
      itemGroup.add(nubB);

      group.add(itemGroup);
      return {
        group: itemGroup,
        active: false,
        velocity: new THREE.Vector3(),
        radius: 0.58,
        spin: 0,
      };
    });
  }

  function createLasers(group) {
    const length = roomHalf * 3.1;
    const warningMaterial = new THREE.MeshBasicMaterial({
      color: "#fef2f2",
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: "#fb7185",
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });

    return Array.from({ length: LASER_POOL_SIZE }, () => {
      const groupLaser = new THREE.Group();
      groupLaser.visible = false;

      const warning = new THREE.Mesh(new THREE.BoxGeometry(length, 0.045, 0.18), warningMaterial.clone());
      warning.position.y = 0.12;
      groupLaser.add(warning);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 1.5), beamMaterial.clone());
      beam.position.y = 0.16;
      beam.visible = false;
      groupLaser.add(beam);

      const core = new THREE.Mesh(new THREE.BoxGeometry(length, 0.095, 0.32), coreMaterial.clone());
      core.position.y = 0.19;
      core.visible = false;
      groupLaser.add(core);

      group.add(groupLaser);
      return {
        group: groupLaser,
        warning,
        beam,
        core,
        active: false,
        mode: "warning",
        timer: 0,
        angle: 0,
        width: 1.5,
        length,
      };
    });
  }

  function createCircles(group) {
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: "#f43f5e",
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
    });
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#fecdd3",
      transparent: true,
      opacity: 0.82,
    });

    return Array.from({ length: CIRCLE_POOL_SIZE }, () => {
      const circleGroup = new THREE.Group();
      circleGroup.visible = false;

      const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 64), fillMaterial.clone());
      fill.rotation.x = -Math.PI / 2;
      fill.position.y = 0.07;
      circleGroup.add(fill);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 10, 80), ringMaterial.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.11;
      circleGroup.add(ring);

      group.add(circleGroup);
      return {
        group: circleGroup,
        fill,
        ring,
        active: false,
        age: 0,
        life: 4.8,
        maxRadius: 4.6,
        velocity: new THREE.Vector3(),
        radius: 0,
      };
    });
  }

  function createFeathers(group) {
    const featherShape = new THREE.Shape();
    featherShape.moveTo(0, 0.74);
    featherShape.bezierCurveTo(0.32, 0.42, 0.34, -0.36, 0, -0.74);
    featherShape.bezierCurveTo(-0.34, -0.36, -0.32, 0.42, 0, 0.74);
    const featherGeometry = new THREE.ShapeGeometry(featherShape);
    const stemGeometry = new THREE.BoxGeometry(0.055, 0.04, 1.15);
    const colors = ["#f8fafc", "#bae6fd", "#fef3c7"];

    return Array.from({ length: FEATHER_POOL_SIZE }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: colors[index % colors.length],
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
      });
      const featherGroup = new THREE.Group();
      featherGroup.visible = false;

      const plume = new THREE.Mesh(featherGeometry, material);
      plume.rotation.x = -Math.PI / 2;
      plume.position.y = 0.33;
      featherGroup.add(plume);

      const stem = new THREE.Mesh(stemGeometry, material.clone());
      stem.position.y = 0.36;
      featherGroup.add(stem);

      group.add(featherGroup);
      return {
        group: featherGroup,
        active: false,
        velocity: new THREE.Vector3(),
        radius: 0.48,
        spin: 0,
      };
    });
  }

  function showIntroPopup() {
    showPopup(
      "1층 Bad Child",
      "미쿠가 한 번이라도 맞으면 처음부터 다시 시작합니다. 시작 원 안에서 E를 누르고 음악이 끝날 때까지 피해 주세요.",
      "확인",
    );
  }

  function goalText() {
    if (state.status === "cleared") {
      return "출구로 이동";
    }
    if (state.status === "playing") {
      return "피격 없이 생존";
    }
    if (state.status === "failed") {
      return "처음부터 재도전";
    }
    return "시작 원에서 E";
  }

  function updateVisibility() {
    if (!stage) {
      return;
    }

    const visible = getCurrentFloor() === BADCHILD_FLOOR
      && !isEscapeComplete()
      && state.status !== "cleared";
    stage.group.visible = visible;
    dom.bulletHud.classList.toggle("hidden", !visible);
  }

  function reset(options = {}) {
    audio.pause();
    const startSeconds = getStartSeconds();
    resetAudioTime(startSeconds);
    state.status = "ready";
    state.puzzleTimer = 0;
    state.laserTimer = 0;
    state.circleTimer = 0;
    state.featherTimer = 0;
    state.survivedSeconds = startSeconds;
    hideHazards();

    if (options.placePlayer) {
      placePlayerAtStart();
    }

    updateVisibility();
    updateBulletHud();
    updateHud();
  }

  function isPlaying() {
    return getCurrentFloor() === BADCHILD_FLOOR && state.status === "playing";
  }

  function isCleared() {
    return state.status === "cleared";
  }

  function isPlayerAtStart() {
    const player = getPlayer();
    return Boolean(player && player.group.position.distanceTo(BADCHILD_START_POSITION) <= START_RADIUS);
  }

  function handleKeyDown(event) {
    if (getCurrentFloor() !== BADCHILD_FLOOR) {
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
        showMessage("시작 원 안으로 들어가 E를 눌러주세요.", 1800);
      }
    }

    return true;
  }

  async function start() {
    const player = getPlayer();
    if (!player || (state.status !== "ready" && state.status !== "failed")) {
      return;
    }

    const startSeconds = getStartSeconds();
    state.status = "ready";
    preparePatternTimers(startSeconds);
    state.survivedSeconds = startSeconds;
    hideHazards();
    clearPointerTarget();
    player.previousPosition.copy(player.group.position);
    resetTrail();

    resetAudioTime(startSeconds);

    try {
      await audio.play();
      state.status = "playing";
      updateHud();
      updateBulletHud();
      showMessage(startSeconds > 0 ? `${formatSongTime(startSeconds)}부터 Bad Child 시작` : "Bad Child 시작", 1000);
    } catch (error) {
      console.warn("Bad Child playback was blocked.", error);
      state.status = "ready";
      updateHud();
      updateBulletHud();
      showPopup("오디오 재생 확인", "브라우저가 음악 재생을 막았습니다. 화면을 클릭한 뒤 시작 원 안에서 E를 다시 눌러주세요.", "확인");
    }
  }

  function preparePatternTimers(songTime) {
    state.puzzleTimer = isPuzzlePatternTime(songTime) ? 0.18 : 999;
    state.laserTimer = isLaserPatternTime(songTime) ? 0.16 : 0.7;
    state.circleTimer = isCirclePatternTime(songTime) ? 0.24 : 0.9;
    state.featherTimer = songTime >= LASER_CIRCLE_END ? 0.16 : 0.2;
  }

  function update(dt, elapsed) {
    updateVisibility();
    if (getCurrentFloor() !== BADCHILD_FLOOR || isEscapeComplete()) {
      return;
    }

    updateStageMaterials(elapsed);

    if (state.status === "playing") {
      const songTime = audio.currentTime;
      state.survivedSeconds = songTime;
      updatePatternSpawners(dt, songTime);
      updateHazards(dt, elapsed);
      if (checkPlayerHit()) {
        fail();
        return;
      }
    }

    updateBulletHud();
  }

  function updateStageMaterials(elapsed) {
    if (!stage) {
      return;
    }

    const atStart = state.status !== "playing" && isPlayerAtStart();
    stage.padMaterial.opacity = atStart
      ? 0.28 + Math.sin(elapsed * 6.4) * 0.07
      : 0.13 + Math.sin(elapsed * 2.4) * 0.025;
    stage.ringMaterial.opacity = atStart
      ? 0.9 + Math.sin(elapsed * 7.5) * 0.08
      : 0.58 + Math.sin(elapsed * 3.1) * 0.06;
    stage.ring.rotation.z += 0.016;
    stage.label.visible = state.status !== "playing";
  }

  function updatePatternSpawners(dt, songTime) {
    if (isPuzzlePatternTime(songTime)) {
      updatePuzzleSpawner(dt, songTime);
    }

    if (songTime >= PUZZLE_RAIN_END && songTime < LASER_CIRCLE_END) {
      clearPuzzlePieces();
    }

    if (isLaserPatternTime(songTime)) {
      updateLaserSpawner(dt, songTime);
    }

    if (isCirclePatternTime(songTime)) {
      updateCircleSpawner(dt, songTime);
    }

    if (songTime >= LASER_CIRCLE_END) {
      updateFeatherSpawner(dt, songTime);
    }
  }

  function updatePuzzleSpawner(dt, songTime) {
    const puzzleTime = songTime >= LASER_CIRCLE_END ? FINAL_PUZZLE_REFERENCE_TIME : songTime;
    const progress = puzzleTime < PUZZLE_WARMUP_END
      ? 0
      : THREE.MathUtils.clamp((puzzleTime - PUZZLE_WARMUP_END) / (PUZZLE_SPAWN_END - PUZZLE_WARMUP_END), 0, 1);
    const interval = puzzleTime < PUZZLE_WARMUP_END
      ? 0.48
      : THREE.MathUtils.lerp(0.32, PUZZLE_MIN_INTERVAL, progress);
    const burstCount = puzzleTime < PUZZLE_WARMUP_END ? 1 : 1 + Math.floor(progress * 2.2);

    state.puzzleTimer -= dt;
    while (state.puzzleTimer <= 0) {
      for (let i = 0; i < burstCount; i += 1) {
        spawnPuzzlePiece(progress);
      }
      state.puzzleTimer += interval;
    }
  }

  function updateLaserSpawner(dt, songTime) {
    const pressure = songTime >= LASER_CIRCLE_END ? 1 : songTime >= CIRCLE_ONLY_END ? 0.65 : 0.35;
    const interval = THREE.MathUtils.lerp(1.45, 1.02, pressure);
    const burstCount = getLaserBurstCount(songTime);
    const fixedEdgeCount = isCircleLaserTime(songTime) ? 3 : 0;
    state.laserTimer -= dt;
    while (state.laserTimer <= 0) {
      for (let i = 0; i < burstCount; i += 1) {
        spawnLaser(pressure);
      }
      if (fixedEdgeCount > 0) {
        spawnFixedEdgeLasers(fixedEdgeCount, pressure);
      }
      state.laserTimer += interval;
    }
  }

  function getLaserBurstCount(songTime) {
    if (songTime >= PUZZLE_RAIN_END && songTime < LASER_ONLY_END) {
      return 10;
    }
    if (isCircleLaserTime(songTime) || songTime >= LASER_CIRCLE_END) {
      return 5;
    }
    return 1;
  }

  function updateCircleSpawner(dt, songTime) {
    const circleOnly = isCircleOnlyTime(songTime);
    const pressure = songTime >= LASER_CIRCLE_END ? 1 : songTime >= CIRCLE_ONLY_END ? 0.72 : 0.35;
    const interval = circleOnly ? 0.55 : THREE.MathUtils.lerp(2.25, 1.65, pressure);

    if (circleOnly) {
      fillCircleOnlyArena();
    }

    state.circleTimer -= dt;
    while (state.circleTimer <= 0) {
      const burstCount = circleOnly
        ? Math.max(1, Math.min(3, CIRCLE_ONLY_TARGET_COUNT - getActiveCircleCount()))
        : 1;
      for (let i = 0; i < burstCount; i += 1) {
        spawnCircle(circleOnly ? 0.78 : pressure, { roaming: circleOnly });
      }
      state.circleTimer += interval;
    }
  }

  function fillCircleOnlyArena() {
    while (getActiveCircleCount() < CIRCLE_ONLY_TARGET_COUNT) {
      if (!spawnCircle(0.78, { roaming: true })) {
        return;
      }
    }
  }

  function getActiveCircleCount() {
    return stage.circles.reduce((count, circle) => count + (circle.active ? 1 : 0), 0);
  }

  function updateFeatherSpawner(dt, songTime) {
    const pressure = THREE.MathUtils.clamp((songTime - LASER_CIRCLE_END) / 34, 0, 1);
    const interval = THREE.MathUtils.lerp(0.23, 0.13, pressure);
    state.featherTimer -= dt;
    while (state.featherTimer <= 0) {
      spawnFeather(pressure);
      if (pressure > 0.45 && Math.random() < 0.35) {
        spawnFeather(pressure);
      }
      state.featherTimer += interval;
    }
  }

  function spawnPuzzlePiece(pressure) {
    const item = stage.puzzlePieces.find((piece) => !piece.active);
    if (!item) {
      return;
    }

    const laneWidth = roomHalf - 3.2;
    item.group.position.set(
      THREE.MathUtils.randFloat(-laneWidth, laneWidth),
      0,
      -roomHalf - THREE.MathUtils.randFloat(1.5, 7.5),
    );
    item.group.rotation.set(0, Math.random() * Math.PI * 2, Math.random() * Math.PI);
    item.velocity.set(
      THREE.MathUtils.randFloatSpread(1.4 + pressure * 1.9),
      0,
      THREE.MathUtils.randFloat(10.5 + pressure * 2.5, 14.5 + pressure * 5.0),
    );
    item.radius = THREE.MathUtils.randFloat(0.44, 0.62);
    item.spin = THREE.MathUtils.randFloat(2.4, 5.8) * (Math.random() < 0.5 ? -1 : 1);
    item.active = true;
    item.group.visible = true;
  }

  function spawnLaser(pressure, options = {}) {
    const laser = stage.lasers.find((item) => !item.active);
    if (!laser) {
      return false;
    }

    const angles = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI * 0.18, -Math.PI * 0.18];
    const angle = options.angle ?? angles[Math.floor(Math.random() * angles.length)];
    const normalAngle = angle + Math.PI / 2;
    const offset = THREE.MathUtils.randFloat(-18, 18) * (pressure < 0.6 ? 0.8 : 1);
    const position = options.position ?? {
      x: Math.cos(normalAngle) * offset,
      z: Math.sin(normalAngle) * offset,
    };

    laser.group.position.set(position.x, 0, position.z);
    laser.group.rotation.y = -angle;
    laser.group.visible = true;
    laser.warning.visible = true;
    laser.beam.visible = false;
    laser.core.visible = false;
    laser.warning.material.opacity = 0.4;
    laser.beam.material.opacity = 0.68;
    laser.core.material.opacity = 0.78;
    laser.active = true;
    laser.mode = "warning";
    laser.timer = LASER_WARNING_SECONDS;
    laser.angle = angle;
    laser.width = options.width ?? THREE.MathUtils.lerp(1.35, 1.65, pressure);
    laser.beam.scale.z = laser.width / 1.5;
    laser.core.scale.z = THREE.MathUtils.lerp(0.82, 1.0, pressure);
    return true;
  }

  function spawnFixedEdgeLasers(count, pressure) {
    const lines = getEdgeLaserLines();
    shuffleArray(lines);
    for (let i = 0; i < Math.min(count, lines.length); i += 1) {
      spawnLaser(pressure, lines[i]);
    }
  }

  function getEdgeLaserLines() {
    const edge = roomHalf - EDGE_LASER_MARGIN;
    const inner = edge - EDGE_LASER_INSET;
    const lines = [];

    [edge, inner].forEach((distance) => {
      lines.push(
        { angle: Math.PI / 2, position: { x: distance, z: 0 }, width: 1.75 },
        { angle: Math.PI / 2, position: { x: -distance, z: 0 }, width: 1.75 },
        { angle: 0, position: { x: 0, z: distance }, width: 1.75 },
        { angle: 0, position: { x: 0, z: -distance }, width: 1.75 },
      );
    });

    return lines;
  }

  function shuffleArray(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  }

  function spawnCircle(pressure, options = {}) {
    const circle = stage.circles.find((item) => !item.active);
    if (!circle) {
      return false;
    }

    const roaming = Boolean(options.roaming);
    const spawnLimit = roomHalf - (roaming ? 5 : 8);
    circle.group.position.set(
      THREE.MathUtils.randFloat(-spawnLimit, spawnLimit),
      0,
      THREE.MathUtils.randFloat(-spawnLimit, spawnLimit),
    );
    const angle = Math.random() * Math.PI * 2;
    const speed = roaming
      ? THREE.MathUtils.randFloat(8.5, 13.5)
      : THREE.MathUtils.randFloat(4.8 + pressure * 1.4, 7.4 + pressure * 2.8);
    circle.velocity.set(Math.cos(angle) * speed, 0, Math.sin(angle) * speed);
    circle.age = 0;
    circle.life = roaming
      ? THREE.MathUtils.randFloat(7.2, 9.4)
      : THREE.MathUtils.lerp(5.2, 4.25, pressure);
    circle.maxRadius = roaming
      ? THREE.MathUtils.randFloat(3.0, 4.15)
      : THREE.MathUtils.lerp(3.7, 5.1, pressure);
    circle.radius = 0.1;
    circle.active = true;
    circle.group.visible = true;
    circle.group.scale.setScalar(0.1);
    return true;
  }

  function spawnFeather(pressure) {
    const feather = stage.feathers.find((item) => !item.active);
    if (!feather) {
      return;
    }

    const fromSide = Math.random() < 0.38;
    if (fromSide) {
      const side = Math.random() < 0.5 ? -1 : 1;
      feather.group.position.set(
        side * (roomHalf + 3),
        0,
        THREE.MathUtils.randFloat(-roomHalf + 5, roomHalf - 12),
      );
      feather.velocity.set(
        -side * THREE.MathUtils.randFloat(9.5, 13.5 + pressure * 4),
        0,
        THREE.MathUtils.randFloat(4.5, 8.5 + pressure * 3),
      );
    } else {
      feather.group.position.set(
        THREE.MathUtils.randFloat(-roomHalf + 4, roomHalf - 4),
        0,
        -roomHalf - 3,
      );
      feather.velocity.set(
        THREE.MathUtils.randFloatSpread(4 + pressure * 4),
        0,
        THREE.MathUtils.randFloat(11, 16 + pressure * 5),
      );
    }

    feather.group.rotation.set(0, Math.atan2(feather.velocity.x, feather.velocity.z), Math.random() * Math.PI);
    feather.radius = THREE.MathUtils.randFloat(0.36, 0.5);
    feather.spin = THREE.MathUtils.randFloat(3.5, 7.5) * (Math.random() < 0.5 ? -1 : 1);
    feather.active = true;
    feather.group.visible = true;
  }

  function updateHazards(dt, elapsed) {
    updatePuzzlePieces(dt);
    updateLasers(dt, elapsed);
    updateCircles(dt);
    updateFeathers(dt);
  }

  function updatePuzzlePieces(dt) {
    for (const item of stage.puzzlePieces) {
      if (!item.active) {
        continue;
      }

      item.group.position.addScaledVector(item.velocity, dt);
      item.group.rotation.y += item.spin * dt;
      item.group.rotation.z += item.spin * 0.6 * dt;

      if (Math.abs(item.group.position.x) > roomHalf + 8 || item.group.position.z > roomHalf + 8) {
        deactivateMovingHazard(item);
      }
    }
  }

  function updateLasers(dt, elapsed) {
    for (const laser of stage.lasers) {
      if (!laser.active) {
        continue;
      }

      laser.timer -= dt;
      if (laser.mode === "warning") {
        laser.warning.material.opacity = 0.28 + Math.sin(elapsed * 24) * 0.14;
        if (laser.timer <= 0) {
          laser.mode = "active";
          laser.timer = LASER_ACTIVE_SECONDS;
          laser.warning.visible = false;
          laser.beam.visible = true;
          laser.core.visible = true;
        }
      } else if (laser.timer <= 0) {
        laser.active = false;
        laser.group.visible = false;
      } else {
        const flash = Math.sin(elapsed * 35) * 0.08;
        laser.beam.material.opacity = 0.66 + flash;
        laser.core.material.opacity = 0.78 + flash;
      }
    }
  }

  function updateCircles(dt) {
    for (const circle of stage.circles) {
      if (!circle.active) {
        continue;
      }

      circle.age += dt;
      if (circle.age >= circle.life) {
        circle.active = false;
        circle.group.visible = false;
        continue;
      }

      circle.group.position.addScaledVector(circle.velocity, dt);
      if (Math.abs(circle.group.position.x) > roomHalf - circle.maxRadius) {
        circle.group.position.x = THREE.MathUtils.clamp(circle.group.position.x, -roomHalf + circle.maxRadius, roomHalf - circle.maxRadius);
        circle.velocity.x *= -1;
      }
      if (Math.abs(circle.group.position.z) > roomHalf - circle.maxRadius) {
        circle.group.position.z = THREE.MathUtils.clamp(circle.group.position.z, -roomHalf + circle.maxRadius, roomHalf - circle.maxRadius);
        circle.velocity.z *= -1;
      }

      const cycle = Math.sin((circle.age / circle.life) * Math.PI);
      circle.radius = Math.max(0.12, cycle * circle.maxRadius);
      circle.group.scale.setScalar(circle.radius);
      circle.fill.material.opacity = 0.16 + cycle * 0.2;
      circle.ring.material.opacity = 0.52 + cycle * 0.32;
    }
  }

  function updateFeathers(dt) {
    for (const feather of stage.feathers) {
      if (!feather.active) {
        continue;
      }

      feather.group.position.addScaledVector(feather.velocity, dt);
      feather.group.rotation.z += feather.spin * dt;

      if (Math.abs(feather.group.position.x) > roomHalf + 8 || feather.group.position.z > roomHalf + 8) {
        deactivateMovingHazard(feather);
      }
    }
  }

  function checkPlayerHit() {
    const player = getPlayer();
    if (!player) {
      return false;
    }

    scratchPlayer.set(player.group.position.x, player.group.position.z);
    return checkMovingHazards(stage.puzzlePieces)
      || checkMovingHazards(stage.feathers)
      || checkLaserHits()
      || checkCircleHits();
  }

  function checkMovingHazards(items) {
    for (const item of items) {
      if (!item.active) {
        continue;
      }
      const dx = item.group.position.x - scratchPlayer.x;
      const dz = item.group.position.z - scratchPlayer.y;
      if (Math.hypot(dx, dz) <= item.radius + PLAYER_HIT_RADIUS) {
        return true;
      }
    }
    return false;
  }

  function checkLaserHits() {
    for (const laser of stage.lasers) {
      if (!laser.active || laser.mode !== "active") {
        continue;
      }

      scratchForward.set(Math.cos(laser.angle), Math.sin(laser.angle));
      scratchNormal.set(-scratchForward.y, scratchForward.x);
      const dx = scratchPlayer.x - laser.group.position.x;
      const dz = scratchPlayer.y - laser.group.position.z;
      const along = dx * scratchForward.x + dz * scratchForward.y;
      const across = Math.abs(dx * scratchNormal.x + dz * scratchNormal.y);
      if (Math.abs(along) <= laser.length / 2 && across <= laser.width / 2 + PLAYER_HIT_RADIUS) {
        return true;
      }
    }
    return false;
  }

  function checkCircleHits() {
    for (const circle of stage.circles) {
      if (!circle.active || circle.radius < 0.36) {
        continue;
      }

      const dx = circle.group.position.x - scratchPlayer.x;
      const dz = circle.group.position.z - scratchPlayer.y;
      if (Math.hypot(dx, dz) <= circle.radius + PLAYER_HIT_RADIUS * 0.7) {
        return true;
      }
    }
    return false;
  }

  function fail() {
    if (state.status !== "playing") {
      return;
    }

    state.status = "failed";
    audio.pause();
    const startSeconds = getStartSeconds();
    state.survivedSeconds = startSeconds;
    resetAudioTime(startSeconds);
    hideHazards();
    updateHud();
    updateBulletHud();
    showPopup(
      "1층 실패",
      "한 번 맞았습니다. Bad Child를 처음부터 다시 버텨야 합니다.",
      "처음부터",
      () => {
        reset({ placePlayer: true });
        showMessage("시작 원에서 E로 다시 시작", 1600);
      },
    );
  }

  function complete() {
    if (getCurrentFloor() !== BADCHILD_FLOOR || state.status !== "playing") {
      return;
    }

    state.status = "cleared";
    hideHazards();
    updateBulletHud();
    updateVisibility();
    updateHud();

    const recruitName = getCurrentRecruit()?.def.name ?? "1층 동료";
    if (getCurrentRecruit()) {
      recruitCurrent();
    } else {
      openExit();
    }

    showPopup(
      "Bad Child 생존 성공",
      `${recruitName}가 동료로 합류했고 출구가 열렸습니다.`,
      "확인",
    );
  }

  function updateBulletHud() {
    const ratio = getSongProgressRatio();
    dom.bulletSong.textContent = "Bad Child · Bullet Survivor";
    dom.bulletStatus.textContent = goalText();
    dom.bulletProgressFill.style.width = `${ratio * 100}%`;
    dom.bulletProgressFill.classList.toggle("danger", state.status === "failed");
    dom.bulletProgressText.textContent = `${Math.round(ratio * 100)}%`;
    dom.bulletPattern.textContent = getPatternLabel(audio.currentTime);
    dom.bulletTime.textContent = `${formatSongTime(audio.currentTime)} / ${formatSongTime(audio.duration)}`;
    dom.bulletHint.textContent = state.status === "playing" ? "한 대도 맞지 않기" : "시작 원 E";
  }

  function getSongProgressRatio() {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      return state.status === "cleared" ? 1 : 0;
    }
    return THREE.MathUtils.clamp(audio.currentTime / audio.duration, 0, 1);
  }

  function getPatternLabel(seconds) {
    if (state.status === "cleared") {
      return "Clear";
    }
    if (seconds < PUZZLE_WARMUP_END) {
      return "Puzzle Warmup";
    }
    if (seconds < PUZZLE_SPAWN_END) {
      return "Puzzle Rain";
    }
    if (seconds < PUZZLE_RAIN_END) {
      return "Puzzle Break";
    }
    if (seconds < LASER_ONLY_END) {
      return "Laser";
    }
    if (seconds < CIRCLE_ONLY_END) {
      return "Moving Circle";
    }
    if (seconds < LASER_CIRCLE_END) {
      return "Circle + Laser";
    }
    return "Feather + Laser + Circle";
  }

  function hideHazards() {
    if (!stage) {
      return;
    }

    stage.puzzlePieces.forEach(deactivateMovingHazard);
    stage.feathers.forEach(deactivateMovingHazard);
    for (const laser of stage.lasers) {
      laser.active = false;
      laser.group.visible = false;
      laser.warning.visible = true;
      laser.beam.visible = false;
      laser.core.visible = false;
    }
    for (const circle of stage.circles) {
      circle.active = false;
      circle.group.visible = false;
      circle.radius = 0;
    }
  }

  function clearPuzzlePieces() {
    stage.puzzlePieces.forEach(deactivateMovingHazard);
  }

  function isLaserPatternTime(songTime) {
    return (songTime >= PUZZLE_RAIN_END && songTime < LASER_ONLY_END)
      || isCircleLaserTime(songTime)
      || songTime >= LASER_CIRCLE_END;
  }

  function isPuzzlePatternTime(songTime) {
    return songTime < PUZZLE_SPAWN_END || songTime >= LASER_CIRCLE_END;
  }

  function isCircleOnlyTime(songTime) {
    return songTime >= LASER_ONLY_END && songTime < CIRCLE_ONLY_END;
  }

  function isCircleLaserTime(songTime) {
    return songTime >= CIRCLE_ONLY_END && songTime < LASER_CIRCLE_END;
  }

  function isCirclePatternTime(songTime) {
    return isCircleOnlyTime(songTime)
      || isCircleLaserTime(songTime)
      || songTime >= LASER_CIRCLE_END;
  }

  function deactivateMovingHazard(item) {
    item.active = false;
    item.group.visible = false;
  }

  function placePlayerAtStart() {
    const player = getPlayer();
    if (!player) {
      return;
    }

    player.group.position.copy(BADCHILD_START_POSITION);
    player.group.rotation.y = Math.PI;
    player.previousPosition.copy(player.group.position);
    clearPointerTarget();
    resetTrail();
  }

  function resetAudioTime(seconds = 0) {
    try {
      audio.currentTime = seconds;
    } catch {
      // Metadata may not be available yet.
    }
  }

  function getStartSeconds() {
    const seconds = Number(getDeveloperStartSeconds());
    if (!Number.isFinite(seconds) || seconds < 0) {
      return 0;
    }

    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      return Math.min(seconds, Math.max(0, audio.duration - 0.1));
    }

    return seconds;
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
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const safeSeconds = Math.floor(seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
