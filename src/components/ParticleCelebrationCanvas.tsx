import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  alpha: number;
  shape: 'rect' | 'circle' | 'diamond';
}

const PALETTE = ['#8B5CF6', '#10B981', '#F43F5E', '#F59E0B', '#38BDF8', '#A78BFA'];

export const ParticleCelebrationCanvas: React.FC<{ active: boolean }> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    const width = (canvas.width = canvas.parentElement?.clientWidth || 720);
    const height = (canvas.height = canvas.parentElement?.clientHeight || 480);

    const count = isHeadless ? 36 : 85;
    const particles: Particle[] = Array.from({ length: count }, (_, idx) => {
      const angle = (Math.PI * 2 * idx) / count + (idx % 5) * 0.12;
      const speed = 3 + (idx % 7) * 1.35;
      const shapes: Particle['shape'][] = ['rect', 'circle', 'diamond'];
      return {
        x: width * 0.5,
        y: height * 0.42,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3.2,
        size: 5 + (idx % 5) * 2,
        color: PALETTE[idx % PALETTE.length],
        rotation: (idx * 45) % 360,
        vRot: (idx % 2 === 0 ? 1 : -1) * (2 + (idx % 4)),
        alpha: 1,
        shape: shapes[idx % shapes.length],
      };
    });

    let frame = 0;
    const maxFrames = isHeadless ? 15 : 140;
    let rafId = 0;

    const renderFrame = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.14; // gravity
        p.vx *= 0.99;
        p.rotation += p.vRot;
        if (frame > maxFrames * 0.65) {
          p.alpha = Math.max(0.15, p.alpha - 0.025);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 0.6);
          ctx.lineTo(p.size * 0.6, 0);
          ctx.lineTo(0, p.size * 0.6);
          ctx.lineTo(-p.size * 0.6, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      if (frame < maxFrames) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      data-testid="celebration-canvas"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      aria-hidden="true"
    />
  );
};
