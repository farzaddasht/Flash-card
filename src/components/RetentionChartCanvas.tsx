import React, { useEffect, useRef } from 'react';

interface RetentionPoint {
  day: number;
  withoutLeitner: number;
  withLeitner: number;
}

export const RetentionChartCanvas: React.FC<{ data: RetentionPoint[] }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent))
        ? 1
        : Math.min(window.devicePixelRatio || 1, 2);

    const cssWidth = canvas.parentElement?.clientWidth || 640;
    const cssHeight = 250;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const padLeft = 44;
    const padRight = 24;
    const padTop = 24;
    const padBottom = 38;
    const plotW = cssWidth - padLeft - padRight;
    const plotH = cssHeight - padTop - padBottom;

    // Horizontal grid lines (25%, 50%, 75%, 100%)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'right';

    [25, 50, 75, 100].forEach((pct) => {
      const y = padTop + plotH * (1 - pct / 100);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(cssWidth - padRight, y);
      ctx.stroke();
      ctx.fillText(`${pct}%`, padLeft - 8, y + 4);
    });

    const xForIdx = (idx: number) =>
      padLeft + (idx / Math.max(1, data.length - 1)) * plotW;
    const yForPct = (pct: number) => padTop + plotH * (1 - pct / 100);

    // X-axis Leitner Box interval markers (0d, 1d, 2d, 4d, 8d, 12d, 16d)
    ctx.textAlign = 'center';
    data.forEach((pt, idx) => {
      const x = xForIdx(idx);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`Day ${pt.day}`, x, cssHeight - 12);
    });

    // Draw "Without Leitner" curve (Coral Rose #F43F5E dashed)
    ctx.save();
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    data.forEach((pt, idx) => {
      const x = xForIdx(idx);
      const y = yForPct(pt.withoutLeitner);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Draw "With Leitner 5-Box" area fill & curve (Cyber Emerald #10B981 + Electric Violet gradient)
    const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
    areaGrad.addColorStop(1, 'rgba(139, 92, 246, 0.02)');

    ctx.beginPath();
    data.forEach((pt, idx) => {
      const x = xForIdx(idx);
      const y = yForPct(pt.withLeitner);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(xForIdx(data.length - 1), padTop + plotH);
    ctx.lineTo(xForIdx(0), padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Solid line for Leitner retention
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    data.forEach((pt, idx) => {
      const x = xForIdx(idx);
      const y = yForPct(pt.withLeitner);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Nodes
    data.forEach((pt, idx) => {
      const x = xForIdx(idx);
      const y = yForPct(pt.withLeitner);
      ctx.fillStyle = '#090D16';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }, [data]);

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        data-testid="retention-chart-canvas"
        className="block w-full"
        aria-label="Memory retention curve comparing Leitner 5-Box spaced repetition against unassisted forgetting curve"
      />
    </div>
  );
};
