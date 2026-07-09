// A: 负责 Canvas 渲染和手动选座交互。
// 注意：这里负责“座位区域组件”，不是整个页面的视觉系统。

const CELL_SIZE = 28;
const ROW_SPACING = 40;
const SEAT_RADIUS = 9;

export function drawSeatMap(canvas, { hall, seatState, highlightedSeatIds = [] }) {
  if (!canvas || !hall) {
    return;
  }

  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  hall.rows.forEach((row, rowIndex) => {
    drawRow(ctx, {
      canvas,
      row,
      rowIndex,
      seatState,
      highlightedSeatIds,
    });
  });
}

function drawRow(ctx, { canvas, row, rowIndex, seatState, highlightedSeatIds }) {
  const rowWidth = row.pattern.length * CELL_SIZE;
  const startX = canvas.width / 2 - rowWidth / 2 + row.offsetX;
  const baseY = 90 + rowIndex * ROW_SPACING;

  row.pattern.split("").forEach((cellType, cellIndex) => {
    if (cellType === "A" || cellType === "X") {
      return;
    }

    const x = startX + cellIndex * CELL_SIZE + CELL_SIZE / 2;
    const y = baseY + getCurveOffset(cellIndex, row.pattern.length, row.curveDepth);
    const seatId = `${row.rowLabel}-${cellIndex + 1}`;
    const currentState = seatState.find((item) => item.seatId === seatId)?.status ?? "available";

    drawSeat(ctx, {
      x,
      y,
      seatId,
      status: currentState,
      isHighlighted: highlightedSeatIds.includes(seatId),
    });
  });
}

function drawSeat(ctx, { x, y, seatId, status, isHighlighted }) {
  ctx.save();

  if (isHighlighted) {
    ctx.beginPath();
    ctx.fillStyle = "rgba(13, 148, 136, 0.18)";
    ctx.arc(x, y, SEAT_RADIUS + 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.fillStyle = getSeatColor(status);
  ctx.arc(x, y, SEAT_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#344054";
  ctx.font = "10px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(seatId, x, y + 22);

  ctx.restore();
}

function getCurveOffset(cellIndex, length, curveDepth = 0) {
  const center = (length - 1) / 2;
  const distance = Math.abs(cellIndex - center);
  const maxDistance = Math.max(center, 1);

  return (distance / maxDistance) * curveDepth;
}

function getSeatColor(status) {
  switch (status) {
    case "selected":
      return "#f59e0b";
    case "sold":
      return "#ef4444";
    case "reserved":
      return "#fb7185";
    default:
      return "#22c55e";
  }
}
