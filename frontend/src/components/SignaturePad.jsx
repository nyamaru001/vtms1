import { useRef, useEffect, useState, useCallback } from 'react';

export default function SignaturePad({ value, onChange, width = 400, height = 150, disabled = false }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a1a2e';

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        setHasDrawn(true);
      };
      img.src = value;
    }
  }, [value, width, height]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    if (disabled) return;
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!drawing || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!drawing) return;
    setDrawing(false);
    setHasDrawn(true);
    const canvas = canvasRef.current;
    onChange?.(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange?.(null);
  };

  return (
    <div className="signature-pad-container">
      <canvas
        ref={canvasRef}
        className={`signature-pad-canvas ${disabled ? 'disabled' : ''}`}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        style={{
          border: '1px solid var(--border, #d1d5db)',
          borderRadius: 8,
          cursor: disabled ? 'not-allowed' : 'crosshair',
          touchAction: 'none',
          maxWidth: '100%',
        }}
      />
      {!disabled && (
        <div className="signature-pad-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={clear} disabled={!hasDrawn}>
            Clear Signature
          </button>
        </div>
      )}
    </div>
  );
}
