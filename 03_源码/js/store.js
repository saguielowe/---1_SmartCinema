/**
 * SmartCinema 状态管理模块（C 模块核心文件）
 * ============================================
 * 负责：
 *   1. LocalStorage 持久化层（load / save / remove）
 *   2. 应用启动初始化（从 LS 恢复或首次写入 mock 数据）
 *   3. 内存状态管理（用户、订单、座位状态、热度数据）
 *   4. 状态变更时自动同步回 LocalStorage
 *   5. 暴露统一接口供 A/B/D 模块调用
 *
 * 所有 LocalStorage key 以 "smartcinema_" 为前缀，与 docs/data-schema.md 保持一致。
 * 内部状态通过 getter 读取，通过专用方法更新，避免模块间直接篡改内部对象。
 */

import { allMockData, generateSeatState, generateHeatMap, generateAllSeatStates, generateAllHeatMaps } from "./mock-data.js";

// =============================================================================
// 一、LocalStorage 工具函数（B-1）
// =============================================================================

/**
 * LocalStorage key 常量，集中管理避免拼写错误。
 * 所有 key 以 "smartcinema_" 为前缀。
 */
const STORAGE_KEYS = {
  USERS: "smartcinema_users",
  MOVIES: "smartcinema_movies",
  SCHEDULES: "smartcinema_schedules",
  HALLS: "smartcinema_halls",
  ORDERS: "smartcinema_orders",
  SEAT_STATE: "smartcinema_seat_state",
  CURRENT_USER: "smartcinema_current_user",
  HEAT_MAP: "smartcinema_heat_map",
};

/**
 * 从 LocalStorage 读取并解析 JSON 数据。
 * 读取失败（key 不存在 / JSON 解析错误）返回 null，不抛异常。
 *
 * @param {string} key - LocalStorage key（建议使用 STORAGE_KEYS 常量）
 * @returns {any|null} 解析后的数据，失败返回 null
 */
function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[Store] 读取 LocalStorage key="${key}" 失败:`, e.message);
    return null;
  }
}

/**
 * 将数据序列化为 JSON 并写入 LocalStorage。
 * 写入失败（超出配额等）仅打印警告，不中断程序。
 *
 * @param {string} key - LocalStorage key
 * @param {any} data - 要存储的数据（需可序列化）
 */
function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`[Store] 写入 LocalStorage key="${key}" 失败:`, e.message);
  }
}

/**
 * 从 LocalStorage 中删除指定 key。
 *
 * @param {string} key - LocalStorage key
 */
function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[Store] 删除 LocalStorage key="${key}" 失败:`, e.message);
  }
}

// =============================================================================
// 二、Store 工厂函数
// =============================================================================

/**
 * 创建 SmartCinema 的集中状态管理实例。
 *
 * 内部维护一个内存状态对象 `state`，包含：
 *   - halls, movies, schedules（影厅/电影/场次 基础数据）
 *   - users（全部注册用户）
 *   - currentUser（当前登录用户对象）
 *   - orders（全部订单）
 *   - seatStates（{ [scheduleId]: seatState[] } 按场次存座位状态）
 *   - heatMaps（{ [scheduleId]: heatMapData[] } 按场次存热度数据）
 *   - lockTimers（{ [orderId]: timeoutId } 锁票超时定时器）
 *
 * 所有状态变更通过 store 暴露的方法进行，方法内部自动同步 LocalStorage。
 *
 * @param {object} [initialState] - 可选的初始状态（用于测试或跳过 LS 初始化）
 * @returns {object} store 实例
 */
export function createStore(initialState) {
  // ---- 内部状态 ----
  const state = {
    halls: initialState?.halls ?? [],
    movies: initialState?.movies ?? [],
    schedules: initialState?.schedules ?? [],
    users: initialState?.users ?? [],
    currentUser: initialState?.currentUser ?? null,
    orders: initialState?.orders ?? [],
    seatStates: initialState?.seatStates ?? {},
    heatMaps: initialState?.heatMaps ?? {},
    lockTimers: {},
  };

  // ===========================================================================
  // 三、持久化辅助函数（B-3 自动同步）
  // ===========================================================================

  /**
   * 将内存状态中的持久化部分写入 LocalStorage。
   * 调用时机：任何数据变更后自动触发。
   * 注意：seatStates 和 heatMaps 按场次拆分存储为独立的 JSON key。
   */
  function persistAll() {
    saveToStorage(STORAGE_KEYS.HALLS, state.halls);
    saveToStorage(STORAGE_KEYS.MOVIES, state.movies);
    saveToStorage(STORAGE_KEYS.SCHEDULES, state.schedules);
    saveToStorage(STORAGE_KEYS.USERS, state.users);
    saveToStorage(STORAGE_KEYS.ORDERS, state.orders);
    saveToStorage(STORAGE_KEYS.SEAT_STATE, state.seatStates);
    saveToStorage(STORAGE_KEYS.HEAT_MAP, state.heatMaps);

    if (state.currentUser) {
      saveToStorage(STORAGE_KEYS.CURRENT_USER, state.currentUser);
    } else {
      removeFromStorage(STORAGE_KEYS.CURRENT_USER);
    }
  }

  /**
   * 仅持久化用户数据（注册/登录变更时调用，避免写全部数据）。
   */
  function persistUsers() {
    saveToStorage(STORAGE_KEYS.USERS, state.users);
    if (state.currentUser) {
      saveToStorage(STORAGE_KEYS.CURRENT_USER, state.currentUser);
    } else {
      removeFromStorage(STORAGE_KEYS.CURRENT_USER);
    }
  }

  /**
   * 仅持久化订单数据（订单变更时调用）。
   */
  function persistOrders() {
    saveToStorage(STORAGE_KEYS.ORDERS, state.orders);
  }

  /**
   * 仅持久化座位状态（锁票/支付/取消时调用）。
   */
  function persistSeatStates() {
    saveToStorage(STORAGE_KEYS.SEAT_STATE, state.seatStates);
  }

  /**
   * 仅持久化热度数据（热度更新时调用）。
   */
  function persistHeatMaps() {
    saveToStorage(STORAGE_KEYS.HEAT_MAP, state.heatMaps);
  }

  // ===========================================================================
  // 四、应用初始化（B-2）
  // ===========================================================================

  /**
   * 应用启动时调用：从 LocalStorage 恢复数据，或首次运行时写入 mock 数据。
   *
   * 逻辑：
   * 1. 检查 smartcinema_users 是否存在（作为"是否已初始化"的标志）
   * 2. 若存在 → 从 LocalStorage 加载全部数据到内存
   * 3. 若不存在 → 使用 allMockData 写入 LocalStorage 并加载到内存
   *    - seatStates 和 heatMaps 按场次动态生成完整数据
   * 4. 恢复当前登录会话
   * 5. 恢复锁票超时定时器
   *
   * @returns {object} 初始化结果 { isFirstRun: boolean }
   */
  function initStore() {
    const existingUsers = loadFromStorage(STORAGE_KEYS.USERS);
    const isFirstRun = existingUsers === null;

    if (isFirstRun) {
      // 首次运行：写入完整 mock 数据到 LocalStorage
      console.log("[Store] 首次运行，初始化 mock 数据到 LocalStorage...");

      // 基础数据直接写入
      saveToStorage(STORAGE_KEYS.HALLS, allMockData.halls);
      saveToStorage(STORAGE_KEYS.MOVIES, allMockData.movies);
      saveToStorage(STORAGE_KEYS.SCHEDULES, allMockData.schedules);
      saveToStorage(STORAGE_KEYS.USERS, allMockData.users);
      saveToStorage(STORAGE_KEYS.ORDERS, allMockData.orders);

      // seatStates 和 heatMaps 使用预生成的完整数据（12 个场次）
      saveToStorage(STORAGE_KEYS.SEAT_STATE, allMockData.seatStates);
      saveToStorage(STORAGE_KEYS.HEAT_MAP, allMockData.heatMaps);

      // 不自动登录，current_user 留空
      removeFromStorage(STORAGE_KEYS.CURRENT_USER);
    }

    // 从 LocalStorage 加载到内存状态
    // 影厅布局属于静态配置，始终使用当前代码版本，避免旧 LocalStorage
    // 缓存阻止新增过道/无障碍座位等布局更新。座位 ID 数量不变时，
    // 已有订单和 seatState 可以继续沿用。
    state.halls = allMockData.halls;
    saveToStorage(STORAGE_KEYS.HALLS, state.halls);
    state.movies = loadFromStorage(STORAGE_KEYS.MOVIES) || allMockData.movies;
    state.schedules = loadFromStorage(STORAGE_KEYS.SCHEDULES) || allMockData.schedules;
    state.users = loadFromStorage(STORAGE_KEYS.USERS) || allMockData.users;
    state.orders = loadFromStorage(STORAGE_KEYS.ORDERS) || [];
    state.seatStates = loadFromStorage(STORAGE_KEYS.SEAT_STATE) || {};
    state.heatMaps = loadFromStorage(STORAGE_KEYS.HEAT_MAP) || {};

    // 恢复登录会话
    state.currentUser = loadFromStorage(STORAGE_KEYS.CURRENT_USER) || null;

    // 恢复锁票超时定时器
    restoreLockTimers();

    console.log("[Store] 初始化完成, isFirstRun:", isFirstRun);
    return { isFirstRun };
  }

  // ===========================================================================
  // 五、锁票超时管理（D-6 前置逻辑）
  // ===========================================================================

  /**
   * 页面加载后恢复所有 booked 状态订单的超时定时器。
   * 对于已经过期的订单立即执行取消，未过期的设置 setTimeout。
   * 页面关闭后定时器失效属于正常行为（前端模拟），初始化时一并处理。
   */
  function restoreLockTimers() {
    const now = Date.now();
    for (const order of state.orders) {
      // 只处理已预订未支付的订单
      if (order.status === "booked" && order.paymentStatus === "pending") {
        if (order.expiresAt && order.expiresAt <= now) {
          // 已过期：立即取消
          console.log("[Store] 恢复时发现过期订单，自动取消:", order.orderId);
          cancelOrderInternal(order.orderId);
        } else if (order.expiresAt) {
          // 未过期：设置定时器
          const delay = order.expiresAt - now;
          scheduleOrderTimeout(order.orderId, delay);
        }
      }
    }
  }

  /**
   * 为订单设置超时定时器。
   *
   * @param {string} orderId - 订单 ID
   * @param {number} delay - 延迟毫秒数
   */
  function scheduleOrderTimeout(orderId, delay) {
    // 先清除已有定时器（如果存在）
    clearOrderTimer(orderId);

    const timerId = setTimeout(() => {
      console.log("[Store] 订单超时，自动取消:", orderId);
      cancelOrderInternal(orderId);
    }, delay);

    state.lockTimers[orderId] = timerId;
  }

  /**
   * 清除指定订单的超时定时器。
   *
   * @param {string} orderId - 订单 ID
   */
  function clearOrderTimer(orderId) {
    if (state.lockTimers[orderId]) {
      clearTimeout(state.lockTimers[orderId]);
      delete state.lockTimers[orderId];
    }
  }

  // ===========================================================================
  // 六、数据查询辅助函数
  // ===========================================================================

  /**
   * 根据 hallId 查找影厅对象。
   *
   * @param {string} hallId - 影厅 ID
   * @returns {object|undefined}
   */
  function getHallById(hallId) {
    return state.halls.find((h) => h.hallId === hallId);
  }

  /**
   * 根据 scheduleId 查找场次对象。
   *
   * @param {string} scheduleId - 场次 ID
   * @returns {object|undefined}
   */
  function getScheduleById(scheduleId) {
    return state.schedules.find((s) => s.scheduleId === scheduleId);
  }

  /**
   * 生成唯一 ID（简化实现：时间戳 + 随机数）。
   *
   * @param {string} prefix - ID 前缀（如 "o"、"u"）
   * @returns {string} 唯一 ID
   */
  function generateId(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  // ===========================================================================
  // 七、订单管理内部方法（锁票/支付/取消共享逻辑）
  // ===========================================================================

  /**
   * 内部取消订单方法（被超时定时器、cancelOrder、refundOrder 共用）。
   * 执行座位释放 + 订单状态变更，但不包含外部调用时的额外校验。
   *
   * @param {string} orderId - 订单 ID
   * @param {boolean} [isRefund=false] - 是否为退票（true → refunded，false → cancelled）
   */
  function cancelOrderInternal(orderId, isRefund = false) {
    const order = state.orders.find((o) => o.orderId === orderId);
    if (!order) return;

    // 更新订单状态
    order.status = isRefund ? "refunded" : "cancelled";
    order.paymentStatus = "closed";
    order.updatedAt = Date.now();

    // 释放座位
    const seatStates = state.seatStates[order.scheduleId];
    if (seatStates) {
      for (const seatId of order.seatIds) {
        const seat = seatStates.find((s) => s.seatId === seatId);
        if (seat) {
          seat.status = "available";
          seat.userId = "";
          seat.orderId = "";
          seat.lockedUntil = null;
          seat.updatedAt = Date.now();
        }
      }
    }

    // 清除超时定时器
    clearOrderTimer(orderId);

    // 持久化
    persistOrders();
    persistSeatStates();
    // 热度略微下降（取消/退票，delta 为负）
    for (const seatId of order.seatIds) {
      updateHeatScoreInternal(order.scheduleId, seatId, -0.02);
    }
    persistHeatMaps();
  }

  // ===========================================================================
  // 八、对外暴露的 Store 接口
  // ===========================================================================

  const store = {
    // -----------------------------------------------------------------------
    // 8.1 初始化与工具
    // -----------------------------------------------------------------------

    /**
     * 初始化 Store（应用启动时调用一次）。
     * @returns {{ isFirstRun: boolean }}
     */
    initStore,

    /**
     * 清除所有 LocalStorage 数据并重置内存状态。
     * 用于开发调试。调用后需刷新页面或重新调用 initStore() 恢复 mock 数据。
     */
    clearAllData() {
      Object.values(STORAGE_KEYS).forEach((key) => removeFromStorage(key));
      // 清除所有超时定时器
      Object.values(state.lockTimers).forEach((tid) => clearTimeout(tid));
      // 重置内存状态
      state.halls = [];
      state.movies = [];
      state.schedules = [];
      state.users = [];
      state.currentUser = null;
      state.orders = [];
      state.seatStates = {};
      state.heatMaps = {};
      state.lockTimers = {};
      console.log("[Store] 所有数据已清除");
    },

    // -----------------------------------------------------------------------
    // 8.2 影厅 / 电影 / 场次（只读查询）
    // -----------------------------------------------------------------------

    /** 获取全部影厅列表 */
    getHalls() { return state.halls; },

    /** 根据 ID 获取影厅 */
    getHallById,

    /** 获取全部电影列表 */
    getMovies() { return state.movies; },

    /** 根据 ID 获取电影 */
    getMovieById(movieId) { return state.movies.find((m) => m.movieId === movieId); },

    /** 获取全部场次列表 */
    getSchedules() { return state.schedules; },

    /** 根据 ID 获取场次 */
    getScheduleById,

    /** 获取某电影的所有场次 */
    getSchedulesByMovie(movieId) { return state.schedules.filter((s) => s.movieId === movieId); },

    // -----------------------------------------------------------------------
    // 8.3 用户模块（B-2 初始化 & C 类任务）
    // -----------------------------------------------------------------------

    /**
     * 注册新用户。
     * 校验用户名唯一性和密码非空，成功后自动登录。
     *
     * @param {string} username - 用户名
     * @param {string} password - 密码（明文，仅课程作业模拟）
     * @returns {{ success: boolean, message: string, user?: object }}
     */
    register(username, password) {
      if (!username || !username.trim()) {
        return { success: false, message: "用户名不能为空" };
      }
      if (!password) {
        return { success: false, message: "密码不能为空" };
      }
      // 检查用户名唯一
      const exists = state.users.some((u) => u.username === username.trim());
      if (exists) {
        return { success: false, message: "用户名已存在，请更换" };
      }
      // 创建用户
      const newUser = {
        userId: generateId("u"),
        username: username.trim(),
        password, // 明文存储（仅课程作业）
        role: "user",
        nickname: username.trim(),
        createdAt: Date.now(),
        accessibilityMode: {
          largeText: false,
          highContrast: false,
          colorBlindFriendly: false,
          voicePrompt: false,
        },
        preferences: {
          preferCenter: true,
          preferBack: false,
          preferAisle: false,
        },
      };
      state.users.push(newUser);
      // 注册成功后自动登录
      state.currentUser = newUser;
      persistUsers();
      console.log("[Store] 注册成功:", newUser.username);
      return { success: true, message: "注册成功", user: newUser };
    },

    /**
     * 用户登录。
     *
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {{ success: boolean, message: string, user?: object }}
     */
    login(username, password) {
      if (!username || !password) {
        return { success: false, message: "用户名和密码不能为空" };
      }
      const user = state.users.find(
        (u) => u.username === username.trim() && u.password === password
      );
      if (!user) {
        return { success: false, message: "用户名或密码错误" };
      }
      state.currentUser = user;
      persistUsers();
      console.log("[Store] 登录成功:", user.username, "(role:", user.role + ")");
      return { success: true, message: "登录成功", user };
    },

    /**
     * 登出当前用户。
     */
    logout() {
      state.currentUser = null;
      persistUsers();
      console.log("[Store] 已登出");
    },

    /** 获取当前登录用户（无登录返回 null） */
    getCurrentUser() { return state.currentUser; },

    /** 是否已登录 */
    isLoggedIn() { return state.currentUser !== null; },

    /** 当前用户是否为管理员 */
    isAdmin() { return state.currentUser?.role === "admin"; },

    // -----------------------------------------------------------------------
    // 8.4 订单模块（D 类任务）
    // -----------------------------------------------------------------------

    /**
     * 创建订单并锁票。
     *
     * @param {object} params
     * @param {string} params.scheduleId - 场次 ID
     * @param {string[]} params.seatIds - 座位 ID 数组
     * @param {string} params.ticketType - 票种（single/couple/family/group）
     * @param {number} params.peopleCount - 人数
     * @returns {{ success: boolean, message: string, order?: object }}
     */
    createOrder({ scheduleId, seatIds, ticketType, peopleCount }) {
      // 前置校验：必须已登录
      if (!state.currentUser) {
        return { success: false, message: "请先登录" };
      }
      // 校验座位是否都可用
      const seats = state.seatStates[scheduleId];
      if (!seats) {
        return { success: false, message: "场次不存在" };
      }
      for (const seatId of seatIds) {
        const seat = seats.find((s) => s.seatId === seatId);
        if (!seat) {
          return { success: false, message: `座位 ${seatId} 不存在` };
        }
        if (seat.status !== "available") {
          return { success: false, message: `座位 ${seatId} 不可选（当前状态：${seat.status}）` };
        }
      }

      // 计算总价
      const schedule = getScheduleById(scheduleId);
      const pricePerSeat = schedule ? schedule.price : 0;
      const totalPrice = pricePerSeat * seatIds.length;

      // 生成订单
      const now = Date.now();
      const lockDuration = 15 * 60 * 1000; // 15 分钟锁票
      const order = {
        orderId: generateId("o"),
        userId: state.currentUser.userId,
        scheduleId,
        seatIds: [...seatIds],
        ticketType,
        peopleCount,
        totalPrice,
        status: "booked",
        paymentStatus: "pending",
        paymentMethod: "mock",
        createdAt: now,
        updatedAt: now,
        expiresAt: now + lockDuration,
      };

      state.orders.push(order);

      // 锁票：更新座位状态
      for (const seatId of seatIds) {
        const seat = seats.find((s) => s.seatId === seatId);
        if (seat) {
          seat.status = "reserved";
          seat.userId = state.currentUser.userId;
          seat.orderId = order.orderId;
          seat.lockedUntil = now + lockDuration;
          seat.updatedAt = now;
        }
      }

      // 启动超时定时器
      scheduleOrderTimeout(order.orderId, lockDuration);

      // 持久化
      persistOrders();
      persistSeatStates();

      console.log("[Store] 订单创建:", order.orderId, "座位:", seatIds.join(","), "总价:", totalPrice);
      return { success: true, message: "预订成功", order };
    },

    /**
     * 模拟支付（确认购票）。
     *
     * @param {string} orderId - 订单 ID
     * @returns {{ success: boolean, message: string }}
     */
    payOrder(orderId) {
      const order = state.orders.find((o) => o.orderId === orderId);
      if (!order) {
        return { success: false, message: "订单不存在" };
      }
      if (order.status !== "booked") {
        return { success: false, message: `订单状态异常（当前：${order.status}），无法支付` };
      }

      // 更新订单状态
      order.status = "purchased";
      order.paymentStatus = "paid";
      order.updatedAt = Date.now();

      // 更新座位状态为已售
      const seats = state.seatStates[order.scheduleId];
      if (seats) {
        for (const seatId of order.seatIds) {
          const seat = seats.find((s) => s.seatId === seatId);
          if (seat) {
            seat.status = "sold";
            seat.updatedAt = Date.now();
          }
        }
      }

      // 清除超时定时器
      clearOrderTimer(orderId);

      // 持久化
      persistOrders();
      persistSeatStates();

      // 热度上升
      for (const seatId of order.seatIds) {
        updateHeatScoreInternal(order.scheduleId, seatId, 0.05);
      }

      console.log("[Store] 支付成功:", orderId);
      return { success: true, message: "支付成功" };
    },

    /**
     * 取消预订（释放座位）。
     *
     * @param {string} orderId - 订单 ID
     * @returns {{ success: boolean, message: string }}
     */
    cancelOrder(orderId) {
      const order = state.orders.find((o) => o.orderId === orderId);
      if (!order) {
        return { success: false, message: "订单不存在" };
      }
      if (order.status !== "booked") {
        return { success: false, message: `订单状态异常（当前：${order.status}），无法取消` };
      }
      cancelOrderInternal(orderId, false);
      console.log("[Store] 订单已取消:", orderId);
      return { success: true, message: "已取消预订，座位已释放" };
    },

    /**
     * 退票（已购票后退票，释放座位）。
     *
     * @param {string} orderId - 订单 ID
     * @returns {{ success: boolean, message: string }}
     */
    refundOrder(orderId) {
      const order = state.orders.find((o) => o.orderId === orderId);
      if (!order) {
        return { success: false, message: "订单不存在" };
      }
      if (order.status !== "purchased") {
        return { success: false, message: `订单状态异常（当前：${order.status}），无法退票` };
      }
      cancelOrderInternal(orderId, true);
      console.log("[Store] 已退票:", orderId);
      return { success: true, message: "退票成功，座位已释放" };
    },

    /**
     * 查询订单列表。
     * 普通用户返回自己的订单，管理员返回全部。
     *
     * @param {object} [filter] - 可选筛选条件
     * @param {string} [filter.status] - 按订单状态筛选（booked/purchased/cancelled/refunded）
     * @param {string} [filter.scheduleId] - 按场次筛选
     * @returns {Array<object>} 订单数组（按 createdAt 倒序）
     */
    getOrders(filter = {}) {
      let orders = [...state.orders];

      // 普通用户只看自己的订单
      if (!store.isAdmin()) {
        const userId = state.currentUser?.userId;
        orders = orders.filter((o) => o.userId === userId);
      }
      // 可选筛选
      if (filter.status) {
        orders = orders.filter((o) => o.status === filter.status);
      }
      if (filter.scheduleId) {
        orders = orders.filter((o) => o.scheduleId === filter.scheduleId);
      }
      // 按创建时间倒序
      orders.sort((a, b) => b.createdAt - a.createdAt);
      return orders;
    },

    /**
     * 查询单条订单详情。
     *
     * @param {string} orderId - 订单 ID
     * @returns {object|null}
     */
    getOrderById(orderId) {
      return state.orders.find((o) => o.orderId === orderId) || null;
    },

    // -----------------------------------------------------------------------
    // 8.5 座位状态模块（E 类任务）
    // -----------------------------------------------------------------------

    /**
     * 查询某场次所有座位的状态。
     *
     * @param {string} scheduleId - 场次 ID
     * @returns {Array<object>} seatState 数组
     */
    getSeatStateBySchedule(scheduleId) {
      return state.seatStates[scheduleId] || [];
    },

    /**
     * 计算某场次剩余可用座位数。
     * 实时根据座位状态计算，不依赖 schedule.remainingSeats 字段。
     *
     * @param {string} scheduleId - 场次 ID
     * @returns {number} 可用座位数
     */
    getRemainingSeats(scheduleId) {
      const seats = state.seatStates[scheduleId];
      if (!seats) return 0;
      return seats.filter((s) => s.status === "available").length;
    },

    /**
     * 批量更新座位状态（内部使用，外部通过订单方法间接调用）。
     *
     * @param {string} scheduleId - 场次 ID
     * @param {string[]} seatIds - 座位 ID 数组
     * @param {string} newStatus - 新状态（available/reserved/sold）
     */
    updateSeatStatus(scheduleId, seatIds, newStatus) {
      const seats = state.seatStates[scheduleId];
      if (!seats) return;
      const now = Date.now();
      for (const seatId of seatIds) {
        const seat = seats.find((s) => s.seatId === seatId);
        if (seat) {
          seat.status = newStatus;
          seat.updatedAt = now;
        }
      }
      persistSeatStates();
    },

    // -----------------------------------------------------------------------
    // 8.6 热度数据模块（F 类任务）
    // -----------------------------------------------------------------------

    /**
     * 查询某场次所有座位的热度数据。
     *
     * @param {string} scheduleId - 场次 ID
     * @returns {Array<object>} heatMapData 数组
     */
    getHeatMapBySchedule(scheduleId) {
      return state.heatMaps[scheduleId] || [];
    },

    /**
     * 聚合某电影所有场次的热度数据。
     *
     * @param {string} movieId - 电影 ID
     * @returns {Array<object>} 聚合后的 heatMapData 数组
     */
    getHeatMapByMovie(movieId) {
      const schedules = state.schedules.filter((s) => s.movieId === movieId);
      const results = [];
      for (const schedule of schedules) {
        const heatData = state.heatMaps[schedule.scheduleId];
        if (heatData) {
          results.push(...heatData);
        }
      }
      return results;
    },

    /**
     * 更新单个座位的热度分数。
     *
     * @param {string} scheduleId - 场次 ID
     * @param {string} seatId - 座位 ID
     * @param {number} delta - 热度变化量（正数增加，负数减少）
     */
    updateHeatScore(scheduleId, seatId, delta) {
      updateHeatScoreInternal(scheduleId, seatId, delta);
      persistHeatMaps();
    },
  };

  /**
   * 内部热度更新（不自动持久化，由调用方决定是否 flush）。
   *
   * @param {string} scheduleId
   * @param {string} seatId
   * @param {number} delta
   */
  function updateHeatScoreInternal(scheduleId, seatId, delta) {
    const heatData = state.heatMaps[scheduleId];
    if (!heatData) return;
    const item = heatData.find((h) => h.seatId === seatId);
    if (item) {
      item.heatScore = Math.round(Math.max(0, Math.min(1, item.heatScore + delta)) * 100) / 100;
    }
  }

  // ===========================================================================
  // 九、返回 store 实例
  // ===========================================================================

  return store;
}

// =============================================================================
// 十、默认 Store 实例（供 D/app.js 直接 import 使用）
// =============================================================================

/**
 * 全局单例 Store。
 * app.js 中 import { store } from "./store.js" 即可直接使用。
 * 需在 app.js 入口调用 store.initStore() 完成初始化。
 */
export const store = createStore();
