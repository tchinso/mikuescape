(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};

    ns.Config = {
        mapBounds: { minX: -360, maxX: 360, minZ: -285, maxZ: 330 },
        landBounds: { minX: -340, maxX: 315, minZ: -255, maxZ: 205 },
        waterLevel: -2.2,
        eyeHeight: 7.2,
        boatEyeHeight: 6.6,
        gravity: 44,
        speed: 20,
        runSpeed: 34,
        boatSpeed: 28,
        jumpForce: 26,
        playerRadius: 1.7,
        boatBoardRadius: 20,
        viewDistance: 940,
        minimapCamSize: 430,
        devGold: 999999999,
        staminaDrain: 22,
        staminaRegen: 18,
        playerMaxHp: 100,
        initialAmmo: 36,
        initialRepairMaterials: 3,
        initialCargoCapacity: 10,
        baseShotDamage: 28,
        shotCooldown: 0.22,
        buildingRepairPerMaterial: 35,
        monster: {
            gracePeriod: 60,
            maxAlive: 50,
            spawnIntervalStart: 42,
            spawnIntervalMin: 18,
            difficultyRampSeconds: 7200,
            fastFirstSecond: 720,
            tankFirstSecond: 1500,
            bossFirstSecond: 3600,
            forestPhaseSecond: 600,
            edgePhaseSecond: 1500,
            worldPhaseSecond: 2700,
            facilityAttackRange: 18
        }
    };

    ns.Perf = (function () {
        const mem = navigator.deviceMemory || 8;
        const cores = navigator.hardwareConcurrency || 8;
        const lowEnd = mem <= 4 || cores <= 4;
        const midEnd = !lowEnd && (mem <= 6 || cores <= 6);

        return {
            maxDpr: 1,
            antialias: false,
            shadowMapSize: lowEnd ? 1024 : 2048,
            shadowType: lowEnd ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap
        };
    })();

    ns.Palette = {
        sky: new THREE.Color(0x97c8f7),
        grass: 0x69c87a,
        grassLight: 0xa7e88f,
        grassDark: 0x347a58,
        forest: 0x1f654c,
        cliff: 0xc8b08a,
        cliffShade: 0x8f765f,
        path: 0xd3bf93,
        stone: 0xaeb7bb,
        stoneLight: 0xe9e3d8,
        stoneDark: 0x59616a,
        water: 0x42d9e8,
        waterDeep: 0x166a99,
        brick: 0xa85b62,
        brickDark: 0x6b334b,
        roofRed: 0xb94668,
        roofOrange: 0xd77b3f,
        roofYellow: 0xd8b64e,
        roofGreen: 0x4f9a6b,
        roofBlue: 0x3f70c8,
        cream: 0xf1dfc2,
        whiteStone: 0xf0eee3,
        wood: 0x8f5f39,
        darkWood: 0x4e2f28,
        gold: 0xe2b657,
        bannerBlue: 0x274f9e,
        bannerRose: 0xb9477a,
        flowerPink: 0xf57ead,
        flowerBlue: 0x77b8ff,
        canvas: 0xf1e8d1
    };

    ns.formatGold = function formatGold(value) {
        return `${Math.floor(value).toLocaleString("ko-KR")} G`;
    };

    ns.clamp = function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    };

    ns.smoothstep = function smoothstep(edge0, edge1, x) {
        const t = ns.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    };

    ns.mulberry32 = function mulberry32(seed) {
        return function () {
            let t = seed += 0x6d2b79f5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };
})();
