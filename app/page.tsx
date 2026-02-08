"use client";
import { useEffect, useRef, useState, useCallback } from "react";

type Mundo = "burbujas" | "arena" | "estrellas" | "agua";

interface Burbuja {
  x: number; y: number; r: number; targetR: number;
  hue: number; speed: number; wobble: number; phase: number;
}

interface Particula {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  hue: number;
  life: number;
}

export default function Calma() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mundo, setMundo] = useState<Mundo>("burbujas");
  const mundoRef = useRef(mundo);
  const touchRef = useRef<{x: number; y: number; active: boolean}>({ x: 0, y: 0, active: false });
  const burbujasRef = useRef<Burbuja[]>([]);
  const particulasRef = useRef<Particula[]>([]);
  const arenaRef = useRef<number[][]>([]);
  const estrellasRef = useRef<{x: number; y: number; size: number; twinkle: number; hue: number}[]>([]);
  const ondasRef = useRef<{x: number; y: number; r: number; maxR: number; hue: number}[]>([]);
  const timeRef = useRef(0);
  const autoGenRef = useRef(0);
  const [sonido, setSonido] = useState(false);
  const sonidoRef = useRef(sonido);
  const [modoZen, setModoZen] = useState(false);
  const modoZenRef = useRef(modoZen);
  const lastTapRef = useRef(0);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => { sonidoRef.current = sonido; }, [sonido]);
  useEffect(() => { modoZenRef.current = modoZen; }, [modoZen]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => { mundoRef.current = mundo; }, [mundo]);

  const playTone = useCallback((freq: number, dur: number) => {
    if (!sonidoRef.current) return;
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  }, []);

  const playPopSound = useCallback((radius: number) => {
    if (!sonidoRef.current) return;
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      // Tono basado en tamaño: burbujas grandes = tono grave, pequeñas = agudo
      const freq = 300 + (60 - radius) * 5; // ~400-600Hz range
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }, []);

  // Generar hue calmante: azules (180-220) o lavandas (280-320)
  const calmHue = () => {
    return Math.random() > 0.5
      ? 180 + Math.random() * 40
      : 280 + Math.random() * 40;
  };

  const crearParticulas = (x: number, y: number, hue: number) => {
    const count = 6 + Math.floor(Math.random() * 3); // 6-8
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 2;
      particulasRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2 + Math.random() * 3,
        hue,
        life: 1,
      });
    }
  };

  const explotarBurbuja = (index: number) => {
    const b = burbujasRef.current[index];
    crearParticulas(b.x, b.y, b.hue);
    playPopSound(b.r);
    // Vibración háptica
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
    burbujasRef.current.splice(index, 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const cols = Math.ceil(canvas.width / 6);
      const rows = Math.ceil(canvas.height / 6);
      arenaRef.current = Array.from({ length: rows }, () => Array(cols).fill(0));
    };
    resize();
    window.addEventListener("resize", resize);

    // Init estrellas
    estrellasRef.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 1 + Math.random() * 3,
      twinkle: Math.random() * Math.PI * 2,
      hue: 40 + Math.random() * 30,
    }));

    const handleStart = (x: number, y: number) => {
      touchRef.current = { x, y, active: true };
      const m = mundoRef.current;

      if (m === "burbujas") {
        // Doble tap para salir de modo zen
        const now = Date.now();
        if (modoZenRef.current && now - lastTapRef.current < 400) {
          setModoZen(false);
          lastTapRef.current = 0;
          return;
        }
        lastTapRef.current = now;

        // Detectar si toca una burbuja existente
        const bs = burbujasRef.current;
        for (let i = bs.length - 1; i >= 0; i--) {
          const b = bs[i];
          const dist = Math.sqrt((x - b.x) ** 2 + (y - b.y) ** 2);
          if (dist < b.r) {
            explotarBurbuja(i);
            return;
          }
        }

        // Si no tocó burbuja, crear una nueva
        const b: Burbuja = {
          x, y, r: 0, targetR: 20 + Math.random() * 40,
          hue: calmHue(), speed: 0.3 + Math.random() * 0.5,
          wobble: 2 + Math.random() * 3, phase: Math.random() * Math.PI * 2,
        };
        burbujasRef.current.push(b);
        if (burbujasRef.current.length > 20) burbujasRef.current.shift();
      } else if (m === "agua") {
        ondasRef.current.push({ x, y, r: 0, maxR: 150 + Math.random() * 100, hue: 190 + Math.random() * 40 });
        if (ondasRef.current.length > 15) ondasRef.current.shift();
      }
    };

    const handleMove = (x: number, y: number) => {
      touchRef.current = { x, y, active: true };
      const m = mundoRef.current;
      if (m === "arena") {
        const grid = arenaRef.current;
        const col = Math.floor(x / 6);
        const row = Math.floor(y / 6);
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const r = row + dy;
            const c = col + dx;
            if (r >= 0 && r < grid.length && c >= 0 && c < grid[0].length) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 4) grid[r][c] = Math.min(1, grid[r][c] + (4 - dist) * 0.15);
            }
          }
        }
      }
    };

    const handleEnd = () => { touchRef.current.active = false; };

    const onMouse = (e: MouseEvent) => { if (e.buttons) { handleMove(e.clientX, e.clientY); } };
    const onMouseDown = (e: MouseEvent) => { handleStart(e.clientX, e.clientY); };
    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) handleMove(t.clientX, t.clientY);
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) handleStart(t.clientX, t.clientY);
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouse);
    canvas.addEventListener("mouseup", handleEnd);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouch, { passive: false });
    canvas.addEventListener("touchend", handleEnd);

    let animId: number;

    const drawBurbujas = (t: number) => {
      ctx.fillStyle = "rgba(240, 245, 255, 1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Generación automática de burbujas
      autoGenRef.current++;
      if (autoGenRef.current % 150 === 0 && burbujasRef.current.length < 18) {
        const autoB: Burbuja = {
          x: 40 + Math.random() * (canvas.width - 80),
          y: canvas.height + 30,
          r: 0,
          targetR: 15 + Math.random() * 45,
          hue: calmHue(),
          speed: 0.2 + Math.random() * 0.4,
          wobble: 2 + Math.random() * 3,
          phase: Math.random() * Math.PI * 2,
        };
        burbujasRef.current.push(autoB);
      }

      const bs = burbujasRef.current;
      for (const b of bs) {
        b.y -= b.speed;
        b.x += Math.sin(t * 0.02 + b.phase) * b.wobble * 0.1;
        if (b.r < b.targetR) b.r += (b.targetR - b.r) * 0.08;

        if (b.y + b.r < -20) { b.y = canvas.height + b.r; }

        const gradient = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
        gradient.addColorStop(0, `hsla(${b.hue}, 50%, 92%, 0.9)`);
        gradient.addColorStop(0.5, `hsla(${b.hue}, 40%, 85%, 0.6)`);
        gradient.addColorStop(1, `hsla(${b.hue}, 35%, 80%, 0.15)`);

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Shine
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fill();
      }

      // Dibujar partículas
      const parts = particulasRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravedad suave
        p.life -= 0.03;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 50%, 85%, ${p.life * 0.7})`;
        ctx.fill();
      }
    };

    const drawArena = () => {
      ctx.fillStyle = "#f5e6c8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const grid = arenaRef.current;
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
          if (grid[r][c] > 0.01) {
            const depth = grid[r][c];
            const hue = 35 + depth * 15;
            const light = 75 - depth * 25;
            ctx.fillStyle = `hsl(${hue}, 50%, ${light}%)`;
            ctx.fillRect(c * 6, r * 6, 6, 6);

            if (depth > 0.3) {
              ctx.fillStyle = `rgba(120, 90, 50, ${depth * 0.15})`;
              ctx.fillRect(c * 6 + 1, r * 6 + 1, 6, 6);
            }
          }
        }
      }

      ctx.fillStyle = "rgba(160, 130, 90, 0.3)";
      ctx.font = "14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("dibuja con tu dedo", canvas.width / 2, canvas.height - 30);
    };

    const drawEstrellas = (t: number) => {
      ctx.fillStyle = "#0a0a2e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const s of estrellasRef.current) {
        s.twinkle += 0.02;
        const alpha = 0.3 + Math.sin(s.twinkle) * 0.7;
        const size = s.size * (0.7 + Math.sin(s.twinkle * 0.7) * 0.3);

        ctx.beginPath();
        ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue}, 80%, 90%, ${alpha})`;
        ctx.fill();

        if (size > 2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${s.hue}, 60%, 80%, ${alpha * 0.1})`;
          ctx.fill();
        }
      }

      if (touchRef.current.active) {
        const tx = touchRef.current.x;
        const ty = touchRef.current.y;
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 60;
          const sx = tx + Math.cos(angle) * dist;
          const sy = ty + Math.sin(angle) * dist;
          ctx.beginPath();
          ctx.arc(sx, sy, 1 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${50 + Math.random() * 20}, 100%, 95%, ${0.5 + Math.random() * 0.5})`;
          ctx.fill();
        }
      }
    };

    const drawAgua = (t: number) => {
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, "#e8f4f8");
      bg.addColorStop(1, "#b8d8e8");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const ondas = ondasRef.current;
      for (let i = ondas.length - 1; i >= 0; i--) {
        const o = ondas[i];
        o.r += 2;
        const alpha = 1 - o.r / o.maxR;
        if (alpha <= 0) { ondas.splice(i, 1); continue; }

        for (let ring = 0; ring < 3; ring++) {
          const rr = o.r - ring * 12;
          if (rr <= 0) continue;
          ctx.beginPath();
          ctx.arc(o.x, o.y, rr, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${o.hue}, 50%, 60%, ${alpha * 0.4 * (1 - ring * 0.3)})`;
          ctx.lineWidth = 2 - ring * 0.5;
          ctx.stroke();
        }
      }

      ctx.fillStyle = "rgba(100, 160, 200, 0.25)";
      ctx.font = "14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("toca para crear ondas", canvas.width / 2, canvas.height - 30);
    };

    const animate = () => {
      timeRef.current++;
      const t = timeRef.current;
      const m = mundoRef.current;

      if (m === "burbujas") drawBurbujas(t);
      else if (m === "arena") drawArena();
      else if (m === "estrellas") drawEstrellas(t);
      else drawAgua(t);

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("mouseup", handleEnd);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouch);
      canvas.removeEventListener("touchend", handleEnd);
    };
  }, [playTone, playPopSound]);

  const mundos: { id: Mundo; emoji: string; label: string; bg: string }[] = [
    { id: "burbujas", emoji: "🫧", label: "Burbujas", bg: "bg-blue-100" },
    { id: "arena", emoji: "🏖️", label: "Arena", bg: "bg-amber-100" },
    { id: "estrellas", emoji: "✨", label: "Estrellas", bg: "bg-indigo-100" },
    { id: "agua", emoji: "💧", label: "Agua", bg: "bg-cyan-100" },
  ];

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Controles — se ocultan en modo zen */}
      {!modoZen && (
        <>
          {/* Navegación de mundos */}
          <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center gap-3 p-4 pb-6">
            {mundos.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMundo(m.id); playTone(300 + mundos.indexOf(m) * 80, 0.3); }}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-2xl transition-all duration-300 ${
                  mundo === m.id
                    ? `${m.bg} scale-110 shadow-lg border-2 border-white/50`
                    : "bg-white/30 backdrop-blur-sm hover:bg-white/50"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className={`text-xs font-medium ${mundo === m.id ? "text-gray-700" : "text-gray-500"}`}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>

          {/* Install PWA */}
          {installPrompt && !installed && (
            <button
              onClick={() => { installPrompt.prompt(); installPrompt.userChoice.then(() => { setInstallPrompt(null); setInstalled(true); }); }}
              className="absolute top-4 right-28 z-10 px-3 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white/70 text-xs font-medium hover:bg-white/30 transition-all"
            >
              Instalar
            </button>
          )}

          {/* Modo Zen button — solo visible en modo burbujas */}
          {mundo === "burbujas" && (
            <button
              onClick={() => setModoZen(true)}
              className="absolute top-4 right-16 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg"
              title="Modo Zen"
            >
              ⛶
            </button>
          )}

          {/* Sonido toggle */}
          <button
            onClick={() => setSonido(!sonido)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg"
          >
            {sonido ? "🔊" : "🔇"}
          </button>

          {/* Firma */}
          <p className="absolute top-4 left-4 z-10 text-[10px] text-black/10">
            Hecho por duendes.app 2026
          </p>
        </>
      )}

      {/* Indicador modo zen — sutil, desaparece */}
      {modoZen && (
        <p className="absolute bottom-6 left-0 right-0 z-10 text-center text-[11px] text-black/15 animate-pulse">
          doble tap para salir
        </p>
      )}
    </div>
  );
}
