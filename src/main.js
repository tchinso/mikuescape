import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import "./styles.css";

const MODEL_DEFS = [
  {
    key: "miku",
    name: "Hatsune Miku",
    shortName: "Miku",
    color: "#2dd4bf",
    url: new URL("../assets/3d/01.hatsune miku.glb", import.meta.url).href,
    gait: { stride: 1.0, bob: 1.0, sway: 0.9 },
  },
  {
    key: "twintail",
    name: "Twintail Shortpants",
    shortName: "Twintail",
    color: "#f472b6",
    url: new URL("../assets/3d/02.twintail shortpants girl.glb", import.meta.url).href,
    gait: { stride: 1.1, bob: 0.92, sway: 1.05 },
  },
  {
    key: "gothic",
    name: "Chibi Gothic Lolita",
    shortName: "Gothic",
    color: "#a78bfa",
    url: new URL("../assets/3d/03.chibi gothic lolita girl.glb", import.meta.url).href,
    gait: { stride: 1.28, bob: 1.18, sway: 0.8 },
  },
  {
    key: "fallen",
    name: "Fallen Angel",
    shortName: "Angel",
    color: "#60a5fa",
    url: new URL("../assets/3d/04.fallen angel girl.glb", import.meta.url).href,
    gait: { stride: 0.96, bob: 0.86, sway: 1.12 },
  },
  {
    key: "neptune",
    name: "Hyperdimension Neptune",
    shortName: "Neptune",
    color: "#c084fc",
    url: new URL("../assets/3d/05.hyperdimension neptune girl.glb", import.meta.url).href,
    gait: { stride: 1.06, bob: 0.95, sway: 1.0 },
  },
  {
    key: "swimsuit",
    name: "School Swimsuit",
    shortName: "Swimsuit",
    color: "#38bdf8",
    url: new URL("../assets/3d/06.school swimsuit girl.glb", import.meta.url).href,
    gait: { stride: 1.18, bob: 1.02, sway: 0.86 },
  },
  {
    key: "pajama",
    name: "Pajama",
    shortName: "Pajama",
    color: "#fb7185",
    url: new URL("../assets/3d/07.pajama girl.glb", import.meta.url).href,
    gait: { stride: 0.9, bob: 0.82, sway: 1.16 },
  },
  {
    key: "fox",
    name: "Chibi Fox-ear",
    shortName: "Fox-ear",
    color: "#fbbf24",
    url: new URL("../assets/3d/08.chibi fox-ear girl.glb", import.meta.url).href,
    gait: { stride: 1.34, bob: 1.24, sway: 0.92 },
  },
  {
    key: "summer",
    name: "Bikini",
    shortName: "Bikini",
    color: "#fb923c",
    url: new URL("../assets/3d/09.bikini girl.glb", import.meta.url).href,
    gait: { stride: 1.0, bob: 0.9, sway: 0.94 },
  },
  {
    key: "cat",
    name: "Cat-ear Modern",
    shortName: "Cat-ear",
    color: "#34d399",
    url: new URL("../assets/3d/10.cat-ear modern girl.glb", import.meta.url).href,
    gait: { stride: 1.2, bob: 1.08, sway: 0.96 },
  },
  {
    key: "chibi-town",
    name: "Chibi Town",
    shortName: "Town",
    color: "#facc15",
    url: new URL("../assets/3d/11.chibi town girl.glb", import.meta.url).href,
    gait: { stride: 1.38, bob: 1.22, sway: 0.78 },
  },
  {
    key: "animal-town",
    name: "Town Animal-ear",
    shortName: "Animal-ear",
    color: "#22d3ee",
    url: new URL("../assets/3d/12.town animal-ear girl.glb", import.meta.url).href,
    gait: { stride: 1.15, bob: 0.98, sway: 1.06 },
  },
  {
    key: "beret",
    name: "Beret Onepiece",
    shortName: "Beret",
    color: "#ef4444",
    url: new URL("../assets/3d/13.beret onepiece girl.glb", import.meta.url).href,
    gait: { stride: 0.94, bob: 0.88, sway: 1.18 },
  },
];

const ROOM_SIZE = 90;
const ROOM_HALF = ROOM_SIZE / 2 - 0.8;
const WALL_OFFSET = ROOM_SIZE / 2 + 0.15;
const DOOR_GAP = 3.4;
const COMPANION_COUNT = MODEL_DEFS.length - 1;
const FOLLOW_DELAY = 15;
const MAX_TRAIL = 720;
const START_POSITION = new THREE.Vector3(0, 0, ROOM_HALF - 4);
const EXIT_POSITION = new THREE.Vector3(0, 0, -ROOM_HALF + 0.35);

const FLOOR_THEMES = [
  { floor: 13, floorColor: "#203341", grid: "#38bdf8", wall: "#142431" },
  { floor: 12, floorColor: "#26343b", grid: "#6ee7b7", wall: "#182922" },
  { floor: 11, floorColor: "#322f3f", grid: "#c084fc", wall: "#211c2f" },
  { floor: 10, floorColor: "#383128", grid: "#fbbf24", wall: "#2b2218" },
  { floor: 9, floorColor: "#273846", grid: "#22d3ee", wall: "#172b34" },
  { floor: 8, floorColor: "#392f34", grid: "#fb7185", wall: "#2c1d25" },
  { floor: 7, floorColor: "#26362f", grid: "#34d399", wall: "#16271f" },
  { floor: 6, floorColor: "#373443", grid: "#a78bfa", wall: "#242130" },
  { floor: 5, floorColor: "#3a3228", grid: "#fb923c", wall: "#2a2118" },
  { floor: 4, floorColor: "#293546", grid: "#60a5fa", wall: "#182336" },
  { floor: 3, floorColor: "#353a2a", grid: "#bef264", wall: "#232a18" },
  { floor: 2, floorColor: "#3b2f38", grid: "#f472b6", wall: "#291f28" },
  { floor: 1, floorColor: "#24322f", grid: "#6ee7b7", wall: "#13251f" },
];

const dom = {
  canvas: document.querySelector("#game"),
  floorValue: document.querySelector("#floorValue"),
  friendValue: document.querySelector("#friendValue"),
  nextValue: document.querySelector("#nextValue"),
  rosterList: document.querySelector("#rosterList"),
  motionName: document.querySelector("#motionName"),
  motionState: document.querySelector("#motionState"),
  loading: document.querySelector("#loading"),
  loadingDetail: document.querySelector("#loadingDetail"),
  message: document.querySelector("#message"),
  skipButton: document.querySelector("#skipButton"),
  resetButton: document.querySelector("#resetButton"),
};

const renderer = new THREE.WebGLRenderer({
  canvas: dom.canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#090d12");
scene.fog = new THREE.Fog("#090d12", 28, 130);

const camera = new THREE.PerspectiveCamera(
  43,
  window.innerWidth / window.innerHeight,
  0.1,
  220,
);
camera.position.set(0, 16, 22);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const hemiLight = new THREE.HemisphereLight("#dbeafe", "#172018", 1.75);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight("#ffffff", 3.4);
keyLight.position.set(-24, 34, 24);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 95;
keyLight.shadow.camera.left = -52;
keyLight.shadow.camera.right = 52;
keyLight.shadow.camera.top = 52;
keyLight.shadow.camera.bottom = -52;
scene.add(keyLight);

const fillLight = new THREE.PointLight("#7dd3fc", 38, 70, 1.6);
fillLight.position.set(22, 9, -22);
scene.add(fillLight);

const room = createRoom();
scene.add(room.group);

const loader = new GLTFLoader();
const loadedScenes = new Map();
const actors = [];
const followers = [];
const trail = [];
const keys = new Set();
const pointerTarget = new THREE.Vector3();
const pointerTargetActive = { value: false };
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const clock = new THREE.Clock();

let player = null;
let currentRecruit = null;
let currentFloor = 13;
let exitOpen = false;
let escapeComplete = false;
let loadedCount = 0;
let messageTimeout = null;

init();

async function init() {
  renderRoster();
  bindEvents();

  await loadModels();

  player = createActor(MODEL_DEFS[0], "player");
  player.group.position.copy(START_POSITION);
  scene.add(player.group);
  actors.push(player);

  resetTrail();

  spawnRecruit();
  updateHud();
  dom.loading.classList.add("hidden");
  showMessage("13F");

  renderer.setAnimationLoop(tick);
}

function bindEvents() {
  window.addEventListener("resize", resize);

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    keys.add(key);

    if (key === "n") {
      advanceDebugStep();
    }

    if (key === "r") {
      resetPrototype();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  dom.canvas.addEventListener("pointerdown", setPointerTarget);
  dom.skipButton.addEventListener("click", advanceDebugStep);
  dom.resetButton.addEventListener("click", resetPrototype);
}

async function loadModels() {
  await Promise.all(
    MODEL_DEFS.map(async (def) => {
      const gltf = await loader.loadAsync(def.url);
      loadedScenes.set(def.key, gltf.scene);
      loadedCount += 1;
      dom.loadingDetail.textContent = `${loadedCount} / ${MODEL_DEFS.length}`;
    }),
  );
}

function createActor(def, role) {
  const group = new THREE.Group();
  group.name = `${role}-${def.key}`;

  const motionPivot = new THREE.Group();
  const root = loadedScenes.get(def.key).clone(true);
  normalizeModel(root, role === "player" ? 1.45 : 1.32);
  motionPivot.add(root);
  group.add(motionPivot);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(role === "player" ? 0.58 : 0.5, 32),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(def.color),
      transparent: true,
      opacity: role === "player" ? 0.28 : 0.2,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.014;
  group.add(shadow);

  const actor = {
    def,
    group,
    motionPivot,
    root,
    shadow,
    role,
    phase: Math.random() * Math.PI * 2,
    previousPosition: group.position.clone(),
    velocity: new THREE.Vector3(),
    speed: 0,
    marker: null,
    label: null,
  };

  return actor;
}

function normalizeModel(root, targetHeight) {
  root.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;

    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.needsUpdate = true;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
        }
      });
    }
  });

  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  let size = box.getSize(new THREE.Vector3());

  const horizontalMax = Math.max(size.x, size.z);
  if (size.y < horizontalMax * 0.45) {
    if (size.z >= size.x) {
      root.rotation.x += Math.PI / 2;
    } else {
      root.rotation.z += Math.PI / 2;
    }
    root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root);
    size = box.getSize(new THREE.Vector3());
  }

  const scale = targetHeight / Math.max(size.y, 0.001);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(root);
  const center = scaledBox.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.y -= scaledBox.min.y;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);
}

function createRoom() {
  const group = new THREE.Group();
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: "#203341",
    roughness: 0.64,
    metalness: 0.08,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: "#142431",
    roughness: 0.78,
    metalness: 0.04,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: "#d6f7ff",
    roughness: 0.34,
    metalness: 0.5,
    emissive: "#164e63",
    emissiveIntensity: 0.18,
  });
  const exitMaterial = new THREE.MeshStandardMaterial({
    color: "#26313b",
    roughness: 0.45,
    metalness: 0.36,
    emissive: "#0f172a",
    emissiveIntensity: 0.18,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const grid = new THREE.GridHelper(ROOM_SIZE, ROOM_SIZE, "#38bdf8", "#253244");
  grid.position.y = 0.018;
  grid.material.transparent = true;
  grid.material.opacity = 0.42;
  group.add(grid);

  const makeWall = (name, position, scale) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMaterial);
    wall.name = name;
    wall.position.copy(position);
    wall.scale.copy(scale);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    return wall;
  };

  const wallSpan = ROOM_SIZE + 0.3;
  const sideWall = new THREE.Vector3(0.3, 2.7, wallSpan);
  const northWallSpan = (ROOM_SIZE - DOOR_GAP) / 2;
  const northWallCenterX = DOOR_GAP / 2 + northWallSpan / 2;

  makeWall("west-wall", new THREE.Vector3(-WALL_OFFSET, 1.35, 0), sideWall);
  makeWall("east-wall", new THREE.Vector3(WALL_OFFSET, 1.35, 0), sideWall);
  makeWall("south-wall", new THREE.Vector3(0, 1.35, WALL_OFFSET), new THREE.Vector3(wallSpan, 2.7, 0.3));
  makeWall(
    "north-wall-left",
    new THREE.Vector3(-northWallCenterX, 1.35, -WALL_OFFSET),
    new THREE.Vector3(northWallSpan, 2.7, 0.3),
  );
  makeWall(
    "north-wall-right",
    new THREE.Vector3(northWallCenterX, 1.35, -WALL_OFFSET),
    new THREE.Vector3(northWallSpan, 2.7, 0.3),
  );
  makeWall("north-wall-top", new THREE.Vector3(0, 2.65, -WALL_OFFSET), new THREE.Vector3(DOOR_GAP, 0.35, 0.32));

  const exitGroup = new THREE.Group();
  exitGroup.position.copy(EXIT_POSITION);

  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.35, 0.18), exitMaterial);
  leftDoor.position.set(-0.58, 1.18, -0.24);
  leftDoor.castShadow = true;
  leftDoor.receiveShadow = true;
  exitGroup.add(leftDoor);

  const rightDoor = leftDoor.clone();
  rightDoor.position.x = 0.58;
  exitGroup.add(rightDoor);

  const exitRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.035, 12, 96),
    new THREE.MeshBasicMaterial({
      color: "#64748b",
      transparent: true,
      opacity: 0.62,
    }),
  );
  exitRing.rotation.x = Math.PI / 2;
  exitRing.position.set(0, 0.05, 0.6);
  exitGroup.add(exitRing);

  const header = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.18, 0.18), trimMaterial);
  header.position.set(0, 2.55, -0.2);
  header.castShadow = true;
  exitGroup.add(header);

  group.add(exitGroup);

  const floorSign = createTextSprite("13F", "#6ee7b7", 1.0);
  floorSign.name = "floor-sign";
  floorSign.position.set(0, 2.05, -WALL_OFFSET + 0.29);
  floorSign.scale.set(2.2, 0.7, 1);
  group.add(floorSign);

  return {
    group,
    floor,
    grid,
    wallMaterial,
    floorMaterial,
    exitMaterial,
    exitGroup,
    leftDoor,
    rightDoor,
    exitRing,
    floorSign,
  };
}

function spawnRecruit() {
  if (followers.length >= COMPANION_COUNT) {
    openExit();
    return;
  }

  const def = MODEL_DEFS[followers.length + 1];
  const actor = createActor(def, "waiting");
  const spawn = getRecruitSpawn(followers.length);
  actor.group.position.copy(spawn);
  actor.group.rotation.y = Math.atan2(-spawn.x, -spawn.z);

  const marker = createRecruitMarker(def.color);
  actor.marker = marker;
  actor.group.add(marker);

  const label = createTextSprite(def.shortName, def.color, 0.8);
  label.position.set(0, 1.82, 0);
  label.scale.set(1.55, 0.42, 1);
  actor.label = label;
  actor.group.add(label);

  currentRecruit = actor;
  actors.push(actor);
  scene.add(actor.group);
  updateHud();
}

function getRecruitSpawn(index) {
  const points = [
    new THREE.Vector3(-28, 0, -30),
    new THREE.Vector3(24, 0, -26),
    new THREE.Vector3(-32, 0, 2),
    new THREE.Vector3(31, 0, 8),
    new THREE.Vector3(0, 0, -34),
    new THREE.Vector3(-22, 0, 26),
    new THREE.Vector3(26, 0, 28),
    new THREE.Vector3(-12, 0, -18),
    new THREE.Vector3(14, 0, -14),
    new THREE.Vector3(-34, 0, 22),
    new THREE.Vector3(36, 0, -4),
    new THREE.Vector3(0, 0, 31),
  ];
  return points[index % points.length].clone();
}

function createRecruitMarker(color) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.03, 10, 80),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.76,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  group.add(ring);

  const halo = new THREE.PointLight(color, 2.3, 4.2, 1.7);
  halo.position.y = 1.15;
  group.add(halo);

  return group;
}

function createTextSprite(text, color, opacity = 0.9) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(5, 8, 12, 0.68)";
  roundRect(context, 24, 28, 464, 104, 22);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = "#f7fafc";
  context.font = "700 56px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 82, 420);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.Sprite(material);
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;

  if (player && !escapeComplete) {
    updatePlayer(dt);
    updateTrail();
    updateFollowers(dt);
    checkRecruitCollision();
    checkExitCollision();
  }

  updateRecruitIdle(elapsed, dt);
  updateExit(elapsed, dt);
  updateActors(dt, elapsed);
  updateCamera(dt);

  renderer.render(scene, camera);
}

function updatePlayer(dt) {
  const direction = new THREE.Vector3();
  const up = keys.has("w") || keys.has("arrowup");
  const down = keys.has("s") || keys.has("arrowdown");
  const left = keys.has("a") || keys.has("arrowleft");
  const right = keys.has("d") || keys.has("arrowright");

  if (up) direction.z -= 1;
  if (down) direction.z += 1;
  if (left) direction.x -= 1;
  if (right) direction.x += 1;

  if (direction.lengthSq() > 0) {
    pointerTargetActive.value = false;
    direction.normalize();
  } else if (pointerTargetActive.value) {
    direction.copy(pointerTarget).sub(player.group.position);
    direction.y = 0;

    if (direction.length() < 0.12) {
      pointerTargetActive.value = false;
      direction.set(0, 0, 0);
    } else {
      direction.normalize();
    }
  }

  const speed = keys.has("shift") ? 11 : 6.8;
  player.group.position.addScaledVector(direction, speed * dt);
  clampToRoom(player.group.position, ROOM_HALF);
}

function updateTrail() {
  trail.unshift(player.group.position.clone());
  if (trail.length > MAX_TRAIL) {
    trail.length = MAX_TRAIL;
  }
}

function updateFollowers(dt) {
  followers.forEach((follower, index) => {
    const targetIndex = Math.min((index + 1) * FOLLOW_DELAY, trail.length - 1);
    const target = trail[targetIndex];
    const toTarget = target.clone().sub(follower.group.position);
    toTarget.y = 0;
    const distance = toTarget.length();

    if (distance > 0.035) {
      const speed = 3.0 + index * 0.045;
      const step = Math.min(distance, speed * dt);
      follower.group.position.addScaledVector(toTarget.normalize(), step);
    }
  });
}

function updateRecruitIdle(elapsed, dt) {
  if (!currentRecruit) {
    return;
  }

  currentRecruit.group.rotation.y += 0.22 * dt;

  if (currentRecruit.marker) {
    currentRecruit.marker.rotation.y = elapsed * 1.7;
    currentRecruit.marker.scale.setScalar(1 + Math.sin(elapsed * 3.3) * 0.035);
  }
}

function updateExit(elapsed, dt) {
  const openAmount = exitOpen ? 1 : 0;
  room.leftDoor.position.x = THREE.MathUtils.damp(room.leftDoor.position.x, -1.18 * openAmount - 0.58, 6, dt);
  room.rightDoor.position.x = THREE.MathUtils.damp(room.rightDoor.position.x, 1.18 * openAmount + 0.58, 6, dt);

  if (exitOpen) {
    room.exitRing.material.color.set("#6ee7b7");
    room.exitRing.material.opacity = 0.72 + Math.sin(elapsed * 5) * 0.12;
    room.exitMaterial.emissive.set("#10b981");
    room.exitMaterial.emissiveIntensity = 0.45 + Math.sin(elapsed * 3) * 0.12;
  } else {
    room.exitRing.material.color.set("#64748b");
    room.exitRing.material.opacity = 0.5;
    room.exitMaterial.emissive.set("#0f172a");
    room.exitMaterial.emissiveIntensity = 0.18;
  }
}

function updateActors(dt, elapsed) {
  let fastest = player;

  actors.forEach((actor) => {
    actor.velocity.copy(actor.group.position).sub(actor.previousPosition);
    actor.speed = actor.velocity.length() / Math.max(dt, 0.001);
    actor.previousPosition.copy(actor.group.position);

    const moving = actor.speed > 0.08 || actor.role === "waiting";
    const gait = actor.def.gait;
    const stride = elapsed * (7.4 * gait.stride) + actor.phase;
    const moveWeight = actor.role === "waiting" ? 0.38 : Math.min(actor.speed / 2.6, 1);
    const bob = Math.abs(Math.sin(stride)) * 0.072 * gait.bob * moveWeight;
    const idleBob = Math.sin(elapsed * 2.1 + actor.phase) * 0.018;

    actor.motionPivot.position.y = moving ? bob + idleBob : idleBob;
    actor.motionPivot.rotation.z = Math.sin(stride) * 0.075 * gait.sway * moveWeight;
    actor.motionPivot.rotation.x = Math.cos(stride * 0.5) * 0.035 * moveWeight;

    const shadowScale = 1 + Math.sin(stride) * 0.03 * moveWeight;
    actor.shadow.scale.set(shadowScale, shadowScale, shadowScale);

    if (actor.speed > 0.08 && actor.role !== "waiting") {
      const yaw = Math.atan2(actor.velocity.x, actor.velocity.z);
      actor.group.rotation.y = dampAngle(actor.group.rotation.y, yaw, 12, dt);
    }

    if (actor !== currentRecruit && actor.speed > fastest.speed) {
      fastest = actor;
    }
  });

  dom.motionName.textContent = fastest.def.name;
  dom.motionState.textContent = fastest.speed > 0.08 ? "walk" : "idle";
}

function updateCamera(dt) {
  if (!player) {
    return;
  }

  const target = player.group.position;
  const offset = window.innerWidth < 760
    ? new THREE.Vector3(0, 14, 20)
    : new THREE.Vector3(0, 16, 22);
  const desiredPosition = target.clone().add(offset);
  camera.position.lerp(desiredPosition, 1 - Math.exp(-4.3 * dt));
  camera.lookAt(target.x, 0.95, target.z - 0.8);
}

function checkRecruitCollision() {
  if (!currentRecruit) {
    return;
  }

  const distance = player.group.position.distanceTo(currentRecruit.group.position);
  if (distance < 1.05) {
    recruitCurrent();
  }
}

function recruitCurrent() {
  if (!currentRecruit || escapeComplete) {
    return;
  }

  const recruited = currentRecruit;
  currentRecruit = null;
  recruited.role = "follower";

  if (recruited.marker) {
    recruited.group.remove(recruited.marker);
    recruited.marker = null;
  }

  if (recruited.label) {
    recruited.group.remove(recruited.label);
    disposeSprite(recruited.label);
    recruited.label = null;
  }

  followers.push(recruited);
  renderRoster();
  openExit();
}

function openExit() {
  if (exitOpen) {
    return;
  }

  exitOpen = true;
  updateHud();
  showMessage(currentFloor === 1 ? "출구 개방" : "문 열림");
}

function checkExitCollision() {
  if (!exitOpen || escapeComplete) {
    return;
  }

  const position = player.group.position;
  const reachedExitRing = position.z < EXIT_POSITION.z + 3 && Math.abs(position.x) < 2.4;
  const reachedDoorway = position.distanceTo(EXIT_POSITION) < 2.25;

  if (reachedExitRing || reachedDoorway) {
    completeDoorTransition();
  }
}

function advanceDebugStep() {
  if (currentRecruit) {
    recruitCurrent();
    return;
  }

  if (exitOpen) {
    completeDoorTransition();
  }
}

function completeDoorTransition() {
  if (!exitOpen || escapeComplete) {
    return;
  }

  pointerTargetActive.value = false;

  if (currentFloor <= 1) {
    escapeComplete = true;
    updateHud();
    showMessage("탈출 완료", 2800);
    return;
  }

  currentFloor -= 1;
  exitOpen = followers.length >= COMPANION_COUNT && currentFloor === 1;
  applyFloorTheme();
  placePartyAtStart();
  updateHud();
  showMessage(`${currentFloor}F`);

  if (!exitOpen) {
    window.setTimeout(() => {
      if (!escapeComplete && !currentRecruit) {
        spawnRecruit();
      }
    }, 420);
  }
}

function applyFloorTheme() {
  const theme = FLOOR_THEMES.find((item) => item.floor === currentFloor) ?? FLOOR_THEMES.at(-1);
  room.floorMaterial.color.set(theme.floorColor);
  room.wallMaterial.color.set(theme.wall);
  room.grid.material.color.set(theme.grid);
  room.floorSign.material.map.dispose();
  const newSign = createTextSprite(`${currentFloor}F`, theme.grid, 1);
  room.floorSign.material.map = newSign.material.map;
  room.floorSign.material.needsUpdate = true;
  newSign.material.dispose();
}

function updateHud() {
  dom.floorValue.textContent = `${currentFloor}F`;
  dom.friendValue.textContent = `${followers.length} / ${COMPANION_COUNT}`;
  if (escapeComplete) {
    dom.nextValue.textContent = "탈출 완료";
  } else if (currentRecruit) {
    dom.nextValue.textContent = currentRecruit.def.name;
  } else if (exitOpen && currentFloor === 1) {
    dom.nextValue.textContent = "출구";
  } else if (exitOpen) {
    dom.nextValue.textContent = "문으로 이동";
  } else {
    const next = MODEL_DEFS[followers.length + 1];
    dom.nextValue.textContent = next ? next.name : "출구";
  }
}

function renderRoster() {
  dom.rosterList.replaceChildren();
  MODEL_DEFS.slice(1).forEach((def, index) => {
    const row = document.createElement("div");
    row.className = `roster-item${index < followers.length ? " active" : ""}`;
    row.style.setProperty("--swatch", def.color);

    const swatch = document.createElement("span");
    swatch.className = "roster-swatch";
    row.append(swatch);

    const name = document.createElement("span");
    name.className = "roster-name";
    name.textContent = def.name;
    row.append(name);

    const floor = document.createElement("span");
    floor.className = "roster-floor";
    floor.textContent = `${13 - index}F`;
    row.append(floor);

    dom.rosterList.append(row);
  });
}

function showMessage(text, duration = 1250) {
  dom.message.textContent = text;
  dom.message.classList.remove("hidden");
  window.clearTimeout(messageTimeout);
  messageTimeout = window.setTimeout(() => {
    dom.message.classList.add("hidden");
  }, duration);
}

function setPointerTarget(event) {
  const bounds = dom.canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);

  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    clampToRoom(hit, ROOM_HALF);
    pointerTarget.copy(hit);
    pointerTargetActive.value = true;
  }
}

function clampToRoom(position, limit) {
  position.x = THREE.MathUtils.clamp(position.x, -limit, limit);
  position.z = THREE.MathUtils.clamp(position.z, -limit, limit);
  position.y = 0;
}

function placePartyAtStart() {
  player.group.position.copy(START_POSITION);
  player.group.rotation.y = Math.PI;
  player.previousPosition.copy(START_POSITION);

  followers.forEach((follower, index) => {
    const column = (index % 5) - 2;
    const row = Math.floor(index / 5) + 1;
    follower.group.position.set(column * 0.78, 0, START_POSITION.z + row * 1.25);
    clampToRoom(follower.group.position, ROOM_HALF);
    follower.group.rotation.y = Math.PI;
    follower.previousPosition.copy(follower.group.position);
  });

  resetTrail();
}

function resetTrail() {
  trail.splice(0);
  for (let i = 0; i < MAX_TRAIL; i += 1) {
    trail.push(player.group.position.clone());
  }
}

function resetPrototype() {
  pointerTargetActive.value = false;
  exitOpen = false;
  escapeComplete = false;
  currentFloor = 13;

  actors.splice(0).forEach((actor) => {
    scene.remove(actor.group);
    disposeActor(actor);
  });
  followers.splice(0);
  trail.splice(0);

  player = createActor(MODEL_DEFS[0], "player");
  player.group.position.copy(START_POSITION);
  scene.add(player.group);
  actors.push(player);

  resetTrail();

  currentRecruit = null;
  room.leftDoor.position.x = -0.58;
  room.rightDoor.position.x = 0.58;
  applyFloorTheme();
  renderRoster();
  spawnRecruit();
  updateHud();
  showMessage("13F");
}

function disposeActor(actor) {
  actor.shadow.geometry.dispose();
  actor.shadow.material.dispose();

  if (actor.marker) {
    disposeObject(actor.marker);
  }

  if (actor.label) {
    disposeSprite(actor.label);
  }
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material?.dispose?.());
    }

    if (child.isSprite) {
      disposeSprite(child);
    }
  });
}

function disposeSprite(sprite) {
  sprite.material.map?.dispose();
  sprite.material.dispose();
}

function dampAngle(current, target, lambda, dt) {
  const fullTurn = Math.PI * 2;
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, fullTurn) - Math.PI;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
