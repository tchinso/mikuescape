(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};

    class UIEngine {
        constructor() {
            this.dom = {
                hpBar: document.getElementById("hp-bar"),
                hp: document.getElementById("hp-display"),
                staminaBar: document.getElementById("stamina-bar"),
                location: document.getElementById("location-display"),
                pos: document.getElementById("pos-display"),
                gold: document.getElementById("gold-display"),
                ammo: document.getElementById("ammo-display"),
                cargo: document.getElementById("cargo-display"),
                gear: document.getElementById("gear-display"),
                boat: document.getElementById("boat-display"),
                minimapArrow: document.getElementById("minimap-arrow"),
                minimapContainer: document.getElementById("minimap-container"),
                monsterMinimapLayer: document.getElementById("monster-minimap-layer"),
                fpsHud: document.getElementById("fps-hud"),
                pauseMenu: document.getElementById("pause-menu"),
                startBtn: document.getElementById("start-btn"),
                prompt: document.getElementById("interaction-prompt"),
                toast: document.getElementById("toast"),
                dialog: document.getElementById("dialog"),
                dialogTitle: document.getElementById("dialog-title"),
                dialogBody: document.getElementById("dialog-body"),
                dialogMenu: document.getElementById("dialog-menu")
            };

            this.toastTimer = 0;
            this.dialogVisible = false;
            this.lastStamina = -1;
            this.lastHp = "";
            this.lastAmmo = "";
            this.lastCargo = "";
            this.lastGear = "";
            this.lastLocation = "";
            this.lastBoat = "";
            this.monsterDots = [];
        }

        setGold(value) {
            this.dom.gold.textContent = ns.formatGold(value);
        }

        setHp(value, maxValue) {
            const hp = Math.max(0, Math.ceil(value));
            const maxHp = Math.max(1, Math.ceil(maxValue));
            const text = `${hp} / ${maxHp}`;
            if (text === this.lastHp) return;
            this.lastHp = text;
            this.dom.hp.textContent = text;
            this.dom.hpBar.style.width = `${ns.clamp((hp / maxHp) * 100, 0, 100)}%`;
        }

        setAmmo(value) {
            const text = `${Math.max(0, Math.floor(value))}`;
            if (text === this.lastAmmo) return;
            this.lastAmmo = text;
            this.dom.ammo.textContent = text;
        }

        setCargo(count, capacity) {
            const text = `${count} / ${capacity}`;
            if (text === this.lastCargo) return;
            this.lastCargo = text;
            this.dom.cargo.textContent = text;
        }

        setGear(text) {
            if (text === this.lastGear) return;
            this.lastGear = text;
            this.dom.gear.textContent = text;
        }

        setBoatStatus(text) {
            if (text === this.lastBoat) return;
            this.lastBoat = text;
            this.dom.boat.textContent = text;
        }

        setLocation(text) {
            if (text === this.lastLocation) return;
            this.lastLocation = text;
            this.dom.location.textContent = text;
        }

        setPosition(x, z) {
            this.dom.pos.textContent = `${Math.round(x)}, ${Math.round(z)}`;
        }

        setStamina(value) {
            const rounded = Math.round(value);
            if (rounded === this.lastStamina) return;
            this.lastStamina = rounded;
            this.dom.staminaBar.style.width = `${rounded}%`;
        }

        setFps(value) {
            this.dom.fpsHud.textContent = `${Math.round(value)} FPS`;
        }

        setDirection(angleRadians) {
            const deg = -angleRadians * (180 / Math.PI);
            this.dom.minimapArrow.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
        }

        setMonsterMarkers(monsters, playerPos, minimapSize) {
            const layer = this.dom.monsterMinimapLayer;
            const rect = this.dom.minimapContainer.getBoundingClientRect();
            if (!layer || !rect.width || !playerPos) return;

            const size = minimapSize || 430;
            const halfWorld = size / 2;
            const radiusPx = Math.min(rect.width, rect.height) / 2;
            let visibleCount = 0;

            for (let i = 0; i < monsters.length; i++) {
                const monster = monsters[i];
                if (!monster || monster.dead) continue;

                const dx = monster.x - playerPos.x;
                const dz = monster.z - playerPos.z;
                if (Math.abs(dx) > halfWorld || Math.abs(dz) > halfWorld) continue;

                const px = rect.width / 2 + (dx / size) * rect.width;
                const py = rect.height / 2 + (dz / size) * rect.height;
                const circleDx = px - rect.width / 2;
                const circleDy = py - rect.height / 2;
                if (circleDx * circleDx + circleDy * circleDy > radiusPx * radiusPx) continue;

                const dot = this.ensureMonsterDot(visibleCount);
                dot.className = `monster-dot ${monster.type || "normal"}`;
                dot.style.left = `${px}px`;
                dot.style.top = `${py}px`;
                dot.style.display = "block";
                visibleCount += 1;
            }

            for (let i = visibleCount; i < this.monsterDots.length; i++) {
                this.monsterDots[i].style.display = "none";
            }
        }

        ensureMonsterDot(index) {
            if (this.monsterDots[index]) return this.monsterDots[index];
            const dot = document.createElement("div");
            dot.className = "monster-dot";
            dot.style.display = "none";
            this.dom.monsterMinimapLayer.appendChild(dot);
            this.monsterDots[index] = dot;
            return dot;
        }

        showInteraction(label) {
            if (this.dialogVisible) {
                this.hideInteraction();
                return;
            }
            this.dom.prompt.textContent = `E  ${label}`;
            this.dom.prompt.classList.add("visible");
        }

        hideInteraction() {
            this.dom.prompt.classList.remove("visible");
        }

        showToast(message, duration) {
            this.dom.toast.textContent = message;
            this.dom.toast.classList.add("visible");
            this.toastTimer = duration || 1.8;
        }

        update(dt) {
            if (this.toastTimer > 0) {
                this.toastTimer -= dt;
                if (this.toastTimer <= 0) {
                    this.dom.toast.classList.remove("visible");
                }
            }
        }

        showDialog(data) {
            this.dialogVisible = true;
            this.dom.dialogTitle.textContent = data.title || "장소";
            this.dom.dialogBody.textContent = data.body || "";
            this.dom.dialogMenu.innerHTML = "";

            const items = data.items || [];
            for (let i = 0; i < items.length; i++) {
                const item = typeof items[i] === "string" ? { label: items[i] } : items[i];
                const li = document.createElement("li");
                li.textContent = item.label || "";
                if (item.disabled) li.classList.add("disabled");
                if (item.action && !item.disabled) {
                    li.addEventListener("pointerdown", (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        item.action();
                    });
                }
                this.dom.dialogMenu.appendChild(li);
            }

            this.dom.dialog.classList.add("visible");
            this.hideInteraction();
        }

        hideDialog() {
            this.dialogVisible = false;
            this.dom.dialog.classList.remove("visible");
        }

        showPause() {
            this.dom.pauseMenu.style.display = "flex";
            window.setTimeout(() => {
                this.dom.pauseMenu.style.opacity = 1;
            }, 10);
        }

        hidePause() {
            this.dom.pauseMenu.style.opacity = 0;
            window.setTimeout(() => {
                this.dom.pauseMenu.style.display = "none";
            }, 260);
        }
    }

    UIEngine.prototype.showDialog = function (data) {
        this.dialogVisible = true;
        this.dom.dialogTitle.textContent = data.title || "장소";
        this.dom.dialogBody.textContent = data.body || "";
        this.dom.dialogMenu.innerHTML = "";

        const items = data.items || [];
        for (let i = 0; i < items.length; i++) {
            const item = typeof items[i] === "string" ? { label: items[i] } : items[i];
            const li = document.createElement("li");
            li.textContent = item.label || "";
            if (item.disabled) li.classList.add("disabled");
            if (item.action && !item.disabled) {
                li.addEventListener("pointerdown", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    item.action();
                });
            }
            this.dom.dialogMenu.appendChild(li);
        }

        this.dom.dialog.classList.add("visible");
        this.hideInteraction();
    };

    ns.UIEngine = UIEngine;
})();
