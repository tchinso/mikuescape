(function () {
    const ns = window.RuruWorld = window.RuruWorld || {};

    const cache = new Map();

    function makeRNG(seed) {
        let s = seed >>> 0;
        return function () {
            s = (s + 0x6d2b79f5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function cached(key, make) {
        if (!cache.has(key)) cache.set(key, make());
        return cache.get(key);
    }

    function canvas2d(w, h) {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        return [canvas, canvas.getContext("2d")];
    }

    function colorCss(hex) {
        return `#${new THREE.Color(hex).getHexString()}`;
    }

    function offsetCss(hex, h, s, l) {
        return colorCss(new THREE.Color(hex).offsetHSL(h || 0, s || 0, l || 0).getHex());
    }

    function toTexture(canvas, options) {
        const opts = options || {};
        const texture = new THREE.CanvasTexture(canvas);
        texture.encoding = opts.srgb === false ? THREE.LinearEncoding : THREE.sRGBEncoding;
        texture.anisotropy = opts.aniso || 8;
        if (opts.repeat) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(opts.repeat[0], opts.repeat[1]);
        }
        if (opts.rotation) {
            texture.center.set(0.5, 0.5);
            texture.rotation = opts.rotation;
        }
        return texture;
    }

    function speckle(ctx, w, h, count, rng, alpha, light) {
        for (let i = 0; i < count; i++) {
            const v = light ? 255 : 0;
            ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rng()})`;
            ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2.5, 1 + rng() * 2.5);
        }
    }

    function makeTextureSet(name, baseHex, variant, seed, repeat) {
        return cached(`paint:${name}:${baseHex}:${variant}:${seed}`, () => {
            const W = 512;
            const H = 512;
            const [canvas, ctx] = canvas2d(W, H);
            const [bump, bctx] = canvas2d(W, H);
            const rng = makeRNG(seed);
            const base = colorCss(baseHex);
            const light = offsetCss(baseHex, 0, -0.04, 0.15);
            const dark = offsetCss(baseHex, 0, 0.08, -0.17);
            ctx.fillStyle = base;
            ctx.fillRect(0, 0, W, H);
            bctx.fillStyle = "#808080";
            bctx.fillRect(0, 0, W, H);

            if (variant === "grass") {
                const grad = ctx.createLinearGradient(0, 0, W, H);
                grad.addColorStop(0, light);
                grad.addColorStop(0.5, base);
                grad.addColorStop(1, dark);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, W, H);
                for (let i = 0; i < 1100; i++) {
                    const x = rng() * W;
                    const y = rng() * H;
                    const len = 5 + rng() * 13;
                    ctx.strokeStyle = rng() > 0.5 ? "rgba(255,255,210,0.16)" : "rgba(20,70,40,0.22)";
                    ctx.lineWidth = 0.6 + rng() * 1.4;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + (rng() - 0.5) * 8, y - len);
                    ctx.stroke();
                    bctx.fillStyle = rng() > 0.4 ? "#9b9b9b" : "#696969";
                    bctx.fillRect(x, y, 1, len * 0.45);
                }
                for (let i = 0; i < 70; i++) {
                    ctx.fillStyle = rng() > 0.5 ? "rgba(255,150,205,0.55)" : "rgba(130,190,255,0.55)";
                    ctx.beginPath();
                    ctx.arc(rng() * W, rng() * H, 1.4 + rng() * 2.1, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (variant === "stone" || variant === "marble") {
                const tile = variant === "marble" ? 128 : 96;
                for (let y = 0; y < H; y += tile) {
                    for (let x = 0; x < W; x += tile) {
                        const shade = 1 + (rng() - 0.5) * 0.18;
                        ctx.fillStyle = shade > 1 ? `rgba(255,255,255,${shade - 1})` : `rgba(0,0,0,${1 - shade})`;
                        ctx.fillRect(x, y, tile, tile);
                        ctx.strokeStyle = "rgba(55,48,64,0.26)";
                        ctx.lineWidth = 3;
                        ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
                        bctx.strokeStyle = "#a9a9a9";
                        bctx.lineWidth = 4;
                        bctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
                    }
                }
                for (let i = 0; i < (variant === "marble" ? 70 : 42); i++) {
                    let x = rng() * W;
                    let y = rng() * H;
                    ctx.strokeStyle = variant === "marble" ? "rgba(140,120,170,0.28)" : "rgba(48,38,54,0.26)";
                    ctx.lineWidth = variant === "marble" ? 1.2 + rng() * 2.8 : 1 + rng() * 2;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    for (let j = 0; j < 8; j++) {
                        x += (rng() - 0.5) * 70;
                        y += 24 + rng() * 34;
                        ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
            } else if (variant === "brick") {
                const bw = 76;
                const bh = 38;
                ctx.fillStyle = dark;
                ctx.fillRect(0, 0, W, H);
                for (let y = 0; y < H + bh; y += bh) {
                    const off = (Math.floor(y / bh) % 2) * bw * 0.5;
                    for (let x = -bw; x < W + bw; x += bw) {
                        const v = 0.08 + rng() * 0.2;
                        ctx.fillStyle = `rgba(255,235,205,${v})`;
                        ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
                        ctx.strokeStyle = "rgba(70,33,28,0.72)";
                        ctx.lineWidth = 2;
                        ctx.strokeRect(x + off + 1, y + 1, bw - 2, bh - 2);
                    }
                }
            } else if (variant === "wood") {
                const plank = 64;
                for (let x = 0; x < W; x += plank) {
                    ctx.fillStyle = rng() > 0.5 ? "rgba(255,220,160,0.07)" : "rgba(40,18,8,0.1)";
                    ctx.fillRect(x, 0, plank, H);
                    ctx.strokeStyle = "rgba(24,12,5,0.74)";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, H);
                    ctx.stroke();
                    for (let i = 0; i < 30; i++) {
                        const gx = x + 4 + rng() * (plank - 8);
                        ctx.strokeStyle = `rgba(42,20,7,${0.11 + rng() * 0.2})`;
                        ctx.lineWidth = 0.6 + rng() * 1.6;
                        ctx.beginPath();
                        ctx.moveTo(gx, -10);
                        for (let y = 0; y < H + 16; y += 24) {
                            ctx.lineTo(gx + Math.sin(y * 0.035 + i) * (2 + rng() * 5), y);
                        }
                        ctx.stroke();
                    }
                    if (rng() < 0.7) {
                        const kx = x + plank * (0.25 + rng() * 0.5);
                        const ky = rng() * H;
                        const gr = ctx.createRadialGradient(kx, ky, 1, kx, ky, 18 + rng() * 18);
                        gr.addColorStop(0, "rgba(45,20,7,0.75)");
                        gr.addColorStop(1, "rgba(45,20,7,0)");
                        ctx.fillStyle = gr;
                        ctx.beginPath();
                        ctx.ellipse(kx, ky, 22, 12, rng() * 0.8, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            } else if (variant === "roof") {
                const row = 38;
                for (let y = -row; y < H + row; y += row) {
                    for (let x = -40; x < W + 40; x += 52) {
                        const ox = (Math.floor(y / row) % 2) * 26;
                        ctx.fillStyle = rng() > 0.5 ? "rgba(255,230,180,0.08)" : "rgba(35,14,18,0.12)";
                        ctx.beginPath();
                        ctx.ellipse(x + ox, y + row, 31, 21, 0, Math.PI, Math.PI * 2);
                        ctx.lineTo(x + ox + 31, y + row + 18);
                        ctx.lineTo(x + ox - 31, y + row + 18);
                        ctx.closePath();
                        ctx.fill();
                        ctx.strokeStyle = "rgba(42,20,28,0.46)";
                        ctx.stroke();
                    }
                }
            } else if (variant === "cloth") {
                for (let i = 0; i < 900; i++) {
                    ctx.strokeStyle = rng() > 0.5 ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";
                    ctx.lineWidth = 0.8;
                    const x = rng() * W;
                    const y = rng() * H;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + 15 + rng() * 35, y + 2 + rng() * 5);
                    ctx.stroke();
                }
                for (let x = 0; x < W; x += 34) {
                    ctx.fillStyle = "rgba(255,255,255,0.07)";
                    ctx.fillRect(x, 0, 3, H);
                }
            } else {
                speckle(ctx, W, H, 1200, rng, 0.09, false);
                speckle(ctx, W, H, 450, rng, 0.07, true);
            }

            speckle(ctx, W, H, 600, rng, 0.045, false);
            return {
                map: toTexture(canvas, { repeat: repeat || [2, 2] }),
                bumpMap: toTexture(bump, { srgb: false, repeat: repeat || [2, 2] })
            };
        });
    }

    function standardMaterial(name, baseHex, variant, options) {
        const opts = options || {};
        const set = makeTextureSet(name, baseHex, variant, opts.seed || 1, opts.repeat);
        return new THREE.MeshStandardMaterial({
            map: set.map,
            bumpMap: opts.bump === false ? null : set.bumpMap,
            bumpScale: opts.bumpScale === undefined ? 0.085 : opts.bumpScale,
            color: opts.tint === undefined ? 0xffffff : opts.tint,
            roughness: opts.roughness === undefined ? 0.88 : opts.roughness,
            metalness: opts.metalness || 0,
            flatShading: opts.flatShading !== false
        });
    }

    function glowSprite(color, outer) {
        return cached(`glow:${color}:${outer || ""}`, () => {
            const [canvas, ctx] = canvas2d(128, 128);
            const grad = ctx.createRadialGradient(64, 64, 1, 64, 64, 64);
            grad.addColorStop(0, color);
            grad.addColorStop(0.28, color.replace(/[\d.]+\)$/, "0.55)"));
            grad.addColorStop(1, outer || "rgba(255,255,255,0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);
            return toTexture(canvas);
        });
    }

    function runeTexture(color, seed) {
        return cached(`rune:${color}:${seed}`, () => {
            const [canvas, ctx] = canvas2d(512, 512);
            const rng = makeRNG(seed || 77);
            ctx.clearRect(0, 0, 512, 512);
            ctx.translate(256, 256);
            ctx.strokeStyle = color;
            ctx.lineWidth = 5;
            ctx.shadowColor = color;
            ctx.shadowBlur = 22;
            for (let r = 92; r <= 210; r += 38) {
                ctx.globalAlpha = 0.5 + rng() * 0.25;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.globalAlpha = 0.76;
            for (let i = 0; i < 18; i++) {
                const a = (i / 18) * Math.PI * 2;
                const r0 = 116 + (i % 3) * 24;
                const r1 = 198 - (i % 2) * 18;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
                ctx.lineTo(Math.cos(a + 0.12) * r1, Math.sin(a + 0.12) * r1);
                ctx.stroke();
            }
            ctx.font = "bold 54px Georgia, serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.84;
            ["A", "V", "R", "S", "L", "N", "E", "M"].forEach((ch, i) => {
                const a = (i / 8) * Math.PI * 2 + 0.18;
                ctx.save();
                ctx.rotate(a + Math.PI / 2);
                ctx.fillText(ch, 0, -170);
                ctx.restore();
            });
            return toTexture(canvas);
        });
    }

    function skyTexture() {
        return cached("jrpg-sky", () => {
            const W = 2048;
            const H = 1024;
            const [canvas, ctx] = canvas2d(W, H);
            const rng = makeRNG(9284);
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, "#2e397f");
            grad.addColorStop(0.34, "#7f8fd7");
            grad.addColorStop(0.66, "#ffd5b1");
            grad.addColorStop(1, "#dff7ff");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            ctx.globalCompositeOperation = "lighter";
            const auroras = ["rgba(117,240,214,0.16)", "rgba(255,156,215,0.12)", "rgba(142,184,255,0.14)"];
            for (let i = 0; i < 34; i++) {
                const x = rng() * W;
                const y = 90 + rng() * 420;
                const r = 120 + rng() * 320;
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                g.addColorStop(0, auroras[i % auroras.length]);
                g.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.ellipse(x, y, r * (0.85 + rng() * 1.2), r * 0.36, rng() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = "source-over";

            for (let i = 0; i < 1300; i++) {
                const x = rng() * W;
                const y = rng() * H * 0.54;
                const r = rng() * rng() * 1.8 + 0.25;
                ctx.fillStyle = `rgba(255,255,255,${0.25 + rng() * 0.65})`;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            for (let i = 0; i < 42; i++) {
                const x = rng() * W;
                const y = 490 + rng() * 300;
                const r = 58 + rng() * 150;
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                g.addColorStop(0, "rgba(255,255,255,0.36)");
                g.addColorStop(1, "rgba(255,255,255,0)");
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.ellipse(x, y, r * 1.8, r * 0.42, rng() * 0.35, 0, Math.PI * 2);
                ctx.fill();
            }

            return toTexture(canvas, { aniso: 8 });
        });
    }

    function signTexture(text, palette) {
        const p = palette || {};
        const bg = p.bg || "#25314d";
        const fg = p.fg || "#ffe6a6";
        const glow = p.glow || "rgba(116,238,217,0.9)";
        return cached(`sign:${text}:${bg}:${fg}`, () => {
            const [canvas, ctx] = canvas2d(512, 160);
            const g = ctx.createLinearGradient(0, 0, 0, 160);
            g.addColorStop(0, bg);
            g.addColorStop(1, "#101827");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 512, 160);
            ctx.strokeStyle = fg;
            ctx.lineWidth = 6;
            ctx.strokeRect(10, 10, 492, 140);
            ctx.strokeStyle = glow;
            ctx.lineWidth = 2;
            ctx.strokeRect(24, 24, 464, 112);
            ctx.shadowColor = glow;
            ctx.shadowBlur = 20;
            ctx.fillStyle = fg;
            ctx.font = "bold 48px 'Malgun Gothic', 'Segoe UI', serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, 256, 83);
            return toTexture(canvas);
        });
    }

    function bannerTexture(color, crest) {
        return cached(`banner:${color}:${crest || ""}`, () => {
            const [canvas, ctx] = canvas2d(192, 320);
            const rng = makeRNG(313);
            const g = ctx.createLinearGradient(0, 0, 0, 320);
            g.addColorStop(0, offsetCss(color, 0, -0.04, 0.12));
            g.addColorStop(0.6, colorCss(color));
            g.addColorStop(1, offsetCss(color, 0, 0.05, -0.16));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(174, 0);
            ctx.lineTo(174, 250);
            ctx.lineTo(96, 318);
            ctx.lineTo(18, 250);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(255,232,170,0.68)";
            ctx.lineWidth = 8;
            ctx.stroke();
            for (let i = 0; i < 140; i++) {
                ctx.strokeStyle = rng() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
                ctx.beginPath();
                const x = 22 + rng() * 148;
                ctx.moveTo(x, 8);
                ctx.lineTo(x + (rng() - 0.5) * 18, 294);
                ctx.stroke();
            }
            ctx.fillStyle = "rgba(255,240,180,0.86)";
            ctx.font = "bold 98px Georgia, serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "rgba(255,218,120,0.8)";
            ctx.shadowBlur = 12;
            ctx.fillText(crest || "✦", 96, 132);
            return toTexture(canvas);
        });
    }

    ns.FantasyVisuals = {
        makeRNG,
        canvas2d,
        toTexture,
        standardMaterial,
        glowSprite,
        runeTexture,
        skyTexture,
        signTexture,
        bannerTexture,
        colorCss,
        offsetCss
    };
})();
