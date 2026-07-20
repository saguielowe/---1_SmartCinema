# C 模块：账号与订单 —— 功能函数文档

> 所属分支：`feature/order-storage`
> 主文件：`03_源码/js/store.js`、`03_源码/js/mock-data.js`
> 最后更新：2026-07-18

本文档记录 C 模块（及配套 mock 数据模块）中所有对外暴露的函数、接口和数据结构。后续开发过程中持续维护，标注函数签名、参数、返回值和用途。

---

## 〇、G：给 A / B / D 模块的对接接口速查

> C 模块通过 `store` 单例提供以下接口。`app.js` 中 `import { store } from "./store.js"` 后直接调用。

### 给 A 模块（Canvas 座位图）

| 接口 | 签名 | 用途 |
|------|------|------|
| `getHalls()` | `() → hall[]` | 获取全部影厅列表 |
| `getHallById(hallId)` | `(string) → hall\|undefined` | 按 ID 获取影厅（含 rows/pattern/offsetX/curveDepth） |
| `getSeatStateBySchedule(scheduleId)` | `(string) → seatState[]` | 获取某场次全部座位状态（status: available/reserved/sold） |
| `getRemainingSeats(scheduleId)` | `(string) → number` | 获取可用座位数 |
| `getScheduleById(scheduleId)` | `(string) → schedule\|undefined` | 获取场次信息（含 hallId / movieId / price） |

**A 的典型调用：**
```js
const schedule = store.getScheduleById("s001");
const hall = store.getHallById(schedule.hallId);
const seatState = store.getSeatStateBySchedule("s001");
drawSeatMap(canvas, { hall, seatState, highlightedSeatIds: [...] });
```

**A 的输出 → C 的输入：** `selectedSeatIds: string[]` — 用户选中的座位 ID 数组，传给 `store.createOrder()` 的 `seatIds` 参数。

### 给 B 模块（推荐引擎）

| 接口 | 签名 | 用途 |
|------|------|------|
| `getHallById(hallId)` | `(string) → hall\|undefined` | 获取影厅结构（含 rows/pattern） |
| `getSeatStateBySchedule(scheduleId)` | `(string) → seatState[]` | 获取座位状态（B 需要知道哪些座位已售） |
| `getHalls()` | `() → hall[]` | 全部影厅 |
| `getSchedules()` | `() → schedule[]` | 全部场次 |
| `getScheduleById(scheduleId)` | `(string) → schedule\|undefined` | 场次详情 |
| `getMovieById(movieId)` | `(string) → movie\|undefined` | 电影详情（含 tags/duration/rating） |

**B 的典型调用：**
```js
const hall = store.getHallById(schedule.hallId);
const seatState = store.getSeatStateBySchedule(schedule.scheduleId);
const result = runRecommendation(recommendationInput, hall, seatState);
```

**B 的输出 → C 的输入：** `recommendationResult.recommendedSeatIds: string[]` — 可作为 `store.createOrder()` 的 `seatIds` 参数实现"一键接受推荐"。

### 给 D 模块（页面整合 / UI）

| 接口 | 签名 | 用途 |
|------|------|------|
| **初始化** ||
| `initStore()` | `() → { isFirstRun: boolean }` | 应用启动时调用一次，写入 mock 数据或从 LS 恢复 |
| **用户** ||
| `register(username, password)` | `→ { success, message, user? }` | 注册新用户 |
| `login(username, password)` | `→ { success, message, user? }` | 登录 |
| `logout()` | `void` | 登出 |
| `getCurrentUser()` | `→ user\|null` | 当前登录用户 |
| `isLoggedIn()` | `→ boolean` | 是否已登录 |
| `isAdmin()` | `→ boolean` | 是否管理员 |
| **订单** ||
| `createOrder({ scheduleId, seatIds, ticketType, peopleCount })` | `→ { success, message, order? }` | 创建订单 + 锁票 |
| `payOrder(orderId)` | `→ { success, message }` | 模拟支付 |
| `cancelOrder(orderId)` | `→ { success, message }` | 取消预订 |
| `refundOrder(orderId)` | `→ { success, message }` | 退票 |
| `getOrders(filter?)` | `→ order[]` | 查询订单（普通用户只看自己的） |
| `getOrderById(orderId)` | `→ order\|null` | 单条订单 |
| **座位** ||
| `getSeatStateBySchedule(scheduleId)` | `→ seatState[]` | 座位状态 |
| `getRemainingSeats(scheduleId)` | `→ number` | 可用座位数 |
| `updateSeatStatus(scheduleId, seatIds, newStatus)` | `void` | 批量更新座位 |
| **热度** ||
| `getHeatMapBySchedule(scheduleId)` | `→ heatMapData[]` | 热度数据 |
| `getHeatMapByMovie(movieId)` | `→ heatMapData[]` | 电影聚合热度 |
| `updateHeatScore(scheduleId, seatId, delta)` | `void` | 手动更新热度 |
| **基础查询** ||
| `getMovies()` / `getMovieById(id)` | `→ movie[]` / `movie\|undefined` | 电影数据 |
| `getSchedules()` / `getScheduleById(id)` / `getSchedulesByMovie(movieId)` | `→ schedule[]` / `schedule\|undefined` / `schedule[]` | 场次数据 |
| `getHalls()` / `getHallById(id)` | `→ hall[]` / `hall\|undefined` | 影厅数据 |
| `clearAllData()` | `void` | 调试用清除全部数据 |

---

## 一、mock-data.js —— 公共测试数据模块

### 1.1 影厅数据（导出常量）

#### `hallSmall` → `{object}`
小厅「星光厅」完整影厅对象，严格为 100 座（10 排 × 10 座）。

| 字段 | 类型 | 说明 |
|------|------|------|
| hallId | string | `"hall-small"` |
| hallName | string | `"星光厅"` |
| hallType | string | `"small"` |
| capacity | number | `100` |
| rowCount | number | `10` |
| screenLabel | string | `"银幕"` |
| rows | array | 10 个 row 对象，含 rowLabel / pattern / offsetX / curveDepth |

#### `hallMedium` → `{object}`
中厅「银幕厅」完整影厅对象，严格为 200 座（10 排 × 20 座）。结构同上，hallId=`"hall-medium"`。

#### `hallLarge` → `{object}`
大厅「巨幕厅」完整影厅对象，严格为 300 座（10 排 × 30 座）。结构同上，hallId=`"hall-large"`。

#### `hallsMock` → `{Array<object>}`
全部三套影厅的数组：`[hallSmall, hallMedium, hallLarge]`。

#### `hallMock` → `{object}`
向后兼容引用，指向 `hallMedium`。A 模块初始开发时使用此默认值。

---

### 1.2 电影数据（导出常量）

#### `moviesMock` → `{Array<object>}`
5 部电影的数组，每项结构：

| 字段 | 类型 | 示例 |
|------|------|------|
| movieId | string | `"m001"` |
| title | string | `"星际穿越"` |
| duration | number | `169`（分钟） |
| poster | string | `"assets/posters/interstellar.jpg"` |
| tags | string[] | `["sci-fi", "adventure", "space"]` |
| showType | string | `"imax"` / `"3d"` / `"2d"` |
| rating | number | `9.3` |
| language | string | `"en"` / `"zh"` |

电影列表：星际穿越（m001）、流浪地球3（m002）、哪吒之魔童闹海（m003）、奥本海默（m004）、蜘蛛侠：纵横宇宙（m005）。

---

### 1.3 场次数据（导出常量）

#### `schedulesMock` → `{Array<object>}`
12 个场次的数组，覆盖三种影厅规模和 4 个不同日期。每项结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| scheduleId | string | `"s001"` ~ `"s012"` |
| movieId | string | 对应电影 ID |
| hallId | string | 对应影厅 ID |
| date | string | `"2026-07-15"` ~ `"2026-07-18"` |
| startTime | string | `"HH:MM"` |
| endTime | string | `"HH:MM"`（由 duration 推算） |
| price | number | 大厅 68、中厅 58、小厅 48 |
| remainingSeats | number | 初始=影厅 capacity（后续由座位状态实时计算） |
| status | string | `"on_sale"` |

---

### 1.4 座位状态（导出函数 + 导出常量）

#### `generateSeatState(scheduleId, hall)` → `{Array<object>}`
**函数签名：**
```
generateSeatState(scheduleId: string, hall: object): Array<seatState>
```
- **scheduleId**：场次 ID（如 `"s001"`）
- **hall**：影厅对象，需包含 `rows` 数组及每行的 `pattern`
- **返回值**：该影厅所有座位的初始状态数组。85% 概率为 `available`，15% 概率为 `sold`（基于 scheduleId+seatId 的确定性 hash，同输入反复得到相同结果）
- **座位 ID 生成规则**：遍历 pattern，仅 S/W 计入编号，A/X 跳过。例如 A 排第 3 个 S → `"A-3"`
- **用途**：`store.js` 初始化 LocalStorage 时，为每个 scheduleId 批量生成初始 seatState

#### `generateAllSeatStates()` → `{Object<string, Array<object>>}`
**函数签名：**
```
generateAllSeatStates(): Object<string, Array<seatState>>
```
- **无参数**
- **返回值**：键为 scheduleId（`"s001"` ~ `"s012"`），值为该场次所有座位的 seatState 数组
- **内部逻辑**：遍历 `schedulesMock`，通过 `getHallById()` 获取对应 hall，对每个场次调用 `generateSeatState()`
- **用途**：批量预生成全部 12 个场次的座位状态

#### `allSeatStates` → `{Object<string, Array<object>>}`
预生成的常量，`generateAllSeatStates()` 的调用结果。包含 s001~s012 全部场次的完整座位状态。

**数据量统计：**
| 场次 | 影厅 | 座位数 | 预置 sold 数（约 15%）|
|------|------|--------|----------------------|
| s001, s004, s008, s012 | hall-large | 300 | ~45 |
| s002, s005, s006, s010, s011 | hall-medium | 200 | ~30 |
| s003, s007, s009 | hall-small | 100 | ~15 |

#### `seatStateMock` → `{Array<object>}`
向后兼容引用：`allSeatStates["s001"]`，对应 s001 场次（星际穿越·巨幕厅，300 座）。供 `app.js` 初始加载使用。

---

### 1.5 用户数据（导出常量）

#### `usersMock` → `{Array<object>}`
3 个预设账号；`guest` 仅用于无会话时自动进入演示流程：
| username | password | role | userId |
|----------|----------|------|--------|
| guest | 空（不用于手动登录） | user | u000 |
| testuser | 123456 | user | u001 |
| admin | admin123 | admin | u002 |

每项完整结构见 `docs/data-schema.md` 中 `user` schema。

---

### 1.6 热度数据（导出函数 + 导出常量）

#### `generateHeatMap(scheduleId, hall)` → `{Array<object>}`
**函数签名：**
```
generateHeatMap(scheduleId: string, hall: object): Array<heatMapData>
```
- **scheduleId**：场次 ID
- **hall**：影厅对象
- **返回值**：每个座位的初始热度数据（seatId + heatScore 0~1）
- **热度分布逻辑**：
  - 中心排（D-G 排，即 ri 在 rowCount*0.3 ~ rowCount*0.7）：heatScore 0.6~0.9，越靠近该排中心列越高
  - 边缘排（A-C 和 H-J）：heatScore 0.1~0.4，带微量随机扰动
- **用途**：`store.js` 初始化时为每个 scheduleId 生成初始热度

#### `generateAllHeatMaps()` → `{Object<string, Array<object>>}`
**函数签名：**
```
generateAllHeatMaps(): Object<string, Array<heatMapData>>
```
- **无参数**
- **返回值**：键为 scheduleId（`"s001"` ~ `"s012"`），值为该场次所有座位的 heatMapData 数组
- **内部逻辑**：遍历 `schedulesMock`，通过 `getHallById()` 获取对应 hall，对每个场次调用 `generateHeatMap()`
- **用途**：批量预生成全部 12 个场次的初始热度数据

#### `allHeatMaps` → `{Object<string, Array<object>>}`
预生成的常量，`generateAllHeatMaps()` 的调用结果。包含 s001~s012 全部场次的完整热度数据。

#### `heatMapMock` → `{Array<object>}`
向后兼容引用：`allHeatMaps["s001"]`，对应 s001 场次（星际穿越·巨幕厅）。供初始演示。

---

### 1.7 订单数据（导出常量）

#### `ordersMock` → `{Array<object>}`
3 条示例订单，覆盖不同状态用于演示：
| orderId | status | paymentStatus | 说明 |
|---------|--------|---------------|------|
| o-demo-001 | purchased | paid | 已完成支付 |
| o-demo-002 | booked | pending | 已预订未支付，5 分钟后过期 |
| o-demo-003 | cancelled | closed | 已取消 |

每条结构见 `docs/data-schema.md` 中 `order` schema。

---

### 1.8 汇总对象

#### `allMockData` → `{object}`
一次性获取所有初始 mock 数据的便捷对象：
```js
{
  halls,         // hallsMock（3 套影厅）
  movies,        // moviesMock（5 部电影）
  schedules,     // schedulesMock（12 个场次）
  users,         // usersMock（游客 + 普通用户 + 管理员）
  orders,        // ordersMock（3 条示例订单）
  seatStates,    // allSeatStates — 完整 12 场次座位状态
  heatMaps,      // allHeatMaps — 完整 12 场次热度数据
}
```
用途：`store.js` 首次运行时通过 `initStore()` 遍历写入所有 LocalStorage key。

---

### 1.9 内部工具函数（不导出）

#### `simpleHash(str)` → `{number}`
- 朴素字符串 hash，返回 0~1 浮点数
- 用于 `generateSeatState` 中确定性决定每个 (scheduleId, seatId) 组合是否为 `sold`
- 算法：`(h * 31 + charCode) & 0x7fffffff` 取低 31 位后 `% 1000 / 1000`
- **确定性保证**：同一输入始终得到同一输出，确保跨页面刷新后 mock 数据一致

#### `getHallById(hallId)` → `{object|undefined}`
- 根据影厅 ID 字符串在 `hallsMock` 中查找对应影厅对象
- 用于 `generateAllSeatStates()` 和 `generateAllHeatMaps()` 中 schedule.hallId → hall 的映射
- 参数：`hallId` — 如 `"hall-small"`、`"hall-medium"`、`"hall-large"`
- 返回值：匹配的 hall 对象，未找到返回 `undefined`

---

## 二、store.js —— 状态管理模块（已实现 ✓）

> 状态：B-1~B-4、C-1~C-5、D-1~D-8、E-1~E-4、F-1~F-5 全部已实现。
> 默认导出单例 `store`，`app.js` 直接 `import { store } from "./store.js"` 使用。
> 工厂函数 `createStore(initialState?)` 也可导出，用于单元测试。

### 2.0 LocalStorage 持久化层（B-1~B-4，内部函数）

| 函数 | 签名 | 说明 |
|------|------|------|
| `loadFromStorage(key)` | `(key: string) → any\|null` | 读取并 JSON.parse，失败返回 null |
| `saveToStorage(key, data)` | `(key: string, data: any) → void` | JSON.stringify 写入，失败仅 warn |
| `removeFromStorage(key)` | `(key: string) → void` | 删除指定 key |
| `initStore()` | `() → { isFirstRun: boolean }` | **（暴露）** 启动初始化：检查 smartcinema_users → 不存在则写入 allMockData → 加载数据 → 恢复正式会话或回退游客账号 → 恢复锁票定时器 |
| `clearAllData()` | `() → void` | **（暴露）** 清除全部 LS 数据 + 重置内存状态 + 清理所有定时器 |
| `persistAll()` | 内部 | 全量持久化（HALLS/MOVIES/SCHEDULES/USERS/ORDERS/SEAT_STATE/HEAT_MAP/CURRENT_USER） |
| `persistUsers()` | 内部 | 仅持久化 USERS + CURRENT_USER |
| `persistOrders()` | 内部 | 仅持久化 ORDERS |
| `persistSeatStates()` | 内部 | 仅持久化 SEAT_STATE |
| `persistHeatMaps()` | 内部 | 仅持久化 HEAT_MAP |

**LS Key 常量：**
| 常量 | Key |
|------|-----|
| STORAGE_KEYS.USERS | `smartcinema_users` |
| STORAGE_KEYS.MOVIES | `smartcinema_movies` |
| STORAGE_KEYS.SCHEDULES | `smartcinema_schedules` |
| STORAGE_KEYS.HALLS | `smartcinema_halls` |
| STORAGE_KEYS.ORDERS | `smartcinema_orders` |
| STORAGE_KEYS.SEAT_STATE | `smartcinema_seat_state` |
| STORAGE_KEYS.CURRENT_USER | `smartcinema_current_user` |
| STORAGE_KEYS.HEAT_MAP | `smartcinema_heat_map` |

### 2.1 基础数据查询（只读）

| 方法签名 | 返回值 | 说明 |
|----------|--------|------|
| `getHalls()` | `hall[]` | 全部影厅列表 |
| `getHallById(hallId)` | `hall\|undefined` | 按 ID 查影厅 |
| `getMovies()` | `movie[]` | 全部电影列表 |
| `getMovieById(movieId)` | `movie\|undefined` | 按 ID 查电影 |
| `getSchedules()` | `schedule[]` | 全部场次列表 |
| `getScheduleById(scheduleId)` | `schedule\|undefined` | 按 ID 查场次 |
| `getSchedulesByMovie(movieId)` | `schedule[]` | 某电影的所有场次 |

### 2.2 用户模块

| 方法签名 | 返回值 | 说明 |
|----------|--------|------|
| `register(username, password)` | `{ success, message, user? }` | 注册（校验唯一 + 非空），成功自动登录 |
| `login(username, password)` | `{ success, message, user? }` | 登录校验，写入 current_user |
| `logout()` | `void` | 登出，清除 current_user |
| `getCurrentUser()` | `user\|null` | 当前账号；无正式会话时初始化为游客 |
| `isLoggedIn()` | `boolean` | 是否已登录 |
| `isAdmin()` | `boolean` | 是否管理员 |

### 2.3 订单模块

| 方法签名 | 返回值 | 说明 |
|----------|--------|------|
| `createOrder({ scheduleId, seatIds, ticketType, peopleCount })` | `{ success, message, order? }` | 创建订单 + 锁票（15 分钟超时）。校验：需登录 + 座位均 available + 场次存在 |
| `payOrder(orderId)` | `{ success, message }` | 模拟支付：booked → purchased/paid，座位 reserved → sold |
| `cancelOrder(orderId)` | `{ success, message }` | 取消预订：booked → cancelled/closed，释放座位 |
| `refundOrder(orderId)` | `{ success, message }` | 退票：purchased → refunded/closed，释放座位 |
| `getOrders(filter?)` | `order[]` | 查询订单（普通用户仅看自己；管理员全量）。filter: { status?, scheduleId? } |
| `getOrderById(orderId)` | `order\|null` | 单条订单查询 |

### 2.4 座位状态模块（E-1~E-4 ✓）

| 任务 | 方法签名 | 返回值 | 说明 |
|------|----------|--------|------|
| E-1 | `getSeatStateBySchedule(scheduleId)` | `seatState[]` | 按 scheduleId 从 `state.seatStates[scheduleId]` 返回完整座位状态数组；无数据返回 `[]` |
| E-2 | `getRemainingSeats(scheduleId)` | `number` | 实时过滤 `status === "available"` 计数，不依赖 `schedule.remainingSeats` 字段 |
| E-3 | `updateSeatStatus(scheduleId, seatIds, newStatus)` | `void` | 批量更新一批座位的 status（available/reserved/sold）→ 直接通过订单方法（createOrder/payOrder/cancelOrder）间接调用 |
| E-4 | `persistSeatStates()` | 内部 | 所有订单操作（createOrder/payOrder/cancelOrder/refundOrder/cancelOrderInternal）均自动调用此函数同步到 LS key `smartcinema_seat_state` |

**E-2 实现细节：** `getRemainingSeats` 每次调用都实时计算，不缓存。`schedule.remainingSeats` 字段仅在 mock 初始化时预设，后续不在任何地方手动维护。
**E-3 调用链：** `createOrder` → 座位 available→reserved | `payOrder` → reserved→sold | `cancelOrder`/`refundOrder` → reserved/sold→available（均通过 `cancelOrderInternal` 统一释放）
**E-4 持久化时机：** createOrder / payOrder / cancelOrder / refundOrder / cancelOrderInternal / updateSeatStatus → 均调用 `persistSeatStates()` 立即写入 LS

### 2.5 热度数据模块（F-1~F-5 ✓）

| 任务 | 方法/位置 | 说明 |
|------|----------|------|
| F-1 | `mock-data.js` → `generateHeatMap()` + `generateAllHeatMaps()` + `allHeatMaps` | 初始化：中心排 D-G（ri 在 30%~70%）heatScore 0.6~0.9（越靠列中心越高）；边缘排 A-C/H-J heatScore 0.1~0.4（带微量随机扰动）。全部 12 场次 × 对应影厅预生成存储在 `allHeatMaps`。`initStore()` 首次运行时写入 LS key `smartcinema_heat_map` |
| F-2 | `getHeatMapBySchedule(scheduleId)` → `heatMapData[]` | 从 `state.heatMaps[scheduleId]` 返回全量数组；无数据返回 `[]` |
| F-2 | `getHeatMapByMovie(movieId)` → `heatMapData[]` | 遍历该电影的所有场次（通过 `getSchedulesByMovie` 获取 scheduleIds），聚合所有 heatMapData 为扁平数组 |
| F-3 | `payOrder()` / `cancelOrderInternal()` 内嵌 | 售出时 `updateHeatScoreInternal(scheduleId, seatId, +0.05)`（上限 1.0）；取消/退票时 `updateHeatScoreInternal(scheduleId, seatId, -0.02)`（下限 0.0）。钳位由 `Math.max(0, Math.min(1, ...))` 保证 |
| F-4 | `state.heatMaps[scheduleId]` 键值结构 | 每个 scheduleId 独立存储，schedule.date 自然区分不同日期场次。`getHeatMapBySchedule(scheduleId)` 直接按场次查询即实现"按时间查看" |
| F-5 | `updateHeatScore(scheduleId, seatId, delta)` | 公开接口，任意 ±delta 值，钳位 0~1 后四舍五入保留两位小数，立即调用 `persistHeatMaps()` 写 LS |
| F-5 | `updateHeatScoreInternal(scheduleId, seatId, delta)` | 内部函数，不自动持久化（供 `payOrder`/`cancelOrderInternal` 批量调用后统一 flush） |

**F-3 热度更新触发时机：**

| 事件 | Store 方法 | 热度变化 |
|------|-----------|---------|
| 模拟支付成功 | `payOrder()` | seatIds 每个座位 +0.05 |
| 取消预订 | `cancelOrder()` → `cancelOrderInternal()` | seatIds 每个座位 -0.02 |
| 退票 | `refundOrder()` → `cancelOrderInternal()` | seatIds 每个座位 -0.02 |
| 超时自动取消 | `scheduleOrderTimeout()` → `cancelOrderInternal()` | seatIds 每个座位 -0.02 |
| 手动更新 | `updateHeatScore(scheduleId, seatId, delta)` | 任意 delta |

### 2.6 锁票超时管理（内部自动）

| 机制 | 说明 |
|------|------|
| `scheduleOrderTimeout(orderId, delay)` | 为 booked 订单设置 setTimeout，超时自动取消 |
| `clearOrderTimer(orderId)` | 支付/取消时清除定时器 |
| `restoreLockTimers()` | `initStore()` 时恢复所有未过期订单的定时器，已过期的立即取消 |
| `cancelOrderInternal(orderId, isRefund)` | 内部共享取消逻辑（取消/退票/超时均调用），含座位释放 + 热度递减 |

---

## 三、test-store.html —— visual cargo test 面板

> 位于 `03_源码/test-store.html`，必须通过 HTTP 服务器访问（`http://localhost:8080/test-store.html`），
> 不可直接双击打开（ES module `import` 在 `file://` 协议下被 CORS 阻止）。

### 3.1 面板布局

| 区域 | 测试覆盖 |
|------|---------|
| 1. Init & LS | `initStore()` / `clearAllData()` / `checkLS()` |
| 2. Users (C-1~5) | `register` / `login` / `logout` / `getCurrentUser` + Admin Login |
| 3. Orders (D-1~8) | 全流程按钮：Create/Pay/Cancel/Refund/Force Expire/Filter/Verify Interfaces/Full Flow Auto Test |
| 4. Heat (F-1~5) | Show Heat / Overview / Update Heat |

### 3.2 D 模块专项测试按钮

| 按钮 | 验证项 | 日志输出内容 |
|------|--------|-------------|
| D-1/2: Create Order + Lock | `createOrder` 创建订单 + `seatState` 锁票验证 | orderId / totalPrice / expires / seats before→after 状态变化 |
| D-3: Pay | `payOrder` 模拟支付 + 座位 reserved→sold | paymentStatus 变化 + 座位状态变化 |
| D-4: Cancel | `cancelOrder` 取消预订 + 座位释放 | cancelled/closed + seats→available |
| D-5: Refund | `refundOrder` 退票 + 已售座位释放 | refunded/closed + seats→available |
| D-6: Force Expire All Booked | 手动触发过期（模拟超时） | 批量 cancelOrder 结果 |
| D-7: All Orders / Apply Filter | `getOrders(filter)` 按状态筛选 | 筛选结果计数 |
| D-8: Verify All Interfaces | 14 个接口存在性检查 | OK/MISSING/INTEGRATED 清单 |
| Run Full Flow | 创建→支付→验证→退票→验证 5 步自动化 | 每步成功/失败 + 座位状态变化 |

---

## 四、状态流转约定

| 用户操作 | 调用的 Store 方法 | 订单状态变化 | 座位状态变化 |
|----------|-------------------|-------------|-------------|
| 点击预订 | `createOrder(...)` | status→booked, paymentStatus→pending | seatIds→reserved |
| 确认支付 | `payOrder(orderId)` | status→purchased, paymentStatus→paid | seatIds→sold |
| 取消预订 | `cancelOrder(orderId)` | status→cancelled, paymentStatus→closed | seatIds→available |
| 已购票后退票 | `refundOrder(orderId)` | status→refunded, paymentStatus→closed | seatIds→available |
| 超时未支付 | 定时器自动触发 `cancelOrder` | 同上"取消预订" | 同上 |

---

## 五、修改日志

| 日期 | 修改内容 | 修改人 |
|------|----------|--------|
| 2026-07-17 | 初始创建，记录 mock-data.js 所有导出和 store.js 规划接口 | C |
| 2026-07-17 | 更新 A-4（allSeatStates / generateAllSeatStates / getHallById）和 A-6（allHeatMaps / generateAllHeatMaps） | C |
| 2026-07-17 | 重构 store.js（B-1~B-4 LocalStorage 持久化层）：loadFromStorage / saveToStorage / initStore / clearAllData / persist* | C |
| 2026-07-17 | store.js 实现 C/D/E/F 全部接口（注册登录、订单 CRUD+锁票、座位状态、热度数据、超时自动取消） | C |
| 2026-07-17 | 创建 test-store.html visual cargo test 面板，修复 onclick→addEventListener binding 问题 | C |
| 2026-07-17 | D-1~D-8 测试面板完善：Full Flow auto-test、按状态筛选、D-8 接口存在性检查、Force Expire | C |
| 2026-07-17 | E-1~E-4 座位状态管理文档标注完成：getSeatStateBySchedule / getRemainingSeats / updateSeatStatus / persistSeatStates | C |
| 2026-07-18 | F-1~F-5 热度数据文档标注完成：generateHeatMap / getHeatMapBySchedule / getHeatMapByMovie / updateHeatScore / updateHeatScoreInternal + 触发时机表 | C |
| 2026-07-18 | G-1~G-4 Store 整合完成：添加 §〇 给 A/B/D 的对接接口速查表（25+ 方法签名 + 典型调用示例），更新 app.js 接入新的 store 单例 | C |
