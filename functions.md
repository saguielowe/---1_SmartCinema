# C 模块：账号与订单 —— 功能函数文档

> 所属分支：`feature/order-storage`
> 主文件：`03_源码/js/store.js`、`03_源码/js/mock-data.js`
> 最后更新：2026-07-17

本文档记录 C 模块（及配套 mock 数据模块）中所有对外暴露的函数、接口和数据结构。后续开发过程中持续维护，标注函数签名、参数、返回值和用途。

---

## 一、mock-data.js —— 公共测试数据模块

### 1.1 影厅数据（导出常量）

#### `hallSmall` → `{object}`
小厅「星光厅」完整影厅对象，约 104 座。

| 字段 | 类型 | 说明 |
|------|------|------|
| hallId | string | `"hall-small"` |
| hallName | string | `"星光厅"` |
| hallType | string | `"small"` |
| capacity | number | `104` |
| rowCount | number | `10` |
| screenLabel | string | `"银幕"` |
| rows | array | 10 个 row 对象，含 rowLabel / pattern / offsetX / curveDepth |

#### `hallMedium` → `{object}`
中厅「银幕厅」完整影厅对象，约 210 座。结构同上，hallId=`"hall-medium"`。

#### `hallLarge` → `{object}`
大厅「巨幕厅」完整影厅对象，约 310 座。结构同上，hallId=`"hall-large"`。

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

### 1.4 座位状态（导出常量 + 生成函数）

#### `generateSeatState(scheduleId, hall)` → `{Array<object>}`
**函数签名：**
```
generateSeatState(scheduleId: string, hall: object): Array<seatState>
```
- **scheduleId**：场次 ID（如 `"s001"`）
- **hall**：影厅对象，需包含 `rows` 数组及每行的 `pattern`
- **返回值**：该影厅所有座位的初始状态数组。85% 概率为 `available`，15% 概率为 `sold`（确定性 hash，同输入反复得到相同结果）
- **座位 ID 生成规则**：遍历 pattern，仅 S/W 计入编号，A/X 跳过。例如 A 排第 3 个 S → `"A-3"`
- **用途**：`store.js` 初始化 LocalStorage 时，为每个 scheduleId 批量生成初始 seatState

#### `seatStateMock` → `{Array<object>}`
向后兼容引用：`generateSeatState("s001", hallLarge)` 的结果，供 `app.js` 初始加载。

---

### 1.5 用户数据（导出常量）

#### `usersMock` → `{Array<object>}`
2 个预设用户：
| username | password | role | userId |
|----------|----------|------|--------|
| testuser | 123456 | user | u001 |
| admin | admin123 | admin | u002 |

每项完整结构见 `docs/data-schema.md` 中 `user` schema。

---

### 1.6 热度数据（导出常量 + 生成函数）

#### `generateHeatMap(scheduleId, hall)` → `{Array<object>}`
**函数签名：**
```
generateHeatMap(scheduleId: string, hall: object): Array<heatMapData>
```
- **scheduleId**：场次 ID
- **hall**：影厅对象
- **返回值**：每个座位的初始热度数据（seatId + heatScore 0~1）
- **热度分布逻辑**：
  - 中心排（D-G，即 ri 在 rowCount*0.3 ~ rowCount*0.7）：heatScore 0.6~0.9，越靠近该排中心列越高
  - 边缘排（A-C 和 H-J）：heatScore 0.1~0.4
- **用途**：`store.js` 初始化时为每个 scheduleId 生成初始热度

#### `heatMapMock` → `{Array<object>}`
`generateHeatMap("s001", hallLarge)` 的预计算结果，供初始演示。

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
  halls,         // hallsMock
  movies,        // moviesMock
  schedules,     // schedulesMock
  users,         // usersMock
  orders,        // ordersMock
  seatStates,    // { s001: seatStateMock }，后续按需补充其他场次
  heatMaps,      // { s001: heatMapMock }
}
```
用途：`store.js` 中 `initMockData()` → 遍历写入 LocalStorage。

---

### 1.9 内部工具函数

#### `simpleHash(str)` → `{number}`
**（内部函数，不导出）**
- 朴素字符串 hash，返回 0~1 浮点数
- 用于 `generateSeatState` 中确定性决定座位是否为 `sold`
- 算法：`(h * 31 + charCode) % 1000 / 1000`

---

## 二、store.js —— 状态管理模块（规划中的接口）

> 注：以下为 `draft.md` 中规划的接口，将在后续开发阶段实现。完成后更新此表。

### 2.1 用户模块

| 方法签名 | 返回值 | 说明 |
|----------|--------|------|
| `register(username, password)` | `{ success, message }` | 注册新用户，校验用户名唯一 |
| `login(username, password)` | `{ success, message, user? }` | 登录校验，写入 current_user |
| `logout()` | `void` | 清除登录状态 |
| `getCurrentUser()` | `user \| null` | 获取当前登录用户 |
| `isLoggedIn()` | `boolean` | 是否已登录 |
| `isAdmin()` | `boolean` | 当前用户是否为管理员 |

### 2.2 订单模块

| 方法签名 | 返回值 | 说明 |
|----------|--------|------|
| `createOrder({ scheduleId, seatIds, ticketType, peopleCount })` | `order` | 创建订单 + 锁票 |
| `payOrder(orderId)` | `{ success, message }` | 模拟支付 |
| `cancelOrder(orderId)` | `{ success, message }` | 取消预订，释放座位 |
| `refundOrder(orderId)` | `{ success, message }` | 退票，释放座位 |
| `getOrders(filter?)` | `order[]` | 查询订单列表（按 userId 或全部） |
| `getOrderById(orderId)` | `order \| null` | 单条订单查询 |

### 2.3 座位状态模块

| 方法签名 | 返回值 | 说明 |
|----------|--------|------|
| `getSeatStateBySchedule(scheduleId)` | `seatState[]` | 查询某场次所有座位状态 |
| `getRemainingSeats(scheduleId)` | `number` | 计算可用座位数 |
| `updateSeatStatus(scheduleId, seatIds, newStatus)` | `void` | 批量更新座位状态 |

### 2.4 热度数据模块

| 方法签名 | 返回值 | 说明 |
|----------|--------|------|
| `getHeatMapBySchedule(scheduleId)` | `heatMapData[]` | 查询某场次热度数据 |
| `getHeatMapByMovie(movieId)` | `heatMapData[]` | 聚合某电影所有场次热度 |
| `updateHeatScore(scheduleId, seatId, delta)` | `void` | 更新单个座位热度 |

### 2.5 初始化与工具

| 方法签名 | 返回值 | 说明 |
|----------|--------|------|
| `initStore()` | `void` | 应用启动时初始化 LocalStorage 和内存状态 |
| `clearAllData()` | `void` | 清除所有 LocalStorage 数据（调试用） |

---

## 三、状态流转约定

| 用户操作 | 调用的 Store 方法 | 订单状态变化 | 座位状态变化 |
|----------|-------------------|-------------|-------------|
| 点击预订 | `createOrder(...)` | status→booked, paymentStatus→pending | seatIds→reserved |
| 确认支付 | `payOrder(orderId)` | status→purchased, paymentStatus→paid | seatIds→sold |
| 取消预订 | `cancelOrder(orderId)` | status→cancelled, paymentStatus→closed | seatIds→available |
| 已购票后退票 | `refundOrder(orderId)` | status→refunded, paymentStatus→closed | seatIds→available |
| 超时未支付 | 定时器自动触发 `cancelOrder` | 同上"取消预订" | 同上 |

---

## 四、修改日志

| 日期 | 修改内容 | 修改人 |
|------|----------|--------|
| 2026-07-17 | 初始创建，记录 mock-data.js 所有导出和 store.js 规划接口 | C |