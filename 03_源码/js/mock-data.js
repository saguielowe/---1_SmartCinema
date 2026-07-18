/**
 * SmartCinema 公共 mock 数据
 * ===========================
 * 为所有模块提供统一的假数据，确保 A/B/C/D 在开发阶段使用一致的测试数据。
 *
 * 座位 ID 规则：统一为 "排号-座位号"，例如 "F-8"。
 *   - 排号：rowLabel（A-J）
 *   - 座位号：该排中第几个 S 或 W（从 1 开始，跳过 A 和 X）
 *
 * 影厅规模：三套预设影厅，均为 10 排，座位总数分别约 100 / 200 / 300。
 * pattern 约定：
 *   S - 普通座位
 *   A - 过道（不计入座位数）
 *   X - 空缺/不可坐（不计入座位数）
 *   W - 无障碍座位（计入座位数）
 *
 * 所有字段结构以 docs/data-schema.md 为准。如需新增字段，先更新文档。
 */

// =============================================================================
// 一、影厅 mock 数据（3 套预设，均为 10 排）
// =============================================================================

/**
 * 小厅「星光厅」：约 104 座（100 S + 0 W + 0 暂不计的辅助位）
 * pattern 由两侧向中间逐渐增宽，模拟弧形排布。
 */
export const hallSmall = {
  hallId: "hall-small",
  hallName: "星光厅",
  hallType: "small",
  capacity: 104,
  rowCount: 10,
  screenLabel: "银幕",
  rows: [
    { rowLabel: "A", pattern: "XXXXSSSSAASSSSSXXXX", offsetX: -8, curveDepth: 12 },
    { rowLabel: "B", pattern: "XXXSSSSSAASSSSSSXXX", offsetX: -6, curveDepth: 11 },
    { rowLabel: "C", pattern: "XXSSSSSSAASSSSSSSXX", offsetX: -4, curveDepth: 10 },
    { rowLabel: "D", pattern: "XSSSSSSSAASSSSSSSSX", offsetX: -2, curveDepth: 9 },
    { rowLabel: "E", pattern: "SSSSSSSSAASSSSSSSSS", offsetX: 0, curveDepth: 8 },
    { rowLabel: "F", pattern: "SSSSSSSSAASSSSSSSSS", offsetX: 0, curveDepth: 7 },
    { rowLabel: "G", pattern: "XSSSSSSSAASSSSSSSSX", offsetX: 2, curveDepth: 8 },
    { rowLabel: "H", pattern: "XXSSSSSSAASSSSSSSXX", offsetX: 4, curveDepth: 9 },
    { rowLabel: "I", pattern: "XXXSSSSSAASSSSSSXXX", offsetX: 6, curveDepth: 10 },
    { rowLabel: "J", pattern: "XXXXSSSSAASSSSSXXXX", offsetX: 8, curveDepth: 11 },
  ],
};
// 各排 S/W 数量：A=8, B=10, C=12, D=14, E=16, F=16, G=14, H=12, I=10, J=8 → 总计 104

/**
 * 中厅「银幕厅」：约 210 座（210 S）
 * 较宽排布，中间过道 AA 将座位分为左右两区。
 */
export const hallMedium = {
  hallId: "hall-medium",
  hallName: "银幕厅",
  hallType: "medium",
  capacity: 210,
  rowCount: 10,
  screenLabel: "银幕",
  rows: [
    { rowLabel: "A", pattern: "XXXXXXSSSSSSSSAASSSSSSSSSXXXXXX", offsetX: -10, curveDepth: 14 },
    { rowLabel: "B", pattern: "XXXXXSSSSSSSSSAASSSSSSSSSSXXXXX", offsetX: -8, curveDepth: 13 },
    { rowLabel: "C", pattern: "XXXXSSSSSSSSSSAASSSSSSSSSSSXXXX", offsetX: -6, curveDepth: 12 },
    { rowLabel: "D", pattern: "XXXSSSSSSSSSSSAASSSSSSSSSSSSXXX", offsetX: -4, curveDepth: 11 },
    { rowLabel: "E", pattern: "XXSSSSSSSSSSSSAASSSSSSSSSSSSSXX", offsetX: -2, curveDepth: 10 },
    { rowLabel: "F", pattern: "XSSSSSSSSSSSSSAASSSSSSSSSSSSSSX", offsetX: 0, curveDepth: 9 },
    { rowLabel: "G", pattern: "XXSSSSSSSSSSSSAASSSSSSSSSSSSSXX", offsetX: 2, curveDepth: 10 },
    { rowLabel: "H", pattern: "XXXSSSSSSSSSSSAASSSSSSSSSSSSXXX", offsetX: 4, curveDepth: 11 },
    { rowLabel: "I", pattern: "XXXXSSSSSSSSSSAASSSSSSSSSSSXXXX", offsetX: 6, curveDepth: 12 },
    { rowLabel: "J", pattern: "XXXXXSSSSSSSSSAASSSSSSSSSSXXXXX", offsetX: 8, curveDepth: 13 },
  ],
};
// 各排 S/W 数量：A=16, B=18, C=20, D=22, E=24, F=26, G=24, H=22, I=20, J=18 → 总计 210

/**
 * 大厅「巨幕厅」：约 310 座（310 S）
 * 超宽排布，中间过道 AA 分左右区，两侧大量 X 做弧形收缩。
 */
export const hallLarge = {
  hallId: "hall-large",
  hallName: "巨幕厅",
  hallType: "large",
  capacity: 310,
  rowCount: 10,
  screenLabel: "银幕",
  rows: [
    { rowLabel: "A", pattern: "XXXXXXXXXSSSSSSSSSSSSSAASSSSSSSSSSSSSSXXXXXXXXX", offsetX: -12, curveDepth: 16 },
    { rowLabel: "B", pattern: "XXXXXXXXSSSSSSSSSSSSSSAASSSSSSSSSSSSSSSXXXXXXXX", offsetX: -10, curveDepth: 15 },
    { rowLabel: "C", pattern: "XXXXXXXSSSSSSSSSSSSSSSAASSSSSSSSSSSSSSSSXXXXXXX", offsetX: -8, curveDepth: 14 },
    { rowLabel: "D", pattern: "XXXXXXSSSSSSSSSSSSSSSSAASSSSSSSSSSSSSSSSSXXXXXX", offsetX: -6, curveDepth: 13 },
    { rowLabel: "E", pattern: "XXXXXSSSSSSSSSSSSSSSSSAASSSSSSSSSSSSSSSSSSXXXXX", offsetX: -4, curveDepth: 12 },
    { rowLabel: "F", pattern: "XXXXSSSSSSSSSSSSSSSSSSAASSSSSSSSSSSSSSSSSSSXXXX", offsetX: -2, curveDepth: 11 },
    { rowLabel: "G", pattern: "XXXXXSSSSSSSSSSSSSSSSSAASSSSSSSSSSSSSSSSSSXXXXX", offsetX: 0, curveDepth: 12 },
    { rowLabel: "H", pattern: "XXXXXXSSSSSSSSSSSSSSSSAASSSSSSSSSSSSSSSSSXXXXXX", offsetX: 2, curveDepth: 13 },
    { rowLabel: "I", pattern: "XXXXXXXSSSSSSSSSSSSSSSAASSSSSSSSSSSSSSSSXXXXXXX", offsetX: 4, curveDepth: 14 },
    { rowLabel: "J", pattern: "XXXXXXXXSSSSSSSSSSSSSSAASSSSSSSSSSSSSSSXXXXXXXX", offsetX: 6, curveDepth: 15 },
  ],
};
// 各排 S/W 数量：A=26, B=28, C=30, D=32, E=34, F=36, G=34, H=32, I=30, J=28 → 总计 310

/**
 * 全部影厅数组，方便遍历渲染。
 */
export const hallsMock = [hallSmall, hallMedium, hallLarge];

/**
 * 保持向后兼容：hallMock 默认指向中厅。
 * A 模块初始开发时使用此引用。
 */
export const hallMock = hallMedium;

// =============================================================================
// 二、电影 mock 数据（5 部）
// =============================================================================

/**
 * 5 部风格各异的电影，覆盖不同评分区间和标签，便于演示推荐和场次切换。
 */
export const moviesMock = [
  {
    movieId: "m001",
    title: "星际穿越",
    duration: 169,
    poster: "assets/posters/interstellar.jpg",
    tags: ["sci-fi", "adventure", "space"],
    showType: "imax",
    rating: 9.3,
    language: "en",
  },
  {
    movieId: "m002",
    title: "流浪地球3",
    duration: 150,
    poster: "assets/posters/wandering-earth.jpg",
    tags: ["sci-fi", "adventure", "domestic"],
    showType: "3d",
    rating: 8.7,
    language: "zh",
  },
  {
    movieId: "m003",
    title: "哪吒之魔童闹海",
    duration: 110,
    poster: "assets/posters/nezha.jpg",
    tags: ["animation", "fantasy", "domestic"],
    showType: "3d",
    rating: 9.1,
    language: "zh",
  },
  {
    movieId: "m004",
    title: "奥本海默",
    duration: 180,
    poster: "assets/posters/oppenheimer.jpg",
    tags: ["drama", "biography", "history"],
    showType: "2d",
    rating: 8.9,
    language: "en",
  },
  {
    movieId: "m005",
    title: "蜘蛛侠：纵横宇宙",
    duration: 140,
    poster: "assets/posters/spiderverse.jpg",
    tags: ["animation", "action", "superhero"],
    showType: "3d",
    rating: 8.5,
    language: "en",
  },
];

// =============================================================================
// 三、场次 mock 数据（每部电影 2~3 场，共 12 场）
// =============================================================================

/**
 * 场次覆盖三种影厅规模、不同日期和时间段。
 * remainingSeats 根据对应影厅 capacity 预设，后续由座位状态实时计算。
 * endTime 由 duration 推算（简化：分钟→HH:MM）。
 */
export const schedulesMock = [
  // ---- 星际穿越 m001 ----
  {
    scheduleId: "s001",
    movieId: "m001",
    hallId: "hall-large",
    date: "2026-07-15",
    startTime: "14:00",
    endTime: "16:49",
    price: 68,
    remainingSeats: 310,
    status: "on_sale",
  },
  {
    scheduleId: "s002",
    movieId: "m001",
    hallId: "hall-medium",
    date: "2026-07-15",
    startTime: "19:30",
    endTime: "22:19",
    price: 58,
    remainingSeats: 210,
    status: "on_sale",
  },
  {
    scheduleId: "s003",
    movieId: "m001",
    hallId: "hall-small",
    date: "2026-07-16",
    startTime: "10:00",
    endTime: "12:49",
    price: 48,
    remainingSeats: 104,
    status: "on_sale",
  },

  // ---- 流浪地球3 m002 ----
  {
    scheduleId: "s004",
    movieId: "m002",
    hallId: "hall-large",
    date: "2026-07-16",
    startTime: "14:30",
    endTime: "17:00",
    price: 68,
    remainingSeats: 310,
    status: "on_sale",
  },
  {
    scheduleId: "s005",
    movieId: "m002",
    hallId: "hall-medium",
    date: "2026-07-17",
    startTime: "19:00",
    endTime: "21:30",
    price: 58,
    remainingSeats: 210,
    status: "on_sale",
  },

  // ---- 哪吒之魔童闹海 m003 ----
  {
    scheduleId: "s006",
    movieId: "m003",
    hallId: "hall-medium",
    date: "2026-07-15",
    startTime: "10:30",
    endTime: "12:20",
    price: 58,
    remainingSeats: 210,
    status: "on_sale",
  },
  {
    scheduleId: "s007",
    movieId: "m003",
    hallId: "hall-small",
    date: "2026-07-16",
    startTime: "16:00",
    endTime: "17:50",
    price: 48,
    remainingSeats: 104,
    status: "on_sale",
  },
  {
    scheduleId: "s008",
    movieId: "m003",
    hallId: "hall-large",
    date: "2026-07-17",
    startTime: "13:00",
    endTime: "14:50",
    price: 68,
    remainingSeats: 310,
    status: "on_sale",
  },

  // ---- 奥本海默 m004 ----
  {
    scheduleId: "s009",
    movieId: "m004",
    hallId: "hall-small",
    date: "2026-07-17",
    startTime: "18:00",
    endTime: "21:00",
    price: 48,
    remainingSeats: 104,
    status: "on_sale",
  },
  {
    scheduleId: "s010",
    movieId: "m004",
    hallId: "hall-medium",
    date: "2026-07-18",
    startTime: "15:00",
    endTime: "18:00",
    price: 58,
    remainingSeats: 210,
    status: "on_sale",
  },

  // ---- 蜘蛛侠：纵横宇宙 m005 ----
  {
    scheduleId: "s011",
    movieId: "m005",
    hallId: "hall-medium",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "12:20",
    price: 58,
    remainingSeats: 210,
    status: "on_sale",
  },
  {
    scheduleId: "s012",
    movieId: "m005",
    hallId: "hall-large",
    date: "2026-07-18",
    startTime: "19:00",
    endTime: "21:20",
    price: 68,
    remainingSeats: 310,
    status: "on_sale",
  },
];

// =============================================================================
// 四、座位状态 mock 数据
// =============================================================================

/**
 * 根据 hallId 查找对应的影厅对象。
 * 用于 schedule → hall 的映射。
 *
 * @param {string} hallId - 影厅 ID（如 "hall-small"）
 * @returns {object|undefined} 影厅对象，未找到返回 undefined
 */
function getHallById(hallId) {
  return hallsMock.find((h) => h.hallId === hallId);
}

/**
 * 为指定 scheduleId 和 hall 生成全部座位的初始状态。
 * 绝大部分为 available，少量随机标记为 sold 以便演示。
 * 基于影厅 pattern 中的 S/W 生成 seatId（A/X 不计入编号）。
 *
 * 每个 scheduleId 独立使用确定性的 pseudo-random hash 决定哪些座位为 sold，
 * 同一个 (scheduleId, seatId) 组合每次调用返回相同的状态。
 *
 * @param {string} scheduleId - 场次 ID（如 "s001"）
 * @param {object} hall - 影厅对象，需包含 rows 数组
 * @returns {Array<object>} seatState 数组，每项结构见 data-schema.md
 */
export function generateSeatState(scheduleId, hall) {
  const states = [];
  const soldProbability = 0.15; // 15% 座位预置为已售，用于演示

  for (const row of hall.rows) {
    let seatNumber = 0; // 当前排座位号（仅 S 和 W 递增，A/X 跳过）
    for (const ch of row.pattern) {
      if (ch === "S" || ch === "W") {
        seatNumber++;
        const seatId = `${row.rowLabel}-${seatNumber}`;
        // 基于 scheduleId+seatId 的确定性 hash，同输入始终得到相同结果
        const hash = simpleHash(`${scheduleId}-${seatId}`);
        const isSold = hash < soldProbability;

        states.push({
          scheduleId,
          seatId,
          status: isSold ? "sold" : "available",
          userId: "",
          orderId: "",
          lockedUntil: null,
          updatedAt: Date.now(),
        });
      }
    }
  }
  return states;
}

/**
 * 生成全部 12 个场次 × 对应影厅 的完整座位状态。
 * 遍历 schedulesMock，为每个场次按其所分配的 hallId 生成全部座位状态。
 *
 * @returns {Object<string, Array<object>>} 键为 scheduleId，值为 seatState 数组
 */
export function generateAllSeatStates() {
  const allStates = {};
  for (const schedule of schedulesMock) {
    const hall = getHallById(schedule.hallId);
    if (hall) {
      allStates[schedule.scheduleId] = generateSeatState(schedule.scheduleId, hall);
    }
  }
  return allStates;
}

/**
 * 简易字符串 hash 函数，返回值 0~1。
 * 用于确定性生成 mock 数据，同输入始终得到相同结果。
 *
 * @param {string} str - 输入字符串
 * @returns {number} 0~1 之间的浮点数
 */
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff;
  }
  return (h % 1000) / 1000;
}

/**
 * 所有场次的完整座位状态（预生成，避免每次启动重复计算）。
 * 键为 scheduleId（s001~s012），值为对应 seatState 数组。
 */
export const allSeatStates = generateAllSeatStates();

/**
 * 保持向后兼容：seatStateMock 对应 s001（星际穿越·巨幕厅）。
 * 供 app.js 初始加载使用。
 */
export const seatStateMock = allSeatStates["s001"] || generateSeatState("s001", hallLarge);

// =============================================================================
// 五、用户 mock 数据
// =============================================================================

/**
 * 预设一个普通用户和一个管理员，密码明文（仅课程作业模拟）。
 * userId 使用 "u" 前缀 + 序号。
 */
export const usersMock = [
  {
    userId: "u001",
    username: "testuser",
    password: "123456",
    role: "user",
    nickname: "测试用户",
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
  },
  {
    userId: "u002",
    username: "admin",
    password: "admin123",
    role: "admin",
    nickname: "管理员",
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
  },
];

// =============================================================================
// 六、热度数据 mock（初始值，后续由订单流转动态更新）
// =============================================================================

/**
 * 为指定 scheduleId 和 hall 生成初始热度数据。
 * 中心排（D-G 排）热度偏高（0.6~0.9），靠边排热度偏低（0.1~0.4），
 * 中间过道附近座位也略微偏高。
 *
 * @param {string} scheduleId - 场次 ID
 * @param {object} hall - 影厅对象
 * @returns {Array} heatMapData 数组
 */
export function generateHeatMap(scheduleId, hall) {
  const data = [];
  const rowCount = hall.rows.length;
  // 中心排索引范围
  const centerStart = Math.floor(rowCount * 0.3);
  const centerEnd = Math.floor(rowCount * 0.7);

  for (let ri = 0; ri < hall.rows.length; ri++) {
    const row = hall.rows[ri];
    let seatNumber = 0;
    // 统计该排 S/W 总数，用于计算座位在排中的位置
    const totalSeats = [...row.pattern].filter((c) => c === "S" || c === "W").length;

    for (let ci = 0; ci < row.pattern.length; ci++) {
      const ch = row.pattern[ci];
      if (ch === "S" || ch === "W") {
        seatNumber++;
        const seatId = `${row.rowLabel}-${seatNumber}`;

        let heatScore;
        if (ri >= centerStart && ri <= centerEnd) {
          // 中心排：高热度 0.6~0.9，越靠近中心列越热
          const colRatio = seatNumber / totalSeats;
          const centerDist = Math.abs(colRatio - 0.5) * 2; // 0=中心, 1=边缘
          heatScore = 0.9 - centerDist * 0.3;
        } else {
          // 边缘排：低热度 0.1~0.4
          const rowDist = Math.min(ri - centerStart, centerEnd - ri, rowCount) / rowCount;
          heatScore = 0.4 - rowDist * 0.3 + Math.random() * 0.1;
        }
        // 钳位到 0~1 并保留两位小数
        heatScore = Math.round(Math.max(0, Math.min(1, heatScore)) * 100) / 100;

        data.push({
          scheduleId,
          seatId,
          heatScore,
        });
      }
    }
  }
  return data;
}

/**
 * 生成全部 12 个场次 × 对应影厅 的完整初始热度数据。
 * 遍历 schedulesMock，为每个场次按其所分配的 hallId 生成每个座位的 heatScore。
 *
 * @returns {Object<string, Array<object>>} 键为 scheduleId，值为 heatMapData 数组
 */
export function generateAllHeatMaps() {
  const allMaps = {};
  for (const schedule of schedulesMock) {
    const hall = getHallById(schedule.hallId);
    if (hall) {
      allMaps[schedule.scheduleId] = generateHeatMap(schedule.scheduleId, hall);
    }
  }
  return allMaps;
}

/**
 * 所有场次的完整热度数据（预生成，避免每次启动重复计算）。
 * 键为 scheduleId（s001~s012），值为 heatMapData 数组。
 */
export const allHeatMaps = generateAllHeatMaps();

/**
 * 保持向后兼容：heatMapMock 对应 s001（星际穿越·巨幕厅）。
 * 供 app.js 初始加载使用。
 */
export const heatMapMock = allHeatMaps["s001"] || generateHeatMap("s001", hallLarge);

// =============================================================================
// 七、订单 mock 数据（初始为空，由用户操作动态创建）
// =============================================================================

/**
 * 预置几条示例订单用于演示订单中心 UI。
 * 包含不同状态的订单：booked（已预订）、purchased（已支付）、cancelled（已取消）。
 */
export const ordersMock = [
  {
    orderId: "o-demo-001",
    userId: "u001",
    scheduleId: "s001",
    seatIds: ["F-15", "F-16"],
    ticketType: "couple",
    peopleCount: 2,
    totalPrice: 136,
    status: "purchased",
    paymentStatus: "paid",
    paymentMethod: "mock",
    createdAt: Date.now() - 86400000, // 1 天前
    updatedAt: Date.now() - 86400000,
    expiresAt: null,
  },
  {
    orderId: "o-demo-002",
    userId: "u001",
    scheduleId: "s002",
    seatIds: ["E-10"],
    ticketType: "single",
    peopleCount: 1,
    totalPrice: 58,
    status: "booked",
    paymentStatus: "pending",
    paymentMethod: "mock",
    createdAt: Date.now() - 600000, // 10 分钟前
    updatedAt: Date.now() - 600000,
    expiresAt: Date.now() + 300000, // 5 分钟后过期
  },
  {
    orderId: "o-demo-003",
    userId: "u001",
    scheduleId: "s001",
    seatIds: ["G-20"],
    ticketType: "single",
    peopleCount: 1,
    totalPrice: 68,
    status: "cancelled",
    paymentStatus: "closed",
    paymentMethod: "mock",
    createdAt: Date.now() - 172800000, // 2 天前
    updatedAt: Date.now() - 100000,
    expiresAt: null,
  },
];

// =============================================================================
// 导出汇总：所有 mock 数据集中对象
// =============================================================================

/**
 * 一次性获取所有初始 mock 数据的便捷对象。
 * 用于 store.js 初始化时批量写入 LocalStorage。
 */
export const allMockData = {
  halls: hallsMock,
  movies: moviesMock,
  schedules: schedulesMock,
  users: usersMock,
  orders: ordersMock,
  // 所有 12 个场次 × 对应影厅的完整座位状态和热度数据（预生成）
  seatStates: allSeatStates,
  heatMaps: allHeatMaps,
};
