(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};
    const C = ns.Config;

    class PlayerEngine {
        constructor(camera, controls, world, collision, ui) {
            this.camera = camera;
            this.controls = controls;
            this.world = world;
            this.collision = collision;
            this.ui = ui;
            this.velocity = new THREE.Vector3();
            this.direction = new THREE.Vector3();
            this.previous = new THREE.Vector3();
            this.tmpDir = new THREE.Vector3();
            this.keyState = { forward: false, backward: false, left: false, right: false };
            this.virtualMove = { x: 0, y: 0, active: false };
            this.fallbackActive = false;
            this.isGrounded = false;
            this.isRunning = false;
            this.stamina = 100;
            this.promptTarget = null;
            this.seaToastCooldown = 0;
            this.shotCooldown = 0;
            this.state = {
                gold: C.devGold,
                hp: C.playerMaxHp,
                maxHp: C.playerMaxHp,
                ammo: C.initialAmmo,
                repairMaterials: C.initialRepairMaterials,
                cargo: [],
                cargoCapacity: C.initialCargoCapacity,
                stats: {
                    attack: 0,
                    defense: 0,
                    speed: 0,
                    stamina: 0
                },
                skills: {},
                equipment: {
                    weapon: { name: "기본 마력총", damage: 0 },
                    armor: { name: "천 갑옷", defense: 0 },
                    shoes: { name: "낡은 장화", speed: 0 },
                    accessory: { name: "빈 장신구", cargo: 0 }
                },
                missions: [],
                counters: {
                    kills: 0,
                    bossKills: 0,
                    outsideForestKills: 0,
                    repairs: 0
                },
                hasBoat: false,
                onBoat: false,
                boatDock: null
            };

            this.setupInput();
            this.ui.setGold(this.state.gold);
            this.ui.setBoatStatus("미보유");
            this.updateHud();
        }

        setupInput() {
            document.addEventListener("keydown", (event) => {
                if (event.repeat) return;
                switch (event.code) {
                    case "KeyW":
                        this.keyState.forward = true;
                        break;
                    case "KeyA":
                        this.keyState.left = true;
                        break;
                    case "KeyS":
                        this.keyState.backward = true;
                        break;
                    case "KeyD":
                        this.keyState.right = true;
                        break;
                    case "ShiftLeft":
                    case "ShiftRight":
                        this.isRunning = true;
                        break;
                    case "Space":
                        event.preventDefault();
                        this.jump();
                        break;
                    case "KeyE":
                        event.preventDefault();
                        this.interact();
                        break;
                    case "Escape":
                        this.ui.hideDialog();
                        break;
                    default:
                        if ((event.key || "").toLowerCase() === "e" || event.key === "ㄷ") {
                            event.preventDefault();
                            this.interact();
                        }
                        break;
                }
            });

            document.addEventListener("keyup", (event) => {
                switch (event.code) {
                    case "KeyW":
                        this.keyState.forward = false;
                        break;
                    case "KeyA":
                        this.keyState.left = false;
                        break;
                    case "KeyS":
                        this.keyState.backward = false;
                        break;
                    case "KeyD":
                        this.keyState.right = false;
                        break;
                    case "ShiftLeft":
                    case "ShiftRight":
                        this.isRunning = false;
                        break;
                }
            });

            this.ui.dom.prompt.addEventListener("pointerdown", (event) => {
                if (!this.ui.dom.prompt.classList.contains("visible")) return;
                event.preventDefault();
                this.interact();
            });
        }

        setFallbackActive(active) {
            this.fallbackActive = active;
        }

        setVirtualMove(x, y) {
            this.virtualMove.x = ns.clamp(x, -1, 1);
            this.virtualMove.y = ns.clamp(y, -1, 1);
            this.virtualMove.active = Math.abs(this.virtualMove.x) > 0.04 || Math.abs(this.virtualMove.y) > 0.04;
        }

        isActive() {
            return this.controls.isLocked || this.fallbackActive;
        }

        placeAt(x, z) {
            const y = this.world.heightAt(x, z) + C.eyeHeight;
            this.camera.position.set(x, y, z);
        }

        jump() {
            if (this.state.onBoat) return;
            if (!this.isActive() && !this.ui.dialogVisible) return;
            if (this.isGrounded) {
                this.velocity.y = C.jumpForce;
                this.isGrounded = false;
            }
        }

        interact() {
            if (this.ui.dialogVisible) {
                this.ui.hideDialog();
                return;
            }

            const pos = this.camera.position;
            const target = this.findStaticInteraction(pos);
            if (target && target.id === "port" && (this.state.onBoat || this.world.isBoatDockedAtPort(this.state))) {
                const result = this.world.handleInteraction(target, this.state, this.ui);
                this.applyInteractionResult(result);
                return;
            }

            if (this.canBoardDockedBoat(pos)) {
                this.boardDockedBoat();
                return;
            }

            if (target) {
                const result = this.world.handleInteraction(target, this.state, this.ui);
                this.applyInteractionResult(result);
                return;
            }

            if (this.state.onBoat && this.world.isSea(pos.x, pos.z)) {
                this.world.showSeaDialog(this.ui);
            }
        }

        findStaticInteraction(pos) {
            return this.collision.nearestInteraction(pos, (item) => !this.state.onBoat || item.id === "port");
        }

        canBoardDockedBoat(pos) {
            const dock = this.state.boatDock;
            if (!this.state.hasBoat || this.state.onBoat || !dock) return false;

            const dx = pos.x - dock.x;
            const dz = pos.z - dock.z;
            const radius = C.boatBoardRadius || 20;
            return dx * dx + dz * dz <= radius * radius;
        }

        boardDockedBoat() {
            const dock = this.state.boatDock;
            if (!dock) return;

            this.state.onBoat = true;
            this.state.boatDock = null;
            this.camera.position.set(dock.x, C.waterLevel + C.boatEyeHeight, dock.z);
            this.velocity.set(0, 0, 0);
            this.isGrounded = true;
            this.ui.setBoatStatus("승선 중");
            this.ui.showToast("정박한 돛단배에 탔습니다.", 1.4);
        }

        applyInteractionResult(result) {
            if (!result || !result.moveTo) return;
            const x = result.moveTo.x;
            const z = result.moveTo.z;
            if (result.mode === "boat") {
                this.camera.position.set(x, C.waterLevel + C.boatEyeHeight, z);
                this.velocity.set(0, 0, 0);
            } else {
                this.camera.position.set(x, this.world.heightAt(x, z) + C.eyeHeight, z);
                this.velocity.set(0, 0, 0);
            }
        }

        update(dt) {
            this.seaToastCooldown = Math.max(0, this.seaToastCooldown - dt);
            this.shotCooldown = Math.max(0, this.shotCooldown - dt);

            if (this.isActive() && !this.ui.dialogVisible) {
                this.updateMovementInput(dt);
            }

            this.velocity.x -= this.velocity.x * 10 * dt;
            this.velocity.z -= this.velocity.z * 10 * dt;
            if (!this.state.onBoat) {
                this.velocity.y -= C.gravity * dt;
            }

            this.previous.copy(this.camera.position);
            this.controls.moveRight(-this.velocity.x * dt);
            this.controls.moveForward(-this.velocity.z * dt);

            const pos = this.camera.position;
            this.collision.clampToBounds(pos);

            if (this.state.onBoat) {
                this.resolveBoatMovement(pos);
            } else {
                this.resolveLandMovement(pos, dt);
            }

            this.updateHud(dt);
        }

        updateMovementInput(dt) {
            const keyForward = Number(this.keyState.forward) - Number(this.keyState.backward);
            const keyRight = Number(this.keyState.right) - Number(this.keyState.left);
            const forwardAxis = ns.clamp(keyForward + this.virtualMove.y, -1, 1);
            const rightAxis = ns.clamp(keyRight + this.virtualMove.x, -1, 1);
            const moving = Math.abs(forwardAxis) > 0.04 || Math.abs(rightAxis) > 0.04;
            const canRun = this.isRunning && moving && !this.state.onBoat;
            let speed = this.state.onBoat ? C.boatSpeed : (canRun ? C.runSpeed : C.speed);
            speed *= this.getSpeedMultiplier();

            if (canRun) {
                this.stamina = Math.max(0, this.stamina - C.staminaDrain * dt);
                if (this.stamina <= 0) {
                    this.isRunning = false;
                    speed = C.speed;
                }
            } else {
                this.stamina = Math.min(this.getMaxStamina(), this.stamina + C.staminaRegen * dt);
            }

            this.direction.z = forwardAxis;
            this.direction.x = rightAxis;
            this.direction.normalize();

            if (Math.abs(forwardAxis) > 0.04) {
                this.velocity.z -= this.direction.z * speed * 10 * dt;
            }
            if (Math.abs(rightAxis) > 0.04) {
                this.velocity.x -= this.direction.x * speed * 10 * dt;
            }
        }

        resolveLandMovement(pos, dt) {
            if (this.world.isSea(pos.x, pos.z)) {
                pos.x = this.previous.x;
                pos.z = this.previous.z;
                this.velocity.x = 0;
                this.velocity.z = 0;
                if (this.seaToastCooldown <= 0) {
                    this.ui.showToast("맨몸으로는 바다에 들어갈 수 없습니다. 항구의 작은 돛단배가 필요합니다.");
                    this.seaToastCooldown = 1.5;
                }
            }

            this.collision.resolveObstacles(pos, C.playerRadius);
            this.collision.clampToBounds(pos);

            const ground = this.world.heightAt(pos.x, pos.z);
            if (pos.y < ground + C.eyeHeight) {
                pos.y = ground + C.eyeHeight;
                this.velocity.y = Math.max(0, this.velocity.y);
                this.isGrounded = true;
            } else {
                this.isGrounded = false;
                pos.y += this.velocity.y * dt;
            }

            if (pos.y < -30) {
                this.placeAt(-166, -96);
                this.velocity.set(0, 0, 0);
            }
        }

        resolveBoatMovement(pos) {
            if (!this.world.isBoatAllowed(pos.x, pos.z)) {
                if (this.dockBoatAtShore(pos)) return;

                pos.x = this.previous.x;
                pos.z = this.previous.z;
                this.velocity.x = 0;
                this.velocity.z = 0;
                if (this.seaToastCooldown <= 0) {
                    this.ui.showToast("돛단배는 항구 수면과 바다에서만 움직입니다.");
                    this.seaToastCooldown = 1.3;
                }
            }

            this.collision.resolveObstacles(pos, C.playerRadius + 1.2);
            this.collision.clampToBounds(pos);
            pos.y = C.waterLevel + C.boatEyeHeight;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        dockBoatAtShore(pos) {
            const spot = this.world.getBoatDockingSpot(pos, this.previous);
            if (!spot) return false;

            this.camera.getWorldDirection(this.tmpDir);
            this.state.onBoat = false;
            this.state.boatDock = {
                x: spot.boat.x,
                z: spot.boat.z,
                heading: Math.atan2(this.tmpDir.x, this.tmpDir.z)
            };

            pos.x = spot.land.x;
            pos.z = spot.land.z;
            this.collision.resolveObstacles(pos, C.playerRadius);
            this.collision.clampToBounds(pos);
            if (this.world.isSea(pos.x, pos.z)) {
                pos.x = spot.land.x;
                pos.z = spot.land.z;
            }
            pos.y = this.world.heightAt(pos.x, pos.z) + C.eyeHeight;

            this.velocity.set(0, 0, 0);
            this.isGrounded = true;
            this.ui.setBoatStatus("정박 중");
            this.ui.showToast("돛단배를 해안에 정박했습니다. 다시 타려면 정박한 곳으로 돌아가세요.", 2.4);
            return true;
        }

        updateHud() {
            const pos = this.camera.position;
            this.ui.setPosition(pos.x, pos.z);
            this.ui.setStamina(this.stamina);
            this.ui.setBoatStatus(this.getBoatStatusText());
            this.ui.setLocation(this.world.getLocation(pos.x, pos.z, this.state));

            this.camera.getWorldDirection(this.tmpDir);
            this.ui.setDirection(Math.atan2(this.tmpDir.x, this.tmpDir.z));

            const target = this.findStaticInteraction(pos);
            if (target && target.id === "port" && this.state.onBoat && !this.ui.dialogVisible) {
                this.promptTarget = target;
                this.ui.showInteraction("항구 반납");
            } else if (target && target.id === "port" && this.world.isBoatDockedAtPort(this.state) && !this.ui.dialogVisible) {
                this.promptTarget = target;
                this.ui.showInteraction("돛단배 반납");
            } else if (this.canBoardDockedBoat(pos) && !this.ui.dialogVisible) {
                this.promptTarget = null;
                this.ui.showInteraction("돛단배 타기");
            } else if (target && !this.ui.dialogVisible) {
                this.promptTarget = target;
                this.ui.showInteraction(target.label);
            } else if (this.state.onBoat && this.world.isSea(pos.x, pos.z) && !this.ui.dialogVisible) {
                this.promptTarget = null;
                this.ui.showInteraction("바다 메뉴");
            } else {
                this.promptTarget = null;
                this.ui.hideInteraction();
            }
        }

        getBoatStatusText() {
            if (this.state.onBoat) return "승선 중";
            if (this.state.hasBoat && this.state.boatDock) return "정박 중";
            if (this.state.hasBoat) return "대여 중";
            return "미보유";
        }
    }

    PlayerEngine.prototype.boardDockedBoat = function () {
        const dock = this.state.boatDock;
        if (!dock) return;

        this.state.onBoat = true;
        this.state.boatDock = null;
        this.camera.position.set(dock.x, C.waterLevel + C.boatEyeHeight, dock.z);
        this.velocity.set(0, 0, 0);
        this.isGrounded = true;
        this.ui.setBoatStatus("승선 중");
        this.ui.showToast("정박해 둔 돛단배에 올랐습니다.", 1.4);
    };

    PlayerEngine.prototype.resolveLandMovement = function (pos, dt) {
        if (this.world.isSea(pos.x, pos.z)) {
            pos.x = this.previous.x;
            pos.z = this.previous.z;
            this.velocity.x = 0;
            this.velocity.z = 0;
            if (this.seaToastCooldown <= 0) {
                this.ui.showToast("맨몸으로는 바다에 들어갈 수 없습니다. 항구에서 돛단배가 필요합니다.");
                this.seaToastCooldown = 1.5;
            }
        }

        this.collision.resolveObstacles(pos, C.playerRadius);
        this.collision.clampToBounds(pos);

        const ground = this.world.heightAt(pos.x, pos.z);
        if (pos.y < ground + C.eyeHeight) {
            pos.y = ground + C.eyeHeight;
            this.velocity.y = Math.max(0, this.velocity.y);
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
            pos.y += this.velocity.y * dt;
        }

        if (pos.y < -30) {
            this.placeAt(-166, -96);
            this.velocity.set(0, 0, 0);
        }
    };

    PlayerEngine.prototype.resolveBoatMovement = function (pos) {
        if (!this.world.isBoatAllowed(pos.x, pos.z)) {
            if (this.dockBoatAtShore(pos)) return;

            pos.x = this.previous.x;
            pos.z = this.previous.z;
            this.velocity.x = 0;
            this.velocity.z = 0;
            if (this.seaToastCooldown <= 0) {
                this.ui.showToast("돛단배는 항구 수면과 바다에서만 움직일 수 있습니다.");
                this.seaToastCooldown = 1.3;
            }
        }

        this.collision.resolveObstacles(pos, C.playerRadius + 1.2);
        this.collision.clampToBounds(pos);
        pos.y = C.waterLevel + C.boatEyeHeight;
        this.velocity.y = 0;
        this.isGrounded = true;
    };

    PlayerEngine.prototype.dockBoatAtShore = function (pos) {
        const spot = this.world.getBoatDockingSpot(pos, this.previous);
        if (!spot) return false;

        this.camera.getWorldDirection(this.tmpDir);
        this.state.onBoat = false;
        this.state.boatDock = {
            x: spot.boat.x,
            z: spot.boat.z,
            heading: Math.atan2(this.tmpDir.x, this.tmpDir.z)
        };

        pos.x = spot.land.x;
        pos.z = spot.land.z;
        this.collision.resolveObstacles(pos, C.playerRadius);
        this.collision.clampToBounds(pos);
        if (this.world.isSea(pos.x, pos.z)) {
            pos.x = spot.land.x;
            pos.z = spot.land.z;
        }
        pos.y = this.world.heightAt(pos.x, pos.z) + C.eyeHeight;

        this.velocity.set(0, 0, 0);
        this.isGrounded = true;
        this.ui.setBoatStatus("정박 중");
        this.ui.showToast("돛단배를 해안에 정박했습니다. 다시 타려면 정박한 곳으로 돌아가세요.", 2.4);
        return true;
    };

    PlayerEngine.prototype.updateHud = function () {
        const pos = this.camera.position;
        this.ui.setPosition(pos.x, pos.z);
        this.ui.setStamina(this.stamina);
        this.ui.setBoatStatus(this.getBoatStatusText());
        this.ui.setLocation(this.world.getLocation(pos.x, pos.z, this.state));

        this.camera.getWorldDirection(this.tmpDir);
        this.ui.setDirection(Math.atan2(this.tmpDir.x, this.tmpDir.z));

        const target = this.findStaticInteraction(pos);
        if (target && target.id === "port" && this.state.onBoat && !this.ui.dialogVisible) {
            this.promptTarget = target;
            this.ui.showInteraction("항구 반납");
        } else if (target && target.id === "port" && this.world.isBoatDockedAtPort(this.state) && !this.ui.dialogVisible) {
            this.promptTarget = target;
            this.ui.showInteraction("돛단배 반납");
        } else if (this.canBoardDockedBoat(pos) && !this.ui.dialogVisible) {
            this.promptTarget = null;
            this.ui.showInteraction("돛단배 타기");
        } else if (target && !this.ui.dialogVisible) {
            this.promptTarget = target;
            this.ui.showInteraction(target.label);
        } else if (this.state.onBoat && this.world.isSea(pos.x, pos.z) && !this.ui.dialogVisible) {
            this.promptTarget = null;
            this.ui.showInteraction("바다 메뉴");
        } else {
            this.promptTarget = null;
            this.ui.hideInteraction();
        }
    };

    PlayerEngine.prototype.getBoatStatusText = function () {
        if (this.state.onBoat) return "승선 중";
        if (this.state.hasBoat && this.state.boatDock) return "정박 중";
        if (this.state.hasBoat) return "대여 중";
        return "미보유";
    };

    PlayerEngine.prototype.findStaticInteraction = function (pos) {
        return this.collision.nearestInteraction(pos, (item) => !this.state.onBoat || item.id === "port" || item.role === "harbor");
    };

    PlayerEngine.prototype.interact = function () {
        if (this.ui.dialogVisible) {
            this.ui.hideDialog();
            return;
        }

        const pos = this.camera.position;
        const target = this.findStaticInteraction(pos);
        const harborTarget = target && (target.id === "port" || target.role === "harbor");
        if (harborTarget && (this.state.onBoat || this.world.isBoatDockedAtPort(this.state))) {
            const result = this.world.handleInteraction(target, this.state, this.ui, this);
            this.applyInteractionResult(result);
            return;
        }

        if (this.canBoardDockedBoat(pos)) {
            this.boardDockedBoat();
            return;
        }

        if (target) {
            const result = this.world.handleInteraction(target, this.state, this.ui, this);
            this.applyInteractionResult(result);
            return;
        }

        if (this.state.onBoat && this.world.isSea(pos.x, pos.z)) {
            this.world.showSeaDialog(this.ui);
        }
    };

    PlayerEngine.prototype.getMaxStamina = function () {
        return 100 + this.state.stats.stamina * 12;
    };

    PlayerEngine.prototype.getSpeedMultiplier = function () {
        const shoeBonus = this.state.equipment.shoes.speed || 0;
        return 1 + this.state.stats.speed * 0.025 + shoeBonus;
    };

    PlayerEngine.prototype.getShotDamage = function () {
        const weaponDamage = this.state.equipment.weapon.damage || 0;
        const skillBonus = this.state.skills.marksmanship ? 8 : 0;
        return C.baseShotDamage + weaponDamage + this.state.stats.attack * 5 + skillBonus;
    };

    PlayerEngine.prototype.getDefense = function () {
        const armorDefense = this.state.equipment.armor.defense || 0;
        return armorDefense + this.state.stats.defense * 2;
    };

    PlayerEngine.prototype.spendGold = function (cost, label) {
        if (this.state.gold < cost) {
            this.ui.showToast(`${label || "거래"}에 필요한 골드가 부족합니다.`);
            return false;
        }
        this.state.gold -= cost;
        this.ui.setGold(this.state.gold);
        return true;
    };

    PlayerEngine.prototype.addGold = function (amount) {
        this.state.gold += amount;
        this.ui.setGold(this.state.gold);
    };

    PlayerEngine.prototype.heal = function (amount) {
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
        this.updateHud();
    };

    PlayerEngine.prototype.receiveDamage = function (amount) {
        const reduced = Math.max(1, amount - this.getDefense());
        this.state.hp = Math.max(0, this.state.hp - reduced);
        this.updateHud();
        if (this.state.hp <= 0) {
            this.state.hp = this.state.maxHp;
            this.placeAt(-166, -96);
            this.velocity.set(0, 0, 0);
            this.ui.showToast("HP가 0이 되어 학교 앞에서 회복했습니다.", 2.4);
            this.updateHud();
        }
    };

    PlayerEngine.prototype.buyAmmo = function (amount, cost) {
        if (!this.spendGold(cost, "탄창 구입")) return false;
        this.state.ammo += amount;
        this.ui.showToast(`탄약 ${amount}발을 보급했습니다.`);
        this.updateHud();
        return true;
    };

    PlayerEngine.prototype.buyRepairMaterials = function (amount, cost) {
        if (!this.spendGold(cost, "수리 자재 구입")) return false;
        this.state.repairMaterials += amount;
        this.ui.showToast(`시설 보수 자재 ${amount}개를 확보했습니다.`);
        this.updateHud();
        return true;
    };

    PlayerEngine.prototype.trainStat = function (stat, cost, label) {
        if (!this.spendGold(cost, label)) return false;
        this.state.stats[stat] += 1;
        if (stat === "stamina") this.stamina = this.getMaxStamina();
        if (stat === "defense") this.heal(12);
        if (stat === "attack") this.ui.showToast(`${label} 완료. 사격 피해가 증가했습니다.`);
        else this.ui.showToast(`${label} 완료.`);
        this.updateHud();
        return true;
    };

    PlayerEngine.prototype.learnSkill = function (skill, cost, label) {
        if (this.state.skills[skill]) {
            this.ui.showToast("이미 습득한 기술입니다.");
            return false;
        }
        if (!this.spendGold(cost, label)) return false;
        this.state.skills[skill] = true;
        this.ui.showToast(`${label}을 습득했습니다.`);
        this.updateHud();
        return true;
    };

    PlayerEngine.prototype.buyEquipment = function (slot, item) {
        if (!this.spendGold(item.cost, item.name)) return false;
        this.state.equipment[slot] = item;
        if (slot === "accessory") {
            this.state.cargoCapacity = C.initialCargoCapacity + (item.cargo || 0);
        }
        if (slot === "armor") this.heal(8);
        this.ui.showToast(`${item.name} 장착 완료.`);
        this.updateHud();
        return true;
    };

    PlayerEngine.prototype.addMonsterLoot = function (monster) {
        this.state.counters.kills += 1;
        if (monster.type === "boss") this.state.counters.bossKills += 1;
        if (!this.world.isForest(monster.x, monster.z)) this.state.counters.outsideForestKills += 1;

        if (this.state.cargo.length < this.state.cargoCapacity) {
            this.state.cargo.push({
                type: monster.type,
                name: monster.name,
                value: monster.value
            });
            this.ui.showToast(`${monster.name} 포획. 항구에서 판매할 수 있습니다.`);
        } else {
            this.addGold(Math.floor(monster.value * 0.35));
            this.ui.showToast("컨테이너가 가득 차서 일부 소재만 즉시 정산했습니다.");
        }
        this.updateMissionProgress();
        this.updateHud();
    };

    PlayerEngine.prototype.sellCargo = function () {
        if (!this.state.cargo.length) {
            this.ui.showToast("판매할 몬스터 화물이 없습니다.");
            return 0;
        }
        const total = this.state.cargo.reduce((sum, item) => sum + item.value, 0);
        const count = this.state.cargo.length;
        this.state.cargo.length = 0;
        this.addGold(total);
        this.ui.showToast(`몬스터 ${count}마리를 판매해 ${ns.formatGold(total)}를 벌었습니다.`, 2.2);
        this.updateHud();
        return total;
    };

    PlayerEngine.prototype.repairBuilding = function (building) {
        if (!building || building.hp >= building.maxHp) {
            this.ui.showToast("보수할 필요가 없습니다.");
            return false;
        }
        if (this.state.repairMaterials <= 0) {
            this.ui.showToast("시설 보수 자재가 부족합니다.");
            return false;
        }
        this.state.repairMaterials -= 1;
        this.world.repairBuilding(building, C.buildingRepairPerMaterial + (this.state.skills.repair ? 20 : 0));
        this.state.counters.repairs += 1;
        this.updateMissionProgress();
        this.updateHud();
        this.ui.showToast(`${building.title} 내구도를 보수했습니다.`);
        return true;
    };

    PlayerEngine.prototype.updateMissionProgress = function () {
        for (let i = 0; i < this.state.missions.length; i++) {
            const mission = this.state.missions[i];
            if (mission.done) continue;
            let current = 0;
            if (mission.type === "outside-kill") current = this.state.counters.outsideForestKills;
            if (mission.type === "repair") current = this.state.counters.repairs;
            if (mission.type === "boss") current = this.state.counters.bossKills;
            if (current >= mission.target) {
                mission.done = true;
                this.addGold(mission.reward);
                this.ui.showToast(`미션 완료: ${mission.title} 보상 ${ns.formatGold(mission.reward)}`, 2.6);
            }
        }
    };

    PlayerEngine.prototype.acceptMission = function (mission) {
        if (this.state.missions.some((item) => item.id === mission.id && !item.done)) {
            this.ui.showToast("이미 진행 중인 미션입니다.");
            return false;
        }
        this.state.missions.push(Object.assign({ done: false }, mission));
        this.ui.showToast(`미션 수락: ${mission.title}`);
        return true;
    };

    PlayerEngine.prototype.shoot = function (monsterEngine) {
        if (this.ui.dialogVisible || this.shotCooldown > 0) return false;
        if (this.state.ammo <= 0) {
            this.ui.showToast("탄약이 없습니다. 상점가나 항구에서 탄창을 구입하세요.");
            this.shotCooldown = 0.35;
            return false;
        }
        this.state.ammo -= 1;
        this.shotCooldown = C.shotCooldown;
        const hit = monsterEngine && monsterEngine.shoot(this.camera, this.getShotDamage());
        if (!hit) this.ui.showToast("빗나감", 0.35);
        this.updateHud();
        return true;
    };

    PlayerEngine.prototype.boardDockedBoat = function () {
        const dock = this.state.boatDock;
        if (!dock) return;

        this.state.onBoat = true;
        this.state.boatDock = null;
        this.camera.position.set(dock.x, C.waterLevel + C.boatEyeHeight, dock.z);
        this.velocity.set(0, 0, 0);
        this.isGrounded = true;
        this.ui.setBoatStatus("승선 중");
        this.ui.showToast("정박한 쪽단배에 올랐습니다.", 1.4);
    };

    PlayerEngine.prototype.getBoatStatusText = function () {
        if (this.state.onBoat) return "승선 중";
        if (this.state.hasBoat && this.state.boatDock) return "정박 중";
        if (this.state.hasBoat) return "대여 중";
        return "미보유";
    };

    PlayerEngine.prototype.updateHud = function () {
        const pos = this.camera.position;
        this.ui.setPosition(pos.x, pos.z);
        this.ui.setHp(this.state.hp, this.state.maxHp);
        this.ui.setAmmo(this.state.ammo);
        this.ui.setCargo(this.state.cargo.length, this.state.cargoCapacity);
        this.ui.setGear(this.state.equipment.weapon.name);
        this.ui.setGold(this.state.gold);
        this.ui.setStamina(Math.min(100, (this.stamina / this.getMaxStamina()) * 100));
        this.ui.setBoatStatus(this.getBoatStatusText());
        this.ui.setLocation(this.world.getLocation(pos.x, pos.z, this.state));

        this.camera.getWorldDirection(this.tmpDir);
        this.ui.setDirection(Math.atan2(this.tmpDir.x, this.tmpDir.z));

        const target = this.findStaticInteraction(pos);
        const harborTarget = target && (target.id === "port" || target.role === "harbor");
        if (harborTarget && this.state.onBoat && !this.ui.dialogVisible) {
            this.promptTarget = target;
            this.ui.showInteraction("항구 반납");
        } else if (harborTarget && this.world.isBoatDockedAtPort(this.state) && !this.ui.dialogVisible) {
            this.promptTarget = target;
            this.ui.showInteraction("쪽단배 반납");
        } else if (this.canBoardDockedBoat(pos) && !this.ui.dialogVisible) {
            this.promptTarget = null;
            this.ui.showInteraction("쪽단배 타기");
        } else if (target && !this.ui.dialogVisible) {
            this.promptTarget = target;
            this.ui.showInteraction(target.label);
        } else if (this.state.onBoat && this.world.isSea(pos.x, pos.z) && !this.ui.dialogVisible) {
            this.promptTarget = null;
            this.ui.showInteraction("바다 메뉴");
        } else {
            this.promptTarget = null;
            this.ui.hideInteraction();
        }
    };

    ns.PlayerEngine = PlayerEngine;
})();
