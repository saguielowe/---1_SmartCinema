import { store } from "./store.js";
import { createSeatMap } from "./seat-map.js";
import { getDefaultRecommendation } from "./recommendation.js";

store.initStore();

const seatCanvas = document.querySelector("#seat-canvas");
const scheduleSelect = document.querySelector("#schedule-select");
const peopleCountInput = document.querySelector("#people-count");
const recommendationButton = document.querySelector("#recommend-button");
const recommendationList = document.querySelector("#recommendation-list");
const selectionText = document.querySelector("#selection-text");
const selectionFeedback = document.querySelector("#selection-feedback");
const hoverSeatText = document.querySelector("#hover-seat");
const clearSelectionButton = document.querySelector("#clear-selection");
const orderList = document.querySelector("#order-list");

const schedules = store.getSchedules();
let currentScheduleId = schedules[0]?.scheduleId || "s001";
let recommendation = getDefaultRecommendation();

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

scheduleSelect?.addEventListener("change", () => {
  currentScheduleId = scheduleSelect.value;
  seatMap.clearSelection({ notify: false });
  seatMap.resetFocus();
  seatMap.update({ ...getSeatMapData(), maxSelected: getPeopleCount() });
  renderSelection([]);
  renderOrders();
  setFeedback("已切换场次，请重新选择座位。", "info");
});

peopleCountInput?.addEventListener("change", () => {
  const count = getPeopleCount();
  peopleCountInput.value = String(count);
  seatMap.update({ maxSelected: count });

  const selected = seatMap.getSelectedSeatIds();
  if (selected.length > count) {
    seatMap.setSelectedSeatIds(selected.slice(0, count));
  } else {
    renderSelection(selected);
  }
});

recommendationButton?.addEventListener("click", () => {
  recommendation = getDefaultRecommendation();
  seatMap.update({ highlightedSeatIds: getAvailableRecommendationIds() });
  renderRecommendation();
  setFeedback("推荐座位已用青色光圈标出；推荐逻辑由 B 模块继续完善。", "info");
});

clearSelectionButton?.addEventListener("click", () => {
  seatMap.clearSelection();
  setFeedback("已清空所选座位。", "info");
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
  return {
    hall,
    seatState,
    highlightedSeatIds: getAvailableRecommendationIds(seatState),
  };
}

function getAvailableRecommendationIds(seatState = store.getSeatStateBySchedule(currentScheduleId)) {
  const available = new Set(
    seatState.filter((seat) => seat.status === "available").map((seat) => seat.seatId),
  );
  return recommendation.recommendedSeatIds.filter((seatId) => available.has(seatId));
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
}

function setFeedback(message, type) {
  if (!selectionFeedback) return;
  selectionFeedback.textContent = message;
  selectionFeedback.dataset.type = type;
}

function renderFocusedSeat(seat) {
  if (!hoverSeatText) return;
  const label = { available: "可选", reserved: "已锁定", sold: "已售" }[seat?.status];
  hoverSeatText.textContent = seat
    ? `当前座位：${seat.seatId}（${label || seat.status}）`
    : "悬停或使用方向键查看座位号";
}

function renderRecommendation() {
  if (!recommendationList) return;
  recommendationList.innerHTML = `
    <li>推荐座位：${recommendation.recommendedSeatIds.join("、")}</li>
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
