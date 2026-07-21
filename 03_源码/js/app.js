import { debugRecommendation } from "./recommendation.js?v=guest-1";
import { store } from "./store.js?v=guest-1";
import { createSeatMap } from "./seat-map.js?v=curve-2";

store.initStore();

const seatCanvas = document.querySelector("#seat-canvas");
const scheduleSelect = document.querySelector("#schedule-select");
const peopleCountInput = document.querySelector("#people-count");
const ticketTypeSelect = document.querySelector("#ticket-type");
const preferenceSelect = document.querySelector("#preference");
const hasTeenInput = document.querySelector("#has-teen");
const hasSeniorInput = document.querySelector("#has-senior");
const needAccessibilityInput = document.querySelector("#need-accessibility");
const applyRecommendationButton = document.querySelector("#apply-recommendation");
const heatDaySelect = document.querySelector("#heat-day-select");
const heatToggleButton = document.querySelector("#heat-toggle");
const currentInventory = document.querySelector("#current-inventory");
const heatLegendItems = document.querySelectorAll(".heat-legend-item");
const accessibilityModeButton = document.querySelector("#accessibility-mode-button");
const userSummary = document.querySelector("#user-summary");
const recommendationList = document.querySelector("#recommendation-list");
const selectionText = document.querySelector("#selection-text");
const selectionFeedback = document.querySelector("#selection-feedback");
const hoverSeatText = document.querySelector("#hover-seat");
const clearSelectionButton = document.querySelector("#clear-selection");
const submitSelectionButton = document.querySelector("#submit-selection");
const orderList = document.querySelector("#order-list");
const paymentDialog = document.querySelector("#payment-dialog");
const paymentSummary = document.querySelector("#payment-summary");
const deferPaymentButton = document.querySelector("#defer-payment");
const confirmPaymentButton = document.querySelector("#confirm-payment");

const schedules = store.getSchedules();
let currentScheduleId = "";
let activeRecommendationSeatIds = [];
let currentHeatMap = [];
let currentRecommendationReport = null;
let isApplyingAutomaticSelection = false;
let isAccessibilityMode = Boolean(store.getCurrentUser()?.accessibilityMode?.enabled);
let isManualSelection = false;
let pendingPaymentOrder = null;
let isHeatVisible = false;

populateSchedules();
applyAccessibilityModeState();

const seatMap = createSeatMap(seatCanvas, {
  hall: null,
  seatState: [],
  heatMap: [],
  showHeat: isHeatVisible,
  highlightedSeatIds: [],
  maxSelected: getPeopleCount(),
  onSelectionChange: handleSelectionChange,
  onSelectionLimit: (limit) => {
    setFeedback(`本次需要 ${limit} 个座位，已达到数量；可先取消一个再选择新位置。`, "warning");
  },
  onSeatFocus: renderFocusedSeat,
});

renderSelection([]);
renderRecommendation();
renderUserSummary();
renderOrders();
renderFocusedSeat(null);

scheduleSelect?.addEventListener("change", () => {
  currentScheduleId = scheduleSelect.value;
  populateHeatWeekOptions(store.getScheduleById(currentScheduleId)?.date);
  seatMap.resetFocus();
  applyAutomaticRecommendation({ message: "已根据场次和购票条件自动选好座位，可直接确认。" });
});

peopleCountInput?.addEventListener("input", handlePeopleCountChange);
ticketTypeSelect?.addEventListener("change", handleTicketTypeChange);
preferenceSelect?.addEventListener("change", refreshFromConditions);
hasTeenInput?.addEventListener("change", refreshFromConditions);
hasSeniorInput?.addEventListener("change", refreshFromConditions);
needAccessibilityInput?.addEventListener("change", refreshFromConditions);
applyRecommendationButton?.addEventListener("click", () => {
  if (!currentScheduleId) {
    setFeedback("请先选择场次，再生成推荐座位。", "warning");
    return;
  }
  applyAutomaticRecommendation({ message: "已根据当前购票条件重新生成推荐座位。" });
});
accessibilityModeButton?.addEventListener("click", toggleAccessibilityMode);
heatDaySelect?.addEventListener("change", refreshHeatForSelectedDay);
heatToggleButton?.addEventListener("click", toggleHeatVisibility);
orderList?.addEventListener("click", handleOrderAction);
clearSelectionButton?.addEventListener("click", () => {
  isManualSelection = true;
  seatMap.update({ highlightedSeatIds: [] });
  seatMap.clearSelection();
  renderSelection([]);
  setFeedback("推荐座位已清空；现在可用点击或 Ctrl/Cmd + 点击自行多选。", "info");
});

submitSelectionButton?.addEventListener("click", () => {
  const selectedSeatIds = seatMap.getSelectedSeatIds();
  const peopleCount = getPeopleCount();
  if (!currentScheduleId || selectedSeatIds.length !== peopleCount) return;

  const detail = {
    scheduleId: currentScheduleId,
    seatIds: [...selectedSeatIds],
    ticketType: ticketTypeSelect?.value || "single",
    peopleCount,
    preference: preferenceSelect?.value || "center",
  };
  const result = store.createOrder(detail);
  if (!result.success) {
    setFeedback(`无法创建订单：${result.message}`, "warning");
    return;
  }

  pendingPaymentOrder = result.order;
  window.dispatchEvent(new CustomEvent("smartcinema:seat-selection-submit", {
    detail: { ...detail, selectedSeatIds: [...selectedSeatIds], orderId: result.order.orderId },
  }));
  redrawCurrentScheduleAfterOrder();
  openPaymentDialog(result.order);
});

confirmPaymentButton?.addEventListener("click", () => {
  if (!pendingPaymentOrder) return;
  const result = store.payOrder(pendingPaymentOrder.orderId);
  if (!result.success) {
    setFeedback(`支付失败：${result.message}`, "warning");
    return;
  }
  const paidOrderId = pendingPaymentOrder.orderId;
  pendingPaymentOrder = null;
  paymentDialog?.close();
  applyAutomaticRecommendation({
    message: `订单 ${paidOrderId} 支付成功，座位已更新为已售。请前往右侧订单中心查看。`,
  });
});

deferPaymentButton?.addEventListener("click", () => {
  if (!pendingPaymentOrder) {
    paymentDialog?.close();
    return;
  }
  const deferredOrderId = pendingPaymentOrder.orderId;
  pendingPaymentOrder = null;
  paymentDialog?.close();
  renderOrders();
  setFeedback(
    `订单 ${deferredOrderId} 将继续锁座 15 分钟，请在订单中心完成支付或主动取消。`,
    "info",
  );
});

paymentDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  deferPaymentButton?.click();
});

function refreshFromConditions() {
  peopleCountInput.value = String(getPeopleCount());
  if (!currentScheduleId) {
    renderSelection([]);
    setFeedback("购票条件已更新；选择场次后会立即推荐座位。", "info");
    return;
  }
  applyAutomaticRecommendation({ message: "购票条件已更新，推荐座位已自动刷新。" });
}

function handleTicketTypeChange() {
  const defaultPeopleCount = {
    single: 1,
    couple: 2,
    family: 3,
    group: 5,
  }[ticketTypeSelect?.value] || 1;
  peopleCountInput.value = String(defaultPeopleCount);
  if (hasTeenInput) hasTeenInput.checked = ticketTypeSelect?.value === "family";
  refreshFromConditions();
}

function handlePeopleCountChange() {
  peopleCountInput.value = String(getPeopleCount());
  const peopleCount = getPeopleCount();
  const ticketType = ticketTypeSelect?.value;

  if (ticketType === "single" && peopleCount > 1) {
    ticketTypeSelect.value = "group";
    setFeedback("人数超过 1 人，票种已自动切换为团体票。", "info");
  } else if (ticketType === "couple" && peopleCount !== 2) {
    ticketTypeSelect.value = peopleCount > 1 ? "group" : "single";
    setFeedback(
      peopleCount > 1
        ? "情侣票固定为 2 人；人数已修改，票种自动切换为团体票。"
        : "情侣票固定为 2 人；人数已修改，票种自动回退为个人票。",
      "info",
    );
  }
  refreshFromConditions();
}

function toggleAccessibilityMode() {
  isAccessibilityMode = !isAccessibilityMode;
  applyAccessibilityModeState();
  store.setAccessibilityModeEnabled(isAccessibilityMode);
  refreshFromConditions();
}

function applyAccessibilityModeState() {
  accessibilityModeButton.setAttribute("aria-pressed", String(isAccessibilityMode));
  accessibilityModeButton.classList.toggle("is-active", isAccessibilityMode);
  preferenceSelect.value = isAccessibilityMode ? "back" : "center";
  if (needAccessibilityInput) needAccessibilityInput.checked = isAccessibilityMode;
}

function populateSchedules() {
  if (!scheduleSelect) return;
  const scheduleOptions = schedules.map((schedule) => {
    const movie = store.getMovieById(schedule.movieId);
    const hall = store.getHallById(schedule.hallId);
    const label = `${movie?.title || "未知影片"} · ${hall?.hallName || "未知影厅"} · ${schedule.date} ${schedule.startTime}`;
    return `<option value="${schedule.scheduleId}">${label}</option>`;
  }).join("");
  scheduleSelect.innerHTML = `<option value="" selected disabled>请选择影片与场次</option>${scheduleOptions}`;
  scheduleSelect.value = "";
}

function populateHeatWeekOptions(endDateText) {
  if (!heatDaySelect || !endDateText) return;
  const endDate = new Date(`${endDateText}T12:00:00`);
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  heatDaySelect.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - (6 - index));
    return `<option value="${index}"${index === 6 ? " selected" : ""}>${formatter.format(date)}</option>`;
  }).join("");
  heatDaySelect.disabled = !isHeatVisible;
}

function toggleHeatVisibility() {
  isHeatVisible = !isHeatVisible;
  heatToggleButton?.setAttribute("aria-pressed", String(isHeatVisible));
  if (heatToggleButton) heatToggleButton.textContent = isHeatVisible ? "隐藏热度" : "显示热度";
  heatLegendItems.forEach((item) => { item.hidden = !isHeatVisible; });
  if (heatDaySelect) heatDaySelect.disabled = !isHeatVisible || !currentScheduleId;
  seatMap.update({ showHeat: isHeatVisible });
  setFeedback(isHeatVisible ? "已显示观众热度分布，可切换日期查看一周变化。" : "已隐藏热度，仅显示座位状态。", "info");
}

function getHeatDayIndex() {
  const value = Number.parseInt(heatDaySelect?.value || "6", 10);
  return Number.isFinite(value) ? Math.min(6, Math.max(0, value)) : 6;
}

function refreshHeatForSelectedDay() {
  const schedule = store.getScheduleById(currentScheduleId);
  const hall = schedule ? store.getHallById(schedule.hallId) : null;
  if (!hall) return;
  const seatState = store.getSeatStateBySchedule(currentScheduleId);
  currentHeatMap = calculateDemandHeatMap(hall, seatState, buildSeatMetadata(hall));
  seatMap.update({ heatMap: currentHeatMap });
  renderRecommendation();
  setFeedback(`已切换到 ${heatDaySelect.selectedOptions[0]?.textContent || "所选日期"} 的热度分布。`, "info");
}

function applyAutomaticRecommendation({ message = "" } = {}) {
  const schedule = store.getScheduleById(currentScheduleId);
  const hall = schedule ? store.getHallById(schedule.hallId) : null;
  const seatState = currentScheduleId ? store.getSeatStateBySchedule(currentScheduleId) : [];

  if (!hall) {
    activeRecommendationSeatIds = [];
    currentHeatMap = [];
    currentRecommendationReport = null;
    seatMap.update({ hall: null, seatState: [], heatMap: [], highlightedSeatIds: [], selectedSeatIds: [] });
    renderSelection([]);
    renderRecommendation();
    renderOrders();
    return;
  }

  const seatMeta = buildSeatMetadata(hall);
  currentHeatMap = calculateDemandHeatMap(hall, seatState, seatMeta);
  currentRecommendationReport = debugRecommendation(buildRecommendationInput(schedule), {
    hall,
    seatState,
    schedule,
  });
  activeRecommendationSeatIds = currentRecommendationReport.result.recommendedSeatIds;
  isManualSelection = false;

  isApplyingAutomaticSelection = true;
  seatMap.update({
    hall,
    seatState,
    heatMap: currentHeatMap,
    highlightedSeatIds: activeRecommendationSeatIds,
    selectedSeatIds: activeRecommendationSeatIds,
    maxSelected: getPeopleCount(),
  });
  isApplyingAutomaticSelection = false;

  renderSelection(activeRecommendationSeatIds);
  renderRecommendation();
  renderOrders();
  renderFocusedSeat(null);
  dispatchSelectionChange(activeRecommendationSeatIds);
  setFeedback(
    message || "已根据当前购票条件推荐相邻座位，可直接确认。",
    activeRecommendationSeatIds.length === getPeopleCount() ? "success" : "warning",
  );
}

function buildSeatMetadata(hall) {
  const metadata = [];
  const maxSeatsInRow = Math.max(
    1,
    ...(hall.rows || []).map((row) => [...row.pattern].filter((cell) => cell === "S" || cell === "W").length),
  );

  for (let rowIndex = 0; rowIndex < (hall.rows || []).length; rowIndex += 1) {
    const row = hall.rows[rowIndex];
    const totalSeats = [...row.pattern].filter((cell) => cell === "S" || cell === "W").length;
    let seatNumber = 0;
    let section = 0;
    let inAisle = false;

    for (let cellIndex = 0; cellIndex < row.pattern.length; cellIndex += 1) {
      const cellType = row.pattern[cellIndex];
      if (cellType === "A") {
        if (!inAisle) section += 1;
        inAisle = true;
        continue;
      }
      inAisle = false;
      if (cellType !== "S" && cellType !== "W") continue;

      seatNumber += 1;
      const isAisle = row.pattern[cellIndex - 1] === "A" || row.pattern[cellIndex + 1] === "A";
      metadata.push({
        seatId: `${row.rowLabel}-${seatNumber}`,
        rowLabel: row.rowLabel,
        rowIndex,
        seatNumber,
        totalSeats,
        maxSeatsInRow,
        columnPosition: totalSeats <= 1 ? 0.5 : (seatNumber - 1) / (totalSeats - 1),
        section,
        isAisle,
        seatType: cellType,
      });
    }
  }
  return metadata;
}

function calculateDemandHeatMap(hall, seatState, seatMeta) {
  const metaBySeatId = new Map(seatMeta.map((seat) => [seat.seatId, seat]));
  const selectedDayIndex = getHeatDayIndex();
  const demandSources = store.getSeatDemandBySchedule(currentScheduleId)
    .map((source) => ({ ...source, meta: metaBySeatId.get(source.seatId) }))
    .filter((source) => source.meta && getSourceActivationDay(source.seatId) <= selectedDayIndex);
  const rowCenter = ((hall.rows?.length || 1) - 1) / 2;
  const maxRowDistance = Math.max(1, rowCenter);

  const rawDemand = new Map();
  for (const target of seatMeta) {
    let demand = 0;
    for (const source of demandSources) {
      const rowDistance = (target.rowIndex - source.meta.rowIndex) / 1.8;
      const columnDistance = (
        (target.columnPosition - source.meta.columnPosition) * target.maxSeatsInRow
      ) / 3.4;
      const distanceSquared = rowDistance ** 2 + columnDistance ** 2;
      demand += source.demandScore * Math.exp(-distanceSquared / 2);
    }
    rawDemand.set(target.seatId, demand);
  }

  const combinedScores = seatMeta.map((seat) => {
    const rowCentrality = 1 - Math.abs(seat.rowIndex - rowCenter) / maxRowDistance;
    const columnCentrality = 1 - Math.abs(seat.columnPosition - 0.5) * 2;
    const structuralHeat = Math.max(0, rowCentrality * 0.56 + columnCentrality * 0.44);
    const demandHeat = 1 - Math.exp(-(rawDemand.get(seat.seatId) || 0) / 1.45);
    return {
      seatId: seat.seatId,
      score: Math.min(1, structuralHeat * 0.42 + demandHeat * 0.58),
    };
  });
  const scoreValues = combinedScores.map((item) => item.score);
  const minimumScore = Math.min(...scoreValues);
  const maximumScore = Math.max(...scoreValues);
  const scoreRange = Math.max(1e-6, maximumScore - minimumScore);

  // 每天都按本厅最低到最高热度归一化，确保蓝/黄/红三个区域在演示中均清晰可辨。
  return combinedScores.map((item) => {
    const heatScore = (item.score - minimumScore) / scoreRange;
    return {
      scheduleId: currentScheduleId,
      seatId: item.seatId,
      heatScore: Math.round(heatScore * 100) / 100,
    };
  });
}

function getSourceActivationDay(seatId) {
  let hash = 0;
  for (const character of `${currentScheduleId}:${seatId}`) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % 7;
}

function findBestSeatGroup({ hall, seatState, heatMap, seatMeta, anchorSeatId = "" }) {
  const count = getPeopleCount();
  const available = new Set(
    seatState.filter((seat) => seat.status === "available").map((seat) => seat.seatId),
  );
  const heatBySeatId = new Map(heatMap.map((item) => [item.seatId, item.heatScore]));
  const metaBySeatId = new Map(seatMeta.map((seat) => [seat.seatId, seat]));
  const rows = new Map();

  for (const meta of seatMeta) {
    if (!available.has(meta.seatId)) continue;
    if (!rows.has(meta.rowLabel)) rows.set(meta.rowLabel, []);
    rows.get(meta.rowLabel).push(meta);
  }

  let best = null;
  for (const seats of rows.values()) {
    seats.sort((a, b) => a.seatNumber - b.seatNumber);
    for (let index = 0; index <= seats.length - count; index += 1) {
      const candidate = seats.slice(index, index + count);
      const isContinuous = candidate.every((seat, offset) => (
        offset === 0 || (
          seat.seatNumber === candidate[offset - 1].seatNumber + 1
          && seat.section === candidate[offset - 1].section
        )
      ));
      if (!isContinuous) continue;
      if (anchorSeatId && !candidate.some((seat) => seat.seatId === anchorSeatId)) continue;

      const averageHeat = candidate.reduce(
        (sum, seat) => sum + (heatBySeatId.get(seat.seatId) || 0),
        0,
      ) / count;
      const preference = preferenceSelect?.value || "center";
      const rowRatio = candidate[0].rowIndex / Math.max(1, (hall.rows?.length || 1) - 1);
      const aisleRatio = candidate.filter((seat) => seat.isAisle).length / count;
      const score = preference === "back"
        ? averageHeat * 0.68 + rowRatio * 0.32
        : preference === "aisle"
          ? averageHeat * 0.68 + aisleRatio * 0.32
          : averageHeat;

      if (!best || score > best.score) {
        best = { score, seatIds: candidate.map((seat) => seat.seatId) };
      }
    }
  }

  if (!best && anchorSeatId && available.has(anchorSeatId)) {
    const anchor = metaBySeatId.get(anchorSeatId);
    const nearest = [...available]
      .map((seatId) => metaBySeatId.get(seatId))
      .filter(Boolean)
      .sort((a, b) => {
        const distanceA = Math.abs(a.rowIndex - anchor.rowIndex) * 3 + Math.abs(a.seatNumber - anchor.seatNumber);
        const distanceB = Math.abs(b.rowIndex - anchor.rowIndex) * 3 + Math.abs(b.seatNumber - anchor.seatNumber);
        return distanceA - distanceB;
      })
      .slice(0, count)
      .map((seat) => seat.seatId);
    return nearest;
  }

  if (!best) {
    const preference = preferenceSelect?.value || "center";
    return [...available]
      .map((seatId) => metaBySeatId.get(seatId))
      .filter(Boolean)
      .sort((a, b) => {
        const heatA = heatBySeatId.get(a.seatId) || 0;
        const heatB = heatBySeatId.get(b.seatId) || 0;
        const rowA = a.rowIndex / Math.max(1, (hall.rows?.length || 1) - 1);
        const rowB = b.rowIndex / Math.max(1, (hall.rows?.length || 1) - 1);
        const scoreA = preference === "back" ? heatA * 0.68 + rowA * 0.32 : heatA;
        const scoreB = preference === "back" ? heatB * 0.68 + rowB * 0.32 : heatB;
        return scoreB - scoreA;
      })
      .slice(0, count)
      .map((seat) => seat.seatId);
  }

  return best?.seatIds || [];
}

function getPeopleCount() {
  const parsed = Number.parseInt(peopleCountInput?.value || "1", 10);
  return Math.max(1, Number.isFinite(parsed) ? parsed : 1);
}

function handleSelectionChange(selectedSeatIds) {
  if (isApplyingAutomaticSelection || !currentScheduleId) return;
  isManualSelection = true;
  seatMap.update({ highlightedSeatIds: [] });
  renderSelection(selectedSeatIds);
  renderRecommendation();
  dispatchSelectionChange(selectedSeatIds);
  setFeedback(
    selectedSeatIds.length === getPeopleCount()
      ? "手动选座数量已满足人数要求，可确认座位。"
      : `已选 ${selectedSeatIds.length}/${getPeopleCount()} 个座位；Ctrl/Cmd + 点击可继续多选。`,
    selectedSeatIds.length === getPeopleCount() ? "success" : "info",
  );
}

function renderSelection(selectedSeatIds) {
  if (!selectionText) return;
  selectionText.textContent = currentScheduleId
    ? pendingPaymentOrder
      ? `已锁定座位：${pendingPaymentOrder.seatIds.join("、")}`
      : selectedSeatIds.length
        ? `${isManualSelection ? "已选座位" : "B 推荐座位"}：${selectedSeatIds.join("、")}`
        : "尚未选择座位"
    : "请选择场次";
  if (submitSelectionButton) {
    submitSelectionButton.disabled = !currentScheduleId || selectedSeatIds.length !== getPeopleCount();
  }
}

function setFeedback(message, type) {
  if (!selectionFeedback) return;
  selectionFeedback.textContent = message;
  selectionFeedback.dataset.type = type;
}

function renderFocusedSeat(seat) {
  if (!hoverSeatText) return;
  if (!currentScheduleId || !seat) return;
  const label = { available: "可选", reserved: "已锁定", sold: "已售" }[seat?.status];
  const accessibility = seat?.seatType === "W" ? " · 无障碍座位" : "";
  const heat = Number.isFinite(seat?.heatScore) ? ` · 热度 ${seat.heatScore.toFixed(2)}` : "";
  hoverSeatText.textContent = `当前座位：${seat.seatId}（${label || seat.status}）${accessibility}${heat}`;
}

function buildRecommendationInput(schedule) {
  const preference = preferenceSelect?.value || "center";

  return {
    ticketType: ticketTypeSelect?.value || "single",
    peopleCount: getPeopleCount(),
    selectedMovieId: schedule?.movieId,
    selectedScheduleId: schedule?.scheduleId,
    needAccessibility: Boolean(needAccessibilityInput?.checked),
    ages: buildAudienceAges(getPeopleCount()),
    preferences: {
      preferCenter: preference === "center",
      preferBack: preference === "back",
      preferAisle: preference === "aisle",
      accessibilityNeeded: Boolean(needAccessibilityInput?.checked),
    },
  };
}

function buildAudienceAges(peopleCount) {
  const ages = Array.from({ length: peopleCount }, () => 30);
  if (hasTeenInput?.checked) ages[0] = 12;
  if (hasSeniorInput?.checked) ages[ages.length - 1] = 68;
  return ages;
}

function renderRecommendation() {
  if (!recommendationList) return;
  if (!currentScheduleId) {
    recommendationList.innerHTML = "<li>选择场次后会自动显示推荐结果。</li>";
    return;
  }

  if (!currentRecommendationReport) {
    recommendationList.innerHTML = "<li>暂无推荐结果，请调整购票条件或切换场次。</li>";
    return;
  }

  const result = currentRecommendationReport.result;
  const warnings = result.warnings?.length
    ? `<li>规则提醒：${formatSentenceList(result.warnings)}</li>`
    : "";
  recommendationList.innerHTML = `
    <li>推荐座位：${result.recommendedSeatIds.join("、") || "暂无"}</li>
    <li>备选座位：${result.fallbackSeatIds.join("、") || "暂无"}</li>
    <li>体验评分：${result.scoreLabel}（${result.scoreValue}/100）</li>
    <li>推荐区域：${formatRecommendedArea(result.recommendedArea)}</li>
    <li>推荐理由：${formatSentenceList(result.reasons)}</li>
    ${warnings}
  `;
}

function formatSentenceList(items) {
  const sentences = (items || [])
    .map((item) => String(item).trim().replace(/[。；;.\s]+$/g, ""))
    .filter(Boolean);
  return sentences.length ? `${sentences.join("；")}。` : "暂无";
}

function formatRecommendedArea(area) {
  return {
    "middle-center": "中排中央",
    "middle-back": "后排中央",
    "front-center": "前排中央",
    "front-side": "前排侧区",
    "middle-side": "中排侧区",
    "back-side": "后排侧区",
  }[area] || "暂无";
}

function redrawCurrentScheduleAfterOrder() {
  const schedule = store.getScheduleById(currentScheduleId);
  const hall = schedule ? store.getHallById(schedule.hallId) : null;
  const seatState = store.getSeatStateBySchedule(currentScheduleId);
  const seatMeta = buildSeatMetadata(hall || { rows: [] });
  currentHeatMap = hall ? calculateDemandHeatMap(hall, seatState, seatMeta) : [];
  activeRecommendationSeatIds = [];
  isManualSelection = false;
  isApplyingAutomaticSelection = true;
  seatMap.update({
    hall,
    seatState,
    heatMap: currentHeatMap,
    highlightedSeatIds: [],
    selectedSeatIds: [],
    maxSelected: getPeopleCount(),
  });
  isApplyingAutomaticSelection = false;
  renderSelection([]);
  renderRecommendation();
  renderOrders();
  renderFocusedSeat(null);
}

function openPaymentDialog(order) {
  const schedule = store.getScheduleById(order.scheduleId);
  const movie = schedule ? store.getMovieById(schedule.movieId) : null;
  const hall = schedule ? store.getHallById(schedule.hallId) : null;
  if (paymentSummary) {
    paymentSummary.innerHTML = `
      <span><strong>电影：</strong>${movie?.title || "未知影片"}</span>
      <span><strong>场次：</strong>${schedule?.date || ""} ${schedule?.startTime || ""} · ${hall?.hallName || ""}</span>
      <span><strong>座位：</strong>${order.seatIds.join("、")}</span>
      <span><strong>订单号：</strong>${order.orderId}</span>
      <span><strong>应付金额：</strong>¥${order.totalPrice}</span>
    `;
  }
  if (confirmPaymentButton) confirmPaymentButton.textContent = `确认支付 ¥${order.totalPrice}`;
  paymentDialog?.showModal();
  setFeedback(
    `订单已创建并锁定座位：${order.seatIds.join("、")}。完成支付后可在右侧订单中心查看。`,
    "success",
  );
}

function renderOrders() {
  if (!orderList) return;
  renderUserSummary();
  renderCurrentInventory();
  const currentUser = store.getCurrentUser();
  if (!currentUser) {
    orderList.innerHTML = `
      <div class="order-empty">
        <span class="order-empty-icon">票</span>
        <strong>尚未登录</strong>
        <span>登录后即可查看个人订单、支付状态和取票码。</span>
      </div>
    `;
    return;
  }

  const orders = store.getOrders();
  const orderStatusLabel = {
    booked: "待支付",
    purchased: "已支付",
    cancelled: "已取消",
    refunded: "已退票",
  };
  const orderCards = orders.length
    ? orders.map((order) => {
        const schedule = store.getScheduleById(order.scheduleId);
        const movie = schedule ? store.getMovieById(schedule.movieId) : null;
        const hall = schedule ? store.getHallById(schedule.hallId) : null;
        const actionHtml = order.status === "booked"
          ? `<button type="button" data-order-action="pay" data-order-id="${order.orderId}">继续支付</button>
             <button class="order-action-secondary" type="button" data-order-action="cancel" data-order-id="${order.orderId}">取消</button>`
          : order.status === "purchased"
            ? `<button class="order-action-secondary" type="button" data-order-action="refund" data-order-id="${order.orderId}">申请退票</button>`
            : "";
        return `
          <article class="order-card">
            <div class="order-card-head">
              <div>
                <span class="order-movie">${movie?.title || "未知影片"}</span>
                <span class="order-number">${order.orderId}</span>
              </div>
              <span class="order-status status-${order.status}">${orderStatusLabel[order.status] || order.status}</span>
            </div>
            <div class="order-card-details">
              <span><b>场次</b>${schedule ? `${schedule.date} ${schedule.startTime}` : order.scheduleId}</span>
              <span><b>影厅</b>${hall?.hallName || "未知影厅"}</span>
              <span><b>座位</b>${order.seatIds.join("、")}</span>
              <span><b>金额</b>¥${order.totalPrice}</span>
              <span><b>下单</b>${formatOrderTime(order.createdAt)}</span>
              ${order.status === "purchased" ? `<span class="pickup-code"><b>取票码</b>${getPickupCode(order.orderId)}</span>` : ""}
            </div>
            ${store.isAdmin() ? `<p class="order-owner">用户 ID：${order.userId}</p>` : ""}
            ${actionHtml ? `<div class="order-card-actions">${actionHtml}</div>` : ""}
          </article>
        `;
      }).join("")
    : `<div class="order-empty"><span class="order-empty-icon">票</span><strong>暂无订单</strong><span>完成一次选座购票后，订单会显示在这里。</span></div>`;

  orderList.innerHTML = `
    <div class="order-card-list">${orderCards}</div>
  `;
}

function renderUserSummary() {
  if (!userSummary) return;
  const currentUser = store.getCurrentUser();
  if (!currentUser) {
    userSummary.innerHTML = `<span class="user-avatar">?</span><div><strong>尚未登录</strong><span>登录后查看账号</span></div>`;
    return;
  }
  const displayName = currentUser.nickname || currentUser.username;
  const roleLabel = currentUser.isGuest
    ? "游客账户"
    : currentUser.role === "admin"
      ? "管理员"
      : "普通用户";
  userSummary.innerHTML = `
    <span class="user-avatar">${displayName.slice(0, 1)}</span>
    <div><strong>${displayName}</strong><span>${currentUser.username} · ${roleLabel}</span></div>
  `;
}

function renderCurrentInventory() {
  if (!currentInventory) return;
  if (!currentScheduleId) {
    currentInventory.innerHTML = "";
    currentInventory.hidden = true;
    return;
  }
  const seatState = store.getSeatStateBySchedule(currentScheduleId);
  const available = seatState.filter((seat) => seat.status === "available").length;
  const reserved = seatState.filter((seat) => seat.status === "reserved").length;
  const sold = seatState.filter((seat) => seat.status === "sold").length;
  currentInventory.innerHTML = `<strong>当前场次库存</strong><span>总 ${seatState.length}</span><span>可选 ${available}</span><span>锁定 ${reserved}</span><span>已售 ${sold}</span>`;
  currentInventory.hidden = false;
}

function formatOrderTime(timestamp) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getPickupCode(orderId) {
  let hash = 0;
  for (const character of orderId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return String(hash % 1000000).padStart(6, "0");
}

function handleOrderAction(event) {
  const button = event.target.closest("[data-order-action]");
  if (!button) return;
  const order = store.getOrderById(button.dataset.orderId);
  if (!order) return;

  if (button.dataset.orderAction === "pay") {
    pendingPaymentOrder = order;
    openPaymentDialog(order);
    return;
  }

  const result = button.dataset.orderAction === "refund"
    ? store.refundOrder(order.orderId)
    : store.cancelOrder(order.orderId);
  if (currentScheduleId) redrawCurrentScheduleAfterOrder();
  else renderOrders();
  setFeedback(result.message, result.success ? "success" : "warning");
}

function dispatchSelectionChange(selectedSeatIds) {
  window.dispatchEvent(new CustomEvent("smartcinema:seat-selection-change", {
    detail: { scheduleId: currentScheduleId, selectedSeatIds: [...selectedSeatIds] },
  }));
}

window.__seatSelection = {
  getScheduleId: () => currentScheduleId,
  getSelectedSeatIds: () => seatMap.getSelectedSeatIds(),
  refreshRecommendation: () => applyAutomaticRecommendation(),
};
window.__store = store;
