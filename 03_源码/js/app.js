import { store } from "./store.js?v=a-seatmap-3";
import { createSeatMap } from "./seat-map.js?v=a-seatmap-3";
import { getDefaultRecommendation } from "./recommendation.js";

store.initStore();

const seatCanvas = document.querySelector("#seat-canvas");
const scheduleSelect = document.querySelector("#schedule-select");
const peopleCountInput = document.querySelector("#people-count");
const ticketTypeSelect = document.querySelector("#ticket-type");
const recommendationButton = document.querySelector("#recommend-button");
const recommendationList = document.querySelector("#recommendation-list");
const selectionText = document.querySelector("#selection-text");
const selectionFeedback = document.querySelector("#selection-feedback");
const hoverSeatText = document.querySelector("#hover-seat");
const clearSelectionButton = document.querySelector("#clear-selection");
const submitSelectionButton = document.querySelector("#submit-selection");
const orderList = document.querySelector("#order-list");

const schedules = store.getSchedules();
let currentScheduleId = schedules[0]?.scheduleId || "s001";
let recommendation = getDefaultRecommendation();
let activeRecommendationSeatIds = [];

populateSchedules();

const seatMap = createSeatMap(seatCanvas, {
  ...getSeatMapData(),
  maxSelected: getPeopleCount(),
  onSelectionChange: handleSelectionChange,
  onSelectionLimit: (limit) => {
    setFeedback(`最多选择 ${limit} 个座位，请先取消已选座位或修改人数。`, "warning");
  },
  onSeatFocus: renderFocusedSeat,
});

renderRecommendation();
renderSelection([]);
renderOrders();
renderFocusedSeat(null);

scheduleSelect?.addEventListener("change", () => {
  currentScheduleId = scheduleSelect.value;
  seatMap.clearSelection({ notify: false });
  seatMap.resetFocus();
  seatMap.update({ ...getSeatMapData(), maxSelected: getPeopleCount() });
  renderSelection([]);
  renderRecommendation();
  renderOrders();
  renderFocusedSeat(null);
  setFeedback("已切换场次，请重新选择座位。", "info");
});

peopleCountInput?.addEventListener("change", () => {
  const count = getPeopleCount();
  peopleCountInput.value = String(count);
  activeRecommendationSeatIds = getAvailableRecommendationIds();
  seatMap.update({ maxSelected: count, highlightedSeatIds: activeRecommendationSeatIds });
  renderRecommendation();

  const selected = seatMap.getSelectedSeatIds();
  if (selected.length > count) {
    seatMap.setSelectedSeatIds(selected.slice(0, count));
  } else {
    renderSelection(selected);
  }
});

recommendationButton?.addEventListener("click", () => {
  recommendation = getDefaultRecommendation();
  activeRecommendationSeatIds = getAvailableRecommendationIds();
  seatMap.update({ highlightedSeatIds: activeRecommendationSeatIds });
  renderRecommendation();
  setFeedback("推荐座位已用绿橙渐变呼吸环标出；推荐逻辑由 B 模块继续完善。", "info");
});

clearSelectionButton?.addEventListener("click", () => {
  seatMap.clearSelection();
  setFeedback("已清空所选座位。", "info");
});

submitSelectionButton?.addEventListener("click", () => {
  const selectedSeatIds = seatMap.getSelectedSeatIds();
  const peopleCount = getPeopleCount();
  if (selectedSeatIds.length !== peopleCount) return;

  const detail = {
    scheduleId: currentScheduleId,
    selectedSeatIds: [...selectedSeatIds],
    ticketType: ticketTypeSelect?.value || "single",
    peopleCount,
  };
  window.dispatchEvent(new CustomEvent("smartcinema:seat-selection-submit", { detail }));
  setFeedback(`已确认座位：${selectedSeatIds.join("、")}。等待 D 模块接入登录与订单提交。`, "success");
});

function populateSchedules() {
  if (!scheduleSelect) return;
  scheduleSelect.innerHTML = schedules.map((schedule) => {
    const movie = store.getMovieById(schedule.movieId);
    const hall = store.getHallById(schedule.hallId);
    const label = `${schedule.scheduleId} · ${movie?.title || "未知影片"} · ${hall?.hallName || "未知影厅"} · ${schedule.date} ${schedule.startTime}`;
    return `<option value="${schedule.scheduleId}">${label}</option>`;
  }).join("");
  scheduleSelect.value = currentScheduleId;
}

function getSeatMapData() {
  const schedule = store.getScheduleById(currentScheduleId);
  const hall = schedule ? store.getHallById(schedule.hallId) : null;
  const seatState = store.getSeatStateBySchedule(currentScheduleId);
  const heatMap = store.getHeatMapBySchedule(currentScheduleId);
  activeRecommendationSeatIds = getAvailableRecommendationIds(seatState, heatMap);
  return {
    hall,
    seatState,
    heatMap,
    highlightedSeatIds: activeRecommendationSeatIds,
  };
}

function getAvailableRecommendationIds(
  seatState = store.getSeatStateBySchedule(currentScheduleId),
  heatMap = store.getHeatMapBySchedule(currentScheduleId),
) {
  const count = getPeopleCount();
  const available = new Set(
    seatState.filter((seat) => seat.status === "available").map((seat) => seat.seatId),
  );

  for (const preferredIds of [recommendation.recommendedSeatIds, recommendation.fallbackSeatIds]) {
    if (preferredIds.length >= count && preferredIds.slice(0, count).every((seatId) => available.has(seatId))) {
      return preferredIds.slice(0, count);
    }
  }

  const heatBySeatId = new Map(heatMap.map((item) => [item.seatId, item.heatScore]));
  const rows = new Map();
  for (const seat of seatState) {
    if (seat.status !== "available") continue;
    const [rowLabel, seatNumberText] = seat.seatId.split("-");
    if (!rows.has(rowLabel)) rows.set(rowLabel, []);
    rows.get(rowLabel).push({ seatId: seat.seatId, seatNumber: Number(seatNumberText) });
  }

  let best = null;
  for (const seats of rows.values()) {
    seats.sort((a, b) => a.seatNumber - b.seatNumber);
    for (let index = 0; index <= seats.length - count; index += 1) {
      const candidate = seats.slice(index, index + count);
      const isContinuous = candidate.every((seat, offset) => (
        offset === 0 || seat.seatNumber === candidate[offset - 1].seatNumber + 1
      ));
      if (!isContinuous) continue;
      const score = candidate.reduce((sum, seat) => sum + (heatBySeatId.get(seat.seatId) || 0), 0);
      if (!best || score > best.score) best = { score, seatIds: candidate.map((seat) => seat.seatId) };
    }
  }

  return best?.seatIds || [];
}

function getPeopleCount() {
  const parsed = Number.parseInt(peopleCountInput?.value || "1", 10);
  return Math.min(8, Math.max(1, Number.isFinite(parsed) ? parsed : 1));
}

function handleSelectionChange(selectedSeatIds) {
  renderSelection(selectedSeatIds);
  const required = getPeopleCount();
  if (selectedSeatIds.length === required) {
    setFeedback("座位数量已满足人数要求，可交给 D 模块接入确认购票按钮。", "success");
  } else {
    setFeedback(`还需选择 ${required - selectedSeatIds.length} 个座位。`, "info");
  }

  window.dispatchEvent(new CustomEvent("smartcinema:seat-selection-change", {
    detail: { scheduleId: currentScheduleId, selectedSeatIds: [...selectedSeatIds] },
  }));
}

function renderSelection(selectedSeatIds) {
  if (!selectionText) return;
  selectionText.textContent = selectedSeatIds.length
    ? `已选 ${selectedSeatIds.length} 个：${selectedSeatIds.join("、")}`
    : "尚未选择座位";
  if (submitSelectionButton) {
    submitSelectionButton.disabled = selectedSeatIds.length !== getPeopleCount();
  }
}

function setFeedback(message, type) {
  if (!selectionFeedback) return;
  selectionFeedback.textContent = message;
  selectionFeedback.dataset.type = type;
}

function renderFocusedSeat(seat) {
  if (!hoverSeatText) return;
  const label = { available: "可选", reserved: "已锁定", sold: "已售" }[seat?.status];
  const accessibility = seat?.seatType === "W" ? " · 无障碍座位" : "";
  const heat = Number.isFinite(seat?.heatScore) ? ` · 热度 ${seat.heatScore.toFixed(2)}` : "";
  hoverSeatText.textContent = seat
    ? `当前座位：${seat.seatId}（${label || seat.status}）${accessibility}${heat}`
    : `无障碍座位：${getAccessibleSeatIds().join("、") || "本厅暂无"}；悬停或使用方向键查看详情`;
}

function getAccessibleSeatIds() {
  const schedule = store.getScheduleById(currentScheduleId);
  const hall = schedule ? store.getHallById(schedule.hallId) : null;
  const seatIds = [];

  for (const row of hall?.rows || []) {
    let seatNumber = 0;
    for (const cellType of row.pattern) {
      if (cellType !== "S" && cellType !== "W") continue;
      seatNumber += 1;
      if (cellType === "W") seatIds.push(`${row.rowLabel}-${seatNumber}`);
    }
  }
  return seatIds;
}

function renderRecommendation() {
  if (!recommendationList) return;
  recommendationList.innerHTML = `
    <li>当前高亮：${activeRecommendationSeatIds.join("、") || "暂无可用连座"}</li>
    <li>规则初选：${recommendation.recommendedSeatIds.join("、")}</li>
    <li>备选座位：${recommendation.fallbackSeatIds.join("、")}</li>
    <li>推荐理由：${recommendation.reasons.join("；")}</li>
  `;
}

function renderOrders() {
  if (!orderList) return;

  const orders = store.getOrders();
  const currentUser = store.getCurrentUser();
  const seatState = store.getSeatStateBySchedule(currentScheduleId);
  const available = seatState.filter((seat) => seat.status === "available").length;
  const reserved = seatState.filter((seat) => seat.status === "reserved").length;
  const sold = seatState.filter((seat) => seat.status === "sold").length;

  const orderHtml = orders.length
    ? orders.slice(0, 5).map((order) => `
        <li>[${order.status}] ${order.seatIds.join("、")} · ¥${order.totalPrice}</li>
      `).join("")
    : "<li>暂无订单</li>";

  orderList.innerHTML = `
    <li>${currentUser ? `当前用户：${currentUser.username}（${currentUser.role}）` : "当前未登录"}</li>
    <li>场次 ${currentScheduleId}：总 ${seatState.length} · 可选 ${available} · 锁定 ${reserved} · 已售 ${sold}</li>
    <li>当前用户订单：${orders.length} 条</li>
    ${orderHtml}
  `;
}

// D/C 联调时可读取该接口，不需要访问 A 模块内部状态。
window.__seatSelection = {
  getScheduleId: () => currentScheduleId,
  getSelectedSeatIds: () => seatMap.getSelectedSeatIds(),
  clear: () => seatMap.clearSelection(),
};
window.__store = store;
