import { useRef, useEffect, useCallback, useState } from 'react';
import type { DiffFile } from '../../types/diff';

interface DiffMinimapProps {
  file: DiffFile;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  onSeek: (ratio: number) => void;
}

export const DiffMinimap = ({ file, scrollTop, scrollHeight, clientHeight, onSeek }: DiffMinimapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasHeight, setCanvasHeight] = useState(300);

  // Track container height with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h > 0) setCanvasHeight(h);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Calculate total lines
  const totalLines = file.hunks.reduce((acc, h) => acc + h.lines.length + 1, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalLines === 0 || canvasHeight === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 16;
    const height = canvasHeight;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#0a0a10';
    ctx.fillRect(0, 0, width, height);

    // Draw hunks
    let lineOffset = 0;
    for (const hunk of file.hunks) {
      const headerY = (lineOffset / totalLines) * height;
      ctx.fillStyle = 'rgba(136, 136, 160, 0.2)';
      ctx.fillRect(0, headerY, width, Math.max(1, height / totalLines));
      lineOffset++;

      for (const line of hunk.lines) {
        const y = (lineOffset / totalLines) * height;
        const h = Math.max(1, height / totalLines);

        if (line[0] === '+') {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
          ctx.fillRect(0, y, width, h);
        } else if (line[0] === '-') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.fillRect(0, y, width, h);
        }
        lineOffset++;
      }
    }

    // Draw viewport indicator
    if (scrollHeight > clientHeight) {
      const viewportTop = (scrollTop / scrollHeight) * height;
      const viewportHeight = (clientHeight / scrollHeight) * height;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(0, viewportTop, width, viewportHeight);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, viewportTop + 0.5, width - 1, viewportHeight);
    }
  }, [file, totalLines, scrollTop, scrollHeight, clientHeight, canvasHeight]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    onSeek(Math.max(0, Math.min(1, ratio)));
  }, [onSeek]);

  return (
    <div ref={containerRef} className="w-4 h-full flex-shrink-0 border-l border-border-subtle/30">
      <canvas
        ref={canvasRef}
        width={16}
        height={canvasHeight}
        onClick={handleClick}
        className="w-full h-full cursor-pointer"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
};
