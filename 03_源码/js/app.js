import { debugRecommendation } from "./recommendation.js?v=guest-1";
import { store } from "./store.js?v=feature-suite-2";
import { createSeatMap } from "./seat-map.js?v=feature-suite-2";
import { createRealtimeSeatClient } from "./realtime.js?v=feature-suite-2";
import { parseAdvisorRequest } from "./advisor.js?v=feature-suite-2";
import { calculateComparisonSummary, calculateScheduleMetrics } from "./admin-dashboard.js?v=admin-dashboard-1";

store.initStore();

const seatCanvas = document.querySelector("#seat-canvas");
const ticketForm = document.querySelector("#ticket-form");
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
const realtimeStatus = document.querySelector("#realtime-status");
const realtimeStatusText = realtimeStatus?.querySelector("span");
const heatLegendItems = document.querySelectorAll(".heat-legend-item");
const accessibilityModeButton = document.querySelector("#accessibility-mode-button");
const userSummary = document.querySelector("#user-summary");
const bookingProgress = document.querySelector(".booking-progress");
const formPanel = document.querySelector(".form-panel");
const customerBookingPanel = document.querySelector("#customer-booking-panel");
const adminSchedulePanel = document.querySelector("#admin-schedule-panel");
const adminScheduleSelect = document.querySelector("#admin-schedule-select");
const adminScheduleDetails = document.querySelector("#admin-schedule-details");
const adminScheduleMetrics = document.querySelector("#admin-schedule-metrics");
const adminComparisonButton = document.querySelector("#admin-comparison-button");
const adminComparisonDialog = document.querySelector("#admin-comparison-dialog");
const adminComparisonSummary = document.querySelector("#admin-comparison-summary");
const adminComparisonBody = document.querySelector("#admin-comparison-body");
const seatMapTitle = document.querySelector("#seat-map-title");
const seatMapNote = document.querySelector("#seat-map-note");
const ordersTitle = document.querySelector("#orders-title");
const ordersNote = document.querySelector("#orders-note");
const progressSteps = [
  document.querySelector("#progress-step-1"),
  document.querySelector("#progress-step-2"),
  document.querySelector("#progress-step-3"),
];
const recommendationList = document.querySelector("#recommendation-list");
const advisorForm = document.querySelector("#advisor-form");
const advisorQuestionInput = document.querySelector("#advisor-question");
const advisorAnswer = document.querySelector("#advisor-answer");
const advisorPrompts = document.querySelector(".advisor-prompts");
const selectionText = document.querySelector("#selection-text");
const selectionFeedback = document.querySelector("#selection-feedback");
const hoverSeatText = document.querySelector("#hover-seat");
const clearSelectionButton = document.querySelector("#clear-selection");
const submitSelectionButton = document.querySelector("#submit-selection");
const orderList = document.querySelector("#order-list");
const orderStatusFilter = document.querySelector("#order-status-filter");
const orderCount = document.querySelector("#order-count");
const orderScopeBadge = document.querySelector("#order-scope-badge");
const orderPagination = document.querySelector("#order-pagination");
const orderPagePrevious = document.querySelector("#order-page-previous");
const orderPageNext = document.querySelector("#order-page-next");
const orderPageStatus = document.querySelector("#order-page-status");
const paymentDialog = document.querySelector("#payment-dialog");
const paymentSummary = document.querySelector("#payment-summary");
const deferPaymentButton = document.querySelector("#defer-payment");
const confirmPaymentButton = document.querySelector("#confirm-payment");
const authDialog = document.querySelector("#auth-dialog");
const loginTab = document.querySelector("#login-tab");
const registerTab = document.querySelector("#register-tab");
const loginPanel = document.querySelector("#login-panel");
const registerPanel = document.querySelector("#register-panel");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const loginUsernameInput = document.querySelector("#login-username");
const loginPasswordInput = document.querySelector("#login-password");
const registerUsernameInput = document.querySelector("#register-username");
const registerPasswordInput = document.querySelector("#register-password");
const registerPasswordConfirmInput = document.querySelector("#register-password-confirm");
const authFeedback = document.querySelector("#auth-feedback");
const authCurrentAvatar = document.querySelector("#auth-current-avatar");
const authCurrentName = document.querySelector("#auth-current-name");
const authCurrentRole = document.querySelector("#auth-current-role");
const logoutButton = document.querySelector("#logout-button");
const accessibilityDialog = document.querySelector("#accessibility-dialog");
const accessibilityForm = document.querySelector("#accessibility-form");
const accessibilityMasterInput = document.querySelector("#accessibility-master");
const largeTextSettingInput = document.querySelector("#large-text-setting");
const highContrastSettingInput = document.querySelector("#high-contrast-setting");
const colorBlindSettingInput = document.querySelector("#color-blind-setting");
const reduceMotionSettingInput = document.querySelector("#reduce-motion-setting");
const voicePromptSettingInput = document.querySelector("#voice-prompt-setting");
const themeSettingInput = document.querySelector("#theme-setting");
const accessibilityFeedback = document.querySelector("#accessibility-feedback");
const resetAccessibilityButton = document.querySelector("#reset-accessibility");
const appAnnouncer = document.querySelector("#app-announcer");

const schedules = store.getSchedules();
let currentScheduleId = "";
let activeRecommendationSeatIds = [];
let currentHeatMap = [];
let currentRecommendationReport = null;
let isApplyingAutomaticSelection = false;
let accessibilitySettings = readAccessibilitySettings();
let isAccessibilityMode = accessibilitySettings.enabled;
let isManualSelection = false;
let pendingPaymentOrder = null;
let isHeatVisible = false;
let currentOrderPage = 1;
let currentProgressStep = 1;
let remoteSelectedSeatIds = [];

const ORDERS_PER_PAGE = 3;

populateSchedules();
applyAccessibilityModeState({ updateSeatMap: false });
setProgressStep(1);

const seatMap = createSeatMap(seatCanvas, {
  hall: null,
  seatState: [],
  heatMap: [],
  showHeat: isHeatVisible,
  colorBlindFriendly: accessibilitySettings.colorBlindFriendly,
  highContrast: accessibilitySettings.highContrast,
  largeText: accessibilitySettings.largeText,
  reduceMotion: accessibilitySettings.reduceMotion,
  highlightedSeatIds: [],
  remoteSelectedSeatIds,
  maxSelected: getPeopleCount(),
  onSelectionChange: handleSelectionChange,
  onSelectionLimit: (limit) => {
    setFeedback(`本次需要 ${limit} 个座位，已达到数量；可先取消一个再选择新位置。`, "warning");
  },
  onSeatFocus: renderFocusedSeat,
});

const realtimeClient = createRealtimeSeatClient({
  onStatus: ({ state, label }) => {
    if (realtimeStatus) realtimeStatus.dataset.state = state;
    if (realtimeStatusText) realtimeStatusText.textContent = label;
  },
  onRemoteSelections: ({ seatIds, clientCount }) => {
    remoteSelectedSeatIds = seatIds;
    const before = seatMap.getSelectedSeatIds();
    seatMap.update({ remoteSelectedSeatIds });
    const after = seatMap.getSelectedSeatIds();
    if (before.length !== after.length) {
      renderSelection(after);
      dispatchSelectionChange(after);
      realtimeClient.publishSelection(currentScheduleId, after);
      setFeedback("其他观众正在选择相同座位，已自动移除冲突座位。", "warning");
    } else if (clientCount > 0 && currentScheduleId) {
      renderFocusedSeat(null);
    }
  },
});

renderRoleView();
renderSelection([]);
renderRecommendation();
renderUserSummary();
renderOrders();
renderFocusedSeat(null);

ticketForm?.addEventListener("submit", (event) => event.preventDefault());
scheduleSelect?.addEventListener("change", () => {
  currentScheduleId = scheduleSelect.value;
  realtimeClient.setActiveSchedule(currentScheduleId);
  setProgressStep(2);
  populateHeatWeekOptions(store.getScheduleById(currentScheduleId)?.date);
  seatMap.resetFocus();
  applyAutomaticRecommendation({ message: "已根据场次和购票条件自动选好座位，可直接确认。" });
});
adminScheduleSelect?.addEventListener("change", () => selectAdminSchedule(adminScheduleSelect.value));
adminComparisonButton?.addEventListener("click", openAdminComparison);
adminComparisonBody?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-schedule-id]");
  if (!button) return;
  adminComparisonDialog?.close();
  selectAdminSchedule(button.dataset.adminScheduleId);
  adminScheduleSelect?.focus();
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
advisorForm?.addEventListener("submit", handleAdvisorQuestion);
advisorPrompts?.addEventListener("click", (event) => {
  const promptButton = event.target.closest("[data-advisor-prompt]");
  if (!promptButton || !advisorQuestionInput) return;
  advisorQuestionInput.value = promptButton.dataset.advisorPrompt || "";
  advisorForm?.requestSubmit();
});
accessibilityModeButton?.addEventListener("click", openAccessibilityDialog);
heatDaySelect?.addEventListener("change", refreshHeatForSelectedDay);
heatToggleButton?.addEventListener("click", toggleHeatVisibility);
orderList?.addEventListener("click", handleOrderAction);
orderStatusFilter?.addEventListener("change", () => {
  currentOrderPage = 1;
  renderOrders();
});
orderPagePrevious?.addEventListener("click", () => {
  currentOrderPage = Math.max(1, currentOrderPage - 1);
  renderOrders();
});
orderPageNext?.addEventListener("click", () => {
  currentOrderPage += 1;
  renderOrders();
});
userSummary?.addEventListener("click", openAuthDialog);
loginTab?.addEventListener("click", () => switchAuthTab("login"));
registerTab?.addEventListener("click", () => switchAuthTab("register"));
loginForm?.addEventListener("submit", handleLogin);
registerForm?.addEventListener("submit", handleRegister);
logoutButton?.addEventListener("click", handleLogout);
authDialog?.addEventListener("click", handleDemoAccountClick);
accessibilityForm?.addEventListener("submit", saveAccessibilitySettings);
resetAccessibilityButton?.addEventListener("click", resetAccessibilitySettings);
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`)?.close());
});
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
  setProgressStep(3);
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

function handleAdvisorQuestion(event) {
  event.preventDefault();
  const question = advisorQuestionInput?.value.trim() || "";
  if (!question) {
    renderAdvisorWarning("请先描述人数、同行成员或座位偏好。");
    return;
  }

  const request = parseAdvisorRequest(question);
  if (ticketTypeSelect) ticketTypeSelect.value = request.ticketType;
  if (peopleCountInput) peopleCountInput.value = String(request.peopleCount);
  if (preferenceSelect) preferenceSelect.value = request.preference;
  if (hasTeenInput) hasTeenInput.checked = request.hasTeen;
  if (hasSeniorInput) hasSeniorInput.checked = request.hasSenior;
  if (needAccessibilityInput) needAccessibilityInput.checked = request.needAccessibility;

  if (!currentScheduleId) {
    const firstScheduleOption = [...(scheduleSelect?.options || [])].find((option) => option.value);
    if (!firstScheduleOption) {
      renderAdvisorWarning("当前没有可用场次，暂时无法生成座位推荐。");
      return;
    }
    scheduleSelect.value = firstScheduleOption.value;
    currentScheduleId = firstScheduleOption.value;
    realtimeClient.setActiveSchedule(currentScheduleId);
    setProgressStep(2);
    populateHeatWeekOptions(store.getScheduleById(currentScheduleId)?.date);
    seatMap.resetFocus();
  }

  applyAutomaticRecommendation({ message: "AI 观影顾问已理解需求并生成推荐。" });
  renderAdvisorAnswer(question, request);
}

function renderAdvisorAnswer(question, request) {
  if (!advisorAnswer) return;
  const result = currentRecommendationReport?.result;
  const seatIds = result?.recommendedSeatIds || [];
  if (seatIds.length === 0) {
    renderAdvisorWarning(result?.warnings?.[0] || "当前余票无法满足需求，请减少人数或切换场次。");
    return;
  }

  const angleScore = Math.round((result.scoreDetails?.angle || 0) * 100);
  const distanceScore = Math.round((result.scoreDetails?.distance || 0) * 100);
  const spacingScore = Math.round((result.scoreDetails?.spacing || 0) * 100);
  const viewReason = `视角：中轴与排距综合得分 ${angleScore}/${distanceScore}，${
    request.wantsCenter && request.preference === "center"
      ? "已优先响应中央视角诉求"
      : request.wantsCenter
        ? "在更高优先级的进出需求下尽量靠近舒适视角"
        : "兼顾正对银幕与舒适距离"
  }。`;
  const noiseReason = `噪音：周边空位得分 ${spacingScore}，${
    request.wantsQuiet && request.preference === "back"
      ? "已倾向中后排和干扰较少区域"
      : request.wantsQuiet
        ? "在过道优先的同时用周边空位评分减少拥挤干扰"
        : "尽量避开拥挤干扰"
  }。`;
  const convenienceReason = request.wantsAisle
    ? "便捷性：已提高靠过道座位权重，方便入场、离场或临时起身。"
    : request.needAccessibility
      ? "便捷性：已启用无障碍座位需求，并优先考虑通行便利。"
      : "便捷性：在不牺牲主要视角的前提下保留合理进出路径。";
  const audienceReason = request.hasTeen || request.hasSenior
    ? `成员规则：${request.hasTeen ? "已避开儿童不适合的前三排" : ""}${
      request.hasTeen && request.hasSenior ? "；" : ""
    }${request.hasSenior ? "已避开老人不适合的最后三排" : ""}。`
    : "";

  advisorAnswer.dataset.state = "success";
  advisorAnswer.innerHTML = `
    <p><strong>推荐 ${escapeHtml(seatIds.join("、"))}</strong> · ${escapeHtml(result.scoreLabel)} ${
      result.scoreValue
    }/100</p>
    <p>我理解的是：“${escapeHtml(question)}”</p>
    <ul>
      <li>${escapeHtml(viewReason)}</li>
      <li>${escapeHtml(noiseReason)}</li>
      <li>${escapeHtml(convenienceReason)}</li>
      ${audienceReason ? `<li>${escapeHtml(audienceReason)}</li>` : ""}
    </ul>
  `;
}

function renderAdvisorWarning(message) {
  if (!advisorAnswer) return;
  advisorAnswer.dataset.state = "warning";
  advisorAnswer.innerHTML = `<p><strong>暂时无法推荐：</strong>${escapeHtml(message)}</p>`;
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

function readAccessibilitySettings() {
  const saved = store.getCurrentUser()?.accessibilityMode || {};
  return {
    enabled: Boolean(saved.enabled),
    largeText: Boolean(saved.largeText),
    highContrast: Boolean(saved.highContrast),
    colorBlindFriendly: Boolean(saved.colorBlindFriendly),
    reduceMotion: Boolean(saved.reduceMotion),
    voicePrompt: Boolean(saved.voicePrompt),
    theme: ["ocean", "violet", "gold"].includes(saved.theme) ? saved.theme : "ocean",
  };
}

function openAccessibilityDialog() {
  syncAccessibilityForm();
  setAccessibilityFeedback("");
  accessibilityDialog?.showModal();
  window.setTimeout(() => accessibilityMasterInput?.focus(), 0);
}

function syncAccessibilityForm() {
  if (accessibilityMasterInput) accessibilityMasterInput.checked = accessibilitySettings.enabled;
  if (largeTextSettingInput) largeTextSettingInput.checked = accessibilitySettings.largeText;
  if (highContrastSettingInput) highContrastSettingInput.checked = accessibilitySettings.highContrast;
  if (colorBlindSettingInput) colorBlindSettingInput.checked = accessibilitySettings.colorBlindFriendly;
  if (reduceMotionSettingInput) reduceMotionSettingInput.checked = accessibilitySettings.reduceMotion;
  if (voicePromptSettingInput) voicePromptSettingInput.checked = accessibilitySettings.voicePrompt;
  if (themeSettingInput) themeSettingInput.value = accessibilitySettings.theme;
}

function saveAccessibilitySettings(event) {
  event.preventDefault();
  const wasEnabled = isAccessibilityMode;
  accessibilitySettings = {
    enabled: Boolean(accessibilityMasterInput?.checked),
    largeText: Boolean(largeTextSettingInput?.checked),
    highContrast: Boolean(highContrastSettingInput?.checked),
    colorBlindFriendly: Boolean(colorBlindSettingInput?.checked),
    reduceMotion: Boolean(reduceMotionSettingInput?.checked),
    voicePrompt: Boolean(voicePromptSettingInput?.checked),
    theme: themeSettingInput?.value || "ocean",
  };
  isAccessibilityMode = accessibilitySettings.enabled;

  try {
    const currentUser = store.getCurrentUser();
    if (currentUser) {
      let saveResult;
      if (typeof store.setAccessibilitySettings === "function") {
        saveResult = store.setAccessibilitySettings(accessibilitySettings);
      } else {
        // 兼容仍缓存旧 store.js 的页面，避免保存按钮静默失效。
        currentUser.accessibilityMode = {
          ...(currentUser.accessibilityMode || {}),
          ...accessibilitySettings,
        };
        saveResult = store.setAccessibilityModeEnabled?.(accessibilitySettings.enabled);
      }
      if (saveResult?.success === false) {
        throw new Error(saveResult.message || "账号设置写入失败");
      }
    }
    applyAccessibilityModeState({ wasEnabled });
  } catch (error) {
    console.error("[Accessibility] 保存显示设置失败", error);
    setAccessibilityFeedback("保存失败，请刷新页面后重试。", "warning");
    return;
  }

  accessibilityDialog?.close();
  if (currentScheduleId) refreshFromConditions();
  setFeedback("无障碍与显示设置已保存，并同步到当前账号。", "success");
}

function resetAccessibilitySettings() {
  [
    accessibilityMasterInput,
    largeTextSettingInput,
    highContrastSettingInput,
    colorBlindSettingInput,
    reduceMotionSettingInput,
    voicePromptSettingInput,
  ].forEach((input) => {
    if (input) input.checked = false;
  });
  if (themeSettingInput) themeSettingInput.value = "ocean";
  setAccessibilityFeedback("");
}

function setAccessibilityFeedback(message, type = "info") {
  if (!accessibilityFeedback) return;
  accessibilityFeedback.textContent = message;
  accessibilityFeedback.dataset.type = type;
  accessibilityFeedback.hidden = !message;
}

function applyAccessibilityModeState({ wasEnabled = false, updateSeatMap = true } = {}) {
  document.documentElement.classList.toggle("is-large-text", accessibilitySettings.largeText);
  document.documentElement.classList.toggle("reduce-motion", accessibilitySettings.reduceMotion);
  document.body.classList.toggle("is-high-contrast", accessibilitySettings.highContrast);
  document.body.classList.toggle("is-colorblind", accessibilitySettings.colorBlindFriendly);
  document.body.dataset.theme = accessibilitySettings.theme;

  accessibilityModeButton?.setAttribute("aria-pressed", String(isAccessibilityMode));
  const enabledFeatureCount = [
    accessibilitySettings.largeText,
    accessibilitySettings.highContrast,
    accessibilitySettings.colorBlindFriendly,
    accessibilitySettings.reduceMotion,
    accessibilitySettings.voicePrompt,
  ].filter(Boolean).length;
  if (accessibilityModeButton) {
    accessibilityModeButton.lastChild.textContent = enabledFeatureCount
      ? ` 无障碍 · ${enabledFeatureCount}`
      : " 无障碍";
  }

  if (isAccessibilityMode) {
    if (preferenceSelect) preferenceSelect.value = "back";
    if (needAccessibilityInput) needAccessibilityInput.checked = true;
  } else if (wasEnabled) {
    if (preferenceSelect?.value === "back") preferenceSelect.value = "center";
    if (needAccessibilityInput) needAccessibilityInput.checked = false;
  }

  if (updateSeatMap) {
    seatMap.update({
      colorBlindFriendly: accessibilitySettings.colorBlindFriendly,
      highContrast: accessibilitySettings.highContrast,
      largeText: accessibilitySettings.largeText,
      reduceMotion: accessibilitySettings.reduceMotion,
    });
  }
}

function openAuthDialog() {
  renderAuthCurrentUser();
  setAuthFeedback("也可以关闭窗口，继续使用游客模式体验完整流程。", "info");
  switchAuthTab("login");
  authDialog?.showModal();
  window.setTimeout(() => loginUsernameInput?.focus(), 0);
}

function switchAuthTab(tabName) {
  const isLogin = tabName === "login";
  loginTab?.setAttribute("aria-selected", String(isLogin));
  registerTab?.setAttribute("aria-selected", String(!isLogin));
  if (loginPanel) loginPanel.hidden = !isLogin;
  if (registerPanel) registerPanel.hidden = isLogin;
}

function handleLogin(event) {
  event.preventDefault();
  const username = loginUsernameInput?.value.trim() || "";
  const password = loginPasswordInput?.value || "";
  const result = store.login(username, password);
  if (!result.success) {
    setAuthFeedback(result.message, "warning");
    loginPasswordInput?.focus();
    return;
  }
  completeAuthentication(result);
}

function handleRegister(event) {
  event.preventDefault();
  const username = registerUsernameInput?.value.trim() || "";
  const password = registerPasswordInput?.value || "";
  const passwordConfirm = registerPasswordConfirmInput?.value || "";
  if (username.length < 3) {
    setAuthFeedback("用户名至少需要 3 个字符。", "warning");
    registerUsernameInput?.focus();
    return;
  }
  if (password.length < 6) {
    setAuthFeedback("密码至少需要 6 个字符。", "warning");
    registerPasswordInput?.focus();
    return;
  }
  if (password !== passwordConfirm) {
    setAuthFeedback("两次输入的密码不一致。", "warning");
    registerPasswordConfirmInput?.focus();
    return;
  }

  const result = store.register(username, password);
  if (!result.success) {
    setAuthFeedback(result.message, "warning");
    return;
  }
  completeAuthentication(result);
  registerForm?.reset();
}

function handleDemoAccountClick(event) {
  const button = event.target.closest("[data-demo-username]");
  if (!button) return;
  if (loginUsernameInput) loginUsernameInput.value = button.dataset.demoUsername || "";
  if (loginPasswordInput) loginPasswordInput.value = button.dataset.demoPassword || "";
  loginForm?.requestSubmit();
}

function completeAuthentication(result) {
  const wasEnabled = isAccessibilityMode;
  accessibilitySettings = readAccessibilitySettings();
  isAccessibilityMode = accessibilitySettings.enabled;
  applyAccessibilityModeState({ wasEnabled, updateSeatMap: true });
  currentOrderPage = 1;
  if (orderStatusFilter) orderStatusFilter.value = "";
  renderRoleView();
  renderUserSummary();
  renderOrders();
  authDialog?.close();
  setFeedback(
    store.isAdmin()
      ? "已进入管理员运营视图，可切换场次查看座位与订单。"
      : `${result.user?.nickname || result.user?.username || "账号"}已登录，订单视图已更新。`,
    "success",
  );
  if (currentScheduleId && !store.isAdmin()) refreshFromConditions();
}

function handleLogout() {
  const currentUser = store.getCurrentUser();
  if (!currentUser || currentUser.isGuest) {
    authDialog?.close();
    return;
  }
  store.logout();
  window.location.reload();
}

function setAuthFeedback(message, type) {
  if (!authFeedback) return;
  authFeedback.textContent = message;
  authFeedback.dataset.type = type;
}

function renderAuthCurrentUser() {
  const currentUser = store.getCurrentUser();
  const displayName = currentUser?.nickname || currentUser?.username || "游客";
  const roleLabel = currentUser?.isGuest
    ? "当前使用游客模式"
    : currentUser?.role === "admin"
      ? "管理员 · 可查看全部订单"
      : "普通用户 · 仅查看自己的订单";
  if (authCurrentAvatar) authCurrentAvatar.textContent = displayName.slice(0, 1);
  if (authCurrentName) authCurrentName.textContent = displayName;
  if (authCurrentRole) authCurrentRole.textContent = roleLabel;
  if (logoutButton) logoutButton.hidden = !currentUser || currentUser.isGuest;
}

function setProgressStep(step) {
  currentProgressStep = Math.min(3, Math.max(1, step));
  progressSteps.forEach((item, index) => {
    if (!item) return;
    const stepNumber = index + 1;
    item.classList.toggle("is-current", stepNumber === currentProgressStep);
    item.classList.toggle("is-complete", stepNumber < currentProgressStep);
    if (stepNumber === currentProgressStep) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
}

function populateSchedules() {
  const scheduleOptions = schedules.map((schedule) => {
    const movie = store.getMovieById(schedule.movieId);
    const hall = store.getHallById(schedule.hallId);
    const label = `${movie?.title || "未知影片"} · ${hall?.hallName || "未知影厅"} · ${schedule.date} ${schedule.startTime}`;
    return `<option value="${schedule.scheduleId}">${label}</option>`;
  }).join("");
  if (scheduleSelect) {
    scheduleSelect.innerHTML = `<option value="" selected disabled>请选择影片与场次</option>${scheduleOptions}`;
    scheduleSelect.value = "";
  }
  if (adminScheduleSelect) adminScheduleSelect.innerHTML = scheduleOptions;
}

function renderRoleView() {
  const isAdmin = store.isAdmin();
  const wasAdminView = document.body.classList.contains("is-admin-view");
  document.body.classList.toggle("is-admin-view", isAdmin);
  if (bookingProgress) bookingProgress.hidden = isAdmin;
  formPanel?.setAttribute("aria-labelledby", isAdmin ? "admin-schedule-title" : "conditions-title");
  if (customerBookingPanel) customerBookingPanel.hidden = isAdmin;
  if (adminSchedulePanel) adminSchedulePanel.hidden = !isAdmin;
  if (adminComparisonButton) adminComparisonButton.hidden = !isAdmin;
  if (seatCanvas) {
    seatCanvas.tabIndex = isAdmin ? -1 : 0;
    seatCanvas.setAttribute(
      "aria-label",
      isAdmin
        ? "当前场次座位状态图，仅供管理员查看"
        : "影厅座位图。选择场次后可使用方向键移动，按 Enter 或空格选择。",
    );
  }
  if (seatMapTitle) seatMapTitle.textContent = isAdmin ? "当前场次座位状态" : "确认你的座位";
  if (seatMapNote) {
    seatMapNote.textContent = isAdmin
      ? "查看已售、锁定与可用座位分布；管理员模式不会占用或选择座位。"
      : "接受推荐，或清空后手动改选。键盘可用方向键移动，Enter / 空格选择座位。";
  }
  if (ordersTitle) ordersTitle.textContent = isAdmin ? "当前场次订单" : "订单中心";
  if (ordersNote) {
    ordersNote.textContent = isAdmin
      ? "仅显示左侧所选场次的订单，可按状态筛选并处理取消或退票。"
      : "按状态筛选订单，继续支付、取消预订或申请退票。";
  }

  if (isAdmin) {
    const scheduleExists = schedules.some((schedule) => schedule.scheduleId === currentScheduleId);
    selectAdminSchedule(scheduleExists ? currentScheduleId : schedules[0]?.scheduleId);
  } else if (wasAdminView) {
    currentScheduleId = "";
    if (scheduleSelect) scheduleSelect.value = "";
    realtimeClient.setActiveSchedule("");
    seatMap.update({
      hall: null,
      seatState: [],
      heatMap: [],
      highlightedSeatIds: [],
      selectedSeatIds: [],
      remoteSelectedSeatIds: [],
    });
    renderSelection([]);
    renderFocusedSeat(null);
    setProgressStep(1);
  }
}

function selectAdminSchedule(scheduleId) {
  if (!store.isAdmin() || !scheduleId) return;
  const schedule = store.getScheduleById(scheduleId);
  const hall = schedule ? store.getHallById(schedule.hallId) : null;
  if (!schedule || !hall) return;

  currentScheduleId = scheduleId;
  currentOrderPage = 1;
  if (adminScheduleSelect) adminScheduleSelect.value = scheduleId;
  realtimeClient.setActiveSchedule(scheduleId);
  realtimeClient.publishSelection(scheduleId, []);
  populateHeatWeekOptions(schedule.date);
  const seatState = store.getSeatStateBySchedule(scheduleId);
  currentHeatMap = calculateDemandHeatMap(hall, seatState, buildSeatMetadata(hall));
  activeRecommendationSeatIds = [];
  currentRecommendationReport = null;
  seatMap.update({
    hall,
    seatState,
    heatMap: currentHeatMap,
    highlightedSeatIds: [],
    selectedSeatIds: [],
    maxSelected: 1,
    remoteSelectedSeatIds,
  });
  renderAdminSchedule();
  renderSelection([]);
  renderOrders();
  renderFocusedSeat(null);
}

function getAdminScheduleMetrics(schedule) {
  const hall = store.getHallById(schedule.hallId);
  const seatState = store.getSeatStateBySchedule(schedule.scheduleId);
  const orders = store.getOrders({ scheduleId: schedule.scheduleId });
  return calculateScheduleMetrics({ schedule, hall, seatState, orders });
}

function renderAdminSchedule() {
  if (!store.isAdmin() || !currentScheduleId) return;
  const schedule = store.getScheduleById(currentScheduleId);
  const movie = schedule ? store.getMovieById(schedule.movieId) : null;
  const hall = schedule ? store.getHallById(schedule.hallId) : null;
  if (!schedule || !hall) return;
  const metrics = getAdminScheduleMetrics(schedule);

  if (adminScheduleDetails) {
    adminScheduleDetails.innerHTML = `
      <strong>${escapeHtml(movie?.title || "未知影片")}</strong>
      <span>${escapeHtml(`${schedule.date} ${schedule.startTime}–${schedule.endTime}`)}</span>
      <span>${escapeHtml(`${hall.hallName} · ${formatHallType(hall.hallType)} · ¥${schedule.price}/座`)}</span>
    `;
  }
  if (adminScheduleMetrics) {
    adminScheduleMetrics.innerHTML = `
      ${renderAdminMetric("上座率", formatPercent(metrics.occupancyRate), `${metrics.sold}/${metrics.capacity} 已售`)}
      ${renderAdminMetric("可用座位", metrics.available, `${metrics.reserved} 个锁定`)}
      ${renderAdminMetric("场次订单", metrics.orderCount, "含全部状态")}
      ${renderAdminMetric("估算票房", formatCurrency(metrics.estimatedRevenue), "按已售座位计算")}
    `;
  }
}

function renderAdminMetric(label, value, note) {
  return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
}

function openAdminComparison() {
  if (!store.isAdmin() || !adminComparisonDialog) return;
  const rows = schedules.map((schedule) => {
    const movie = store.getMovieById(schedule.movieId);
    const hall = store.getHallById(schedule.hallId);
    return { schedule, movie, hall, metrics: getAdminScheduleMetrics(schedule) };
  });
  const summary = calculateComparisonSummary(rows.map((row) => row.metrics));

  if (adminComparisonSummary) {
    adminComparisonSummary.innerHTML = `
      ${renderAdminMetric("综合上座率", formatPercent(summary.occupancyRate), `${summary.sold}/${summary.capacity} 已售`)}
      ${renderAdminMetric("全部订单", summary.orderCount, `${summary.reserved} 个座位锁定中`)}
      ${renderAdminMetric("估算总票房", formatCurrency(summary.estimatedRevenue), "按当前已售座位计算")}
    `;
  }
  if (adminComparisonBody) {
    adminComparisonBody.innerHTML = rows.map(({ schedule, movie, hall, metrics }) => `
      <tr${schedule.scheduleId === currentScheduleId ? ' class="is-current"' : ""}>
        <td><strong>${escapeHtml(movie?.title || "未知影片")}</strong><span>${escapeHtml(`${schedule.date} ${schedule.startTime}`)}</span></td>
        <td>${escapeHtml(hall?.hallName || "未知影厅")}</td>
        <td>${metrics.sold} / ${metrics.capacity}</td>
        <td><span class="occupancy-value">${formatPercent(metrics.occupancyRate)}</span><i><b style="width:${Math.round(metrics.occupancyRate * 100)}%"></b></i></td>
        <td>${metrics.orderCount}</td>
        <td>${formatCurrency(metrics.estimatedRevenue)}</td>
        <td><button type="button" data-admin-schedule-id="${escapeHtml(schedule.scheduleId)}">查看</button></td>
      </tr>
    `).join("");
  }
  adminComparisonDialog.showModal();
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatHallType(hallType) {
  return {
    large: "巨幕厅",
    medium: "标准厅",
    small: "小厅",
  }[hallType] || hallType || "标准厅";
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
  const remoteSeatSet = new Set(remoteSelectedSeatIds);
  const recommendationSeatState = seatState.map((seat) => (
    remoteSeatSet.has(seat.seatId) && seat.status === "available"
      ? { ...seat, status: "reserved" }
      : seat
  ));

  if (!hall) {
    activeRecommendationSeatIds = [];
    currentHeatMap = [];
    currentRecommendationReport = null;
    seatMap.update({ hall: null, seatState: [], heatMap: [], highlightedSeatIds: [], selectedSeatIds: [] });
    renderSelection([]);
    renderRecommendation();
    renderOrders();
    realtimeClient.setActiveSchedule("");
    return;
  }

  const seatMeta = buildSeatMetadata(hall);
  currentHeatMap = calculateDemandHeatMap(hall, seatState, seatMeta);
  currentRecommendationReport = debugRecommendation(buildRecommendationInput(schedule), {
    hall,
    seatState: recommendationSeatState,
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
  realtimeClient.publishSelection(currentScheduleId, activeRecommendationSeatIds);
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

  // 每天都按本厅最低到最高热度归一化，确保绿/黄/红三个区域在演示中均清晰可辨。
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
  const remoteSeatSet = new Set(remoteSelectedSeatIds);
  const available = new Set(
    seatState
      .filter((seat) => seat.status === "available" && !remoteSeatSet.has(seat.seatId))
      .map((seat) => seat.seatId),
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
  return Math.min(20, Math.max(1, Number.isFinite(parsed) ? parsed : 1));
}

function handleSelectionChange(selectedSeatIds) {
  if (store.isAdmin() || isApplyingAutomaticSelection || !currentScheduleId) return;
  isManualSelection = true;
  seatMap.update({ highlightedSeatIds: [] });
  renderSelection(selectedSeatIds);
  renderRecommendation();
  dispatchSelectionChange(selectedSeatIds);
  realtimeClient.publishSelection(currentScheduleId, selectedSeatIds);
  setFeedback(
    selectedSeatIds.length === getPeopleCount()
      ? "手动选座数量已满足人数要求，可确认座位。"
      : `已选 ${selectedSeatIds.length}/${getPeopleCount()} 个座位；Ctrl/Cmd + 点击可继续多选。`,
    selectedSeatIds.length === getPeopleCount() ? "success" : "info",
  );
}

function renderSelection(selectedSeatIds) {
  if (!selectionText) return;
  if (store.isAdmin()) {
    selectionText.textContent = currentScheduleId ? "管理员只读座位视图" : "请选择场次";
    if (selectionFeedback) {
      selectionFeedback.textContent = "座位状态与左侧库存指标同步更新，不会产生选座占用。";
      selectionFeedback.dataset.type = "info";
    }
    if (submitSelectionButton) submitSelectionButton.disabled = true;
    return;
  }
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
  announce(message);
}

function announce(message) {
  if (appAnnouncer) {
    appAnnouncer.textContent = "";
    window.requestAnimationFrame(() => {
      appAnnouncer.textContent = message;
    });
  }

  if (
    accessibilitySettings.voicePrompt
    && "speechSynthesis" in window
    && typeof window.SpeechSynthesisUtterance === "function"
  ) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}

function renderFocusedSeat(seat) {
  if (!hoverSeatText) return;
  if (!currentScheduleId || !seat) return;
  const label = {
    available: "可选",
    reserved: "已锁定",
    sold: "已售",
    remote: "其他观众正在选择",
  }[seat?.status];
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
  renderAdminSchedule();
  renderOrders();
  renderFocusedSeat(null);
  realtimeClient.publishSelection(currentScheduleId, []);
}

function openPaymentDialog(order) {
  const schedule = store.getScheduleById(order.scheduleId);
  const movie = schedule ? store.getMovieById(schedule.movieId) : null;
  const hall = schedule ? store.getHallById(schedule.hallId) : null;
  if (paymentSummary) {
    paymentSummary.innerHTML = `
      <span><strong>电影：</strong>${escapeHtml(movie?.title || "未知影片")}</span>
      <span><strong>场次：</strong>${escapeHtml(`${schedule?.date || ""} ${schedule?.startTime || ""} · ${hall?.hallName || ""}`)}</span>
      <span><strong>座位：</strong>${escapeHtml(order.seatIds.join("、"))}</span>
      <span><strong>订单号：</strong>${escapeHtml(order.orderId)}</span>
      <span><strong>应付金额：</strong>¥${escapeHtml(order.totalPrice)}</span>
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
  const isAdmin = store.isAdmin();

  if (orderScopeBadge) {
    orderScopeBadge.textContent = isAdmin ? "管理员视图" : "我的订单";
    orderScopeBadge.classList.toggle("is-admin", isAdmin);
  }

  if (!currentUser) {
    orderList.innerHTML = `
      <div class="order-empty">
        <span class="order-empty-icon">票</span>
        <strong>尚未登录</strong>
        <span>登录后即可查看个人订单、支付状态和取票码。</span>
      </div>
    `;
    if (orderCount) orderCount.textContent = "0 笔订单";
    if (orderPagination) orderPagination.hidden = true;
    return;
  }

  const selectedStatus = orderStatusFilter?.value || "";
  const orderFilter = {};
  if (selectedStatus) orderFilter.status = selectedStatus;
  if (isAdmin && currentScheduleId) orderFilter.scheduleId = currentScheduleId;
  const orders = store.getOrders(orderFilter);
  const totalPages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE));
  currentOrderPage = Math.min(Math.max(1, currentOrderPage), totalPages);
  const pageStart = (currentOrderPage - 1) * ORDERS_PER_PAGE;
  const visibleOrders = orders.slice(pageStart, pageStart + ORDERS_PER_PAGE);

  if (orderCount) orderCount.textContent = `${orders.length} 笔订单`;
  if (orderPagination) orderPagination.hidden = orders.length <= ORDERS_PER_PAGE;
  if (orderPagePrevious) orderPagePrevious.disabled = currentOrderPage <= 1;
  if (orderPageNext) orderPageNext.disabled = currentOrderPage >= totalPages;
  if (orderPageStatus) orderPageStatus.textContent = `第 ${currentOrderPage} / ${totalPages} 页`;

  const orderStatusLabel = {
    booked: "待支付",
    purchased: "已支付",
    cancelled: "已取消",
    refunded: "已退票",
  };
  const orderCards = visibleOrders.length
    ? visibleOrders.map((order) => {
        const schedule = store.getScheduleById(order.scheduleId);
        const movie = schedule ? store.getMovieById(schedule.movieId) : null;
        const hall = schedule ? store.getHallById(schedule.hallId) : null;
        const safeOrderId = escapeHtml(order.orderId);
        const actionHtml = order.status === "booked"
          ? isAdmin
            ? `<button class="order-action-secondary" type="button" data-order-action="cancel" data-order-id="${safeOrderId}">取消预订</button>`
            : `<button type="button" data-order-action="pay" data-order-id="${safeOrderId}">继续支付</button>
               <button class="order-action-secondary" type="button" data-order-action="cancel" data-order-id="${safeOrderId}">取消</button>`
          : order.status === "purchased"
            ? `<button class="order-action-secondary" type="button" data-order-action="refund" data-order-id="${safeOrderId}">${isAdmin ? "办理退票" : "申请退票"}</button>`
            : "";
        return `
          <article class="order-card">
            <div class="order-card-head">
              <div>
                <span class="order-movie">${escapeHtml(movie?.title || "未知影片")}</span>
                <span class="order-number">${safeOrderId}</span>
              </div>
              <span class="order-status status-${escapeHtml(order.status)}">${escapeHtml(orderStatusLabel[order.status] || order.status)}</span>
            </div>
            <div class="order-card-details">
              <span><b>场次</b>${escapeHtml(schedule ? `${schedule.date} ${schedule.startTime}` : order.scheduleId)}</span>
              <span><b>影厅</b>${escapeHtml(hall?.hallName || "未知影厅")}</span>
              <span><b>座位</b>${escapeHtml(order.seatIds.join("、"))}</span>
              <span><b>金额</b>¥${escapeHtml(order.totalPrice)}</span>
              <span><b>下单</b>${formatOrderTime(order.createdAt)}</span>
              ${order.status === "purchased" ? `<span class="pickup-code"><b>取票码</b>${escapeHtml(getPickupCode(order.orderId))}</span>` : ""}
            </div>
            ${isAdmin ? `<p class="order-owner">用户 ID：${escapeHtml(order.userId)}</p>` : ""}
            ${actionHtml ? `<div class="order-card-actions">${actionHtml}</div>` : ""}
          </article>
        `;
      }).join("")
    : `<div class="order-empty"><span class="order-empty-icon">票</span><strong>暂无订单</strong><span>${selectedStatus ? "当前筛选条件下没有订单。" : isAdmin ? "该场次还没有订单记录。" : "完成一次选座购票后，订单会显示在这里。"}</span></div>`;

  orderList.innerHTML = `
    <div class="order-card-list">${orderCards}</div>
  `;
}

function renderUserSummary() {
  if (!userSummary) return;
  const currentUser = store.getCurrentUser();
  if (!currentUser) {
    userSummary.innerHTML = `
      <span class="user-avatar" aria-hidden="true">?</span>
      <span class="user-summary-copy"><strong>尚未登录</strong><span>打开账号中心</span></span>
    `;
    userSummary.setAttribute("aria-label", "打开账号中心，当前尚未登录");
    return;
  }
  const displayName = currentUser.nickname || currentUser.username;
  const roleLabel = currentUser.isGuest
    ? "游客账户"
    : currentUser.role === "admin"
      ? "管理员"
      : "普通用户";
  userSummary.innerHTML = `
    <span class="user-avatar" aria-hidden="true">${escapeHtml(displayName.slice(0, 1))}</span>
    <span class="user-summary-copy">
      <strong>${escapeHtml(displayName)}</strong>
      <span>${escapeHtml(currentUser.username)} · ${roleLabel}</span>
    </span>
  `;
  userSummary.setAttribute("aria-label", `打开账号中心，当前账号：${displayName}，${roleLabel}`);
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
  if (!store.isAdmin()) setProgressStep(3);

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
window.__realtimeSeatClient = realtimeClient;
window.__store = store;

window.addEventListener("beforeunload", () => {
  realtimeClient.destroy();
});
