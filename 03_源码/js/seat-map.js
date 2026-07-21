const CANVAS_MARGIN = 30;
const TOP_OFFSET = 72;
const MAX_CELL_SIZE = 28;

const STATUS_COLORS = {
  available: "#22c55e",
  selected: "#f59e0b",
  sold: "#ef4444",
  reserved: "#fb7185",
};

/**
 * 创建可交互座位图。
 *
 * A 模块只维护临时选择，不直接修改 C 模块的 seatState。确认购票时，
 * 页面整合层应读取 getSelectedSeatIds()，再调用 store.createOrder()。
 */
export function createSeatMap(canvas, initialOptions = {}) {
  if (!canvas) {
    throw new Error("createSeatMap 需要有效的 canvas 元素");
  }

  const ctx = canvas.getContext("2d");
  let options = normalizeOptions(initialOptions);
  let selectedSeatIds = new Set(initialOptions.selectedSeatIds || []);
  let hitAreas = [];
  let focusedSeatId = "";
  let activeSelectedSeatId = "";
  let dragState = null;
  let suppressNextClick = false;
  let animationFrameId = 0;
  let recommendationPulse = 0;
  let lastRecommendationRenderTime = 0;

  function update(nextOptions = {}) {
    options = normalizeOptions({ ...options, ...nextOptions });
    if (Object.prototype.hasOwnProperty.call(nextOptions, "selectedSeatIds")) {
      selectedSeatIds = new Set(nextOptions.selectedSeatIds || []);
    }
    removeUnavailableSelections();
    render();
    syncRecommendationAnimation();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hitAreas = [];

    if (!options.hall) {
      ctx.save();
      ctx.fillStyle = "#667085";
      ctx.font = "600 24px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("请先选择场次", canvas.width / 2, canvas.height / 2);
      ctx.restore();
      return;
    }

    const rows = options.hall.rows || [];
    const maxPatternLength = Math.max(1, ...rows.map((row) => row.pattern.length));
    const cellSize = Math.min(
      MAX_CELL_SIZE,
      (canvas.width - CANVAS_MARGIN * 2) / maxPatternLength,
    );
    const rowSpacing = Math.min(43, (canvas.height - TOP_OFFSET - 38) / Math.max(rows.length, 1));
    const seatRadius = Math.max(4.5, Math.min(9, cellSize * 0.34));
    const stateBySeatId = new Map(options.seatState.map((seat) => [seat.seatId, seat]));
    const heatBySeatId = new Map(options.heatMap.map((item) => [item.seatId, item.heatScore]));

    rows.forEach((row, rowIndex) => {
      drawRow({
        row,
        rowIndex,
        cellSize,
        rowSpacing,
        seatRadius,
        stateBySeatId,
        heatBySeatId,
      });
    });
  }

  function drawRow({ row, rowIndex, cellSize, rowSpacing, seatRadius, stateBySeatId, heatBySeatId }) {
    const rowWidth = row.pattern.length * cellSize;
    const startX = canvas.width / 2 - rowWidth / 2 + (row.offsetX || 0);
    const baseY = TOP_OFFSET + rowIndex * rowSpacing;
    let seatNumber = 0;

    for (let cellIndex = 0; cellIndex < row.pattern.length; cellIndex += 1) {
      const cellType = row.pattern[cellIndex];
      if (cellType !== "S" && cellType !== "W") continue;

      // 与 C 的 generateSeatState 保持一致：X/A 不参与座位编号。
      seatNumber += 1;
      const seatId = `${row.rowLabel}-${seatNumber}`;
      const x = startX + cellIndex * cellSize + cellSize / 2;
      const y = baseY + getCurveOffset(cellIndex, row.pattern.length, row.curveDepth || 0);
      const storedStatus = stateBySeatId.get(seatId)?.status || "available";
      const heatScore = heatBySeatId.get(seatId) ?? 0;
      const status = selectedSeatIds.has(seatId) && storedStatus === "available"
        ? "selected"
        : storedStatus;

      drawSeat({
        x,
        y,
        seatId,
        status,
        radius: seatRadius,
        isHighlighted: options.highlightedSeatIds.includes(seatId),
        isFocused: focusedSeatId === seatId,
        isAccessible: cellType === "W",
        heatScore,
      });

      hitAreas.push({
        x,
        y,
        radius: Math.max(10, seatRadius + 5),
        seatId,
        status: storedStatus,
        seatType: cellType,
        heatScore,
      });
    }

    ctx.save();
    ctx.fillStyle = "#667085";
    ctx.font = "600 11px Segoe UI";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const leftSeatCellIndex = row.pattern.search(/[SW]/);
    const labelCurveOffset = getCurveOffset(
      Math.max(leftSeatCellIndex, 0),
      row.pattern.length,
      row.curveDepth || 0,
    );
    // 排号和左端最低座位在同一水平线上，避免弧形布局下显得悬在半空。
    ctx.fillText(row.rowLabel, Math.max(18, startX - 8), baseY + labelCurveOffset + 2);
    ctx.restore();
  }

  function drawSeat({ x, y, seatId, status, radius, isHighlighted, isFocused, isAccessible, heatScore }) {
    ctx.save();

    if (options.showHeat) {
      drawHeatBackground({ x, y, radius, heatScore });
    }

    ctx.beginPath();
    const isAvailableAccessible = isAccessible && status === "available";
    const isActiveRecommendation = isHighlighted && (status === "available" || status === "selected");
    ctx.fillStyle = isActiveRecommendation
      ? getRecommendationColor()
      : isAvailableAccessible
        ? "#2563eb"
        : STATUS_COLORS[status] || STATUS_COLORS.available;
    if (isActiveRecommendation) {
      ctx.shadowColor = recommendationPulse > 0.5
        ? "rgba(249, 115, 22, 0.72)"
        : "rgba(34, 197, 94, 0.72)";
      ctx.shadowBlur = 7 + recommendationPulse * 5;
    }
    if (isAvailableAccessible) {
      // 无障碍位用方形轮廓与普通圆形座位区分，小尺寸影厅图中也能辨认。
      ctx.roundRect(x - radius - 1, y - radius - 1, radius * 2 + 2, radius * 2 + 2, 2.5);
    } else {
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
    ctx.fill();

    if (isAccessible) {
      ctx.beginPath();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2.5;
      if (isAvailableAccessible) {
        ctx.roundRect(x - radius - 3, y - radius - 3, radius * 2 + 6, radius * 2 + 6, 3.5);
      } else {
        ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      }
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = `800 ${Math.max(8, radius * 1.25)}px Segoe UI`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("W", x, y + 0.5);
    }

    if (status === "selected") {
      ctx.strokeStyle = "#92400e";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (isFocused) {
      ctx.beginPath();
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 2;
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (radius >= 7) {
      ctx.fillStyle = "#344054";
      ctx.font = `${Math.max(7, radius)}px Segoe UI`;
      ctx.textAlign = "center";
      ctx.fillText(seatId, x, y + radius + 12);
    }

    ctx.restore();
  }

  function drawHeatBackground({ x, y, radius, heatScore }) {
    const palette = heatScore >= 0.68
      ? { core: "239, 68, 68", edge: "254, 202, 202" }
      : heatScore >= 0.38
        ? { core: "245, 158, 11", edge: "253, 230, 138" }
        : { core: "59, 130, 246", edge: "191, 219, 254" };
    // 热度是座位状态下方的连续色块：保留绿/黄/红座位本体，同时让蓝/黄/红区域足够醒目。
    const intensity = 0.42 + Math.max(0, Math.min(1, heatScore)) * 0.28;
    const fieldRadius = radius + 11;
    const gradient = ctx.createRadialGradient(x, y, radius * 0.45, x, y, fieldRadius);
    gradient.addColorStop(0, `rgba(${palette.core}, ${intensity})`);
    gradient.addColorStop(0.62, `rgba(${palette.edge}, ${intensity * 0.78})`);
    gradient.addColorStop(1, `rgba(${palette.edge}, 0.06)`);
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(x, y, fieldRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  function getRecommendationColor() {
    const green = [34, 197, 94];
    const orange = [249, 115, 22];
    const mix = recommendationPulse;
    const channel = (index) => Math.round(green[index] + (orange[index] - green[index]) * mix);
    return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
  }

  function syncRecommendationAnimation() {
    const shouldAnimate = options.highlightedSeatIds.length > 0;
    if (!shouldAnimate && animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
      recommendationPulse = 0;
      return;
    }
    if (shouldAnimate && !animationFrameId) {
      animationFrameId = window.requestAnimationFrame(animateRecommendation);
    }
  }

  function animateRecommendation(timestamp) {
    recommendationPulse = (Math.sin(timestamp / 360) + 1) / 2;
    if (timestamp - lastRecommendationRenderTime >= 80) {
      lastRecommendationRenderTime = timestamp;
      render();
    }
    animationFrameId = window.requestAnimationFrame(animateRecommendation);
  }

  function onCanvasClick(event) {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    const point = toCanvasPoint(event);
    const hit = findHitArea(point.x, point.y);
    if (!hit || hit.status !== "available") return;
    focusedSeatId = hit.seatId;
    const isTouch = event.pointerType === "touch";
    selectSeat(hit.seatId, { multi: event.ctrlKey || event.metaKey || isTouch });
  }

  function onCanvasKeyDown(event) {
    const availableSeats = hitAreas.filter((area) => area.status === "available");
    if (availableSeats.length === 0) return;

    let index = availableSeats.findIndex((area) => area.seatId === focusedSeatId);
    if (index < 0) index = 0;

    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      focusedSeatId = availableSeats[(index + 1) % availableSeats.length].seatId;
      options.onSeatFocus(availableSeats[(index + 1) % availableSeats.length]);
      updateCanvasAccessibilityLabel();
      render();
      return;
    }

    if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      focusedSeatId = availableSeats[(index - 1 + availableSeats.length) % availableSeats.length].seatId;
      options.onSeatFocus(availableSeats[(index - 1 + availableSeats.length) % availableSeats.length]);
      updateCanvasAccessibilityLabel();
      render();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      focusedSeatId = availableSeats[index].seatId;
      selectSeat(focusedSeatId, { multi: event.ctrlKey || event.metaKey });
    }
  }

  function selectSeat(seatId, { multi = false } = {}) {
    if (selectedSeatIds.has(seatId)) {
      selectedSeatIds.delete(seatId);
      if (activeSelectedSeatId === seatId) {
        activeSelectedSeatId = [...selectedSeatIds].at(-1) || "";
      }
    } else if (multi) {
      if (!canAddSelection()) return;
      selectedSeatIds.add(seatId);
      activeSelectedSeatId = seatId;
    } else {
      if (selectedSeatIds.size > 0) {
        const replaceId = selectedSeatIds.has(activeSelectedSeatId)
          ? activeSelectedSeatId
          : [...selectedSeatIds].at(-1);
        selectedSeatIds.delete(replaceId);
      }
      selectedSeatIds.add(seatId);
      activeSelectedSeatId = seatId;
    }

    options.onSeatFocus(hitAreas.find((area) => area.seatId === seatId) || { seatId, status: "available" });
    updateCanvasAccessibilityLabel();
    render();
    emitSelectionChange();
  }

  function canAddSelection() {
    const maxSelected = Math.max(1, Number(options.maxSelected) || 1);
    if (selectedSeatIds.size < maxSelected) return true;
    options.onSelectionLimit(maxSelected);
    return false;
  }

  function onPointerDown(event) {
    if (!(event.ctrlKey || event.metaKey) || event.pointerType === "touch") return;
    const point = toCanvasPoint(event);
    const hit = findHitArea(point.x, point.y);
    if (!hit || hit.status !== "available") return;

    event.preventDefault();
    dragState = {
      mode: selectedSeatIds.has(hit.seatId) ? "remove" : "add",
      visited: new Set(),
    };
    canvas.setPointerCapture?.(event.pointerId);
    applyDragSeat(hit);
  }

  function applyDragSeat(hit) {
    if (!dragState || dragState.visited.has(hit.seatId) || hit.status !== "available") return;
    dragState.visited.add(hit.seatId);

    if (dragState.mode === "add") {
      if (!selectedSeatIds.has(hit.seatId)) {
        if (!canAddSelection()) return;
        selectedSeatIds.add(hit.seatId);
      }
    } else {
      selectedSeatIds.delete(hit.seatId);
    }

    focusedSeatId = hit.seatId;
    activeSelectedSeatId = hit.seatId;
    options.onSeatFocus({ seatId: hit.seatId, status: hit.status });
    render();
    emitSelectionChange();
  }

  function endPointerDrag(event) {
    if (!dragState) return;
    canvas.releasePointerCapture?.(event.pointerId);
    dragState = null;
    suppressNextClick = true;
    window.setTimeout(() => {
      suppressNextClick = false;
    }, 350);
  }

  function onCanvasMove(event) {
    const point = toCanvasPoint(event);
    const hit = findHitArea(point.x, point.y);
    if (dragState && hit) {
      applyDragSeat(hit);
    }
    canvas.style.cursor = hit?.status === "available" ? "pointer" : "not-allowed";
    canvas.title = hit ? `${hit.seatId}（${statusLabel(hit.status)}）` : "";
    options.onSeatFocus(hit || null);
  }

  function findHitArea(x, y) {
    return hitAreas.find((area) => Math.hypot(area.x - x, area.y - y) <= area.radius);
  }

  function toCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function removeUnavailableSelections() {
    const statusBySeatId = new Map(options.seatState.map((seat) => [seat.seatId, seat.status]));
    selectedSeatIds = new Set(
      [...selectedSeatIds].filter((seatId) => statusBySeatId.get(seatId) === "available"),
    );
  }

  function emitSelectionChange() {
    options.onSelectionChange([...selectedSeatIds]);
  }

  function updateCanvasAccessibilityLabel() {
    const focused = focusedSeatId ? `，当前座位 ${focusedSeatId}` : "";
    canvas.setAttribute(
      "aria-label",
      `影厅座位图${focused}。使用方向键移动，按 Enter 或空格选择。`,
    );
  }

  function clearSelection({ notify = true } = {}) {
    if (selectedSeatIds.size === 0) return;
    selectedSeatIds.clear();
    activeSelectedSeatId = "";
    render();
    if (notify) emitSelectionChange();
  }

  function setSelectedSeatIds(seatIds) {
    selectedSeatIds = new Set((seatIds || []).slice(0, options.maxSelected));
    activeSelectedSeatId = [...selectedSeatIds].at(-1) || "";
    removeUnavailableSelections();
    render();
    emitSelectionChange();
  }

  function resetFocus() {
    focusedSeatId = "";
    updateCanvasAccessibilityLabel();
    render();
    options.onSeatFocus(null);
  }

  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", endPointerDrag);
  canvas.addEventListener("pointercancel", endPointerDrag);
  canvas.addEventListener("pointermove", onCanvasMove);
  canvas.addEventListener("keydown", onCanvasKeyDown);
  canvas.addEventListener("focus", () => {
    if (!focusedSeatId) {
      focusedSeatId = hitAreas.find((area) => area.status === "available")?.seatId || "";
    }
    if (focusedSeatId) {
      options.onSeatFocus({ seatId: focusedSeatId, status: "available" });
    }
    updateCanvasAccessibilityLabel();
    render();
  });
  canvas.addEventListener("mouseleave", () => {
    canvas.style.cursor = "default";
    canvas.title = "";
    options.onSeatFocus(null);
  });

  render();
  syncRecommendationAnimation();
  updateCanvasAccessibilityLabel();

  return {
    update,
    render,
    clearSelection,
    resetFocus,
    setSelectedSeatIds,
    getSelectedSeatIds: () => [...selectedSeatIds],
    destroy() {
      canvas.removeEventListener("click", onCanvasClick);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", endPointerDrag);
      canvas.removeEventListener("pointercancel", endPointerDrag);
      canvas.removeEventListener("pointermove", onCanvasMove);
      canvas.removeEventListener("keydown", onCanvasKeyDown);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    },
  };
}

/** 保留旧接口，供只需要绘制的调用方使用。 */
export function drawSeatMap(canvas, options) {
  return createSeatMap(canvas, options);
}

function normalizeOptions(options) {
  return {
    hall: options.hall || null,
    seatState: options.seatState || [],
    heatMap: options.heatMap || [],
    showHeat: Boolean(options.showHeat),
    highlightedSeatIds: options.highlightedSeatIds || [],
    maxSelected: Math.max(1, Number(options.maxSelected) || 1),
    onSelectionChange: options.onSelectionChange || (() => {}),
    onSelectionLimit: options.onSelectionLimit || (() => {}),
    onSeatFocus: options.onSeatFocus || (() => {}),
  };
}

function getCurveOffset(cellIndex, length, curveDepth) {
  const center = (length - 1) / 2;
  const distance = Math.abs(cellIndex - center);
  const ratio = distance / Math.max(center, 1);
  // 二次曲线让中心区域较平、两端逐渐下沉；避免低次幂形成左右两条近似斜线。
  return ratio * ratio * curveDepth * 1.9;
}

function statusLabel(status) {
  return {
    available: "可选",
    reserved: "已锁定",
    sold: "已售",
  }[status] || status;
}
