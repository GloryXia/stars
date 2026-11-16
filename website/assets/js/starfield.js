/* 《光锥之外》暗室星幕与多信使波壳静态可视化渲染器 */
(function () {
  const SPECTRAL_COLORS = [
    '#9DB4FF', // O
    '#AABFFF', // B
    '#CAD8FF', // A
    '#FBF8FF', // F
    '#FFF4E8', // G
    '#FFDDB4', // K
    '#FFBD6F'  // M
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createStars(count, seed) {
    const rand = mulberry32(seed);
    const stars = [];
    for (let i = 0; i < count; i++) {
      const rPick = rand();
      // Weighted realistic distribution toward G/K/M stars, few O/B
      const specIdx =
        rPick < 0.03 ? 0 :
        rPick < 0.10 ? 1 :
        rPick < 0.22 ? 2 :
        rPick < 0.38 ? 3 :
        rPick < 0.58 ? 4 :
        rPick < 0.80 ? 5 : 6;
      const magTier = rand();
      const radius = magTier > 0.96 ? 1.85 : magTier > 0.86 ? 1.35 : magTier > 0.55 ? 0.95 : 0.65;
      const alpha = magTier > 0.94 ? 0.88 : magTier > 0.72 ? 0.56 : 0.30;
      stars.push({
        x: rand(),
        y: rand(),
        color: SPECTRAL_COLORS[specIdx],
        radius,
        alpha,
        halo: magTier > 0.95
      });
    }
    return stars;
  }

  function initAmbientCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const stars = createStars(210, 42197);

    function draw() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const px = s.x * w;
        const py = s.y * h;
        if (s.halo) {
          const grad = ctx.createRadialGradient(px, py, 0, px, py, s.radius * 5.5);
          grad.addColorStop(0, s.color + '44');
          grad.addColorStop(1, s.color + '00');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, s.radius * 5.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(px, py, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    draw();
    window.addEventListener('resize', draw, { passive: true });
  }

  function initHeroCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const stars = createStars(260, 100000);
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const simDisplay = document.getElementById('hero-sim-time');

    let width = 0;
    let height = 0;
    let pointerX = 0;
    let pointerY = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener('pointermove', (e) => {
      if (!width || !height) return;
      pointerX = (e.clientX / width - 0.5) * 14;
      pointerY = (e.clientY / height - 0.5) * 10;
    }, { passive: true });

    resize();
    window.addEventListener('resize', resize, { passive: true });

    let startMs = performance.now();

    function drawFrame(now) {
      if (!width || !height) {
        if (!reduced) requestAnimationFrame(drawFrame);
        return;
      }

      const elapsedSec = reduced ? 20.0 : (now - startMs) / 1000;
      // Gentle observatory cycle (linear physical propagation)
      const cycle = elapsedSec % 44; // 0..44 sim yr demo cycle
      if (simDisplay && !reduced) {
        const simT = 18.0 + (elapsedSec * 0.12) % 26;
        simDisplay.textContent = `T+ ${simT.toFixed(1)} YR`;
      }

      ctx.clearRect(0, 0, width, height);

      // Background radial darkroom vignette (keeps 85%+ deep void)
      const bgGrad = ctx.createRadialGradient(width * 0.72, height * 0.45, 20, width * 0.68, height * 0.48, Math.max(width, height) * 0.72);
      bgGrad.addColorStop(0, '#0C1420');
      bgGrad.addColorStop(0.55, '#070B12');
      bgGrad.addColorStop(1, '#05070B');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle diagonal galactic band dust (dimmed beneath stars)
      ctx.save();
      ctx.translate(width * 0.5, height * 0.5);
      ctx.rotate(-0.42);
      const bandGrad = ctx.createLinearGradient(0, -180, 0, 180);
      bandGrad.addColorStop(0, 'rgba(154, 169, 186, 0)');
      bandGrad.addColorStop(0.5, 'rgba(154, 169, 186, 0.032)');
      bandGrad.addColorStop(1, 'rgba(154, 169, 186, 0)');
      ctx.fillStyle = bandGrad;
      ctx.fillRect(-width, -180, width * 2, 360);
      ctx.restore();

      // Background catalog stars with blackbody temperatures
      for (const s of stars) {
        const px = s.x * width + pointerX * (s.radius * 0.35);
        const py = s.y * height + pointerY * (s.radius * 0.35);
        if (s.halo) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, s.radius * 6);
          g.addColorStop(0, s.color + '4A');
          g.addColorStop(1, s.color + '00');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, s.radius * 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(px, py, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Anchor observatory diagram on right side on desktop, upper-right dark space on mobile
      const isNarrow = width < 820;
      const ax = (isNarrow ? width * 0.68 : width * 0.73) + pointerX * 0.6;
      const ay = (isNarrow ? height * 0.16 : height * 0.46) + pointerY * 0.6;
      const unitScale = Math.min(width, height) * (isNarrow ? 0.18 : 0.32);

      // Polar coordinate rings (1px rule lines, <= 20% opacity)
      ctx.save();
      if (isNarrow) ctx.globalAlpha = 0.52;
      ctx.strokeStyle = 'rgba(36, 52, 74, 0.75)';
      ctx.lineWidth = 1;
      [0.35, 0.70, 1.05, 1.45].forEach((mult) => {
        ctx.beginPath();
        ctx.ellipse(ax, ay, unitScale * mult, unitScale * mult * 0.48, -0.14, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Radial armillary ticks
      for (let deg = 0; deg < 360; deg += 45) {
        const rad = (deg * Math.PI) / 180;
        const r1 = unitScale * 0.14;
        const r2 = unitScale * 1.45;
        ctx.beginPath();
        ctx.moveTo(ax + Math.cos(rad) * r1, ay + Math.sin(rad) * r1 * 0.48);
        ctx.lineTo(ax + Math.cos(rad) * r2, ay + Math.sin(rad) * r2 * 0.48);
        ctx.strokeStyle = 'rgba(36, 52, 74, 0.42)';
        ctx.stroke();
      }

      // Linear 1.00c Hollow EM Shell + R_diss dashed limit
      const rDiss = unitScale * 1.25;
      ctx.setLineDash([3, 6]);
      ctx.strokeStyle = 'rgba(255, 138, 61, 0.22)';
      ctx.beginPath();
      ctx.ellipse(ax, ay, rDiss, rDiss * 0.48, -0.14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Expanding wave shell (linear propagation, fades toward R_diss)
      const wavePhase = ((elapsedSec * 0.055) % 1);
      const outerR = Math.max(12, wavePhase * rDiss);
      const innerR = Math.max(0, (wavePhase - 0.22) * rDiss);
      const shellAlpha = Math.max(0, 1 - wavePhase) * 0.48;
      if (shellAlpha > 0.01) {
        ctx.strokeStyle = `rgba(255, 138, 61, ${shellAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(ax, ay, outerR, outerR * 0.48, -0.14, 0, Math.PI * 2);
        ctx.stroke();

        if (innerR > 12) {
          ctx.strokeStyle = `rgba(234, 242, 255, ${(shellAlpha * 0.55).toFixed(3)})`;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.ellipse(ax, ay, innerR, innerR * 0.48, -0.14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Subtle GW quadrupole ripple (1/r long range)
      const gwPhase = (((elapsedSec * 0.032) + 0.45) % 1);
      const gwR = Math.max(18, gwPhase * unitScale * 1.55);
      const gwAlpha = Math.max(0, 1 - gwPhase) * 0.34;
      ctx.strokeStyle = `rgba(169, 139, 255, ${gwAlpha.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(ax, ay, gwR, gwR * 0.52, 0.25, 0, Math.PI * 2);
      ctx.stroke();

      // Candidate Star B (4.00 LY away) with depth drop-line to reference plane
      const bx = ax + unitScale * 0.72;
      const by = ay - unitScale * 0.28;
      const bPlaneY = ay - unitScale * 0.08;

      // Depth drop-line (AESTHETICS §6.2)
      ctx.strokeStyle = 'rgba(154, 169, 186, 0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, bPlaneY);
      ctx.stroke();
      ctx.fillStyle = 'rgba(154, 169, 186, 0.5)';
      ctx.beginPath();
      ctx.arc(bx, bPlaneY, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 0.10c Directed Expedition trajectory (linear constant motion)
      const expFrac = Math.min(1, (cycle % 40) / 40);
      const fleetX = ax + (bx - ax) * expFrac;
      const fleetY = ay + (by - ay) * expFrac;

      ctx.strokeStyle = 'rgba(44, 127, 153, 0.5)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#6FE3FF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(fleetX, fleetY);
      ctx.stroke();

      // Expedition head marker
      ctx.fillStyle = '#EAF2FF';
      ctx.beginPath();
      ctx.arc(fleetX, fleetY, 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Pending dashed ring around Star B (4s breath per AESTHETICS §5.2)
      const breathAlpha = 0.85 + 0.15 * Math.sin((elapsedSec * Math.PI * 2) / 4);
      ctx.strokeStyle = `rgba(111, 227, 255, ${(breathAlpha * 0.85).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Star B K-type body
      ctx.fillStyle = '#FFDDB4';
      ctx.beginPath();
      ctx.arc(bx, by, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Cradle + Command Core A (solid ring + horizon + 4 ticks)
      ctx.fillStyle = '#FFF4E8';
      ctx.beginPath();
      ctx.arc(ax, ay, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#6FE3FF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ax, ay, 14, 0, Math.PI * 2);
      ctx.stroke();

      // Horizon bar
      ctx.beginPath();
      ctx.moveTo(ax - 11, ay + 21);
      ctx.lineTo(ax + 11, ay + 21);
      ctx.stroke();

      // Four cardinal ticks
      ctx.beginPath();
      ctx.moveTo(ax + 17, ay); ctx.lineTo(ax + 22, ay);
      ctx.moveTo(ax - 17, ay); ctx.lineTo(ax - 22, ay);
      ctx.moveTo(ax, ay + 17); ctx.lineTo(ax, ay + 22);
      ctx.moveTo(ax, ay - 17); ctx.lineTo(ax, ay - 22);
      ctx.stroke();

      // Subtle telemetry callouts
      ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = '#6FE3FF';
      ctx.fillText('CRADLE A', isNarrow ? ax - 24 : ax + 26, isNarrow ? ay + 34 : ay + 3);
      ctx.fillStyle = '#9AA9BA';
      ctx.fillText('STAR B · 4.0 LY', isNarrow ? bx - 44 : bx + 16, isNarrow ? by - 16 : by - 4);

      ctx.restore();

      if (!reduced) {
        requestAnimationFrame(drawFrame);
      }
    }

    if (reduced) {
      drawFrame(performance.now());
    } else {
      requestAnimationFrame(drawFrame);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const heroCanvas = document.getElementById('hero-canvas');
    if (heroCanvas) initHeroCanvas(heroCanvas);

    const ambientCanvas = document.getElementById('ambient-canvas');
    if (ambientCanvas) initAmbientCanvas(ambientCanvas);
  });
})();
