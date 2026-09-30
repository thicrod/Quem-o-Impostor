// Confete leve em canvas (sem dependências). Roda ~2,5s e se desliga sozinho.

import { useEffect, useRef } from 'react';

const COLORS = ['#ff3d8b', '#3ee0ff', '#4ef0a3', '#ffb547', '#b18cff', '#ffffff'];

export function Confetti({ fire, pieces = 140 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!fire) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return undefined;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    const parts = Array.from({ length: pieces }, () => ({
      x: (Math.random() * 0.6 + 0.2) * canvas.width,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 18 * dpr,
      vy: (-Math.random() * 16 - 6) * dpr,
      size: (Math.random() * 7 + 5) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    let frame;
    const start = performance.now();
    const draw = (t) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach((p) => {
        p.vy += 0.45 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 2600);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      if (elapsed < 2600) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    frame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [fire, pieces]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-40 h-full w-full" aria-hidden="true" />;
}
