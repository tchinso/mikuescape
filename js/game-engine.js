(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};
    const C = ns.Config;
    const P = ns.Palette;
    const Perf = ns.Perf;

    class GameEngine {
        constructor() {
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;
            this.mapCamera = null;
            this.clock = new THREE.Clock();
            this.ui = null;
            this.collision = null;
            this.world = null;
            this.player = null;
            this.monsters = null;
            this.viewportW = window.innerWidth;
            this.viewportH = window.innerHeight;
            this.baseDpr = Math.min(window.devicePixelRatio || 1, Perf.maxDpr);
            this.renderDpr = this.baseDpr;
            this.minRenderDpr = 0.75;
            this.minimapViewport = { x: 0, y: 0, w: 0, h: 0 };
            this.gameActive = false;
            this.lastFrameNow = 0;
            this.fpsSmoothed = 0;
            this.lastFpsHudNow = 0;
            this.lastScaleNow = 0;
            this.dragLook = false;
            this.lookYaw = 0;
            this.lookPitch = 0;
            this.lastMouseX = null;
            this.lastMouseY = null;
            this.touchLook = { x: 0, y: 0, active: false };
        }

        init() {
            this.ui = new ns.UIEngine();
            this.scene = new THREE.Scene();
            this.scene.background = P.sky;
            this.scene.fog = new THREE.Fog(0xbfd9ff, 145, C.viewDistance * 0.94);

            this.camera = new THREE.PerspectiveCamera(64, this.viewportW / this.viewportH, 0.1, 1500);

            const fs = C.minimapCamSize;
            this.mapCamera = new THREE.OrthographicCamera(fs / -2, fs / 2, fs / 2, fs / -2, 1, 1200);
            this.mapCamera.up.set(0, 0, -1);

            this.renderer = new THREE.WebGLRenderer({
                antialias: Perf.antialias,
                alpha: false,
                powerPreference: "high-performance"
            });
            this.renderer.setPixelRatio(this.renderDpr);
            this.renderer.setSize(this.viewportW, this.viewportH);
            this.renderer.shadowMap.enabled = false;
            this.renderer.shadowMap.type = Perf.shadowType;
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.2;
            this.renderer.autoClear = false;
            document.body.appendChild(this.renderer.domElement);

            this.controls = new THREE.PointerLockControls(this.camera, document.body);
            this.setupControls();
            this.setupLights();

            this.collision = new ns.CollisionEngine(C);
            this.world = new ns.MapEngine(this.scene, this.collision).build();
            this.player = new ns.PlayerEngine(this.camera, this.controls, this.world, this.collision, this.ui);
            this.monsters = new ns.MonsterEngine(this.scene, this.world, this.player, this.ui);
            this.applyInitialSpawn();
            this.syncLookFromCamera();
            this.setupDragLook();
            this.setupCombatInput();

            this.updateMinimapViewportCache();
            window.addEventListener("resize", () => this.onResize());
            requestAnimationFrame((now) => this.animate(now));
        }

        setupControls() {
            this.ui.dom.startBtn.addEventListener("click", () => {
                this.startExploration();
            });

            this.controls.addEventListener("lock", () => {
                this.ui.hidePause();
                this.gameActive = true;
                this.clock.getDelta();
            });

            this.controls.addEventListener("unlock", () => {
                if (this.player && this.player.fallbackActive) return;
                if (!this.ui.dialogVisible) {
                    this.ui.showPause();
                }
                this.gameActive = false;
            });
        }

        startExploration() {
            this.startFallbackExploration();
        }

        startFallbackExploration() {
            if (this.player) this.player.setFallbackActive(true);
            this.ui.hidePause();
            this.gameActive = true;
            this.clock.getDelta();
        }

        canUsePointerLock() {
            if (!document.body || !document.body.requestPointerLock) return false;
            try {
                if (window.self !== window.top) return false;
            } catch (error) {
                return false;
            }
            return true;
        }

        applyInitialSpawn() {
            const params = new URLSearchParams(window.location.search);
            const spawn = (params.get("spawn") || "school").toLowerCase();
            const points = {
                school: { x: -166, z: -28, lookX: -166, lookZ: -158 },
                capital: { x: 158, z: -82, lookX: 158, lookZ: -226 },
                shopping: { x: -214, z: 54, lookX: -172, lookZ: 22 },
                residential: { x: 28, z: 110, lookX: 28, lookZ: 30 },
                port: { x: 178, z: 174, lookX: 184, lookZ: 236 }
            };

            if (spawn === "sea") {
                this.player.state.hasBoat = true;
                this.player.state.onBoat = true;
                this.player.state.boatDock = null;
                this.ui.setBoatStatus("승선 중");
                this.camera.position.set(266, C.waterLevel + C.boatEyeHeight, 286);
                this.camera.lookAt(204, C.waterLevel + C.boatEyeHeight - 1.2, 226);
                return;
            }

            const point = points[spawn] || points.school;
            this.player.placeAt(point.x, point.z);
            this.camera.lookAt(point.lookX, this.camera.position.y - 1.2, point.lookZ);
        }

        syncLookFromCamera() {
            this.camera.rotation.order = "YXZ";
            this.lookYaw = this.camera.rotation.y;
            this.lookPitch = this.camera.rotation.x;
        }

        setupDragLook() {
            const canvas = this.renderer.domElement;
            canvas.addEventListener("pointerdown", (event) => {
                if (event.pointerType !== "touch") return;
                if (!this.gameActive || this.ui.dialogVisible || this.controls.isLocked) return;
                this.dragLook = true;
                if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
            });

            window.addEventListener("pointerup", (event) => {
                if (event.pointerType === "touch") this.dragLook = false;
            });

            window.addEventListener("pointermove", (event) => {
                if (!this.gameActive || this.ui.dialogVisible || this.controls.isLocked) return;
                if (event.pointerType === "touch" && !this.dragLook) return;

                let dx = event.movementX || 0;
                let dy = event.movementY || 0;
                if (event.pointerType === "mouse") {
                    if (this.lastMouseX === null || this.lastMouseY === null) {
                        this.lastMouseX = event.clientX;
                        this.lastMouseY = event.clientY;
                        return;
                    }
                    dx = event.clientX - this.lastMouseX;
                    dy = event.clientY - this.lastMouseY;
                    this.lastMouseX = event.clientX;
                    this.lastMouseY = event.clientY;
                }

                this.lookYaw -= dx * 0.003;
                this.lookPitch -= dy * 0.003;
                this.lookPitch = ns.clamp(this.lookPitch, -1.05, 0.72);
                this.camera.rotation.set(this.lookPitch, this.lookYaw, 0, "YXZ");
            });

            window.addEventListener("pointerleave", (event) => {
                if (event.pointerType === "mouse") {
                    this.lastMouseX = null;
                    this.lastMouseY = null;
                }
            });

            window.addEventListener("keydown", (event) => {
                if (!this.gameActive || this.ui.dialogVisible || this.controls.isLocked) return;
                const turn = 0.08;
                if (event.code === "ArrowLeft") this.lookYaw += turn;
                if (event.code === "ArrowRight") this.lookYaw -= turn;
                if (event.code === "ArrowUp") this.lookPitch = ns.clamp(this.lookPitch - turn, -1.05, 0.72);
                if (event.code === "ArrowDown") this.lookPitch = ns.clamp(this.lookPitch + turn, -1.05, 0.72);
                this.camera.rotation.set(this.lookPitch, this.lookYaw, 0, "YXZ");
            });
        }

        setupCombatInput() {
            const canvas = this.renderer.domElement;
            canvas.addEventListener("pointerdown", (event) => {
                if (event.button !== 0) return;
                if (event.pointerType === "touch") return;
                if (!this.gameActive || this.ui.dialogVisible) return;
                this.player.shoot(this.monsters);
            });

            window.addEventListener("keydown", (event) => {
                if (event.code !== "KeyF") return;
                if (!this.gameActive || this.ui.dialogVisible) return;
                event.preventDefault();
                this.player.shoot(this.monsters);
            });

            const fireBtn = document.getElementById("touch-fire");
            if (fireBtn) {
                fireBtn.addEventListener("pointerdown", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!this.gameActive || this.ui.dialogVisible) return;
                    this.player.shoot(this.monsters);
                });
            }

            this.setupTouchJoysticks();
        }

        setupTouchJoysticks() {
            const moveJoy = document.getElementById("move-joystick");
            const lookJoy = document.getElementById("look-joystick");
            if (!moveJoy || !lookJoy) return;

            this.bindJoystick(moveJoy, (x, y) => {
                this.player.setVirtualMove(x, y);
            }, () => {
                this.player.setVirtualMove(0, 0);
            });

            this.bindJoystick(lookJoy, (x, y) => {
                this.touchLook.x = x;
                this.touchLook.y = y;
                this.touchLook.active = Math.abs(x) > 0.04 || Math.abs(y) > 0.04;
            }, () => {
                this.touchLook.x = 0;
                this.touchLook.y = 0;
                this.touchLook.active = false;
            });
        }

        bindJoystick(root, onMove, onEnd) {
            const knob = root.querySelector(".joystick-knob");
            const state = { pointerId: null };
            const radius = 42;

            const reset = () => {
                state.pointerId = null;
                if (knob) knob.style.transform = "translate(-50%, -50%)";
                onEnd();
            };

            const update = (event) => {
                const rect = root.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const rawX = event.clientX - cx;
                const rawY = event.clientY - cy;
                const len = Math.max(1, Math.sqrt(rawX * rawX + rawY * rawY));
                const limited = Math.min(radius, len);
                const knobX = rawX / len * limited;
                const knobY = rawY / len * limited;
                if (knob) knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
                onMove(knobX / radius, -knobY / radius);
            };

            root.addEventListener("pointerdown", (event) => {
                if (!this.gameActive || this.ui.dialogVisible) return;
                event.preventDefault();
                event.stopPropagation();
                state.pointerId = event.pointerId;
                if (root.setPointerCapture) root.setPointerCapture(event.pointerId);
                update(event);
            });

            root.addEventListener("pointermove", (event) => {
                if (state.pointerId !== event.pointerId) return;
                event.preventDefault();
                event.stopPropagation();
                update(event);
            });

            root.addEventListener("pointerup", (event) => {
                if (state.pointerId !== event.pointerId) return;
                event.preventDefault();
                event.stopPropagation();
                reset();
            });

            root.addEventListener("pointercancel", (event) => {
                if (state.pointerId !== event.pointerId) return;
                reset();
            });
        }

        updateTouchLook(dt) {
            if (!this.touchLook.active || this.controls.isLocked) return;
            const turnSpeed = 2.35;
            this.lookYaw -= this.touchLook.x * turnSpeed * dt;
            this.lookPitch += this.touchLook.y * turnSpeed * dt;
            this.lookPitch = ns.clamp(this.lookPitch, -1.05, 0.72);
            this.camera.rotation.set(this.lookPitch, this.lookYaw, 0, "YXZ");
        }

        setupLights() {
            const ambient = new THREE.AmbientLight(0xfff4df, 0.38);
            this.scene.add(ambient);

            const hemi = new THREE.HemisphereLight(0xcfeaff, 0x6c4f7b, 0.82);
            hemi.position.set(0, 260, 0);
            this.scene.add(hemi);

            const sun = new THREE.DirectionalLight(0xffedc5, 1.55);
            sun.position.set(-210, 360, 250);
            sun.castShadow = true;
            sun.shadow.mapSize.width = Perf.shadowMapSize;
            sun.shadow.mapSize.height = Perf.shadowMapSize;
            const d = 470;
            sun.shadow.camera.left = -d;
            sun.shadow.camera.right = d;
            sun.shadow.camera.top = d;
            sun.shadow.camera.bottom = -d;
            sun.shadow.camera.near = 1;
            sun.shadow.camera.far = 900;
            sun.shadow.bias = -0.00008;
            this.scene.add(sun);

            const moon = new THREE.DirectionalLight(0x8db7ff, 0.48);
            moon.position.set(280, 220, -260);
            this.scene.add(moon);

            const roseFill = new THREE.PointLight(0xff8bd6, 0.42, 460, 2);
            roseFill.position.set(-120, 80, 40);
            this.scene.add(roseFill);

            const aquaFill = new THREE.PointLight(0x6eefff, 0.36, 520, 2);
            aquaFill.position.set(210, 70, 130);
            this.scene.add(aquaFill);
        }

        updateMinimapViewportCache() {
            this.viewportW = window.innerWidth;
            this.viewportH = window.innerHeight;
            const rect = this.ui.dom.minimapContainer.getBoundingClientRect();
            this.minimapViewport.x = rect.left;
            this.minimapViewport.y = this.viewportH - rect.bottom;
            this.minimapViewport.w = rect.width;
            this.minimapViewport.h = rect.height;
        }

        onResize() {
            this.updateMinimapViewportCache();
            this.camera.aspect = this.viewportW / this.viewportH;
            this.camera.updateProjectionMatrix();
            this.baseDpr = Math.min(window.devicePixelRatio || 1, Perf.maxDpr);
            this.renderDpr = Math.min(this.renderDpr, this.baseDpr);
            this.applyRenderScale();
        }

        applyRenderScale() {
            this.renderer.setPixelRatio(this.renderDpr);
            this.renderer.setSize(this.viewportW, this.viewportH);
        }

        animate(now) {
            requestAnimationFrame((next) => this.animate(next));
            const dt = Math.min(this.clock.getDelta(), 0.05);
            const time = this.clock.getElapsedTime();

            this.updateFpsAndScale(now);
            this.ui.update(dt);

            if (this.gameActive) {
                this.updateTouchLook(dt);
                this.player.update(dt);
                this.monsters.update(dt);
            } else {
                this.player.updateHud();
            }

            if (this.monsters) {
                this.ui.setMonsterMarkers(this.monsters.monsters, this.camera.position, C.minimapCamSize);
            }

            this.world.updateAnimated(time, this.camera, this.player.state);
            this.render();
        }

        updateFpsAndScale(now) {
            if (!now) return;
            if (!this.lastFrameNow) {
                this.lastFrameNow = now;
                this.lastFpsHudNow = now;
                this.lastScaleNow = now;
                return;
            }

            const delta = now - this.lastFrameNow;
            this.lastFrameNow = now;
            if (delta <= 0) return;

            const fps = 1000 / delta;
            this.fpsSmoothed = this.fpsSmoothed ? this.fpsSmoothed * 0.9 + fps * 0.1 : fps;

            if (now - this.lastFpsHudNow >= 250) {
                this.ui.setFps(this.fpsSmoothed);
                this.lastFpsHudNow = now;
            }

            if (!this.gameActive) return;
            if (now - this.lastScaleNow < 1000) return;

            if (this.fpsSmoothed < 48 && this.renderDpr > this.minRenderDpr) {
                this.renderDpr = Math.max(this.minRenderDpr, Math.round((this.renderDpr - 0.1) * 100) / 100);
                this.applyRenderScale();
            } else if (this.fpsSmoothed > 58 && this.renderDpr < this.baseDpr) {
                this.renderDpr = Math.min(this.baseDpr, Math.round((this.renderDpr + 0.1) * 100) / 100);
                this.applyRenderScale();
            }
            this.lastScaleNow = now;
        }

        render() {
            this.renderer.setViewport(0, 0, this.viewportW, this.viewportH);
            this.renderer.setScissor(0, 0, this.viewportW, this.viewportH);
            this.renderer.setScissorTest(true);
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);

            this.renderer.setViewport(this.minimapViewport.x, this.minimapViewport.y, this.minimapViewport.w, this.minimapViewport.h);
            this.renderer.setScissor(this.minimapViewport.x, this.minimapViewport.y, this.minimapViewport.w, this.minimapViewport.h);
            this.renderer.clearDepth();

            this.mapCamera.position.set(this.camera.position.x, 280, this.camera.position.z);
            this.mapCamera.lookAt(this.camera.position.x, 0, this.camera.position.z);
            this.renderer.render(this.scene, this.mapCamera);
            this.renderer.setScissorTest(false);
        }
    }

    const game = new GameEngine();
    ns.game = game;
    game.init();
})();
