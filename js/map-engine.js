(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};
    const C = ns.Config;
    const P = ns.Palette;
    const V = ns.FantasyVisuals;

    function hexCss(hex) {
        return `#${new THREE.Color(hex).getHexString()}`;
    }

    function rectHit(x, z, zone) {
        return x >= zone.x - zone.w / 2 && x <= zone.x + zone.w / 2 &&
            z >= zone.z - zone.d / 2 && z <= zone.z + zone.d / 2;
    }

    function ellipseHit(x, z, zone) {
        const dx = (x - zone.x) / zone.rx;
        const dz = (z - zone.z) / zone.rz;
        return dx * dx + dz * dz <= 1;
    }

    class MapEngine {
        constructor(scene, collision) {
            this.scene = scene;
            this.collision = collision;
            this.materials = {};
            this.heightZones = [];
            this.dockZones = [];
            this.portLandZones = [];
            this.places = [];
            this.waterMeshes = [];
            this.cloudGroup = null;
            this.skyDome = null;
            this.animated = [];
            this.glowSprites = [];
            this.playerBoat = null;
            this.dockBoat = null;
            this.tmpVec = new THREE.Vector3();
            this.rng = ns.mulberry32(240529);
            this.boatSpawn = { x: 144, z: 232 };
            this.portBoatDock = { x: 140, z: 209, heading: -Math.PI / 2 };
            this.portLanding = { x: 178, z: 174 };
        }

        build() {
            this.collision.reset();
            this.createMaterials();
            this.defineZones();
            this.addSkyRealm();
            this.addSea();
            this.addBaseTerrain();
            this.addRoadsAndWaterways();
            this.addSchoolDistrict();
            this.addCapitalDistrict();
            this.addShoppingDistrict();
            this.addResidentialDistrict();
            this.addPortDistrict();
            this.addForestsAndEdges();
            this.addFantasyDetails();
            this.addClouds();
            this.registerPlaces();
            return this;
        }

        createMaterials() {
            const textured = (hex, variant, name, options) => {
                if (!V || !V.standardMaterial) return this.paintedMaterial(hex, name || variant);
                return V.standardMaterial(name || variant, hex, variant, options || {});
            };

            this.materials.grass = textured(P.grass, "grass", "meadow-grass", { repeat: [8, 8], seed: 11, bumpScale: 0.035 });
            this.materials.grassLight = textured(P.grassLight, "grass", "sunlit-meadow", { repeat: [7, 7], seed: 12, bumpScale: 0.03 });
            this.materials.grassDark = textured(P.grassDark, "grass", "mossy-grass", { repeat: [6, 6], seed: 13, bumpScale: 0.04 });
            this.materials.forest = textured(P.forest, "grass", "deep-forest", { repeat: [5, 5], seed: 14, bumpScale: 0.045 });
            this.materials.cliff = textured(P.cliff, "stone", "sun-cliff", { repeat: [5, 3], seed: 21, bumpScale: 0.12 });
            this.materials.cliffShade = textured(P.cliffShade, "stone", "shadow-cliff", { repeat: [4, 4], seed: 22, bumpScale: 0.14 });
            this.materials.path = textured(P.path, "stone", "worn-path", { repeat: [5, 2], seed: 23, bumpScale: 0.06 });
            this.materials.stone = textured(P.stone, "stone", "old-stone", { repeat: [3, 3], seed: 31, bumpScale: 0.09 });
            this.materials.stoneLight = textured(P.stoneLight, "marble", "moon-marble", { repeat: [4, 4], seed: 32, bumpScale: 0.045, roughness: 0.66, flatShading: false });
            this.materials.whiteStone = textured(P.whiteStone, "marble", "palace-stone", { repeat: [3, 3], seed: 33, bumpScale: 0.035, roughness: 0.58, flatShading: false });
            this.materials.stoneDark = textured(P.stoneDark, "stone", "ancient-dark-stone", { repeat: [3, 3], seed: 34, bumpScale: 0.12 });
            this.materials.brick = textured(P.brick, "brick", "rose-brick", { repeat: [3, 3], seed: 41, bumpScale: 0.1 });
            this.materials.brickDark = textured(P.brickDark, "brick", "wine-brick", { repeat: [3, 3], seed: 42, bumpScale: 0.1 });
            this.materials.cream = textured(P.cream, "stone", "warm-plaster", { repeat: [2, 2], seed: 51, bumpScale: 0.025, roughness: 0.8 });
            this.materials.roofRed = textured(P.roofRed, "roof", "ruby-roof", { repeat: [4, 4], seed: 61, bumpScale: 0.08 });
            this.materials.roofOrange = textured(P.roofOrange, "roof", "amber-roof", { repeat: [4, 4], seed: 62, bumpScale: 0.08 });
            this.materials.roofYellow = textured(P.roofYellow, "roof", "sun-roof", { repeat: [4, 4], seed: 63, bumpScale: 0.08 });
            this.materials.roofGreen = textured(P.roofGreen, "roof", "jade-roof", { repeat: [4, 4], seed: 64, bumpScale: 0.08 });
            this.materials.roofBlue = textured(P.roofBlue, "roof", "sapphire-roof", { repeat: [4, 4], seed: 65, bumpScale: 0.08 });
            this.materials.wood = textured(P.wood, "wood", "carved-wood", { repeat: [3, 3], seed: 71, bumpScale: 0.13 });
            this.materials.darkWood = textured(P.darkWood, "wood", "dark-carved-wood", { repeat: [3, 3], seed: 72, bumpScale: 0.14 });
            this.materials.canvas = textured(P.canvas, "cloth", "sail-cloth", { repeat: [2, 2], seed: 81, bumpScale: 0.035 });
            this.materials.bannerBlue = textured(P.bannerBlue, "cloth", "royal-banner-blue", { repeat: [2, 2], seed: 82, bumpScale: 0.04 });
            this.materials.bannerRose = textured(P.bannerRose, "cloth", "royal-banner-rose", { repeat: [2, 2], seed: 83, bumpScale: 0.04 });
            this.materials.gold = new THREE.MeshStandardMaterial({
                color: P.gold,
                emissive: 0x47320c,
                emissiveIntensity: 0.22,
                roughness: 0.34,
                metalness: 0.48
            });
            this.materials.waterFlat = new THREE.MeshStandardMaterial({
                color: P.water,
                roughness: 0.55,
                metalness: 0,
                transparent: true,
                opacity: 0.72
            });
            this.materials.window = new THREE.MeshStandardMaterial({
                color: 0x80dfff,
                roughness: 0.18,
                metalness: 0.02,
                emissive: 0x2269aa,
                emissiveIntensity: 0.55,
                transparent: true,
                opacity: 0.86
            });
            this.materials.shadow = new THREE.MeshStandardMaterial({
                color: 0x6f6049,
                transparent: true,
                opacity: 0.16,
                roughness: 1
            });
            this.materials.crystal = new THREE.MeshStandardMaterial({
                color: 0x8ef8ff,
                emissive: 0x24b9ff,
                emissiveIntensity: 0.92,
                roughness: 0.14,
                metalness: 0.05,
                transparent: true,
                opacity: 0.78,
                flatShading: true
            });
            this.materials.crystalRose = new THREE.MeshStandardMaterial({
                color: 0xff9dde,
                emissive: 0xff4fc7,
                emissiveIntensity: 0.72,
                roughness: 0.18,
                metalness: 0.04,
                transparent: true,
                opacity: 0.74,
                flatShading: true
            });
            this.materials.lanternCore = new THREE.MeshBasicMaterial({
                color: 0xfff1ac,
                transparent: true,
                opacity: 0.95,
                toneMapped: false
            });
        }

        paintedMaterial(hex, variant) {
            const canvas = document.createElement("canvas");
            canvas.width = 96;
            canvas.height = 96;
            const ctx = canvas.getContext("2d");
            const base = new THREE.Color(hex);
            const light = base.clone().offsetHSL(0, -0.03, 0.12);
            const dark = base.clone().offsetHSL(0, 0.04, -0.12);
            const rng = ns.mulberry32((hex ^ variant.length * 2654435761) >>> 0);

            ctx.fillStyle = hexCss(hex);
            ctx.fillRect(0, 0, 96, 96);

            if (variant.indexOf("wood") >= 0) {
                for (let i = 0; i < 16; i++) {
                    const x = i * 6 + rng() * 2;
                    ctx.strokeStyle = i % 2 ? hexCss(dark.getHex()) : hexCss(light.getHex());
                    ctx.globalAlpha = 0.28;
                    ctx.lineWidth = 1 + rng() * 2;
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.bezierCurveTo(x + rng() * 8 - 4, 24, x + rng() * 8 - 4, 58, x + rng() * 8 - 4, 96);
                    ctx.stroke();
                }
            } else if (variant.indexOf("stone") >= 0 || variant.indexOf("cliff") >= 0 || variant.indexOf("path") >= 0) {
                ctx.globalAlpha = 0.24;
                ctx.strokeStyle = hexCss(dark.getHex());
                for (let y = 0; y < 96; y += 18) {
                    ctx.beginPath();
                    ctx.moveTo(0, y + rng() * 4);
                    ctx.lineTo(96, y + rng() * 4);
                    ctx.stroke();
                }
                for (let x = 0; x < 96; x += 22) {
                    ctx.beginPath();
                    ctx.moveTo(x + rng() * 5, 0);
                    ctx.lineTo(x + rng() * 5, 96);
                    ctx.stroke();
                }
            } else if (variant.indexOf("roof") >= 0) {
                ctx.globalAlpha = 0.3;
                ctx.strokeStyle = hexCss(dark.getHex());
                for (let i = -96; i < 160; i += 12) {
                    ctx.beginPath();
                    ctx.moveTo(i, 96);
                    ctx.lineTo(i + 96, 0);
                    ctx.stroke();
                }
                ctx.globalAlpha = 0.16;
                ctx.strokeStyle = hexCss(light.getHex());
                for (let y = 8; y < 96; y += 16) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(96, y + rng() * 2);
                    ctx.stroke();
                }
            } else {
                for (let i = 0; i < 120; i++) {
                    ctx.fillStyle = rng() > 0.5 ? hexCss(light.getHex()) : hexCss(dark.getHex());
                    ctx.globalAlpha = 0.08 + rng() * 0.16;
                    ctx.fillRect(rng() * 96, rng() * 96, 1 + rng() * 5, 1 + rng() * 4);
                }
            }

            ctx.globalAlpha = 1;
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
            texture.anisotropy = 4;

            return new THREE.MeshStandardMaterial({
                map: texture,
                color: 0xffffff,
                flatShading: true,
                roughness: 0.92,
                metalness: 0
            });
        }

        basicMaterial(hex) {
            return new THREE.MeshStandardMaterial({
                color: hex,
                flatShading: true,
                roughness: 0.85,
                metalness: 0
            });
        }

        defineZones() {
            this.heightZones = [
                { id: "school", type: "rect", x: -166, z: -154, w: 184, d: 134, h: 14 },
                { id: "school-yard", type: "rect", x: -164, z: -80, w: 118, d: 50, h: 8 },
                { id: "capital-city", type: "rect", x: 158, z: -158, w: 196, d: 162, h: 10 },
                { id: "capital-palace", type: "rect", x: 158, z: -225, w: 112, d: 66, h: 24 },
                { id: "shopping", type: "rect", x: -210, z: 56, w: 168, d: 128, h: 3 },
                { id: "residential-lower", type: "rect", x: 28, z: 66, w: 172, d: 128, h: 5 },
                { id: "residential-mid", type: "rect", x: 36, z: 32, w: 132, d: 80, h: 10 },
                { id: "residential-upper", type: "rect", x: 52, z: -10, w: 92, d: 46, h: 16 },
                { id: "port-quay", type: "rect", x: 186, z: 154, w: 164, d: 78, h: 2.6 },
                { id: "port-market", type: "rect", x: 188, z: 108, w: 146, d: 62, h: 3.2 }
            ];

            this.dockZones = [
                { x: 184, z: 210, w: 26, d: 102, h: 3 },
                { x: 144, z: 205, w: 84, d: 18, h: 3 },
                { x: 222, z: 202, w: 80, d: 16, h: 3 },
                { x: 184, z: 256, w: 92, d: 18, h: 3 }
            ];

            this.portLandZones = [
                { x: 186, z: 154, w: 170, d: 88 },
                { x: 188, z: 108, w: 150, d: 70 }
            ];
        }

        addSkyRealm() {
            const skyMat = new THREE.MeshBasicMaterial({
                map: V && V.skyTexture ? V.skyTexture() : null,
                color: V && V.skyTexture ? 0xffffff : P.sky,
                side: THREE.BackSide,
                fog: false
            });
            skyMat.toneMapped = false;
            const sky = new THREE.Mesh(new THREE.SphereGeometry(920, 64, 36), skyMat);
            sky.position.set(0, 62, 0);
            sky.rotation.y = -0.36;
            this.scene.add(sky);
            this.skyDome = sky;

            this.addCelestialSprite(-370, 245, -520, 190, "rgba(255,232,170,0.95)");
            this.addCelestialSprite(330, 205, -390, 90, "rgba(139,219,255,0.75)");
            this.addCelestialSprite(-210, 170, 460, 72, "rgba(255,150,224,0.62)");

            this.addFloatingIsland(-260, 92, -430, 1.1, "blue");
            this.addFloatingIsland(280, 84, -355, 0.86, "rose");
            this.addFloatingIsland(80, 118, 415, 0.78, "gold");
        }

        addCelestialSprite(x, y, z, scale, color) {
            if (!V || !V.glowSprite) return;
            const mat = new THREE.SpriteMaterial({
                map: V.glowSprite(color),
                transparent: true,
                opacity: 0.95,
                depthWrite: false,
                fog: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false
            });
            const sprite = new THREE.Sprite(mat);
            sprite.position.set(x, y, z);
            sprite.scale.set(scale, scale, 1);
            this.scene.add(sprite);
            this.glowSprites.push({ sprite, baseScale: scale, baseOpacity: mat.opacity, pulse: 0.04, speed: 0.18 });
        }

        addFloatingIsland(x, y, z, scale, accent) {
            const group = new THREE.Group();
            group.position.set(x, y, z);
            group.scale.setScalar(scale);

            const rock = new THREE.Mesh(new THREE.ConeGeometry(28, 48, 7), this.materials.cliffShade);
            rock.position.y = -18;
            rock.rotation.y = 0.38;
            group.add(rock);

            const cap = new THREE.Mesh(new THREE.CylinderGeometry(31, 25, 8, 9), this.materials.grassDark);
            cap.position.y = 8;
            group.add(cap);

            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2 + 0.2;
                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 9, 7), this.materials.darkWood);
                trunk.position.y = 15;
                tree.add(trunk);
                const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(5.2, 1), this.materials.forest);
                leaf.position.y = 22;
                leaf.scale.y = 0.8;
                tree.add(leaf);
                tree.position.set(Math.cos(a) * 14, 0, Math.sin(a) * 11);
                group.add(tree);
            }

            const crystalMat = accent === "rose" ? this.materials.crystalRose : this.materials.crystal;
            const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(5.5, 0), crystalMat);
            crystal.position.set(0, 17, 0);
            crystal.scale.set(0.75, 1.9, 0.75);
            group.add(crystal);

            this.enableShadow(group);
            this.scene.add(group);
            this.animated.push({ kind: "float", obj: group, baseY: y, amp: 4 + scale * 2, speed: 0.22 + scale * 0.08 });
            this.addGlowSprite(x, y + 18 * scale, z, 34 * scale, accent === "rose" ? "rgba(255,98,202,0.55)" : "rgba(94,238,255,0.55)", false);
        }

        heightAt(x, z) {
            for (let i = 0; i < this.dockZones.length; i++) {
                if (rectHit(x, z, this.dockZones[i])) return this.dockZones[i].h;
            }

            let height = 0;
            for (let i = 0; i < this.heightZones.length; i++) {
                const zone = this.heightZones[i];
                const hit = zone.type === "ellipse" ? ellipseHit(x, z, zone) : rectHit(x, z, zone);
                if (hit) height = Math.max(height, zone.h);
            }

            return height;
        }

        isDock(x, z) {
            return this.dockZones.some((zone) => rectHit(x, z, zone));
        }

        isPortLand(x, z) {
            return this.portLandZones.some((zone) => rectHit(x, z, zone));
        }

        isSea(x, z) {
            if (this.isDock(x, z) || this.isPortLand(x, z)) return false;
            return z > 198 || (x > 298 && z > 90) || (x > 118 && z > 174);
        }

        isBoatAllowed(x, z) {
            return this.isSea(x, z);
        }

        getBoatDockingSpot(landPos, waterPos) {
            if (!this.isBoatAllowed(waterPos.x, waterPos.z)) return null;
            if (this.isSea(landPos.x, landPos.z)) return null;
            return {
                boat: { x: waterPos.x, z: waterPos.z },
                land: { x: landPos.x, z: landPos.z }
            };
        }

        isPortDockingArea(x, z) {
            const dx = x - this.boatSpawn.x;
            const dz = z - this.boatSpawn.z;
            return dx * dx + dz * dz <= 42 * 42 || this.isDock(x, z) || this.isNearDock(x, z, 24);
        }

        isNearDock(x, z, margin) {
            const pad = margin || 0;
            return this.dockZones.some((zone) => (
                x >= zone.x - zone.w / 2 - pad &&
                x <= zone.x + zone.w / 2 + pad &&
                z >= zone.z - zone.d / 2 - pad &&
                z <= zone.z + zone.d / 2 + pad
            ));
        }

        isBoatDockedAtPort(state) {
            return !!(state && state.boatDock && this.isPortDockingArea(state.boatDock.x, state.boatDock.z));
        }

        addSea() {
            const waterGeo = new THREE.PlaneGeometry(820, 680, 130, 100);
            waterGeo.rotateX(-Math.PI / 2);
            const waterMat = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    color: { value: new THREE.Color(P.water) },
                    deepColor: { value: new THREE.Color(P.waterDeep) },
                    sunDirection: { value: new THREE.Vector3(0.55, 0.8, 0.25).normalize() }
                },
                vertexShader: `
                    uniform float time;
                    varying vec3 vWorld;
                    varying float vWave;
                    void main() {
                        vec3 pos = position;
                        float waveA = sin(pos.x * 0.045 + time * 1.3) * 0.55;
                        float waveB = cos(pos.z * 0.055 + time * 1.0) * 0.45;
                        float waveC = sin((pos.x + pos.z) * 0.025 + time * 0.7) * 0.32;
                        vWave = waveA + waveB + waveC;
                        pos.y += vWave;
                        vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;
                        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 color;
                    uniform vec3 deepColor;
                    uniform vec3 sunDirection;
                    varying vec3 vWorld;
                    varying float vWave;
                    void main() {
                        vec3 dx = dFdx(vWorld);
                        vec3 dy = dFdy(vWorld);
                        vec3 normal = normalize(cross(dx, dy));
                        float light = max(dot(normal, sunDirection), 0.0);
                        float foam = smoothstep(0.6, 1.3, vWave);
                        vec3 surface = mix(deepColor, color, light * 0.55 + 0.45);
                        surface = mix(surface, vec3(0.95, 1.0, 0.95), foam * 0.45);
                        gl_FragColor = vec4(surface, 0.72);
                    }
                `,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                extensions: { derivatives: true }
            });

            const water = new THREE.Mesh(waterGeo, waterMat);
            water.position.set(0, C.waterLevel, 20);
            water.receiveShadow = false;
            this.scene.add(water);
            this.waterMeshes.push(water);

            const foamMat = new THREE.MeshBasicMaterial({ color: 0xe9fff7, transparent: true, opacity: 0.4 });
            this.createRibbon([[118, 183], [154, 190], [210, 196], [300, 204]], 5, foamMat, { constantY: C.waterLevel + 0.18 });
            this.createRibbon([[-335, 206], [-160, 211], [40, 208], [116, 196]], 4, foamMat, { constantY: C.waterLevel + 0.18 });
        }

        addBaseTerrain() {
            this.addBox(680, 16, 466, this.materials.cliff, 0, -8, -25);
            this.addBox(660, 0.35, 446, this.materials.grass, 0, 0.18, -25);

            this.addBox(690, 22, 14, this.materials.cliffShade, 0, -9, 210);
            this.addBox(690, 22, 12, this.materials.cliffShade, 0, -9, -258);
            this.addBox(12, 22, 466, this.materials.cliffShade, -346, -9, -25);
            this.addBox(12, 22, 466, this.materials.cliffShade, 326, -9, -25);

            this.addPlatform(-166, -154, 184, 134, 14, this.materials.grassLight);
            this.addPlatform(-164, -80, 118, 50, 8, this.materials.grassLight);
            this.addPlatform(158, -158, 196, 162, 10, this.materials.stoneLight);
            this.addPlatform(158, -225, 112, 66, 24, this.materials.stoneLight);
            this.addPlatform(-210, 56, 168, 128, 3, this.materials.grassLight);
            this.addPlatform(28, 66, 172, 128, 5, this.materials.grassLight);
            this.addPlatform(36, 32, 132, 80, 10, this.materials.grassLight);
            this.addPlatform(52, -10, 92, 46, 16, this.materials.grassLight);
            this.addPlatform(186, 154, 164, 78, 2.6, this.materials.stoneLight);
            this.addPlatform(188, 108, 146, 62, 3.2, this.materials.stoneLight);

            this.addLowWall(-166, -154, 184, 134, 14.2);
            this.addLowWall(158, -158, 196, 162, 10.3, this.materials.whiteStone);
            this.addLowWall(28, 66, 172, 128, 5.3);
        }

        addRoadsAndWaterways() {
            const river = [[-322, -224], [-262, -172], [-232, -84], [-204, 0], [-118, 26], [-22, 24], [66, 58], [132, 118], [260, 188]];
            this.createRibbon(river, 15, this.materials.waterFlat, { constantY: 0.45 });

            const mainRoads = [
                [[-166, -82], [-110, -74], [-44, -88], [36, -104], [74, -116]],
                [[-168, -84], [-188, -32], [-214, 32], [-220, 78]],
                [[-146, 64], [-72, 76], [8, 72], [72, 78], [130, 110], [172, 146]],
                [[160, -80], [168, -24], [178, 52], [184, 104]],
                [[-38, 32], [20, 24], [52, -2]]
            ];

            for (let i = 0; i < mainRoads.length; i++) {
                this.createRibbon(mainRoads[i], i === 0 ? 10 : 8, this.materials.path, { yOffset: 0.18 });
            }

            this.addBridge(-228, -54, 34, 11, -0.34);
            this.addBridge(-58, 26, 34, 10, Math.PI / 2);
            this.addBridge(148, 132, 42, 12, -0.72);
        }

        addSchoolDistrict() {
            this.addStonePlaza(-166, -102, 82, 38, 8.35, 0);
            this.addStairs(-166, -72, 54, 7, "south", 8, 0);
            this.addAcademy(-166, -158);

            this.addHouse(-238, -120, {
                w: 26, d: 22, h: 13, roof: "red", wall: this.materials.brick,
                rot: 0.12, sign: "dorm", label: "기숙사"
            });
            this.addObservatory(-90, -120);
            this.addChapel(-110, -206);
            this.addPyramidRuins(-292, -224);
            this.addAncientArch(-276, -54);
            this.addColosseum(-104, -28);
            this.addGiantTree(-38, -222);

            for (let i = 0; i < 46; i++) {
                const x = -308 + this.rng() * 270;
                const z = -244 + this.rng() * 240;
                if (x > -250 && x < -70 && z > -220 && z < -70) continue;
                if (this.isSea(x, z)) continue;
                this.addTree(x, z, 0.8 + this.rng() * 0.6, this.rng() > 0.45 ? "pine" : "round");
            }
        }

        addCapitalDistrict() {
            this.addCapitalWalls(158, -158, 196, 162);
            this.addStairs(158, -93, 68, 7, "south", 10, 3);
            this.addStonePlaza(158, -145, 92, 54, 10.35, 0);
            this.addFountain(158, -145, 10.6);
            this.addPalace(158, -226);

            const houses = [
                [86, -176, "orange", -0.2, 24, 20],
                [112, -112, "red", 0.18, 22, 18],
                [205, -120, "orange", -0.26, 23, 20],
                [232, -174, "yellow", 0.12, 22, 19],
                [94, -218, "green", 0.14, 20, 17],
                [218, -218, "blue", -0.18, 20, 18]
            ];
            houses.forEach((h, idx) => {
                this.addHouse(h[0], h[1], {
                    w: h[4], d: h[5], h: 11 + (idx % 2) * 2,
                    roof: h[2], wall: this.materials.cream, rot: h[3], sign: idx % 2 ? "office" : "noble"
                });
            });

            this.addDomeHall(236, -88);
            this.addClockTower(82, -88, 10.2, 18, this.materials.whiteStone, this.materials.roofBlue);

            for (let i = 0; i < 24; i++) {
                const x = 74 + this.rng() * 170;
                const z = -228 + this.rng() * 150;
                if (Math.abs(x - 158) < 34 && z < -172) continue;
                this.addTree(x, z, 0.55 + this.rng() * 0.4, "round", P.grassDark);
            }
        }

        addShoppingDistrict() {
            this.addStonePlaza(-214, 54, 56, 46, 3.35, 0.18);
            this.addSignPost(-214, 54, 3.6);
            this.addWell(-196, 62, 3.55);

            const shops = [
                [-268, 32, "orange", "bread", 0.26, 25, 20],
                [-230, -2, "yellow", "general", -0.16, 24, 18],
                [-168, 20, "green", "potion", 0.18, 23, 18],
                [-146, 72, "red", "blacksmith", -0.22, 26, 20],
                [-222, 116, "blue", "inn", 0.1, 31, 21],
                [-282, 86, "green", "cloth", -0.32, 22, 18],
                [-164, 112, "red", "magic", 0.22, 22, 18]
            ];
            shops.forEach((s) => {
                this.addHouse(s[0], s[1], {
                    w: s[5], d: s[6], h: 11,
                    roof: s[2], wall: this.materials.cream,
                    rot: s[4], sign: s[3], awning: true
                });
            });

            this.addMarketTent(-252, 70, P.roofYellow);
            this.addMarketTent(-188, 92, P.roofGreen);
            this.addCrateCluster(-156, 48, 3.4);
            this.addCrateCluster(-248, 104, 3.4);
            this.addFence(-294, 18, -286, 108, 3.5);
            this.addFence(-136, 24, -128, 108, 3.5);

            for (let i = 0; i < 20; i++) {
                const x = -292 + this.rng() * 170;
                const z = -2 + this.rng() * 130;
                if (Math.abs(x + 214) < 36 && Math.abs(z - 54) < 30) continue;
                this.addTree(x, z, 0.5 + this.rng() * 0.35, "round");
            }
        }

        addResidentialDistrict() {
            this.addStonePlaza(28, 66, 70, 54, 5.35, 0.16);
            this.addTotem(28, 66, 5.6, 1.25);
            this.addStairs(28, 28, 44, 5, "north", 10, 5);
            this.addStairs(20, 106, 56, 5, "south", 5, 0);

            const homes = [
                [-38, 38, "yellow", -0.18],
                [0, 116, "orange", 0.16],
                [72, 112, "red", -0.2],
                [94, 48, "green", 0.22],
                [-34, 84, "blue", 0.12],
                [58, 4, "orange", -0.16],
                [88, -18, "yellow", 0.18]
            ];
            homes.forEach((h, idx) => {
                this.addHouse(h[0], h[1], {
                    w: 23 + (idx % 2) * 5,
                    d: 19,
                    h: 9 + (idx % 3),
                    roof: h[2],
                    wall: this.materials.cream,
                    rot: h[3],
                    sign: idx % 3 === 0 ? "home" : "pot",
                    tribal: true
                });
            });

            this.addRoundRuin(-62, 54, 5.5);
            this.addRuinHall(62, -16, 16.3);
            this.addStorageArch(118, 76, 5.4);
            this.addLaundryLine(-12, 104, 5.8);
            this.addGardenPatch(98, 102, 5.4);
            this.addCrateCluster(-36, 116, 5.5);

            for (let i = 0; i < 34; i++) {
                const x = -64 + this.rng() * 210;
                const z = -36 + this.rng() * 170;
                if (Math.abs(x - 28) < 42 && Math.abs(z - 66) < 34) continue;
                this.addTree(x, z, 0.55 + this.rng() * 0.48, this.rng() > 0.72 ? "ancient" : "round");
            }
        }

        addPortDistrict() {
            this.addQuayDetails();
            this.addDocks();
            this.addMerchantShip(184, 260);
            this.dockBoat = this.addSmallBoat(this.portBoatDock.x, this.portBoatDock.z, 0.68, this.portBoatDock.heading, true);
            this.playerBoat = this.addSmallBoat(0, 0, 0.72, 0, true);
            this.playerBoat.visible = false;

            const buildings = [
                [124, 118, "orange", "fish", 0.12, 26, 20],
                [162, 96, "green", "fruit", -0.14, 24, 18],
                [204, 96, "red", "trade", 0.16, 30, 20],
                [248, 122, "blue", "inn", -0.18, 27, 20],
                [224, 158, "yellow", "repair", 0.08, 28, 20]
            ];
            buildings.forEach((b) => {
                this.addHouse(b[0], b[1], {
                    w: b[5], d: b[6], h: 11,
                    roof: b[2], wall: this.materials.cream,
                    rot: b[4], sign: b[3], awning: true
                });
            });

            this.addCrateCluster(160, 166, 3.1);
            this.addCrateCluster(208, 182, 3.1);
            this.addBarrels(126, 162, 3.1);
            this.addMarketTent(140, 94, P.roofGreen);
            this.addMarketTent(188, 132, P.roofRed);
            this.addHarborWall();
        }

        addForestsAndEdges() {
            const clusters = [
                [-315, -126, 64, 120, 34],
                [-305, 86, 58, 120, 28],
                [294, -10, 42, 160, 22],
                [0, -248, 230, 24, 24],
                [-12, 194, 250, 18, 18]
            ];

            clusters.forEach((cluster) => {
                for (let i = 0; i < cluster[4]; i++) {
                    const x = cluster[0] + (this.rng() - 0.5) * cluster[2];
                    const z = cluster[1] + (this.rng() - 0.5) * cluster[3];
                    if (this.isSea(x, z)) continue;
                    this.addTree(x, z, 0.75 + this.rng() * 0.75, this.rng() > 0.38 ? "round" : "pine");
                }
            });

            for (let i = 0; i < 48; i++) {
                const side = Math.floor(this.rng() * 4);
                let x = -330 + this.rng() * 640;
                let z = -240 + this.rng() * 430;
                if (side === 0) z = -244 + this.rng() * 24;
                if (side === 1) z = 176 + this.rng() * 28;
                if (side === 2) x = -332 + this.rng() * 26;
                if (side === 3) x = 296 + this.rng() * 26;
                if (this.isSea(x, z)) continue;
                this.addRock(x, z, 1.2 + this.rng() * 1.8);
            }
        }

        addFantasyDetails() {
            this.addRuneCircle(-166, -102, 8.55, 23, 0x72f7e8, 0.42);
            this.addRuneCircle(158, -145, 10.58, 20, 0xffd36f, 0.38);
            this.addRuneCircle(-214, 54, 3.58, 17, 0x9cf8b8, 0.36);
            this.addRuneCircle(28, 66, 5.58, 21, 0xff8ed8, 0.34);
            this.addRuneCircle(184, 154, 3.38, 24, 0x74d8ff, 0.34);
            this.addRuneCircle(-292, -224, this.heightAt(-292, -224) + 0.2, 15, 0xffb45d, 0.3);

            this.addDistrictSign("루루 아카데미", -166, -65, 10.5, 0, 0x274f9e);
            this.addDistrictSign("왕도 루미나", 158, -88, 12.8, Math.PI, 0xb9477a);
            this.addDistrictSign("별빛 상점가", -214, 22, 6.1, 0.08, 0x4f9a6b);
            this.addDistrictSign("달정원 마을", 24, 128, 8.0, Math.PI, 0xd77b3f);
            this.addDistrictSign("하늘항구", 184, 198, 6.1, Math.PI, 0x3f70c8);

            [
                [-92, -122, 1.1, "blue"], [-38, -222, 1.35, "rose"], [-272, -52, 0.9, "gold"],
                [142, -198, 1.05, "gold"], [236, -88, 0.95, "blue"], [82, -88, 0.8, "rose"],
                [-188, 92, 0.85, "gold"], [-252, 70, 0.78, "blue"], [98, 102, 0.82, "rose"],
                [118, 76, 0.78, "blue"], [122, 196, 0.9, "blue"], [252, 184, 0.95, "gold"]
            ].forEach((c) => this.addCrystalCluster(c[0], c[1], c[2], c[3]));

            [
                [-238, -84, 8.5, 0x274f9e, 0.2, "A"], [-96, -82, 8.5, 0xb9477a, -0.2, "M"],
                [112, -82, 11.8, 0xb9477a, 0.08, "L"], [206, -82, 11.8, 0x274f9e, -0.08, "R"],
                [-294, 16, 4.8, 0x4f9a6b, 0.2, "S"], [-136, 22, 4.8, 0xd77b3f, -0.18, "G"],
                [-42, 116, 7.0, 0xd77b3f, 0.1, "H"], [96, 32, 12.6, 0x274f9e, -0.22, "N"],
                [112, 156, 5.4, 0x3f70c8, 0.18, "P"], [270, 154, 5.4, 0xb9477a, -0.18, "T"]
            ].forEach((b) => this.addBanner(b[0], b[1], b[2], b[3], b[4], b[5]));

            [
                [-214, -70], [-166, -78], [-118, -76], [-44, -88], [36, -104], [74, -116],
                [-214, 30], [-220, 78], [-72, 76], [8, 72], [72, 78], [130, 110],
                [168, -24], [178, 52], [184, 104], [184, 156], [156, 194], [212, 194]
            ].forEach((p, i) => this.addLantern(p[0], p[1], i % 3 === 0 ? 0x74eed9 : (i % 3 === 1 ? 0xffcc73 : 0xff7bd6)));

            this.addFlowerMeadow(-166, -88, 124, 42, 42, [P.flowerPink, P.flowerBlue, P.roofYellow]);
            this.addFlowerMeadow(-214, 78, 116, 54, 38, [P.roofYellow, P.flowerPink, P.grassLight]);
            this.addFlowerMeadow(28, 104, 138, 64, 48, [P.flowerPink, P.flowerBlue, P.roofGreen]);
            this.addFlowerMeadow(158, -176, 132, 60, 34, [P.roofYellow, P.flowerBlue, P.whiteStone]);

            this.addWaterfallRibbon(-328, -214, -258, -172, 18, 0.52);
            this.addWaterfallRibbon(272, 180, 318, 220, 12, 0.46);
        }

        rgbaFromHex(hex, alpha) {
            const c = new THREE.Color(hex);
            return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
        }

        addRuneCircle(x, z, y, radius, color, opacity) {
            if (!V || !V.runeTexture) return null;
            const mat = new THREE.MeshBasicMaterial({
                map: V.runeTexture(this.rgbaFromHex(color, 0.9), Math.floor(radius * 97 + x * 3 - z)),
                transparent: true,
                opacity: opacity || 0.36,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                toneMapped: false
            });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
            mesh.position.set(x, y + 0.04, z);
            mesh.rotation.x = -Math.PI / 2;
            mesh.renderOrder = 3;
            this.scene.add(mesh);
            this.animated.push({ kind: "rune", obj: mesh, speed: 0.025 + radius * 0.001, baseOpacity: mat.opacity });
            return mesh;
        }

        addGlowSprite(x, y, z, scale, color, track) {
            if (!V || !V.glowSprite) return null;
            const mat = new THREE.SpriteMaterial({
                map: V.glowSprite(color),
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
                fog: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false
            });
            const sprite = new THREE.Sprite(mat);
            sprite.position.set(x, y, z);
            sprite.scale.set(scale, scale, 1);
            this.scene.add(sprite);
            if (track !== false) {
                this.glowSprites.push({ sprite, baseScale: scale, baseOpacity: mat.opacity, pulse: 0.12, speed: 0.8 + this.rng() * 0.7 });
            }
            return sprite;
        }

        addCrystalCluster(x, z, scale, tone) {
            const y = this.heightAt(x, z);
            const group = new THREE.Group();
            group.position.set(x, y, z);
            const mat = tone === "rose" ? this.materials.crystalRose : this.materials.crystal;
            const count = 4 + Math.floor(this.rng() * 3);
            for (let i = 0; i < count; i++) {
                const a = (i / count) * Math.PI * 2 + this.rng() * 0.4;
                const r = (1.6 + this.rng() * 4.5) * scale;
                const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.4 + this.rng() * 1.8, 0), mat);
                crystal.position.set(Math.cos(a) * r, 2.4 * scale, Math.sin(a) * r);
                crystal.scale.set(0.55 * scale, (1.6 + this.rng() * 1.4) * scale, 0.55 * scale);
                crystal.rotation.set(this.rng() * 0.25, this.rng() * Math.PI, this.rng() * 0.25);
                group.add(crystal);
            }
            this.enableShadow(group);
            this.scene.add(group);
            const color = tone === "rose" ? "rgba(255,92,202,0.58)" : tone === "gold" ? "rgba(255,207,104,0.55)" : "rgba(96,235,255,0.55)";
            this.addGlowSprite(x, y + 5.6 * scale, z, 13 * scale, color);
            if (scale > 1.2) {
                const light = new THREE.PointLight(tone === "rose" ? 0xff68ce : tone === "gold" ? 0xffcf75 : 0x65eaff, 0.75, 56, 2);
                light.position.set(x, y + 8 * scale, z);
                this.scene.add(light);
                this.animated.push({ kind: "light", obj: light, baseIntensity: 0.75, speed: 1.2 + this.rng() });
            }
            this.animated.push({ kind: "spin", obj: group, speed: 0.03 + this.rng() * 0.03 });
        }

        addLantern(x, z, color) {
            const y = this.heightAt(x, z);
            const post = this.addCylinder(0.35, 0.45, 9, this.materials.darkWood, x, y + 4.5, z, 8);
            const arm = this.addBox(5.5, 0.35, 0.35, this.materials.darkWood, x + 1.8, y + 8.4, z, 0);
            const lamp = this.addSphere(1.15, this.materials.lanternCore, x + 4.4, y + 7.7, z, 0.88);
            const c = this.rgbaFromHex(color, 0.86);
            this.addGlowSprite(x + 4.4, y + 7.7, z, 10, c);
            lamp.castShadow = false;
        }

        addBanner(x, z, y, color, rotY, crest) {
            if (!V || !V.bannerTexture) return;
            const group = new THREE.Group();
            group.position.set(x, y, z);
            group.rotation.y = rotY || 0;
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 13, 8), this.materials.darkWood);
            pole.position.y = 6.5;
            group.add(pole);
            const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.45, 0.45), this.materials.gold);
            bar.position.set(2.4, 12.4, 0);
            group.add(bar);
            const mat = new THREE.MeshBasicMaterial({
                map: V.bannerTexture(color, crest),
                transparent: true,
                side: THREE.DoubleSide,
                alphaTest: 0.03,
                toneMapped: false
            });
            const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 8.7), mat);
            banner.position.set(2.4, 8.0, 0.08);
            group.add(banner);
            this.enableShadow(group);
            this.scene.add(group);
            this.animated.push({ kind: "sway", obj: banner, baseRot: 0, speed: 0.9 + this.rng() * 0.6, amp: 0.045 });
        }

        addDistrictSign(text, x, z, y, rotY, color) {
            if (!V || !V.signTexture) return;
            const group = new THREE.Group();
            group.position.set(x, y, z);
            group.rotation.y = rotY || 0;
            const tex = V.signTexture(text, {
                bg: V.colorCss(color),
                fg: "#ffe9b8",
                glow: this.rgbaFromHex(color === 0x4f9a6b ? 0x7af5ae : color, 0.95)
            });
            const mat = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                side: THREE.DoubleSide,
                toneMapped: false
            });
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 6.8), mat);
            sign.position.y = 7.2;
            group.add(sign);
            const left = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 10, 8), this.materials.darkWood);
            left.position.set(-10, 4.4, -0.15);
            const right = left.clone();
            right.position.x = 10;
            group.add(left, right);
            this.enableShadow(group);
            this.scene.add(group);
            this.addGlowSprite(x, y + 7.4, z, 18, this.rgbaFromHex(color, 0.22));
        }

        addFlowerMeadow(cx, cz, w, d, count, colors) {
            const mats = colors.map((c) => this.basicMaterial(c));
            for (let i = 0; i < count; i++) {
                const x = cx + (this.rng() - 0.5) * w;
                const z = cz + (this.rng() - 0.5) * d;
                if (this.isSea(x, z)) continue;
                const y = this.heightAt(x, z);
                const mat = mats[i % mats.length];
                const stem = this.addCylinder(0.08, 0.1, 0.9, this.materials.grassDark, x, y + 0.45, z, 5);
                stem.castShadow = false;
                stem.receiveShadow = false;
                const bloom = this.addSphere(0.55 + this.rng() * 0.35, mat, x, y + 1.05, z, 0.35);
                bloom.castShadow = false;
                bloom.receiveShadow = false;
            }
        }

        addWaterfallRibbon(x1, z1, x2, z2, width, opacity) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xdffcff,
                transparent: true,
                opacity: opacity || 0.45,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            const mesh = this.createRibbon([[x1, z1], [(x1 + x2) / 2, (z1 + z2) / 2], [x2, z2]], width, mat, { constantY: C.waterLevel + 0.42 });
            this.animated.push({ kind: "water-ribbon", obj: mesh, baseOpacity: mat.opacity, speed: 1.3 + this.rng() });
        }

        registerPlaces() {
            this.places = [
                {
                    id: "school", label: "학교 메뉴", title: "학교",
                    x: -166, z: -112, radius: 98, zoneRadius: 104,
                    body: "붉은 벽돌 아카데미와 시계탑, 기숙사, 연구동이 이어진 테스트 허브입니다.",
                    items: ["수업 테스트", "기숙사", "연구동", "훈련장"]
                },
                {
                    id: "capital", label: "수도 메뉴", title: "수도",
                    x: 158, z: -145, radius: 110, zoneRadius: 112,
                    body: "하얀 성벽과 파란 지붕의 왕궁, 중앙 광장, 관리 건물이 있는 수도 구역입니다.",
                    items: ["왕궁 알현", "광장 게시판", "관리 사무소"]
                },
                {
                    id: "shopping", label: "상점가 메뉴", title: "상점가",
                    x: -214, z: 54, radius: 98, zoneRadius: 98,
                    body: "빵집, 약초상, 대장간, 여관 간판이 모여 있는 생활형 상업 구역입니다.",
                    items: ["빵집", "약초상", "대장간", "여관"]
                },
                {
                    id: "residential", label: "거주지역 대화", title: "거주지역",
                    x: 28, z: 66, radius: 104, zoneRadius: 104,
                    body: "토템과 공동 마당을 중심으로 계단식 집과 오래된 석조 유적이 섞여 있습니다.",
                    items: ["주민 인사", "공동 마당", "마을 회관"]
                },
                {
                    id: "port", label: "항구 메뉴", title: "항구",
                    x: 182, z: 164, radius: 112, zoneRadius: 112,
                    body: "목조 부두, 무역선, 작은 돛단배가 있는 바다 출입구입니다.",
                    items: ["돛단배", "무역소", "선원 여관"]
                }
            ];

            this.places.forEach((place) => this.collision.addInteraction(place));
        }

        getLocation(x, z, state) {
            if (state && state.onBoat && this.isSea(x, z)) return "바다";
            if (this.isSea(x, z)) return "바다";

            for (let i = 0; i < this.places.length; i++) {
                const place = this.places[i];
                const dx = x - place.x;
                const dz = z - place.z;
                if (dx * dx + dz * dz < place.zoneRadius * place.zoneRadius) {
                    return place.title;
                }
            }
            return "필드";
        }

        handleInteraction(item, state, ui) {
            if (!item) return null;

            if (item.id === "port") {
                if (state.onBoat) {
                    state.hasBoat = false;
                    state.onBoat = false;
                    state.boatDock = null;
                    ui.setBoatStatus("미보유");
                    ui.showDialog({
                        title: "항구",
                        body: "돛단배를 항구에 반납하고 부두로 내렸습니다. 필요하면 다시 항구에서 빌릴 수 있습니다.",
                        items: ["돛단배 반납", "정박 완료", "항구 거리"]
                    });
                    return { moveTo: this.portLanding, mode: "land" };
                }

                if (!state.hasBoat) {
                    state.hasBoat = true;
                    state.onBoat = true;
                    state.boatDock = null;
                    ui.setBoatStatus("승선 중");
                    ui.showDialog({
                        title: "항구",
                        body: "항구 관리인이 작은 돛단배를 내어줬습니다. 이제 바다 위로 이동할 수 있습니다.",
                        items: ["작은 돛단배 획득", "출항 테스트", "바다 진입 허용"]
                    });
                    return { moveTo: this.boatSpawn, mode: "boat" };
                }

                if (this.isBoatDockedAtPort(state)) {
                    state.hasBoat = false;
                    state.boatDock = null;
                    ui.setBoatStatus("미보유");
                    ui.showDialog({
                        title: "항구",
                        body: "정박해 둔 돛단배를 항구에 반납했습니다. 이제 항구에서 다시 대여할 수 있습니다.",
                        items: ["돛단배 반납", "대여 가능", "항구 거리"]
                    });
                    return null;
                }

                ui.showDialog({
                    title: "항구",
                    body: "빌린 돛단배가 아직 다른 해안에 정박해 있습니다. 정박한 곳으로 돌아가 배를 타고 항구까지 가져와야 반납할 수 있습니다.",
                    items: ["추가 대여 불가", "정박 위치 복귀", "항구 반납 필요"]
                });
                return null;
            }

            ui.showDialog({
                title: item.title,
                body: item.body,
                items: item.items
            });
            return null;
        }

        showSeaDialog(ui) {
            ui.showDialog({
                title: "바다",
                body: "돛단배에 탄 상태로만 접근 가능한 테스트 바다입니다. 잔잔한 물결과 항구 주변 항로를 확인할 수 있습니다.",
                items: ["항해 테스트", "낚시 메뉴", "항구 복귀"]
            });
        }

        updateAnimated(time, camera, state) {
            for (let i = 0; i < this.waterMeshes.length; i++) {
                const mesh = this.waterMeshes[i];
                if (mesh.material && mesh.material.uniforms && mesh.material.uniforms.time) {
                    mesh.material.uniforms.time.value = time;
                }
            }

            if (this.skyDome) {
                this.skyDome.rotation.y = -0.36 + time * 0.006;
            }

            for (let i = 0; i < this.animated.length; i++) {
                const item = this.animated[i];
                if (!item || !item.obj) continue;
                if (item.kind === "rune") {
                    item.obj.rotation.z += item.speed;
                    if (item.obj.material) item.obj.material.opacity = item.baseOpacity * (0.78 + Math.sin(time * 1.8 + i) * 0.18);
                } else if (item.kind === "float") {
                    item.obj.position.y = item.baseY + Math.sin(time * item.speed + i) * item.amp;
                    item.obj.rotation.y += 0.0025;
                } else if (item.kind === "spin") {
                    item.obj.rotation.y += item.speed;
                } else if (item.kind === "sway") {
                    item.obj.rotation.y = item.baseRot + Math.sin(time * item.speed + i) * item.amp;
                } else if (item.kind === "light") {
                    item.obj.intensity = item.baseIntensity * (0.76 + Math.sin(time * item.speed + i) * 0.18);
                } else if (item.kind === "water-ribbon" && item.obj.material) {
                    item.obj.material.opacity = item.baseOpacity * (0.78 + Math.sin(time * item.speed + i) * 0.14);
                }
            }

            for (let i = 0; i < this.glowSprites.length; i++) {
                const item = this.glowSprites[i];
                const pulse = 1 + Math.sin(time * item.speed + i) * item.pulse;
                item.sprite.scale.set(item.baseScale * pulse, item.baseScale * pulse, 1);
                if (item.sprite.material) item.sprite.material.opacity = item.baseOpacity * (0.84 + Math.sin(time * item.speed + i) * 0.12);
            }

            if (this.cloudGroup) {
                this.cloudGroup.position.x = Math.sin(time * 0.045) * 26;
                this.cloudGroup.position.z = Math.cos(time * 0.035) * 14;
            }

            if (this.playerBoat) {
                if (state.onBoat) {
                    camera.getWorldDirection(this.tmpVec);
                    const angle = Math.atan2(this.tmpVec.x, this.tmpVec.z);
                    this.playerBoat.visible = true;
                    this.playerBoat.position.set(camera.position.x, C.waterLevel + 0.28, camera.position.z);
                    this.playerBoat.rotation.y = angle;
                    if (this.dockBoat) this.dockBoat.visible = false;
                } else {
                    this.playerBoat.visible = false;
                    if (this.dockBoat) {
                        const dock = state.hasBoat && state.boatDock ? state.boatDock : this.portBoatDock;
                        this.dockBoat.visible = true;
                        this.dockBoat.position.set(dock.x, C.waterLevel + 0.25, dock.z);
                        this.dockBoat.rotation.y = typeof dock.heading === "number" ? dock.heading : this.portBoatDock.heading;
                    }
                }
            }
        }

        addPlatform(x, z, w, d, h, topMat) {
            this.addBox(w, h, d, this.materials.cliff, x, h / 2, z);
            this.addBox(w - 2, 0.45, d - 2, topMat || this.materials.grass, x, h + 0.1, z);
        }

        addLowWall(x, z, w, d, y, mat) {
            const material = mat || this.materials.stone;
            const h = 2.8;
            this.addBox(w, h, 2.4, material, x, y + h / 2, z - d / 2);
            this.addBox(w, h, 2.4, material, x, y + h / 2, z + d / 2);
            this.addBox(2.4, h, d, material, x - w / 2, y + h / 2, z);
            this.addBox(2.4, h, d, material, x + w / 2, y + h / 2, z);
        }

        addStonePlaza(x, z, w, d, y, rot) {
            const mesh = this.addBox(w, 0.35, d, this.materials.stoneLight, x, y, z, rot || 0);
            mesh.receiveShadow = true;
        }

        addBox(w, h, d, material, x, y, z, rotY) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            mesh.position.set(x, y, z);
            mesh.rotation.y = rotY || 0;
            this.enableShadow(mesh);
            this.scene.add(mesh);
            return mesh;
        }

        addCylinder(radiusTop, radiusBottom, height, material, x, y, z, segments) {
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments || 12), material);
            mesh.position.set(x, y, z);
            this.enableShadow(mesh);
            this.scene.add(mesh);
            return mesh;
        }

        addCone(radius, height, material, x, y, z, segments) {
            const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments || 12), material);
            mesh.position.set(x, y, z);
            this.enableShadow(mesh);
            this.scene.add(mesh);
            return mesh;
        }

        addSphere(radius, material, x, y, z, scaleY) {
            const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), material);
            mesh.position.set(x, y, z);
            mesh.scale.y = scaleY || 1;
            this.enableShadow(mesh);
            this.scene.add(mesh);
            return mesh;
        }

        enableShadow(obj) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            if (obj.traverse) {
                obj.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
            }
        }

        createRibbon(points, width, material, options) {
            const opts = options || {};
            const verts = [];
            const uvs = [];
            const indices = [];
            const half = width / 2;

            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                const prev = points[Math.max(0, i - 1)];
                const next = points[Math.min(points.length - 1, i + 1)];
                const x = p[0];
                const z = p[1];
                const dx = next[0] - prev[0];
                const dz = next[1] - prev[1];
                const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
                const nx = -dz / len;
                const nz = dx / len;
                const y = opts.constantY !== undefined ? opts.constantY : this.heightAt(x, z) + (opts.yOffset || 0.12);

                verts.push(x + nx * half, y, z + nz * half);
                verts.push(x - nx * half, y, z - nz * half);
                uvs.push(0, i / 3, 1, i / 3);

                if (i < points.length - 1) {
                    const a = i * 2;
                    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
                }
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
            geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
            geo.setIndex(indices);
            geo.computeVertexNormals();
            const mesh = new THREE.Mesh(geo, material);
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        }

        addBridge(x, z, w, d, rot) {
            const y = this.heightAt(x, z) + 1.2;
            const bridge = new THREE.Group();
            bridge.position.set(x, y, z);
            bridge.rotation.y = rot || 0;
            const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), this.materials.wood);
            deck.position.y = 0;
            bridge.add(deck);
            for (let i = -1; i <= 1; i += 2) {
                const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 2, 1), this.materials.darkWood);
                rail.position.set(0, 1.2, i * d / 2);
                bridge.add(rail);
            }
            this.enableShadow(bridge);
            this.scene.add(bridge);
            this.collision.addObstacle(x, z, Math.max(w, d) * 0.2);
        }

        roofMaterial(name) {
            if (name === "blue") return this.materials.roofBlue;
            if (name === "green") return this.materials.roofGreen;
            if (name === "yellow") return this.materials.roofYellow;
            if (name === "red") return this.materials.roofRed;
            return this.materials.roofOrange;
        }

        makeRoofGeometry(w, d, h) {
            const hw = w / 2;
            const hd = d / 2;
            const verts = [
                -hw, 0, -hd, hw, 0, -hd, 0, h, -hd,
                -hw, 0, hd, hw, 0, hd, 0, h, hd
            ];
            const idx = [
                0, 1, 2, 4, 3, 5,
                3, 0, 2, 3, 2, 5,
                1, 4, 5, 1, 5, 2,
                0, 3, 4, 0, 4, 1
            ];
            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
            geo.setIndex(idx);
            geo.computeVertexNormals();
            return geo;
        }

        addHouse(x, z, opts) {
            const y = this.heightAt(x, z);
            const group = new THREE.Group();
            const w = opts.w || 24;
            const d = opts.d || 18;
            const h = opts.h || 10;
            const wall = opts.wall || this.materials.cream;
            const roofMat = this.roofMaterial(opts.roof);

            group.position.set(x, y, z);
            group.rotation.y = opts.rot || 0;

            const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 2.2, 1.3, d + 2.2), this.materials.stone);
            plinth.position.y = 0.65;
            group.add(plinth);

            const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
            base.position.y = h / 2 + 0.8;
            group.add(base);

            const roof = new THREE.Mesh(this.makeRoofGeometry(w + 4, d + 4, 6), roofMat);
            roof.position.y = h + 0.8;
            group.add(roof);

            const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + 5, 0.55, 0.7), this.materials.gold);
            ridge.position.set(0, h + 6.8, 0);
            group.add(ridge);

            const door = new THREE.Mesh(new THREE.BoxGeometry(4.2, 6, 0.55), this.materials.darkWood);
            door.position.set(0, 3.8, -d / 2 - 0.28);
            group.add(door);
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), this.materials.gold);
            knob.position.set(1.25, 3.9, -d / 2 - 0.66);
            group.add(knob);

            for (let i = -1; i <= 1; i += 2) {
                const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 0.45), this.materials.window);
                windowMesh.position.set(i * w * 0.28, 7.0, -d / 2 - 0.3);
                group.add(windowMesh);
                const frameH = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.35, 0.62), this.materials.gold);
                frameH.position.set(i * w * 0.28, 8.75, -d / 2 - 0.62);
                group.add(frameH);
                const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.6, 0.62), this.materials.gold);
                frameL.position.set(i * w * 0.28 - 1.9, 7.0, -d / 2 - 0.62);
                const frameR = frameL.clone();
                frameR.position.x = i * w * 0.28 + 1.9;
                group.add(frameL, frameR);
            }

            const chimney = new THREE.Mesh(new THREE.BoxGeometry(2.5, 5, 2.5), this.materials.brickDark);
            chimney.position.set(w * 0.25, h + 4.8, 1);
            group.add(chimney);

            if (opts.awning) {
                const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 1.4, 4.8), this.roofMaterial(opts.roof === "yellow" ? "green" : "yellow"));
                awning.position.set(0, 5.5, -d / 2 - 2.7);
                group.add(awning);
            }

            if (opts.tribal) {
                for (let i = -1; i <= 1; i += 2) {
                    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.6, h * 0.7, 0.45), this.materials.roofRed);
                    stripe.position.set(i * w * 0.38, h * 0.46, -d / 2 - 0.32);
                    group.add(stripe);
                }
            }

            this.addSignIcon(group, opts.sign || "home", 0, h + 0.5, -d / 2 - 1.2);
            this.enableShadow(group);
            this.scene.add(group);
            this.collision.addObstacle(x, z, Math.max(w, d) * 0.45);
            return group;
        }

        addSignIcon(group, kind, x, y, z) {
            const board = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3, 0.5), this.materials.wood);
            board.position.set(x, y, z);
            group.add(board);

            let icon;
            if (kind === "potion" || kind === "magic") {
                icon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), this.basicMaterial(kind === "magic" ? P.roofBlue : P.roofGreen));
            } else if (kind === "bread" || kind === "inn") {
                icon = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.34, 8, 14), this.basicMaterial(kind === "bread" ? P.roofYellow : P.roofOrange));
            } else if (kind === "blacksmith" || kind === "repair") {
                icon = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.7), this.basicMaterial(P.stoneDark));
            } else if (kind === "fish") {
                icon = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.4, 3), this.basicMaterial(P.waterDeep));
                icon.rotation.z = Math.PI / 2;
            } else if (kind === "fruit") {
                icon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), this.basicMaterial(P.roofOrange));
            } else if (kind === "trade") {
                icon = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 0.7), this.materials.gold);
            } else {
                icon = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 0.7), this.basicMaterial(P.grassDark));
            }
            icon.position.set(x, y, z - 0.45);
            group.add(icon);
        }

        addAcademy(x, z) {
            const y = this.heightAt(x, z);
            const group = new THREE.Group();
            group.position.set(x, y, z);

            const main = new THREE.Mesh(new THREE.BoxGeometry(74, 24, 34), this.materials.brick);
            main.position.y = 12;
            group.add(main);
            const roof = new THREE.Mesh(this.makeRoofGeometry(82, 40, 12), this.materials.roofRed);
            roof.position.y = 24;
            group.add(roof);

            const hall = new THREE.Mesh(new THREE.BoxGeometry(32, 18, 24), this.materials.brickDark);
            hall.position.set(0, 9, -26);
            group.add(hall);
            const hallRoof = new THREE.Mesh(this.makeRoofGeometry(38, 30, 9), this.materials.roofRed);
            hallRoof.position.set(0, 18, -26);
            group.add(hallRoof);

            const tower = new THREE.Mesh(new THREE.BoxGeometry(18, 42, 18), this.materials.stone);
            tower.position.set(0, 21, -2);
            group.add(tower);
            const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(13, 22, 6), this.materials.roofBlue);
            towerRoof.position.set(0, 53, -2);
            group.add(towerRoof);
            const towerCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(4.5, 0), this.materials.crystal);
            towerCrystal.position.set(0, 67, -2);
            towerCrystal.scale.set(0.7, 1.8, 0.7);
            group.add(towerCrystal);
            const clock = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.6, 24), this.materials.canvas);
            clock.position.set(0, 36, -11.2);
            clock.rotation.x = Math.PI / 2;
            group.add(clock);
            const roseWindow = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.55, 32), this.materials.window);
            roseWindow.position.set(0, 23, -17.7);
            roseWindow.rotation.x = Math.PI / 2;
            group.add(roseWindow);
            const roseTrim = new THREE.Mesh(new THREE.TorusGeometry(6.35, 0.28, 8, 28), this.materials.gold);
            roseTrim.position.copy(roseWindow.position);
            roseTrim.rotation.x = Math.PI / 2;
            group.add(roseTrim);

            for (let i = -1; i <= 1; i++) {
                for (let j = 0; j < 2; j++) {
                    const win = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.5), this.materials.window);
                    win.position.set(i * 24, 10 + j * 8, -17.4);
                    group.add(win);
                }
            }

            for (let i = -1; i <= 1; i += 2) {
                const wing = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 26), this.materials.brick);
                wing.position.set(i * 52, 8, 0);
                group.add(wing);
                const wingRoof = new THREE.Mesh(this.makeRoofGeometry(34, 32, 8), this.materials.roofRed);
                wingRoof.position.set(i * 52, 16, 0);
                group.add(wingRoof);
            }

            this.enableShadow(group);
            this.scene.add(group);
            this.addGlowSprite(x, y + 68, z - 2, 24, "rgba(96,235,255,0.42)");
            const light = new THREE.PointLight(0x7ff5ff, 0.85, 86, 2);
            light.position.set(x, y + 52, z - 12);
            this.scene.add(light);
            this.animated.push({ kind: "light", obj: light, baseIntensity: 0.85, speed: 0.9 });
            this.collision.addObstacle(x, z, 42);
        }

        addObservatory(x, z) {
            const y = this.heightAt(x, z);
            this.addCylinder(10, 11, 18, this.materials.stone, x, y + 9, z, 18);
            this.addSphere(11, this.materials.roofBlue, x, y + 21, z, 0.55);
            this.addCylinder(2, 2, 18, this.materials.darkWood, x + 6, y + 28, z - 2, 12).rotation.z = Math.PI / 2.8;
            this.collision.addObstacle(x, z, 13);
        }

        addChapel(x, z) {
            this.addHouse(x, z, { w: 28, d: 34, h: 14, roof: "blue", wall: this.materials.stone, rot: -0.2, sign: "chapel" });
            const y = this.heightAt(x, z);
            this.addCone(6, 18, this.materials.roofBlue, x - 11, y + 31, z - 12, 6);
        }

        addPyramidRuins(x, z) {
            const y = this.heightAt(x, z);
            for (let i = 0; i < 4; i++) {
                this.addBox(40 - i * 8, 4, 40 - i * 8, this.materials.cliff, x, y + 2 + i * 4, z);
            }
            this.addBox(10, 12, 8, this.materials.stoneDark, x, y + 20, z - 4);
            this.collision.addObstacle(x, z, 24);
        }

        addAncientArch(x, z) {
            const y = this.heightAt(x, z);
            this.addBox(6, 20, 8, this.materials.stone, x - 10, y + 10, z);
            this.addBox(6, 20, 8, this.materials.stone, x + 10, y + 10, z);
            this.addBox(26, 6, 8, this.materials.stone, x, y + 22, z);
            this.addRock(x - 18, z + 8, 2);
            this.addRock(x + 18, z - 6, 2.4);
            this.collision.addObstacle(x - 10, z, 5);
            this.collision.addObstacle(x + 10, z, 5);
        }

        addColosseum(x, z) {
            const y = this.heightAt(x, z);
            const ringMat = this.materials.stone;
            for (let i = 0; i < 18; i++) {
                const a = (i / 18) * Math.PI * 2;
                const bx = x + Math.cos(a) * 26;
                const bz = z + Math.sin(a) * 18;
                const p = this.addBox(5, 10, 5, ringMat, bx, y + 5, bz, -a);
                p.scale.y = i % 3 === 0 ? 0.75 : 1;
            }
            this.addBox(34, 0.4, 22, this.materials.path, x, y + 0.25, z);
            this.collision.addObstacle(x, z, 24);
        }

        addGiantTree(x, z) {
            const y = this.heightAt(x, z);
            this.addCylinder(5, 7, 28, this.materials.darkWood, x, y + 14, z, 10);
            for (let i = 0; i < 7; i++) {
                const a = (i / 7) * Math.PI * 2;
                this.addSphere(15 + (i % 2) * 4, this.materials.forest, x + Math.cos(a) * 11, y + 34 + (i % 3) * 3, z + Math.sin(a) * 10, 0.85);
            }
            this.addBox(36, 2.2, 28, this.materials.stone, x, y + 1.1, z + 24, 0.2);
            this.collision.addObstacle(x, z, 18);
        }

        addCapitalWalls(x, z, w, d) {
            const y = this.heightAt(x, z);
            const mat = this.materials.whiteStone;
            this.addBox(w, 13, 5, mat, x, y + 6.5, z - d / 2);
            this.addBox(w, 13, 5, mat, x, y + 6.5, z + d / 2);
            this.addBox(5, 13, d, mat, x - w / 2, y + 6.5, z);
            this.addBox(5, 13, d, mat, x + w / 2, y + 6.5, z);
            const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
            corners.forEach((c) => {
                this.addCylinder(9, 9, 17, mat, x + c[0] * w / 2, y + 8.5, z + c[1] * d / 2, 14);
                this.addCone(10, 10, this.materials.roofBlue, x + c[0] * w / 2, y + 22, z + c[1] * d / 2, 14);
            });
            this.addBox(36, 18, 7, mat, x, y + 9, z + d / 2 + 1);
            this.addBox(14, 12, 8, this.materials.darkWood, x, y + 6, z + d / 2 + 4);
            this.collision.addObstacleLine(x - w / 2, z - d / 2, x + w / 2, z - d / 2, 3.5);
            this.collision.addObstacleLine(x - w / 2, z + d / 2, x - 23, z + d / 2, 3.5);
            this.collision.addObstacleLine(x + 23, z + d / 2, x + w / 2, z + d / 2, 3.5);
            this.collision.addObstacleLine(x - w / 2, z - d / 2, x - w / 2, z + d / 2, 3.5);
            this.collision.addObstacleLine(x + w / 2, z - d / 2, x + w / 2, z + d / 2, 3.5);
        }

        addPalace(x, z) {
            const y = this.heightAt(x, z);
            const group = new THREE.Group();
            group.position.set(x, y, z);
            const base = new THREE.Mesh(new THREE.BoxGeometry(72, 28, 34), this.materials.whiteStone);
            base.position.y = 14;
            group.add(base);
            const roof = new THREE.Mesh(this.makeRoofGeometry(80, 42, 14), this.materials.roofBlue);
            roof.position.y = 28;
            group.add(roof);
            for (let i = -1; i <= 1; i += 2) {
                const tower = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 38, 16), this.materials.whiteStone);
                tower.position.set(i * 42, 19, -1);
                group.add(tower);
                const cone = new THREE.Mesh(new THREE.ConeGeometry(11, 18, 16), this.materials.roofBlue);
                cone.position.set(i * 42, 47, -1);
                group.add(cone);
                const crown = new THREE.Mesh(new THREE.OctahedronGeometry(3.5, 0), i > 0 ? this.materials.crystalRose : this.materials.crystal);
                crown.position.set(i * 42, 59, -1);
                crown.scale.set(0.6, 1.65, 0.6);
                group.add(crown);
            }
            for (let i = -2; i <= 2; i++) {
                const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 15, 10), this.materials.stone);
                col.position.set(i * 9, 8, -18.3);
                group.add(col);
            }
            const balcony = new THREE.Mesh(new THREE.BoxGeometry(60, 2.2, 5), this.materials.gold);
            balcony.position.set(0, 19, -20.4);
            group.add(balcony);
            const roseWindow = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.55, 32), this.materials.window);
            roseWindow.position.set(0, 20, -17.5);
            roseWindow.rotation.x = Math.PI / 2;
            group.add(roseWindow);
            this.enableShadow(group);
            this.scene.add(group);
            this.addGlowSprite(x, y + 60, z - 1, 30, "rgba(255,113,210,0.32)");
            this.collision.addObstacle(x, z, 42);
        }

        addFountain(x, z, y) {
            this.addCylinder(11, 12, 2.2, this.materials.stone, x, y + 1.1, z, 24);
            this.addCylinder(6, 6, 1, this.materials.waterFlat, x, y + 2.4, z, 24);
            this.addCylinder(2, 2, 8, this.materials.whiteStone, x, y + 5.4, z, 16);
            this.addSphere(3.6, this.materials.waterFlat, x, y + 10, z, 0.4);
        }

        addDomeHall(x, z) {
            const y = this.heightAt(x, z);
            this.addCylinder(16, 18, 13, this.materials.whiteStone, x, y + 6.5, z, 18);
            this.addSphere(17, this.materials.roofBlue, x, y + 16, z, 0.42);
            this.collision.addObstacle(x, z, 19);
        }

        addClockTower(x, z, y, height, wallMat, roofMat) {
            this.addBox(14, height, 14, wallMat, x, y + height / 2, z);
            this.addCone(10, 13, roofMat, x, y + height + 6.5, z, 12);
            const clock = this.addCylinder(3.3, 3.3, 0.5, this.materials.canvas, x, y + height - 4, z - 7.3, 20);
            clock.rotation.x = Math.PI / 2;
            this.collision.addObstacle(x, z, 10);
        }

        addSignPost(x, z, y) {
            this.addCylinder(0.7, 0.8, 8, this.materials.darkWood, x, y + 4, z, 8);
            this.addBox(15, 2.4, 1, this.materials.wood, x + 5, y + 7, z, 0.16);
            this.addBox(13, 2.2, 1, this.materials.wood, x - 5, y + 4.4, z, -0.18);
        }

        addWell(x, z, y) {
            this.addCylinder(6, 6, 4, this.materials.stone, x, y + 2, z, 18);
            this.addCylinder(4.8, 4.8, 0.8, this.materials.waterFlat, x, y + 4.2, z, 18);
            this.addBox(16, 1.6, 3, this.materials.wood, x, y + 10, z);
            this.addCone(9, 6, this.materials.roofRed, x, y + 13, z, 4).rotation.y = Math.PI / 4;
            this.collision.addObstacle(x, z, 7);
        }

        addMarketTent(x, z, color) {
            const y = this.heightAt(x, z);
            const mat = this.basicMaterial(color);
            this.addBox(18, 1.5, 14, mat, x, y + 7, z);
            this.addCone(13, 7, mat, x, y + 11, z, 4).rotation.y = Math.PI / 4;
            this.addBox(16, 3, 10, this.materials.wood, x, y + 1.5, z);
            this.collision.addObstacle(x, z, 9);
        }

        addTotem(x, z, y, scale) {
            this.addCylinder(2.4 * scale, 2.8 * scale, 18 * scale, this.materials.darkWood, x, y + 9 * scale, z, 8);
            this.addBox(8 * scale, 5 * scale, 3 * scale, this.materials.roofRed, x, y + 8 * scale, z - 1, 0.12);
            this.addBox(6 * scale, 4 * scale, 3 * scale, this.materials.roofBlue, x, y + 14 * scale, z - 1, -0.08);
            this.addCone(5 * scale, 7 * scale, this.materials.roofYellow, x, y + 21 * scale, z, 6);
            this.collision.addObstacle(x, z, 7 * scale);
        }

        addRoundRuin(x, z, y) {
            for (let i = 0; i < 14; i++) {
                const a = Math.PI * 0.1 + (i / 14) * Math.PI * 1.55;
                this.addCylinder(2, 2.4, 9 + (i % 3) * 2, this.materials.stone, x + Math.cos(a) * 23, y + 4.5, z + Math.sin(a) * 17, 8);
            }
        }

        addRuinHall(x, z, y) {
            this.addBox(44, 15, 24, this.materials.stone, x, y + 7.5, z);
            this.addBox(16, 12, 4, this.materials.darkWood, x, y + 6, z - 13);
            for (let i = -1; i <= 1; i += 2) {
                this.addBox(6, 19, 6, this.materials.stoneDark, x + i * 24, y + 9.5, z - 10);
            }
            this.collision.addObstacle(x, z, 24);
        }

        addStorageArch(x, z, y) {
            this.addBox(22, 10, 20, this.materials.stone, x, y + 5, z);
            this.addCylinder(7, 7, 2, this.materials.darkWood, x, y + 4, z - 10.8, 16).rotation.x = Math.PI / 2;
            this.collision.addObstacle(x, z, 14);
        }

        addLaundryLine(x, z, y) {
            this.addCylinder(0.6, 0.7, 8, this.materials.darkWood, x - 10, y + 4, z, 8);
            this.addCylinder(0.6, 0.7, 8, this.materials.darkWood, x + 10, y + 4, z, 8);
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x - 10, y + 7, z),
                new THREE.Vector3(x + 10, y + 7, z)
            ]);
            const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: P.darkWood }));
            this.scene.add(line);
            this.addBox(4, 3, 0.5, this.basicMaterial(P.roofBlue), x - 3, y + 5.4, z);
            this.addBox(4, 3, 0.5, this.basicMaterial(P.roofYellow), x + 4, y + 5.4, z);
        }

        addGardenPatch(x, z, y) {
            this.addBox(28, 0.4, 16, this.materials.grassDark, x, y + 0.25, z);
            for (let i = 0; i < 14; i++) {
                const px = x - 12 + this.rng() * 24;
                const pz = z - 6 + this.rng() * 12;
                this.addSphere(1.1, this.basicMaterial(this.rng() > 0.5 ? P.flowerPink : P.flowerBlue), px, y + 1.2, pz, 0.55);
            }
        }

        addQuayDetails() {
            this.addBox(172, 4, 8, this.materials.stone, 186, 2, 195);
            this.addBox(8, 4, 86, this.materials.stone, 104, 2, 154);
            this.addBox(8, 4, 86, this.materials.stone, 268, 2, 154);
            for (let i = 0; i < 5; i++) {
                this.addCylinder(2, 2.2, 6, this.materials.stoneDark, 118 + i * 34, 5.4, 194, 12);
            }
        }

        addDocks() {
            this.dockZones.forEach((zone) => {
                this.addBox(zone.w, 1.4, zone.d, this.materials.wood, zone.x, zone.h - 0.7, zone.z);
                const count = Math.max(3, Math.floor((zone.d + zone.w) / 22));
                for (let i = 0; i < count; i++) {
                    const t = count === 1 ? 0.5 : i / (count - 1);
                    const px = zone.x - zone.w / 2 + t * zone.w;
                    const pz = zone.z - zone.d / 2 + t * zone.d;
                    this.addCylinder(1.2, 1.4, 6, this.materials.darkWood, px, zone.h + 2.2, zone.z - zone.d / 2 + 3, 8);
                    this.addCylinder(1.2, 1.4, 6, this.materials.darkWood, zone.x + zone.w / 2 - 3, zone.h + 2.2, pz, 8);
                }
            });
        }

        addMerchantShip(x, z) {
            const y = C.waterLevel + 1.4;
            const group = new THREE.Group();
            group.position.set(x, y, z);
            const hull = new THREE.Mesh(new THREE.BoxGeometry(70, 12, 20), this.materials.darkWood);
            hull.position.y = 4;
            hull.scale.z = 0.86;
            group.add(hull);
            const deck = new THREE.Mesh(new THREE.BoxGeometry(58, 3, 16), this.materials.wood);
            deck.position.y = 11;
            group.add(deck);
            for (let i = -1; i <= 1; i += 2) {
                const bow = new THREE.Mesh(new THREE.ConeGeometry(11, 20, 4), this.materials.darkWood);
                bow.position.set(i * 40, 5, 0);
                bow.rotation.z = i > 0 ? -Math.PI / 2 : Math.PI / 2;
                bow.rotation.y = Math.PI / 4;
                group.add(bow);
            }
            for (let i = -1; i <= 1; i += 2) {
                const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 42, 10), this.materials.darkWood);
                mast.position.set(i * 16, 32, 0);
                group.add(mast);
                const sail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 16, 18), this.materials.canvas);
                sail.position.set(i * 16, 33, 0);
                group.add(sail);
            }
            this.enableShadow(group);
            this.scene.add(group);
            this.collision.addObstacle(x, z, 34);
        }

        addSmallBoat(x, z, scale, rotY, playerBoat) {
            const group = new THREE.Group();
            const y = C.waterLevel + 0.25;
            group.position.set(x, y, z);
            group.rotation.y = rotY || 0;
            group.scale.setScalar(scale || 1);
            const hull = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 24), this.materials.darkWood);
            hull.position.y = 1.6;
            group.add(hull);
            const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 18), this.materials.wood);
            deck.position.y = 3.7;
            group.add(deck);
            const bow = new THREE.Mesh(new THREE.ConeGeometry(6.4, 10, 4), this.materials.darkWood);
            bow.position.set(0, 2, 15);
            bow.rotation.x = Math.PI / 2;
            bow.rotation.y = Math.PI / 4;
            group.add(bow);
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 22, 8), this.materials.darkWood);
            mast.position.set(0, 14, -1);
            group.add(mast);
            const sailGeo = new THREE.BufferGeometry();
            sailGeo.setAttribute("position", new THREE.Float32BufferAttribute([
                0, 4, 0,
                0, 18, 0,
                9, 6, 0
            ], 3));
            sailGeo.setIndex([0, 1, 2]);
            sailGeo.computeVertexNormals();
            const sail = new THREE.Mesh(sailGeo, this.materials.canvas);
            sail.position.set(0, 2, -1.2);
            group.add(sail);
            this.enableShadow(group);
            this.scene.add(group);
            if (!playerBoat) this.collision.addObstacle(x, z, 8);
            return group;
        }

        addHarborWall() {
            this.addBox(180, 5, 5, this.materials.stone, 188, 4.8, 196);
            this.addBox(5, 5, 72, this.materials.stone, 104, 4.8, 160);
            this.addBox(5, 5, 72, this.materials.stone, 272, 4.8, 160);
        }

        addCrateCluster(x, z, y) {
            for (let i = 0; i < 7; i++) {
                const px = x + (this.rng() - 0.5) * 16;
                const pz = z + (this.rng() - 0.5) * 12;
                const s = 2.4 + this.rng() * 2.2;
                this.addBox(s, s, s, this.materials.wood, px, y + s / 2, pz, this.rng() * Math.PI);
                this.collision.addObstacle(px, pz, s * 0.6);
            }
        }

        addBarrels(x, z, y) {
            for (let i = 0; i < 6; i++) {
                const px = x + (this.rng() - 0.5) * 16;
                const pz = z + (this.rng() - 0.5) * 10;
                this.addCylinder(1.9, 2.1, 4, this.materials.darkWood, px, y + 2, pz, 10);
                this.collision.addObstacle(px, pz, 2.4);
            }
        }

        addFence(x1, z1, x2, z2, y) {
            const dx = x2 - x1;
            const dz = z2 - z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dx, dz);
            const cx = (x1 + x2) / 2;
            const cz = (z1 + z2) / 2;
            this.addBox(2.2, 4.2, len, this.materials.wood, cx, y + 2.1, cz, angle);
            this.collision.addObstacleLine(x1, z1, x2, z2, 2.2);
        }

        addTree(x, z, scale, type, colorOverride) {
            const y = this.heightAt(x, z);
            const trunkMat = this.materials.darkWood;
            const leafMat = colorOverride ? this.basicMaterial(colorOverride) : (type === "pine" ? this.materials.forest : this.materials.grassDark);
            this.addCylinder(0.8 * scale, 1.1 * scale, 8 * scale, trunkMat, x, y + 4 * scale, z, 8);
            if (type === "pine") {
                for (let i = 0; i < 3; i++) {
                    this.addCone((5.2 - i * 1.1) * scale, 8 * scale, leafMat, x, y + (8 + i * 4.2) * scale, z, 9);
                }
            } else if (type === "ancient") {
                this.addSphere(7.2 * scale, leafMat, x, y + 11 * scale, z, 0.82);
                this.addSphere(5.2 * scale, leafMat, x - 4 * scale, y + 10 * scale, z + 2 * scale, 0.72);
                this.addSphere(5.2 * scale, leafMat, x + 4 * scale, y + 12 * scale, z - 2 * scale, 0.74);
            } else {
                this.addSphere(5.5 * scale, leafMat, x, y + 10 * scale, z, 0.82);
                this.addSphere(3.6 * scale, leafMat, x - 3 * scale, y + 9.2 * scale, z + 2 * scale, 0.82);
                this.addSphere(3.8 * scale, leafMat, x + 3.2 * scale, y + 10.4 * scale, z - 1.4 * scale, 0.82);
            }
            this.collision.addObstacle(x, z, 3.4 * scale);
        }

        addRock(x, z, scale) {
            const y = this.heightAt(x, z);
            const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), this.materials.cliffShade);
            mesh.position.set(x, y + scale * 0.5, z);
            mesh.rotation.set(this.rng() * Math.PI, this.rng() * Math.PI, this.rng() * Math.PI);
            mesh.scale.y = 0.62 + this.rng() * 0.5;
            this.enableShadow(mesh);
            this.scene.add(mesh);
            this.collision.addObstacle(x, z, scale * 1.1);
        }

        addStairs(x, z, width, steps, direction, fromH, toH) {
            const dz = direction === "south" ? 1 : direction === "north" ? -1 : 0;
            const dx = direction === "east" ? 1 : direction === "west" ? -1 : 0;
            const stepDepth = 5;
            for (let i = 0; i < steps; i++) {
                const t = steps === 1 ? 1 : i / (steps - 1);
                const h = fromH + (toH - fromH) * t;
                const sx = x + dx * stepDepth * i;
                const sz = z + dz * stepDepth * i;
                const w = dx ? stepDepth : width;
                const d = dz ? stepDepth : width;
                this.addBox(w, 1.1, d, this.materials.stone, sx, h + 0.55, sz);
            }
        }

        addClouds() {
            this.cloudGroup = new THREE.Group();
            const cloudMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                flatShading: true,
                roughness: 0.7,
                transparent: true,
                opacity: 0.86
            });
            for (let i = 0; i < 28; i++) {
                const cloud = new THREE.Group();
                const blocks = 3 + Math.floor(this.rng() * 4);
                for (let b = 0; b < blocks; b++) {
                    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cloudMat);
                    mesh.position.set((this.rng() - 0.5) * 18, (this.rng() - 0.5) * 5, (this.rng() - 0.5) * 10);
                    const s = 7 + this.rng() * 12;
                    mesh.scale.set(s, s * 0.48, s * 0.72);
                    cloud.add(mesh);
                }
                cloud.position.set(-330 + this.rng() * 660, 116 + this.rng() * 52, -240 + this.rng() * 520);
                this.cloudGroup.add(cloud);
            }
            this.scene.add(this.cloudGroup);
        }
    }

    MapEngine.prototype.registerPlaces = function () {
        this.places = [
            {
                id: "school", label: "아카데미 메뉴", title: "루루 아카데미",
                x: -166, z: -112, radius: 98, zoneRadius: 104,
                body: "별빛 룬과 오래된 강의동이 이어진 마법 학교입니다. 중앙 광장에는 항해술과 고대 유적 연구 기록이 모여 있습니다.",
                items: ["수업 게시판", "기숙사", "연구동", "훈련장"]
            },
            {
                id: "capital", label: "왕도 메뉴", title: "왕도 루미나",
                x: 158, z: -145, radius: 110, zoneRadius: 112,
                body: "하얀 성벽과 푸른 첨탑이 빛나는 수도입니다. 왕궁 광장과 관리 사무소, 기사단 본부가 자리합니다.",
                items: ["왕궁 알현", "광장 게시판", "관리 사무소"]
            },
            {
                id: "shopping", label: "상점가 메뉴", title: "별빛 상점가",
                x: -214, z: 54, radius: 98, zoneRadius: 98,
                body: "비단 천막과 룬 간판이 줄지어 선 시장입니다. 물약, 빵, 장비, 항해 도구를 살펴볼 수 있습니다.",
                items: ["물약점", "빵집", "장비 상점", "수정 노점"]
            },
            {
                id: "residential", label: "마을 메뉴", title: "달정원 마을",
                x: 28, z: 66, radius: 104, zoneRadius: 104,
                body: "꽃밭과 공동 마당을 중심으로 계단식 집들이 이어진 조용한 거주지입니다.",
                items: ["주민 인사", "공동 마당", "마을 기록"]
            },
            {
                id: "port", label: "항구 메뉴", title: "하늘항구",
                x: 182, z: 164, radius: 112, zoneRadius: 112,
                body: "목조 부두와 무역 창고가 모인 바다 출입구입니다. 작은 돛단배를 빌려 외해로 나갈 수 있습니다.",
                items: ["돛단배", "무역소", "선원 노점"]
            }
        ];

        this.places.forEach((place) => this.collision.addInteraction(place));
    };

    MapEngine.prototype.getLocation = function (x, z, state) {
        if (state && state.onBoat && this.isSea(x, z)) return "바다";
        if (this.isSea(x, z)) return "바다";

        for (let i = 0; i < this.places.length; i++) {
            const place = this.places[i];
            const dx = x - place.x;
            const dz = z - place.z;
            if (dx * dx + dz * dz < place.zoneRadius * place.zoneRadius) {
                return place.title;
            }
        }
        return "필드";
    };

    MapEngine.prototype.handleInteraction = function (item, state, ui) {
        if (!item) return null;

        if (item.id === "port") {
            if (state.onBoat) {
                state.hasBoat = false;
                state.onBoat = false;
                state.boatDock = null;
                ui.setBoatStatus("미보유");
                ui.showDialog({
                    title: "하늘항구",
                    body: "돛단배를 항구에 반납하고 부두로 돌아왔습니다. 필요하면 다시 항구에서 빌릴 수 있습니다.",
                    items: ["돛단배 반납", "정박 완료", "항구 거리"]
                });
                return { moveTo: this.portLanding, mode: "land" };
            }

            if (!state.hasBoat) {
                state.hasBoat = true;
                state.onBoat = true;
                state.boatDock = null;
                ui.setBoatStatus("승선 중");
                ui.showDialog({
                    title: "하늘항구",
                    body: "항구 관리인이 작은 돛단배를 내어주었습니다. 이제 바다 위로 이동할 수 있습니다.",
                    items: ["작은 돛단배 획득", "출항 준비", "바다 진입 허용"]
                });
                return { moveTo: this.boatSpawn, mode: "boat" };
            }

            if (this.isBoatDockedAtPort(state)) {
                state.hasBoat = false;
                state.boatDock = null;
                ui.setBoatStatus("미보유");
                ui.showDialog({
                    title: "하늘항구",
                    body: "정박해 둔 돛단배를 항구에 반납했습니다. 항구에서 다시 대여할 수 있습니다.",
                    items: ["돛단배 반납", "대여 가능", "항구 거리"]
                });
                return null;
            }

            ui.showDialog({
                title: "하늘항구",
                body: "빌린 돛단배가 다른 해안에 정박해 있습니다. 정박한 곳으로 돌아가 배를 몰고 항구까지 가져와야 반납할 수 있습니다.",
                items: ["추가 대여 불가", "정박 위치 확인", "항구 반납 필요"]
            });
            return null;
        }

        ui.showDialog({
            title: item.title,
            body: item.body,
            items: item.items
        });
        return null;
    };

    MapEngine.prototype.showSeaDialog = function (ui) {
        ui.showDialog({
            title: "바다",
            body: "돛단배에 탄 상태로만 접근할 수 있는 외해입니다. 물결과 항구 주변 항로를 확인할 수 있습니다.",
            items: ["외해 탐색", "낚시 메뉴", "항구 복귀"]
        });
    };

    MapEngine.prototype.registerPlaces = function () {
        const mk = (data) => Object.assign({
            radius: 24,
            zoneRadius: 30,
            maxHp: 160,
            hp: data.maxHp || 160,
            destroyed: false,
            label: `${data.title} 메뉴`
        }, data);

        this.places = [
            mk({ id: "school-academy", district: "학교", role: "school", service: "training", title: "학교 본관", x: -166, z: -158, radius: 46, zoneRadius: 54, maxHp: 520 }),
            mk({ id: "school-dorm", district: "학교", role: "school", service: "rest", title: "기숙사", x: -238, z: -120, radius: 24, maxHp: 170 }),
            mk({ id: "school-observatory", district: "학교", role: "school", service: "skills", title: "관측 연구탑", x: -90, z: -120, radius: 28, maxHp: 230 }),
            mk({ id: "school-chapel", district: "학교", role: "school", service: "rest", title: "푸른 예배당", x: -110, z: -206, radius: 26, maxHp: 210 }),
            mk({ id: "school-arena", district: "학교", role: "school", service: "combat", title: "훈련 원형장", x: -104, z: -28, radius: 34, zoneRadius: 38, maxHp: 260 }),

            mk({ id: "capital-palace", district: "왕국", role: "kingdom", service: "missions", title: "왕궁", x: 158, z: -226, radius: 48, zoneRadius: 56, maxHp: 620 }),
            mk({ id: "capital-guild", district: "왕국", role: "kingdom", service: "missions", title: "기사단 회관", x: 236, z: -88, radius: 30, maxHp: 300 }),
            mk({ id: "capital-office", district: "왕국", role: "kingdom", service: "repair-missions", title: "관리 사무소", x: 82, z: -88, radius: 26, maxHp: 260 }),
            mk({ id: "capital-noble-1", district: "왕국", role: "home", title: "북서 귀족 저택", x: 86, z: -176, radius: 23, maxHp: 190 }),
            mk({ id: "capital-noble-2", district: "왕국", role: "home", title: "동문 귀족 저택", x: 205, z: -120, radius: 23, maxHp: 190 }),
            mk({ id: "capital-archive", district: "왕국", role: "kingdom", service: "missions", title: "왕립 기록소", x: 112, z: -112, radius: 22, maxHp: 180 }),

            mk({ id: "shop-bakery", district: "상점가", role: "shop", service: "rest", title: "빵집", x: -268, z: 32, radius: 23, maxHp: 160 }),
            mk({ id: "shop-general", district: "상점가", role: "shop", service: "supplies", title: "잡화점", x: -230, z: -2, radius: 23, maxHp: 160 }),
            mk({ id: "shop-potion", district: "상점가", role: "shop", service: "potion", title: "물약상", x: -168, z: 20, radius: 23, maxHp: 160 }),
            mk({ id: "shop-blacksmith", district: "상점가", role: "shop", service: "weapon", title: "대장간", x: -146, z: 72, radius: 24, maxHp: 190 }),
            mk({ id: "shop-inn", district: "상점가", role: "shop", service: "rest", title: "여관", x: -222, z: 116, radius: 28, maxHp: 180 }),
            mk({ id: "shop-cloth", district: "상점가", role: "shop", service: "armor", title: "방어구점", x: -282, z: 86, radius: 22, maxHp: 160 }),
            mk({ id: "shop-magic", district: "상점가", role: "shop", service: "accessory", title: "마도구점", x: -164, z: 112, radius: 22, maxHp: 170 }),

            mk({ id: "village-home-1", district: "마을", role: "home", title: "언덕집", x: -38, z: 38, radius: 22, maxHp: 150 }),
            mk({ id: "village-home-2", district: "마을", role: "home", title: "남쪽집", x: 0, z: 116, radius: 22, maxHp: 150 }),
            mk({ id: "village-home-3", district: "마을", role: "home", title: "동쪽집", x: 72, z: 112, radius: 22, maxHp: 150 }),
            mk({ id: "village-storage", district: "마을", role: "home", service: "storage", title: "공동 창고", x: 118, z: 76, radius: 24, maxHp: 210 }),
            mk({ id: "village-ruin", district: "마을", role: "home", title: "오래된 회관", x: 62, z: -16, radius: 26, maxHp: 220 }),

            mk({ id: "port", district: "항구", role: "harbor", service: "boat", title: "항구 선착장", x: 184, z: 164, radius: 92, zoneRadius: 96, maxHp: 420 }),
            mk({ id: "port-fish", district: "항구", role: "harbor", service: "sell", title: "어시장", x: 124, z: 118, radius: 24, maxHp: 170 }),
            mk({ id: "port-fruit", district: "항구", role: "shop", service: "rest", title: "과일 노점", x: 162, z: 96, radius: 22, maxHp: 150 }),
            mk({ id: "port-trade", district: "항구", role: "harbor", service: "sell", title: "몬스터 매입소", x: 204, z: 96, radius: 28, maxHp: 220 }),
            mk({ id: "port-inn", district: "항구", role: "shop", service: "rest", title: "항구 여관", x: 248, z: 122, radius: 24, maxHp: 170 }),
            mk({ id: "port-repair", district: "항구", role: "shop", service: "supplies", title: "수리 자재상", x: 224, z: 158, radius: 25, maxHp: 200 })
        ];

        this.buildingIndex = new Map();
        this.places.forEach((place) => {
            place.hp = place.maxHp;
            place.label = `${place.title} 메뉴`;
            this.buildingIndex.set(place.id, place);
            this.collision.addInteraction(place);
        });
    };

    MapEngine.prototype.getLocation = function (x, z, state) {
        if (state && state.onBoat && this.isSea(x, z)) return "바다";
        if (this.isSea(x, z)) return "바다";

        const nearest = this.nearestBuilding(x, z, 34);
        if (nearest) return nearest.title;

        const districts = [
            { title: "학교", x: -166, z: -120, r: 118 },
            { title: "왕국", x: 158, z: -158, r: 130 },
            { title: "상점가", x: -214, z: 54, r: 114 },
            { title: "마을", x: 28, z: 66, r: 116 },
            { title: "항구", x: 184, z: 154, r: 122 }
        ];
        for (let i = 0; i < districts.length; i++) {
            const d = districts[i];
            const dx = x - d.x;
            const dz = z - d.z;
            if (dx * dx + dz * dz <= d.r * d.r) return d.title;
        }
        if (this.isForest(x, z)) return "숲";
        return "월드";
    };

    MapEngine.prototype.buildingStatusText = function (building) {
        const hp = Math.max(0, Math.ceil(building.hp));
        const pct = Math.round((hp / building.maxHp) * 100);
        return `내구도 ${hp}/${building.maxHp} (${pct}%)${building.destroyed ? " - 파괴됨" : ""}`;
    };

    MapEngine.prototype.commonBuildingItems = function (building, player, refresh) {
        const damaged = building.hp < building.maxHp;
        return [
            {
                label: `시설 보수: 자재 1개 보유 ${player.state.repairMaterials}`,
                disabled: !damaged || player.state.repairMaterials <= 0,
                action: () => {
                    player.repairBuilding(building);
                    refresh();
                }
            }
        ];
    };

    MapEngine.prototype.handleInteraction = function (item, state, ui, player) {
        if (!item) return null;
        if (!player) {
            ui.showDialog({ title: item.title, body: this.buildingStatusText(item), items: item.items || [] });
            return null;
        }

        if (item.role === "harbor" && item.service === "boat") {
            const boatResult = this.handleBoatInteraction(item, state, ui, player);
            if (boatResult) return boatResult;
        }

        const refresh = () => this.handleInteraction(item, state, ui, player);
        const body = [
            `${item.district} / ${item.title}`,
            this.buildingStatusText(item),
            this.serviceDescription(item, player)
        ].join("\n");

        const items = [];
        if (!item.destroyed) {
            if (item.role === "school") items.push(...this.schoolMenuItems(item, player, refresh));
            if (item.role === "shop") items.push(...this.shopMenuItems(item, player, refresh));
            if (item.role === "harbor") items.push(...this.harborMenuItems(item, player, refresh));
            if (item.role === "kingdom") items.push(...this.kingdomMenuItems(item, player, refresh));
            if (item.role === "home") items.push({ label: "주민 기록 확인", action: () => ui.showToast("시설 보호 요청과 보수 기록을 확인했습니다.") });
        } else {
            items.push({ label: "파괴된 시설입니다. 보수 후 이용 가능", disabled: true });
        }
        items.push(...this.commonBuildingItems(item, player, refresh));

        ui.showDialog({ title: item.title, body, items });
        return null;
    };

    MapEngine.prototype.handleBoatInteraction = function (item, state, ui, player) {
        if (state.onBoat) {
            state.hasBoat = false;
            state.onBoat = false;
            state.boatDock = null;
            ui.setBoatStatus("미보유");
            ui.showDialog({
                title: item.title,
                body: `쪽단배를 항구에 반납했습니다.\n${this.buildingStatusText(item)}`,
                items: [
                    { label: "포획 몬스터 판매", disabled: player.state.cargo.length === 0, action: () => { player.sellCargo(); this.handleInteraction(item, state, ui, player); } },
                    { label: "탄창 30발 구입 - 120G", action: () => { player.buyAmmo(30, 120); this.handleInteraction(item, state, ui, player); } }
                ]
            });
            return { moveTo: this.portLanding, mode: "land" };
        }

        if (!state.hasBoat) {
            state.hasBoat = true;
            state.onBoat = true;
            state.boatDock = null;
            ui.setBoatStatus("승선 중");
            ui.showDialog({
                title: item.title,
                body: `쪽단배를 빌렸습니다. 바다로 이동할 수 있습니다.\n${this.buildingStatusText(item)}`,
                items: ["출항 준비", "항구 시설 이용은 하선 후 가능"]
            });
            return { moveTo: this.boatSpawn, mode: "boat" };
        }

        if (this.isBoatDockedAtPort(state)) {
            state.hasBoat = false;
            state.boatDock = null;
            ui.setBoatStatus("미보유");
            ui.showDialog({
                title: item.title,
                body: `정박한 쪽단배를 항구에 반납했습니다.\n${this.buildingStatusText(item)}`,
                items: ["쪽단배 반납", "대여 가능"]
            });
            return null;
        }

        return null;
    };

    MapEngine.prototype.serviceDescription = function (item, player) {
        if (item.role === "school") return "학교에서는 스킬을 배우거나 전투 스탯을 올릴 수 있습니다.";
        if (item.service === "weapon") return "무기와 사격 장비를 구입합니다.";
        if (item.service === "armor") return "보호구와 신발을 구입합니다.";
        if (item.service === "accessory") return "장신구와 컨테이너 확장품을 구입합니다.";
        if (item.service === "supplies") return "탄창과 시설 보수 자재를 골드로 구입합니다.";
        if (item.role === "harbor") return `포획 몬스터 ${player.state.cargo.length}마리를 판매해 골드를 마련할 수 있습니다.`;
        if (item.role === "kingdom") return "왕국 미션을 받고 완료 보상을 정산합니다.";
        return "생활 시설입니다. 몬스터 습격 시 내구도가 감소합니다.";
    };

    MapEngine.prototype.schoolMenuItems = function (item, player, refresh) {
        const items = [];
        if (item.service === "training" || item.service === "combat") {
            items.push(
                { label: "체력 단련 +10 HP - 140G", action: () => { if (player.spendGold(140, "체력 단련")) { player.state.maxHp += 10; player.heal(10); player.ui.showToast("최대 HP가 증가했습니다."); } refresh(); } },
                { label: "사격 훈련 +공격 - 160G", action: () => { player.trainStat("attack", 160, "사격 훈련"); refresh(); } },
                { label: "방어 훈련 +방어 - 150G", action: () => { player.trainStat("defense", 150, "방어 훈련"); refresh(); } },
                { label: "지구력 훈련 +스태미나 - 120G", action: () => { player.trainStat("stamina", 120, "지구력 훈련"); refresh(); } }
            );
        }
        if (item.service === "skills" || item.service === "training") {
            items.push(
                { label: "정밀 조준 스킬 - 420G", disabled: !!player.state.skills.marksmanship, action: () => { player.learnSkill("marksmanship", 420, "정밀 조준"); refresh(); } },
                { label: "시설 보수학 스킬 - 360G", disabled: !!player.state.skills.repair, action: () => { player.learnSkill("repair", 360, "시설 보수학"); refresh(); } }
            );
        }
        if (item.service === "rest") {
            items.push({ label: "휴식으로 HP 회복 - 60G", action: () => { if (player.spendGold(60, "휴식")) player.heal(player.state.maxHp); refresh(); } });
        }
        return items;
    };

    MapEngine.prototype.shopMenuItems = function (item, player, refresh) {
        const items = [];
        if (item.service === "weapon") {
            items.push(
                { label: "강철 마력총 - 450G", action: () => { player.buyEquipment("weapon", { name: "강철 마력총", damage: 18, cost: 450 }); refresh(); } },
                { label: "에테르 카빈 - 1250G", action: () => { player.buyEquipment("weapon", { name: "에테르 카빈", damage: 42, cost: 1250 }); refresh(); } }
            );
        }
        if (item.service === "armor") {
            items.push(
                { label: "보강 코트 - 420G", action: () => { player.buyEquipment("armor", { name: "보강 코트", defense: 4, cost: 420 }); refresh(); } },
                { label: "수호 판금 - 1200G", action: () => { player.buyEquipment("armor", { name: "수호 판금", defense: 10, cost: 1200 }); refresh(); } },
                { label: "신속 장화 - 360G", action: () => { player.buyEquipment("shoes", { name: "신속 장화", speed: 0.08, cost: 360 }); refresh(); } },
                { label: "바람 신발 - 1000G", action: () => { player.buyEquipment("shoes", { name: "바람 신발", speed: 0.16, cost: 1000 }); refresh(); } }
            );
        }
        if (item.service === "accessory") {
            items.push(
                { label: "소형 컨테이너 장신구 +8 - 500G", action: () => { player.buyEquipment("accessory", { name: "소형 컨테이너", cargo: 8, cost: 500 }); refresh(); } },
                { label: "길드 수납 부적 +16 - 1200G", action: () => { player.buyEquipment("accessory", { name: "길드 수납 부적", cargo: 16, cost: 1200 }); refresh(); } }
            );
        }
        if (item.service === "supplies" || item.service === "potion" || item.service === "rest") {
            items.push(
                { label: "탄창 30발 - 120G", action: () => { player.buyAmmo(30, 120); refresh(); } },
                { label: "시설 보수 자재 2개 - 160G", action: () => { player.buyRepairMaterials(2, 160); refresh(); } },
                { label: "응급 회복 - 100G", action: () => { if (player.spendGold(100, "응급 회복")) player.heal(50); refresh(); } }
            );
        }
        return items;
    };

    MapEngine.prototype.harborMenuItems = function (item, player, refresh) {
        return [
            { label: `포획 몬스터 판매 (${player.state.cargo.length}마리)`, disabled: player.state.cargo.length === 0, action: () => { player.sellCargo(); refresh(); } },
            { label: "탄창 30발 - 120G", action: () => { player.buyAmmo(30, 120); refresh(); } },
            { label: "시설 보수 자재 2개 - 160G", action: () => { player.buyRepairMaterials(2, 160); refresh(); } }
        ];
    };

    MapEngine.prototype.kingdomMenuItems = function (item, player, refresh) {
        const missions = [
            { id: "outside-patrol", type: "outside-kill", title: "숲 밖 몬스터 3마리 퇴치", target: 3, reward: 450 },
            { id: "facility-repair", type: "repair", title: "내구도 낮은 시설 2회 보수", target: 2, reward: 380 },
            { id: "boss-hunt", type: "boss", title: "보스 몬스터 1마리 퇴치", target: 1, reward: 1800 }
        ];
        return missions.map((mission) => ({
            label: `${mission.title} - 보상 ${ns.formatGold(mission.reward)}`,
            action: () => {
                player.acceptMission(mission);
                player.updateMissionProgress();
                refresh();
            }
        }));
    };

    MapEngine.prototype.nearestBuilding = function (x, z, range, predicate) {
        const max = range || 9999;
        let best = null;
        let bestSq = Infinity;
        for (let i = 0; i < this.places.length; i++) {
            const building = this.places[i];
            if (predicate && !predicate(building)) continue;
            const dx = x - building.x;
            const dz = z - building.z;
            const distSq = dx * dx + dz * dz;
            const reach = max + (building.radius || 20);
            if (distSq <= reach * reach && distSq < bestSq) {
                best = building;
                bestSq = distSq;
            }
        }
        return best;
    };

    MapEngine.prototype.damageBuilding = function (building, amount) {
        if (!building || building.destroyed) return false;
        building.hp = Math.max(0, building.hp - amount);
        if (building.hp <= 0) {
            building.destroyed = true;
        }
        return true;
    };

    MapEngine.prototype.repairBuilding = function (building, amount) {
        if (!building) return false;
        building.hp = Math.min(building.maxHp, building.hp + amount);
        if (building.hp > 0) building.destroyed = false;
        return true;
    };

    MapEngine.prototype.isForest = function (x, z) {
        const zones = [
            { x: -315, z: -126, rx: 72, rz: 132 },
            { x: -305, z: 86, rx: 68, rz: 132 },
            { x: 294, z: -10, rx: 58, rz: 174 },
            { x: 0, z: -248, rx: 260, rz: 38 },
            { x: -12, z: 194, rx: 270, rz: 34 }
        ];
        for (let i = 0; i < zones.length; i++) {
            if (ellipseHit(x, z, zones[i])) return true;
        }
        return x < -292 || x > 286 || z < -226 || (z > 166 && !this.isSea(x, z));
    };

    MapEngine.prototype.isDeepForest = function (x, z) {
        const zones = [
            { x: -320, z: -150, rx: 42, rz: 76 },
            { x: -312, z: 96, rx: 38, rz: 72 },
            { x: 304, z: -22, rx: 34, rz: 92 },
            { x: -20, z: -248, rx: 160, rz: 24 }
        ];
        return zones.some((zone) => ellipseHit(x, z, zone));
    };

    MapEngine.prototype.randomMonsterSpawnPoint = function (rng, phase, playerPos) {
        const deep = [
            { x: -320, z: -150, rx: 42, rz: 76 },
            { x: -312, z: 96, rx: 38, rz: 72 },
            { x: 304, z: -22, rx: 34, rz: 92 },
            { x: -20, z: -248, rx: 160, rz: 24 }
        ];
        const forest = [
            { x: -315, z: -126, rx: 72, rz: 132 },
            { x: -305, z: 86, rx: 68, rz: 132 },
            { x: 294, z: -10, rx: 58, rz: 174 },
            { x: 0, z: -248, rx: 260, rz: 38 },
            { x: -12, z: 194, rx: 270, rz: 34 }
        ];

        for (let tries = 0; tries < 80; tries++) {
            let x;
            let z;
            if (phase <= 0) {
                const zone = deep[Math.floor(rng() * deep.length)];
                x = zone.x + (rng() * 2 - 1) * zone.rx;
                z = zone.z + (rng() * 2 - 1) * zone.rz;
            } else if (phase === 1) {
                const zone = forest[Math.floor(rng() * forest.length)];
                x = zone.x + (rng() * 2 - 1) * zone.rx;
                z = zone.z + (rng() * 2 - 1) * zone.rz;
            } else if (phase === 2) {
                const zone = forest[Math.floor(rng() * forest.length)];
                x = zone.x + (rng() * 2 - 1) * (zone.rx + 34);
                z = zone.z + (rng() * 2 - 1) * (zone.rz + 34);
            } else {
                x = C.landBounds.minX + rng() * (C.landBounds.maxX - C.landBounds.minX);
                z = C.landBounds.minZ + rng() * (C.landBounds.maxZ - C.landBounds.minZ);
            }

            if (this.isSea(x, z)) continue;
            if (phase <= 0 && !this.isDeepForest(x, z)) continue;
            if (phase === 1 && !this.isForest(x, z)) continue;
            if (playerPos) {
                const dx = x - playerPos.x;
                const dz = z - playerPos.z;
                if (dx * dx + dz * dz < 50 * 50) continue;
            }
            return { x, z };
        }
        return { x: -320, z: -150 };
    };

    MapEngine.prototype.showSeaDialog = function (ui) {
        ui.showDialog({
            title: "바다",
            body: "쪽단배에 탄 상태로만 이동할 수 있는 해역입니다. 항구 근처에서 하선하거나 다시 항구로 돌아갈 수 있습니다.",
            items: ["항해 중", "항구로 돌아가기"]
        });
    };

    ns.MapEngine = MapEngine;
})();
