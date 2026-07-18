/**
 * SmartCinema 页面整合入口（D 模块接线点）
 * ==========================================
 * 职责：
 *   1. 初始化 Store（从 LS 恢复或首次写入 mock 数据）
 *   2. 接线 A（Canvas 座位图）、B（推荐引擎）、C（Store）模块
 *   3. 渲染推荐结果和订单列表到 DOM
 *
 * 本文件由 D 模块负责人维护，C 模块仅对接线提供 Store 实例和接口。
 * 当前版本使用新的 Store 单例（import { store } from "./store.js"），
 * 替代了旧的 createStore({ hall, seatState }) 占位。
 */
import { store } from "./store.js";
import { drawSeatMap } from "./seat-map.js";
import { getDefaultRecommendation } from "./recommendation.js";

// ===========================================================================
// 一、初始化 Store
// ===========================================================================

/**
 * 应用启动时调用 initStore()：
 * - 首次运行 → 将 allMockData 写入 LS 并加载
 * - 非首次 → 从 LS 恢复所有数据（包括登录会话和锁票定时器）
 * - 返回 { isFirstRun: boolean }
 */
const initResult = store.initStore();
console.log("[App] Store 初始化完成, isFirstRun:", initResult.isFirstRun);

// ===========================================================================
// 二、DOM 引用
// ===========================================================================

const seatCanvas = document.querySelector("#seat-canvas");
const recommendationList = document.querySelector("#recommendation-list");
const orderList = document.querySelector("#order-list");

// ===========================================================================
// 三、接线 A：Canvas 座位图
// ===========================================================================

/**
 * 初始加载时使用默认场次 s001 的数据画座位图。
 * drawSeatMap 需要 { hall, seatState, highlightedSeatIds }。
 * - hall: 从 Store 根据 scheduleId 获取对应影厅
 * - seatState: 从 Store 获取当前场次的座位状态
 * - highlightedSeatIds: 来自推荐模块
 *
 * 注意：后续 A 和 D 联调时，scheduleId 应由用户选择的场次动态传入，
 * 而非写死 s001。
 */
const defaultScheduleId = "s001";
const defaultSchedule = store.getScheduleById(defaultScheduleId);
const defaultHall = defaultSchedule ? store.getHallById(defaultSchedule.hallId) : null;
const defaultSeatState = store.getSeatStateBySchedule(defaultScheduleId);

const recommendation = getDefaultRecommendation();

if (seatCanvas && defaultHall && defaultSeatState.length > 0) {
  drawSeatMap(seatCanvas, {
    hall: defaultHall,
    seatState: defaultSeatState,
    highlightedSeatIds: recommendation.recommendedSeatIds,
  });
  console.log("[App] 座位图已绘制 (schedule=" + defaultScheduleId + ", hall=" + defaultHall.hallId + ", seats=" + defaultSeatState.length + ")");
} else {
  console.warn("[App] 座位图未绘制：seatCanvas=" + !!seatCanvas + " hall=" + !!defaultHall + " seatState=" + defaultSeatState.length);
}

// ===========================================================================
// 四、接线 B：推荐结果
// ===========================================================================

renderRecommendation(recommendation);

/**
 * 渲染推荐结果到 DOM。
 * recommendation 来自 B 模块的 getDefaultRecommendation()。
 *
 * @param {object} result - recommendationResult schema
 */
function renderRecommendation(result) {
  if (!recommendationList) return;
  recommendationList.innerHTML = `
    <li>推荐座位：${result.recommendedSeatIds.join(", ")}</li>
    <li>备选座位：${result.fallbackSeatIds.join(", ")}</li>
    <li>推荐理由：${result.reasons.join("；")}</li>
  `;
}

// ===========================================================================
// 五、接线 C：订单中心
// ===========================================================================

renderOrders();

/**
 * 渲染订单列表和当前座位状态到 DOM。
 * 调用 Store 的 getOrders() 和 getSeatStateBySchedule()。
 *
 * 普通用户看到自己的订单，管理员看到全部订单。
 * 当前以默认场次 s001 展示座位状态统计。
 */
function renderOrders() {
  if (!orderList) return;

  const orders = store.getOrders();
  const currentUser = store.getCurrentUser();
  const seatState = store.getSeatStateBySchedule(defaultScheduleId);
  const remaining = store.getRemainingSeats(defaultScheduleId);

  // 订单列表
  let orderHtml = "";
  if (orders.length === 0) {
    orderHtml = "<li>暂无订单</li>";
  } else {
    orderHtml = orders.slice(0, 5).map((o) => {
      const sched = store.getScheduleById(o.scheduleId);
      const movie = sched ? store.getMovieById(sched.movieId) : null;
      return `<li>[${o.status}] ${o.orderId} — ${movie?.title || "?"} — ${o.seatIds.join(",")} — ¥${o.totalPrice}</li>`;
    }).join("");
  }

  // 登录状态
  const loginInfo = currentUser
    ? `当前用户：${currentUser.username}（${currentUser.role}）`
    : "未登录（testuser/123456 登录）";

  // 座位状态统计
  const available = seatState.filter((s) => s.status === "available").length;
  const sold = seatState.filter((s) => s.status === "sold").length;

  orderList.innerHTML = `
    <li>${loginInfo}</li>
    <li>场次 ${defaultScheduleId}：总 ${seatState.length} 座 | 可选 ${available} | 已售 ${sold} | 余票 ${remaining}</li>
    <li>订单数：${orders.length} 条</li>
    ${orderHtml}
  `;
}

// ===========================================================================
// 六、导出 Store 实例供 Console 调试
// ===========================================================================

// 挂到 window 方便在浏览器 Console 中直接测试
window.__store = store;
console.log("[App] Store 已挂载到 window.__store，可在 Console 中调用 store.login('testuser','123456') 等测试");