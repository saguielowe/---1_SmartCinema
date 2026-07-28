const CANVAS_MARGIN = 30;
const TOP_OFFSET = 72;
const MAX_CELL_SIZE = 28;

const DEFAULT_STATUS_COLORS = {
  available: "#22c55e",
  selected: "#f59e0b",
  sold: "#ef4444",
  reserved: "#fb7185",
  remote: "#0891b2",
};

const COLOR_BLIND_STATUS_COLORS = {
  available: "#0072b2",
  selected: "#e69f00",
  sold: "#595959",
  reserved: "#cc79a7",
  remote: "#56b4e9",
};

const HIGH_CONTRAST_STATUS_COLORS = {
  available: "#00852f",
  selected: "#ffd400",
  sold: "#d50000",
  reserved: "#95005d",
  remote: "#005fcc",
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
  let isRecommendationSelectionActive = hasSameSeatIds(selectedSeatIds, initialOptions.highlightedSeatIds || []);
  let hitAreas = [];
  let focusedSeatId = "";
  let activeSelectedSeatId = "";
  let dragState = null;
  let suppressNextClick = false;
  let animationFrameId = 0;
  let interactionAnimationFrameId = 0;
  let interactionEffects = [];
  let recommendationPulse = 0;
  let lastRecommendationRenderTime = 0;

  function update(nextOptions = {}) {
    options = normalizeOptions({ ...options, ...nextOptions });
    if (Object.prototype.hasOwnProperty.call(nextOptions, "selectedSeatIds")) {
      selectedSeatIds = new Set(nextOptions.selectedSeatIds || []);
      isRecommendationSelectionActive = hasSameSeatIds(selectedSeatIds, options.highlightedSeatIds);
    }
    removeUnavailableSelections();
    render();
    syncRecommendationAnimation();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (options.highContrast) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    hitAreas = [];

    if (!options.hall) {
      ctx.save();
      ctx.fillStyle = options.highContrast ? "#000000" : "#667085";
      ctx.font = `${options.highContrast ? "800" : "600"} ${options.largeText ? 30 : 24}px Segoe UI`;
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
        displaySelectedSeatIds: new Set(options.displaySelectedSeatIds),
      });
    });
    drawInteractionEffects(performance.now());
  }

  function drawRow({
    row,
    rowIndex,
    cellSize,
    rowSpacing,
    seatRadius,
    stateBySeatId,
    heatBySeatId,
    displaySelectedSeatIds,
  }) {
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
      const isRemoteSelection = options.remoteSelectedSeatIds.includes(seatId) &&
        storedStatus === "available";
      const isDisplaySelected = displaySelectedSeatIds.has(seatId);
      const status = isRemoteSelection
        ? "remote"
        : isDisplaySelected
          ? "selected"
          : selectedSeatIds.has(seatId) && storedStatus === "available"
          ? "selected"
          : storedStatus;
      const interactiveStatus = isRemoteSelection ? "remote" : storedStatus;

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
        status: interactiveStatus,
        displayStatus: status,
        seatType: cellType,
        heatScore,
      });
    }

    ctx.save();
    ctx.fillStyle = options.highContrast ? "#000000" : "#667085";
    ctx.font = `${options.highContrast ? "800" : "600"} ${options.largeText ? 15 : 11}px Segoe UI`;
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
    const statusColors = options.highContrast
      ? HIGH_CONTRAST_STATUS_COLORS
      : options.colorBlindFriendly
        ? COLOR_BLIND_STATUS_COLORS
        : DEFAULT_STATUS_COLORS;
    const accessibleColor = options.highContrast
      ? "#0037a6"
      : options.colorBlindFriendly
        ? "#009e73"
        : "#2563eb";
    const isAvailableAccessible = isAccessible && status === "available";
    const isActiveRecommendation = isHighlighted && (status === "available" || status === "selected");
    ctx.fillStyle = isActiveRecommendation
      ? getRecommendationColor()
      : isAvailableAccessible
        ? accessibleColor
        : statusColors[status] || statusColors.available;
    if (isActiveRecommendation) {
      ctx.shadowColor = options.colorBlindFriendly
        ? recommendationPulse > 0.5
          ? "rgba(230, 159, 0, 0.72)"
          : "rgba(0, 114, 178, 0.72)"
        : recommendationPulse > 0.5
          ? "rgba(249, 115, 22, 0.72)"
          : "rgba(34, 197, 94, 0.72)";
      ctx.shadowBlur = options.reduceMotion ? 7 : 7 + recommendationPulse * 5;
    }
    if (isAvailableAccessible) {
      // 无障碍位用方形轮廓与普通圆形座位区分，小尺寸影厅图中也能辨认。
      drawRoundedRectanglePath(x - radius - 1, y - radius - 1, radius * 2 + 2, radius * 2 + 2, 2.5);
    } else {
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
    ctx.fill();
    if (options.highContrast) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    if (isAccessible) {
      ctx.beginPath();
      ctx.strokeStyle = accessibleColor;
      ctx.lineWidth = 2.5;
      if (isAvailableAccessible) {
        drawRoundedRectanglePath(x - radius - 3, y - radius - 3, radius * 2 + 6, radius * 2 + 6, 3.5);
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

    if (options.colorBlindFriendly && !isAccessible) {
      drawColorBlindStatusMark({ x, y, radius, status });
    }

    if (status === "remote") {
      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.8;
      ctx.arc(x, y, Math.max(2.3, radius * 0.34), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.52, y + radius * 0.5);
      ctx.quadraticCurveTo(x, y + radius * 0.08, x + radius * 0.52, y + radius * 0.5);
      ctx.stroke();
    }

    if (status === "selected") {
      ctx.strokeStyle = options.highContrast ? "#000000" : "#92400e";
      ctx.lineWidth = options.highContrast ? 2.8 : 1.5;
      ctx.stroke();
    }

    if (isFocused) {
      ctx.beginPath();
      ctx.strokeStyle = options.highContrast ? "#e6007a" : "#0f766e";
      ctx.lineWidth = options.highContrast ? 3.5 : 2;
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (radius >= 7) {
      ctx.fillStyle = options.highContrast ? "#000000" : "#344054";
      ctx.font = `${options.largeText || options.highContrast ? "700" : "400"} ${
        options.largeText ? Math.max(12, radius * 1.3) : Math.max(7, radius)
      }px Segoe UI`;
      ctx.textAlign = "center";
      ctx.fillText(seatId, x, y + radius + 12);
    }

    ctx.restore();
  }

  function drawRoundedRectanglePath(x, y, width, height, radius) {
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, width, height, radius);
      return;
    }

    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  }

  function drawColorBlindStatusMark({ x, y, radius, status }) {
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.2, radius * 0.18);
    ctx.lineCap = "round";

    if (status === "sold") {
      const markRadius = radius * 0.42;
      ctx.beginPath();
      ctx.moveTo(x - markRadius, y - markRadius);
      ctx.lineTo(x + markRadius, y + markRadius);
      ctx.moveTo(x + markRadius, y - markRadius);
      ctx.lineTo(x - markRadius, y + markRadius);
      ctx.stroke();
    } else if (status === "selected") {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.8, radius * 0.24), 0, Math.PI * 2);
      ctx.fill();
    } else if (status === "reserved") {
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.38, y);
      ctx.lineTo(x + radius * 0.38, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawHeatBackground({ x, y, radius, heatScore }) {
    const palette = options.colorBlindFriendly
      ? heatScore >= 0.68
        ? { core: "204, 121, 167", edge: "239, 196, 220" }
        : heatScore >= 0.38
          ? { core: "230, 159, 0", edge: "248, 220, 151" }
          : { core: "0, 114, 178", edge: "160, 210, 235" }
      : options.highContrast
        ? heatScore >= 0.68
          ? { core: "213, 0, 0", edge: "255, 168, 168" }
          : heatScore >= 0.38
            ? { core: "230, 154, 0", edge: "255, 226, 128" }
            : { core: "0, 133, 47", edge: "155, 230, 176" }
      : heatScore >= 0.68
        ? { core: "239, 68, 68", edge: "254, 202, 202" }
        : heatScore >= 0.38
          ? { core: "245, 158, 11", edge: "253, 230, 138" }
          : { core: "34, 197, 94", edge: "187, 247, 208" };
    // 热度使用座位下方的连续色场；普通模式严格对应绿（冷）/黄（一般）/红（热）。
    const intensity = (options.highContrast ? 0.56 : 0.46) +
      Math.max(0, Math.min(1, heatScore)) * 0.26;
    const fieldRadius = radius + (options.highContrast ? 13 : 11);
    const gradient = ctx.createRadialGradient(x, y, radius * 0.45, x, y, fieldRadius);
    gradient.addColorStop(0, `rgba(${palette.core}, ${intensity})`);
    gradient.addColorStop(0.62, `rgba(${palette.edge}, ${intensity * 0.78})`);
    gradient.addColorStop(1, `rgba(${palette.edge}, 0.06)`);
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(x, y, fieldRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${palette.core}, ${options.highContrast ? 0.76 : 0.5})`;
    ctx.lineWidth = options.highContrast ? 2.4 : 1.2;
    ctx.arc(x, y, radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  function getRecommendationColor() {
    const green = options.colorBlindFriendly ? [0, 114, 178] : [34, 197, 94];
    const orange = options.colorBlindFriendly ? [230, 159, 0] : [249, 115, 22];
    if (options.reduceMotion) {
      return `rgb(${green[0]}, ${green[1]}, ${green[2]})`;
    }
    const mix = recommendationPulse;
    const channel = (index) => Math.round(green[index] + (orange[index] - green[index]) * mix);
    return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
  }

  function syncRecommendationAnimation() {
    const shouldAnimate = options.highlightedSeatIds.length > 0 && !options.reduceMotion;
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
    const wasSelected = selectedSeatIds.has(seatId);
    if (multi && isRecommendationSelectionActive) {
      selectedSeatIds = new Set([seatId]);
      activeSelectedSeatId = seatId;
      isRecommendationSelectionActive = false;
    } else if (selectedSeatIds.has(seatId)) {
      selectedSeatIds.delete(seatId);
      isRecommendationSelectionActive = false;
      if (activeSelectedSeatId === seatId) {
        activeSelectedSeatId = [...selectedSeatIds].at(-1) || "";
      }
    } else if (multi) {
      clearActiveRecommendationSelection();
      if (!canAddSelection()) return;
      selectedSeatIds.add(seatId);
      activeSelectedSeatId = seatId;
      isRecommendationSelectionActive = false;
    } else {
      if (selectedSeatIds.size > 0) {
        const replaceId = selectedSeatIds.has(activeSelectedSeatId)
          ? activeSelectedSeatId
          : [...selectedSeatIds].at(-1);
        selectedSeatIds.delete(replaceId);
      }
      selectedSeatIds.add(seatId);
      activeSelectedSeatId = seatId;
      isRecommendationSelectionActive = false;
    }

    queueInteractionEffect(seatId, wasSelected ? "remove" : "add");
    options.onSeatFocus(hitAreas.find((area) => area.seatId === seatId) || { seatId, status: "available" });
    updateCanvasAccessibilityLabel();
    render();
    emitSelectionChange();
  }

  function clearActiveRecommendationSelection() {
    if (!isRecommendationSelectionActive) return;
    selectedSeatIds.clear();
    activeSelectedSeatId = "";
    isRecommendationSelectionActive = false;
  }

  function canAddSelection({ notify = true } = {}) {
    const maxSelected = Math.max(1, Number(options.maxSelected) || 1);
    if (selectedSeatIds.size < maxSelected) return true;
    if (notify) options.onSelectionLimit(maxSelected);
    return false;
  }

  function onPointerDown(event) {
    if (!(event.ctrlKey || event.metaKey) || event.pointerType === "touch") return;
    const point = toCanvasPoint(event);
    const hit = findHitArea(point.x, point.y);
    if (!hit || hit.status !== "available") return;

    dragState = {
      mode: selectedSeatIds.has(hit.seatId) ? "remove" : "add",
      visited: new Set(),
      pointerId: event.pointerId,
      startHit: hit,
      startPoint: point,
      hasDragged: false,
      limitNotified: false,
    };
    canvas.setPointerCapture?.(event.pointerId);
  }

  function applyDragSeats(hits) {
    if (!dragState || hits.length === 0) return;

    let lastAppliedHit = null;
    let selectionChanged = false;

    hits.forEach((hit) => {
      if (dragState.visited.has(hit.seatId) || hit.status !== "available") return;
      dragState.visited.add(hit.seatId);

      if (dragState.mode === "add") {
        if (!selectedSeatIds.has(hit.seatId)) {
          const canAdd = canAddSelection({ notify: !dragState.limitNotified });
          if (!canAdd) {
            dragState.limitNotified = true;
            return;
          }
          selectedSeatIds.add(hit.seatId);
          selectionChanged = true;
          queueInteractionEffect(hit.seatId, "add");
        }
      } else if (selectedSeatIds.delete(hit.seatId)) {
        selectionChanged = true;
        queueInteractionEffect(hit.seatId, "remove");
      }

      focusedSeatId = hit.seatId;
      activeSelectedSeatId = hit.seatId;
      lastAppliedHit = hit;
    });

    if (!lastAppliedHit) return;
    options.onSeatFocus({ seatId: lastAppliedHit.seatId, status: lastAppliedHit.status });
    render();
    if (selectionChanged) emitSelectionChange();
  }

  function applyDragPointerEvent(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    let samples = [event];
    if (typeof event.getCoalescedEvents === "function") {
      const coalescedEvents = event.getCoalescedEvents();
      if (coalescedEvents.length > 0) {
        samples = [...coalescedEvents];
        const finalSample = samples.at(-1);
        if (finalSample.clientX !== event.clientX || finalSample.clientY !== event.clientY) {
          samples.push(event);
        }
      }
    }

    samples.forEach((sample) => {
      const nextPoint = toCanvasPoint(sample);
      const moveDistance = Math.hypot(
        nextPoint.x - dragState.startPoint.x,
        nextPoint.y - dragState.startPoint.y,
      );
      if (!dragState.hasDragged && moveDistance < 8) return;
      if (!dragState.hasDragged) {
        dragState.hasDragged = true;
        const hasActiveRecommendation = options.highlightedSeatIds.some((seatId) =>
          selectedSeatIds.has(seatId)
        );
        if (hasActiveRecommendation) {
          selectedSeatIds.clear();
          activeSelectedSeatId = "";
          isRecommendationSelectionActive = false;
        }
        applyDragSeats([dragState.startHit]);
      }
      const endHit = findClosestSeatInRow(dragState.startHit, nextPoint.x);
      const crossedSeats = findSeatRange(dragState.startHit, endHit);
      applyDragSeats(crossedSeats);
    });
  }

  function endPointerDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (event.type === "pointerup") {
      applyDragPointerEvent(event);
    }
    const shouldSuppressClick = dragState.hasDragged;
    canvas.releasePointerCapture?.(event.pointerId);
    dragState = null;
    if (shouldSuppressClick) {
      suppressNextClick = true;
      window.setTimeout(() => {
        suppressNextClick = false;
      }, 350);
    }
  }

  function onCanvasMove(event) {
    const point = toCanvasPoint(event);
    const hit = findHitArea(point.x, point.y);
    if (dragState) {
      applyDragPointerEvent(event);
    }
    canvas.style.cursor = hit?.status === "available" ? "pointer" : "not-allowed";
    canvas.title = hit ? `${hit.seatId}（${statusLabel(hit.displayStatus || hit.status)}）` : "";
    options.onSeatFocus(hit ? { ...hit, status: hit.displayStatus || hit.status } : null);
  }

  function findHitArea(x, y) {
    return hitAreas.find((area) => Math.hypot(area.x - x, area.y - y) <= area.radius);
  }

  function findClosestSeatInRow(startHit, x) {
    const rowLabel = getSeatPosition(startHit.seatId).rowLabel;
    return hitAreas
      .filter((area) => getSeatPosition(area.seatId).rowLabel === rowLabel)
      .reduce(
        (closest, area) =>
          !closest || Math.abs(area.x - x) < Math.abs(closest.x - x) ? area : closest,
        null,
      );
  }

  function findSeatRange(startHit, endHit) {
    if (!endHit) return [];
    const start = getSeatPosition(startHit.seatId);
    const end = getSeatPosition(endHit.seatId);
    const minimum = Math.min(start.seatNumber, end.seatNumber);
    const maximum = Math.max(start.seatNumber, end.seatNumber);
    const direction = start.seatNumber <= end.seatNumber ? 1 : -1;

    return hitAreas
      .filter((area) => {
        const position = getSeatPosition(area.seatId);
        return position.rowLabel === start.rowLabel &&
          position.seatNumber >= minimum &&
          position.seatNumber <= maximum;
      })
      .sort((left, right) =>
        (getSeatPosition(left.seatId).seatNumber - getSeatPosition(right.seatId).seatNumber) *
        direction
      );
  }

  function getSeatPosition(seatId) {
    const separatorIndex = seatId.lastIndexOf("-");
    return {
      rowLabel: seatId.slice(0, separatorIndex),
      seatNumber: Number.parseInt(seatId.slice(separatorIndex + 1), 10),
    };
  }

  function queueInteractionEffect(seatId, mode) {
    if (options.reduceMotion) return;
    interactionEffects.push({
      seatId,
      mode,
      startedAt: performance.now(),
    });
    interactionEffects = interactionEffects.slice(-36);
    if (!interactionAnimationFrameId) {
      interactionAnimationFrameId = window.requestAnimationFrame(animateInteractionEffects);
    }
  }

  function drawInteractionEffects(timestamp) {
    if (options.reduceMotion || interactionEffects.length === 0) return;
    interactionEffects.forEach((effect) => {
      const elapsed = timestamp - effect.startedAt;
      const progress = Math.max(0, Math.min(1, elapsed / 460));
      if (progress >= 1) return;
      const area = hitAreas.find((item) => item.seatId === effect.seatId);
      if (!area) return;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = effect.mode === "add"
        ? `rgba(245, 158, 11, ${0.9 * (1 - progress)})`
        : `rgba(37, 99, 235, ${0.82 * (1 - progress)})`;
      ctx.lineWidth = 3 - progress * 1.4;
      ctx.arc(area.x, area.y, area.radius + 2 + progress * 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function animateInteractionEffects(timestamp) {
    interactionEffects = interactionEffects.filter((effect) => timestamp - effect.startedAt < 460);
    render();
    if (interactionEffects.length > 0 && !options.reduceMotion) {
      interactionAnimationFrameId = window.requestAnimationFrame(animateInteractionEffects);
    } else {
      interactionAnimationFrameId = 0;
    }
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
    const remoteSeatIds = new Set(options.remoteSelectedSeatIds);
    selectedSeatIds = new Set(
      [...selectedSeatIds].filter(
        (seatId) => statusBySeatId.get(seatId) === "available" && !remoteSeatIds.has(seatId),
      ),
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
    isRecommendationSelectionActive = false;
    render();
    if (notify) emitSelectionChange();
  }

  function setSelectedSeatIds(seatIds) {
    selectedSeatIds = new Set((seatIds || []).slice(0, options.maxSelected));
    activeSelectedSeatId = [...selectedSeatIds].at(-1) || "";
    isRecommendationSelectionActive = hasSameSeatIds(selectedSeatIds, options.highlightedSeatIds);
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
      if (interactionAnimationFrameId) window.cancelAnimationFrame(interactionAnimationFrameId);
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
    colorBlindFriendly: Boolean(options.colorBlindFriendly),
    highContrast: Boolean(options.highContrast),
    largeText: Boolean(options.largeText),
    reduceMotion: Boolean(options.reduceMotion),
    highlightedSeatIds: options.highlightedSeatIds || [],
    displaySelectedSeatIds: options.displaySelectedSeatIds || [],
    remoteSelectedSeatIds: options.remoteSelectedSeatIds || [],
    maxSelected: Math.max(1, Number(options.maxSelected) || 1),
    onSelectionChange: options.onSelectionChange || (() => {}),
    onSelectionLimit: options.onSelectionLimit || (() => {}),
    onSeatFocus: options.onSeatFocus || (() => {}),
  };
}

function hasSameSeatIds(leftSeatIds, rightSeatIds) {
  const left = leftSeatIds instanceof Set ? leftSeatIds : new Set(leftSeatIds || []);
  const right = rightSeatIds instanceof Set ? rightSeatIds : new Set(rightSeatIds || []);
  if (left.size === 0 || left.size !== right.size) return false;
  return [...left].every((seatId) => right.has(seatId));
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
    selected: "已选",
    reserved: "已锁定",
    sold: "已售",
    remote: "其他观众正在选择",
  }[status] || status;
}
