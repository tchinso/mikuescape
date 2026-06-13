(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};
    const C = ns.Config;

    class MonsterEngine {
        constructor(scene, world, player, ui) {
            this.scene = scene;
            this.world = world;
            this.player = player;
            this.ui = ui;
            this.monsters = [];
            this.elapsed = 0;
            this.spawnTimer = 0;
            this.rng = ns.mulberry32(913608);
            this.tmp = new THREE.Vector3();
            this.rayDir = new THREE.Vector3();
            this.materials = this.createMaterials();
        }

        createMaterials() {
            return {
                normal: new THREE.MeshStandardMaterial({ color: 0x6d5be8, roughness: 0.72, metalness: 0.02, emissive: 0x181042, emissiveIntensity: 0.14 }),
                fast: new THREE.MeshStandardMaterial({ color: 0xff5d8e, roughness: 0.66, metalness: 0.02, emissive: 0x4c0a22, emissiveIntensity: 0.18 }),
                tank: new THREE.MeshStandardMaterial({ color: 0x3c435a, roughness: 0.86, metalness: 0.04, emissive: 0x11151f, emissiveIntensity: 0.1 }),
                boss: new THREE.MeshStandardMaterial({ color: 0x171020, roughness: 0.58, metalness: 0.08, emissive: 0x551a6f, emissiveIntensity: 0.32 }),
                eye: new THREE.MeshBasicMaterial({ color: 0xfff2a8, toneMapped: false }),
                horn: new THREE.MeshStandardMaterial({ color: 0xe2b657, roughness: 0.5, metalness: 0.22 })
            };
        }

        difficulty() {
            if (this.elapsed < C.monster.gracePeriod) return 0;
            return ns.clamp((this.elapsed - C.monster.gracePeriod) / C.monster.difficultyRampSeconds, 0, 1);
        }

        phase() {
            if (this.elapsed < C.monster.forestPhaseSecond) return 0;
            if (this.elapsed < C.monster.edgePhaseSecond) return 1;
            if (this.elapsed < C.monster.worldPhaseSecond) return 2;
            return 3;
        }

        spawnInterval() {
            const d = this.difficulty();
            return C.monster.spawnIntervalStart - (C.monster.spawnIntervalStart - C.monster.spawnIntervalMin) * d;
        }

        update(dt) {
            this.elapsed += dt;
            if (this.elapsed >= C.monster.gracePeriod) {
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) {
                    this.trySpawn();
                    this.spawnTimer = this.spawnInterval() * (0.75 + this.rng() * 0.55);
                }
            }

            for (let i = this.monsters.length - 1; i >= 0; i--) {
                const monster = this.monsters[i];
                if (monster.dead) {
                    this.removeMonster(i);
                    continue;
                }
                this.updateMonster(monster, dt);
            }
        }

        trySpawn() {
            if (this.monsters.length >= C.monster.maxAlive) return;
            const phase = this.phase();
            const count = this.rng() < this.difficulty() * 0.08 ? 2 : 1;
            for (let i = 0; i < count && this.monsters.length < C.monster.maxAlive; i++) {
                const type = this.pickType();
                const point = this.world.randomMonsterSpawnPoint(this.rng, phase, this.player.camera.position);
                this.spawn(type, point.x, point.z);
            }
        }

        pickType() {
            const d = this.difficulty();
            if (this.elapsed >= C.monster.bossFirstSecond && this.rng() < 0.008 + d * 0.012) return "boss";
            if (this.elapsed > C.monster.tankFirstSecond && this.rng() < 0.07 + d * 0.06) return "tank";
            if (this.elapsed > C.monster.fastFirstSecond && this.rng() < 0.1 + d * 0.06) return "fast";
            return "normal";
        }

        statsFor(type) {
            const d = this.difficulty();
            const scale = 1 + d * 0.45;
            if (type === "fast") {
                return { name: "추격 몬스터", hp: 46 * scale, damage: 5 + d * 3, speed: 15 + d * 1.2, radius: 3.1, value: Math.floor(70 + d * 70), aggro: 98 };
            }
            if (type === "tank") {
                return { name: "중장갑 몬스터", hp: 128 * scale, damage: 12 + d * 7, speed: 4.5 + d * 0.6, radius: 5.2, value: Math.floor(150 + d * 150), aggro: 62 };
            }
            if (type === "boss") {
                return { name: "보스 몬스터", hp: 420 * scale, damage: 20 + d * 12, speed: 6 + d * 0.8, radius: 8.5, value: Math.floor(900 + d * 700), aggro: 130 };
            }
            return { name: "일반 몬스터", hp: 64 * scale, damage: 6 + d * 4, speed: 8 + d * 1, radius: 3.8, value: Math.floor(95 + d * 90), aggro: 72 };
        }

        spawn(type, x, z) {
            const stats = this.statsFor(type);
            const y = this.world.heightAt(x, z);
            const mesh = this.createMonsterMesh(type, stats);
            mesh.position.set(x, y, z);
            this.scene.add(mesh);
            this.monsters.push({
                type,
                name: stats.name,
                x,
                z,
                hp: stats.hp,
                maxHp: stats.hp,
                damage: stats.damage,
                speed: stats.speed,
                radius: stats.radius,
                value: stats.value,
                aggro: stats.aggro,
                mesh,
                attackCooldown: 0,
                roamTimer: 0,
                roamX: x,
                roamZ: z,
                dead: false
            });
        }

        createMonsterMesh(type, stats) {
            const group = new THREE.Group();
            const bodyMat = this.materials[type] || this.materials.normal;
            const body = new THREE.Mesh(new THREE.IcosahedronGeometry(stats.radius, type === "boss" ? 2 : 1), bodyMat);
            body.position.y = stats.radius * 0.9;
            body.scale.y = type === "fast" ? 1.25 : type === "tank" ? 0.82 : 1;
            group.add(body);

            const eyeY = stats.radius * 1.08;
            for (let i = -1; i <= 1; i += 2) {
                const eye = new THREE.Mesh(new THREE.SphereGeometry(stats.radius * 0.18, 8, 6), this.materials.eye);
                eye.position.set(i * stats.radius * 0.32, eyeY, -stats.radius * 0.72);
                group.add(eye);
            }

            if (type === "tank" || type === "boss") {
                for (let i = -1; i <= 1; i += 2) {
                    const horn = new THREE.Mesh(new THREE.ConeGeometry(stats.radius * 0.18, stats.radius * 0.9, 8), this.materials.horn);
                    horn.position.set(i * stats.radius * 0.55, stats.radius * 1.65, -stats.radius * 0.18);
                    horn.rotation.z = i * 0.46;
                    group.add(horn);
                }
            }

            if (type === "boss") {
                const crown = new THREE.Mesh(new THREE.TorusGeometry(stats.radius * 0.52, stats.radius * 0.08, 8, 18), this.materials.horn);
                crown.position.y = stats.radius * 1.85;
                crown.rotation.x = Math.PI / 2;
                group.add(crown);
            }

            group.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            return group;
        }

        updateMonster(monster, dt) {
            monster.attackCooldown = Math.max(0, monster.attackCooldown - dt);
            monster.roamTimer -= dt;

            const playerPos = this.player.camera.position;
            const dx = playerPos.x - monster.x;
            const dz = playerPos.z - monster.z;
            const distSq = dx * dx + dz * dz;
            const phase = this.phase();
            const canChasePlayer = phase >= 2 || this.world.isForest(playerPos.x, playerPos.z);
            let targetX = monster.roamX;
            let targetZ = monster.roamZ;
            let chasing = false;

            if (canChasePlayer && distSq < monster.aggro * monster.aggro) {
                targetX = playerPos.x;
                targetZ = playerPos.z;
                chasing = true;
            } else if (phase >= 2 && !this.world.isForest(monster.x, monster.z)) {
                const building = this.world.nearestBuilding(monster.x, monster.z, 70, (item) => !item.destroyed);
                if (building) {
                    targetX = building.x;
                    targetZ = building.z;
                }
            } else if (monster.roamTimer <= 0) {
                const point = this.world.randomMonsterSpawnPoint(this.rng, phase, null);
                monster.roamX = point.x;
                monster.roamZ = point.z;
                monster.roamTimer = 3 + this.rng() * 5;
                targetX = monster.roamX;
                targetZ = monster.roamZ;
            }

            this.moveMonster(monster, targetX, targetZ, dt, chasing);
            this.resolveAttacks(monster, distSq);
            this.syncMesh(monster);
        }

        moveMonster(monster, targetX, targetZ, dt, chasing) {
            let dx = targetX - monster.x;
            let dz = targetZ - monster.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            if (len > 0.1) {
                dx /= len;
                dz /= len;
                const speed = monster.speed * (chasing ? 1.08 : 0.72);
                monster.x += dx * speed * dt;
                monster.z += dz * speed * dt;
            }

            const phase = this.phase();
            if (phase === 0 && !this.world.isDeepForest(monster.x, monster.z)) {
                const point = this.world.randomMonsterSpawnPoint(this.rng, 0, null);
                monster.roamX = point.x;
                monster.roamZ = point.z;
            } else if (phase === 1 && !this.world.isForest(monster.x, monster.z)) {
                const point = this.world.randomMonsterSpawnPoint(this.rng, 1, null);
                monster.roamX = point.x;
                monster.roamZ = point.z;
            }

            const pos = this.tmp.set(monster.x, 0, monster.z);
            this.world.collision.clampToBounds(pos);
            monster.x = pos.x;
            monster.z = pos.z;
        }

        resolveAttacks(monster, playerDistSq) {
            const hitRange = monster.radius + C.playerRadius + 1.6;
            if (playerDistSq <= hitRange * hitRange && monster.attackCooldown <= 0) {
                this.player.receiveDamage(monster.damage);
                monster.attackCooldown = monster.type === "fast" ? 0.78 : 1.18;
                return;
            }

            if (this.world.isForest(monster.x, monster.z)) return;
            const building = this.world.nearestBuilding(monster.x, monster.z, C.monster.facilityAttackRange, (item) => !item.destroyed);
            if (building && monster.attackCooldown <= 0) {
                this.world.damageBuilding(building, monster.damage * 0.65);
                monster.attackCooldown = monster.type === "tank" ? 1.6 : 2.1;
                if (building.destroyed) {
                    this.ui.showToast(`${building.title} 시설이 파괴되었습니다.`, 2.4);
                }
            }
        }

        syncMesh(monster) {
            const y = this.world.heightAt(monster.x, monster.z);
            monster.mesh.position.set(monster.x, y, monster.z);
            monster.mesh.rotation.y += monster.type === "fast" ? 0.055 : 0.025;
            const hpPulse = 0.84 + (monster.hp / monster.maxHp) * 0.16;
            monster.mesh.scale.setScalar(hpPulse);
        }

        shoot(camera, damage) {
            camera.getWorldDirection(this.rayDir);
            const origin = camera.position;
            let best = null;
            let bestT = Infinity;

            for (let i = 0; i < this.monsters.length; i++) {
                const monster = this.monsters[i];
                const centerY = this.world.heightAt(monster.x, monster.z) + monster.radius * 1.05;
                const ox = monster.x - origin.x;
                const oy = centerY - origin.y;
                const oz = monster.z - origin.z;
                const t = ox * this.rayDir.x + oy * this.rayDir.y + oz * this.rayDir.z;
                if (t <= 0 || t > 240) continue;

                const cx = origin.x + this.rayDir.x * t;
                const cy = origin.y + this.rayDir.y * t;
                const cz = origin.z + this.rayDir.z * t;
                const px = monster.x - cx;
                const py = centerY - cy;
                const pz = monster.z - cz;
                const radius = monster.radius * 1.05;
                if (px * px + py * py + pz * pz <= radius * radius && t < bestT) {
                    best = monster;
                    bestT = t;
                }
            }

            if (!best) return false;
            best.hp -= damage;
            if (best.hp <= 0) {
                best.dead = true;
                this.player.addMonsterLoot(best);
            } else {
                this.ui.showToast(`${best.name} 명중 (${Math.ceil(best.hp)} HP)`, 0.55);
            }
            return true;
        }

        removeMonster(index) {
            const monster = this.monsters[index];
            if (monster && monster.mesh) {
                this.scene.remove(monster.mesh);
                monster.mesh.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                });
            }
            this.monsters.splice(index, 1);
        }
    }

    ns.MonsterEngine = MonsterEngine;
})();
