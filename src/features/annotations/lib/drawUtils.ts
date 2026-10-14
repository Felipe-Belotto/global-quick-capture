export function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string = "#ef4444",
  lineWidth: number = 3
) {
  const headLength = 14;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Linha principal
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Cabeça da seta
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHighlightRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string = "#ef4444",
  lineWidth: number = 3
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

export function applyPixelate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  blockSize: number = 10
) {
  if (width <= 0 || height <= 0) return;
  const clampedX = Math.max(0, Math.floor(x));
  const clampedY = Math.max(0, Math.floor(y));
  const clampedW = Math.min(ctx.canvas.width - clampedX, Math.floor(width));
  const clampedH = Math.min(ctx.canvas.height - clampedY, Math.floor(height));

  if (clampedW <= 0 || clampedH <= 0) return;

  const imgData = ctx.getImageData(clampedX, clampedY, clampedW, clampedH);
  const data = imgData.data;

  for (let py = 0; py < clampedH; py += blockSize) {
    for (let px = 0; px < clampedW; px += blockSize) {
      const redIndex = (py * clampedW + px) * 4;
      const r = data[redIndex];
      const g = data[redIndex + 1];
      const b = data[redIndex + 2];
      const a = data[redIndex + 3];

      for (let subY = 0; subY < blockSize && py + subY < clampedH; subY++) {
        for (let subX = 0; subX < blockSize && px + subX < clampedW; subX++) {
          const targetIndex = ((py + subY) * clampedW + (px + subX)) * 4;
          data[targetIndex] = r;
          data[targetIndex + 1] = g;
          data[targetIndex + 2] = b;
          data[targetIndex + 3] = a;
        }
      }
    }
  }

  ctx.putImageData(imgData, clampedX, clampedY);
}
