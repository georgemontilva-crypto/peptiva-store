import { useEffect, useRef } from "react";

type Node = { x: number; y: number; vx: number; vy: number; r: number; hue: 0 | 1 };

/**
 * Fondo animado de laboratorio: moléculas que flotan y se enlazan cuando están cerca,
 * con una leve atracción hacia el cursor. Se pausa fuera de pantalla y respeta "reducir movimiento".
 */
export default function MoleculeField({ tone = "light", density = 1, className = "" }: { tone?: "light" | "dark"; density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colors = tone === "dark" ? ["255,255,255", "79,199,201"] : ["21,66,110", "15,176,179"];
    let w = 0;
    let h = 0;
    let nodes: Node[] = [];
    let raf = 0;
    let visible = true;
    const mouse = { x: -9999, y: -9999 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(70, (w * h) / 16000) * density);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1.4 + Math.random() * 2.6,
        hue: Math.random() > 0.65 ? 1 : 0,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const link = 120;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < link) {
            ctx.strokeStyle = `rgba(${colors[a.hue]},${(1 - d / link) * (tone === "dark" ? 0.28 : 0.22)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3.2);
        glow.addColorStop(0, `rgba(${colors[n.hue]},${tone === "dark" ? 0.75 : 0.55})`);
        glow.addColorStop(1, `rgba(${colors[n.hue]},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      for (const n of nodes) {
        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const d = Math.hypot(dx, dy);
        if (d < 160 && d > 1) {
          n.vx += (dx / d) * 0.012;
          n.vy += (dy / d) * 0.012;
        }
        n.vx = Math.max(-0.6, Math.min(0.6, n.vx * 0.995));
        n.vy = Math.max(-0.6, Math.min(0.6, n.vy * 0.995));
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -10) n.x = w + 10;
        if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10;
        if (n.y > h + 10) n.y = -10;
      }
      draw();
      if (visible) raf = requestAnimationFrame(step);
    };

    resize();
    if (reduced) {
      draw();
      return;
    }
    raf = requestAnimationFrame(step);

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      const now = Boolean(e?.isIntersecting) && !document.hidden;
      if (now && !visible) raf = requestAnimationFrame(step);
      visible = now;
    });
    io.observe(canvas);
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const parent = canvas.parentElement;
    parent?.addEventListener("pointermove", onMove);
    parent?.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      parent?.removeEventListener("pointermove", onMove);
      parent?.removeEventListener("pointerleave", onLeave);
    };
  }, [tone, density]);

  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden />;
}
