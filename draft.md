# C 模块：账号与订单 —— 准备工作与工作分类整理

> 对应任务：`注册登录、LocalStorage、订单、锁票、热度数据`
> 工作文件：`03_源码/js/store.js`（主文件）
> 对接方：A（选座）、B（推荐）、D（页面整合）
> 分支：`feature/order-storage`
> 记录页：`docs/contributions/c-order-storage.md`

---

## 一、开始前的准备工作

### 1.1 环境与分支
1. 从 `main` 拉出 `feature/order-storage` 分支。
2. 确认 `03_源码/` 下所有现有文件无未提交改动（尤其 `store.js`、`mock-data.js`、`app.js`）。
3. 用 Live Server 或直接浏览器打开 `03_源码/index.html`，确认当前占位页能正常渲染 Canvas 和推荐占位文字。

### 1.2 阅读与对齐（必须，否则后续字段冲突）
| 序号 | 文档 | 重点关注内容 |
|------|------|-------------|
| 1 | `docs/data-schema.md` | 所有实体 schema（user/order/seatState/heatMapData）、LocalStorage key 命名、锁票机制流程 |
| 2 | `docs/booking-flow.md` | 状态流转表（booked→purchased/cancelled/refunded 对应座位状态变化） |
| 3 | `docs/task-assignment.md` | "先对齐的三件事"（座位 ID 规则、字段以 data-schema 为准、公共文件冲突处理）、接入顺序第1条 |
| 4 | `docs/collaboration.md` | 分支命名、提交信息格式、贡献记录写法、字段变更必须先更新 docs |
| 5 | `docs/feature-checklist.md` | 必须完成里的"订单"和"登录注册"两项 |

### 1.3 确认 C 模块的输入 / 输出边界

**C 需要输出给其他模块的数据：**
| 输出内容 | 消费方 | 数据结构 |
|----------|--------|----------|
| 当前场次的 `seatState[]` | A（画座位图）、B（跑推荐） | `seatState` schema |
| 当前登录用户信息 | D（页面整合） | `smartcinema_current_user` 或 store 暴露的 getter |
| 热度数据 `heatMapData[]` | D（热度图 UI，可能 Canvas） | `heatMapData` schema |
| 订单列表（用户自己的 / 管理员看到全部） | D（订单中心 UI） | `order[]` |

**C 需要从其他模块接收的数据：**
| 输入内容 | 来源 | 用途 |
|----------|------|------|
| `selectedSeatIds` | A（选座组件） | 创建订单时写入 seatIds |
| `recommendationResult` | B（推荐模块） | 可作为"一键接受推荐并创建订单"的输入 |
| 当前 scheduleId / movieId | D（页面选择） | 创建订单、查询座位状态时用 |

### 1.4 当前 `store.js` 状态评估
当前 `store.js` 仅是一个最小占位：
- 只有 `hall` 和 `seatState` 两个状态
- 只暴露 `getHall()`、`getSeatState()`、`setSeatState()`
- **缺少**：用户管理、登录会话、订单 CRUD、热度数据、锁票定时器、LocalStorage 持久化

需要从零搭建完整的 Store 层。

### 1.5 当前 `mock-data.js` 状态评估
- 只有 1 个影厅 `hallMock`（IMAX厅，8 排，约 80 座）—— **不符合题目要求的 100/200/300 三档**
- 只有 4 条 `seatStateMock`，且只有单个 scheduleId `s001`
- **缺少**：movies、schedules、users、orders、heatMapData 的 mock 数据

**C 需要先提供三套预设 mock 数据**（按 task-assignment.md 接入顺序第1条要求）。

---

## 二、工作分类

### 类别 A：Mock 数据准备（最高优先级，阻塞 A、B 开发）

- [x] **A-1** 在 `mock-data.js` 中补充三套影厅 `hall` mock 数据
  - 小厅 ~100 座、中厅 ~200 座、大厅 ~300 座
  - 均为 10 排，每排可不同座位数
  - 使用 `S/A/X/W` 的 pattern，包含过道、空缺、偏移、弧度
  - 按 `data-schema.md` 中 `hall` 结构编写

- [x] **A-2** 在 `mock-data.js` 中补充 `movie` mock 数据（3~5 部电影）

- [x] **A-3** 在 `mock-data.js` 中补充 `schedule` mock 数据
  - 为每部电影创建 1~3 个场次
  - 指定 hallId、日期、时间、价格

- [x] **A-4** 在 `mock-data.js` 中补充完整的 `seatState` mock 数据
  - 为每个 scheduleId 生成所有座位的初始状态（大部分 `available`，少量随机 `sold`）
  - 基于各影厅的 pattern 自动推算所有 seatId（如 A-1, A-2, B-3...）

- [x] **A-5** 在 `mock-data.js` 中补充 `user` mock 数据
  - 至少一个普通用户 + 一个管理员用户
  - 明文密码（项目无后端，仅前端模拟）

- [x] **A-6** 在 `mock-data.js` 中补充 `heatMapData` mock 数据
  - 为每个 scheduleId 的每个座位生成初始热度值（0~1，模拟热门/一般/冷门区域分布）

### 类别 B：LocalStorage 持久化层

- [x] **B-1** 封装统一的 LocalStorage 读写工具函数
  - `loadFromStorage(key)`：读取并 parse JSON，失败返回 null
  - `saveToStorage(key, data)`：序列化写入
  - `removeFromStorage(key)`：删除
  - 所有 key 使用 `smartcinema_` 前缀（与 data-schema.md 一致）

- [x] **B-2** 实现应用启动时的初始化逻辑
  - 检查 `smartcinema_users` 是否存在
  - 不存在 → 写入 mock 数据到 LocalStorage
  - 存在 → 直接加载，保留用户已有数据

- [x] **B-3** 实现数据变更时自动同步到 LocalStorage
  - 用户注册/登录状态变更时
  - 订单创建/状态变更时
  - 座位状态变更时
  - 热度数据更新时

- [x] **B-4** 实现"清除数据"功能（供开发调试，可放在管理员后台）

### 类别 C：用户注册与登录

- [ ] **C-1** 实现注册功能
  - 输入：username + password
  - 校验：用户名唯一、密码非空
  - 生成 `userId`（可用时间戳或自增 ID）
  - 写入 `smartcinema_users`
  - 注册成功后自动登录

- [ ] **C-2** 实现登录功能
  - 输入：username + password
  - 校验：用户名密码匹配
  - 支持普通用户和管理员两种角色
  - 登录成功 → 写入 `smartcinema_current_user`
  - 登录失败 → 返回明确错误提示

- [ ] **C-3** 实现登录状态维护
  - 页面刷新后自动从 `smartcinema_current_user` 恢复登录态
  - Store 暴露 `getCurrentUser()` 和 `isLoggedIn()` getter
  - 提供 `isAdmin()` 判断是否为管理员

- [ ] **C-4** 实现登出功能
  - 清除 `smartcinema_current_user`
  - Store 状态重置

- [ ] **C-5** 暴露给 Store 的用户操作接口
  - `register(username, password)` → 返回注册结果
  - `login(username, password)` → 返回登录结果
  - `logout()`
  - `getCurrentUser()`
  - `isLoggedIn()`
  - `isAdmin()`

### 类别 D：订单管理

- [x] **D-1** 实现创建订单（预订）
  - 输入：scheduleId、seatIds、ticketType、peopleCount
  - 自动计算 totalPrice（price × seatIds.length）
  - 生成 orderId
  - 设置 status = `booked`、paymentStatus = `pending`
  - 写入 createdAt、expiresAt（建议 15 分钟倒计时）
  - 写入 userId（从当前登录用户取）

- [x] **D-2** 实现订单创建时的座位锁票
  - 对应 seatIds 的 seatState → status 改为 `reserved`
  - 写入 userId、orderId、lockedUntil
  - 同时更新 `smartcinema_seat_state` 和 `smartcinema_orders`

- [x] **D-3** 实现模拟支付（确认购票）
  - 弹出假支付确认面板 / 弹窗（UI 由 D 做，C 提供底层状态变更）
  - 确认后：
    - `order.status` → `purchased`
    - `order.paymentStatus` → `paid`
    - 对应座位 `status` → `sold`

- [x] **D-4** 实现取消预订
  - `order.status` → `cancelled`、`paymentStatus` → `closed`
  - 对应座位 `status` → `available`
  - 清除座位上的 userId、orderId、lockedUntil

- [x] **D-5** 实现退票（已购票后退票）
  - `order.status` → `refunded`、`paymentStatus` → `closed`
  - 对应座位 `status` → `available`
  - 清除座位上的 userId、orderId、lockedUntil

- [x] **D-6** 实现锁票超时自动释放
  - 使用 `setInterval` 或 `setTimeout` 检查所有 `booked` 状态的订单
  - 若当前时间 > expiresAt → 自动执行取消预订逻辑
  - 页面刷新后恢复定时器

- [x] **D-7** 实现订单查询
  - 普通用户：查询当前用户的所有订单（按时间倒序）
  - 管理员：查询所有用户的所有订单
  - 可按状态筛选（booked / purchased / cancelled / refunded）

- [x] **D-8** 暴露给 Store 的订单操作接口
  - `createOrder({ scheduleId, seatIds, ticketType, peopleCount })`
  - `payOrder(orderId)`
  - `cancelOrder(orderId)`
  - `refundOrder(orderId)`
  - `getOrders(filter?)` → 返回订单列表
  - `getOrderById(orderId)`

### 类别 E：座位状态管理

- [x] **E-1** 实现按 scheduleId 查询座位状态
  - `getSeatStateBySchedule(scheduleId)` → 返回该场次所有座位状态数组

- [x] **E-2** 实现剩余座位数计算
  - `getRemainingSeats(scheduleId)` → 返回 `available` 状态座位数
  - 对应 `schedule.remainingSeats` 字段由此实时计算，不手动维护

- [x] **E-3** 实现座位状态批量更新
  - `updateSeatStatus(scheduleId, seatIds, newStatus)` → 更新一批座位的状态
  - 用于与锁票/支付/取消联动

- [x] **E-4** 确保座位状态变更同步到 LocalStorage

### 类别 F：热度数据

- [x] **F-1** 实现热度数据初始化
  - 为每个 scheduleId × seatId 生成初始 `heatScore`（0~1）
  - 模拟热门区域（中心排、中心位置分数高）、冷门区域（前排边角分数低）

- [x] **F-2** 实现热度数据查询
  - `getHeatMapBySchedule(scheduleId)` → 返回该场次所有座位热度数据
  - `getHeatMapByMovie(movieId)` → 聚合该电影所有场次的热度

- [x] **F-3** 实现热度更新机制
  - 每次座位被售出（status → `sold`）时，该座位热度 +0.05（上限 1.0）
  - 每次订单取消/退票时，该座位热度 -0.02（下限 0.0）
  - 模拟"越多人买就越热门"的效果

- [x] **F-4** 实现按时间查看热度
  - 不同场次（日期）的热度数据分开存储和查询
  - 支持"一周内不同日期"切换（实际由 schedule.date 区分）

- [x] **F-5** 暴露给 Store 的热度操作接口
  - `getHeatMapBySchedule(scheduleId)`
  - `getHeatMapByMovie(movieId)`
  - `updateHeatScore(scheduleId, seatId, delta)`

### 类别 G：Store 重构与接口整合

- [x] **G-1** 重构 `createStore()`，整合所有模块
  - 用户模块（登录/注册/会话）
  - 订单模块（CRUD + 锁票）
  - 座位状态模块
  - 热度数据模块
  - LocalStorage 同步

- [x] **G-2** 统一对外暴露的公共接口
  - 确保 A/B/D 可以通过 Store 实例获取所需数据
  - 提供清晰的 getter 方法，避免内部状态被直接篡改
  - `functions.md §〇` 提供 25+ 方法签名的分模块速查表（含典型调用示例）

- [x] **G-3** 更新 `app.js` 中的 Store 调用
  - 替换为 `import { store } from "./store.js"` 单例
  - 启动时调用 `store.initStore()`
  - `renderOrders()` 接入实际订单列表 + 登录状态 + 座位统计
  - 通过 `store.getScheduleById` / `getHallById` / `getSeatStateBySchedule` 为 A 提供数据

- [x] **G-4** 确保 Store 方法可以被 D 在 `app.js` 中方便地接线调用
  - `window.__store = store` 挂载到全局供 Console 调试

### 类别 H：协作与文档

- [ ] **H-1** 更新 `docs/data-schema.md`
  - 如果开发中发现需要新增字段或调整结构，先更新文档再改代码
  - 在微信群发送结论和链接

- [ ] **H-2** 维护 `docs/contributions/c-order-storage.md`
  - 每个阶段完成后记录：做了什么、改了哪些文件、怎么手动测试、遇到的问题和处理
  - 阶段性提交后同步更新

- [ ] **H-3** 维护 `docs/ai-usage-report.md`
  - 记录实际使用的 AI 工具/模型、用途、采纳内容、人工修改

- [ ] **H-4** 提交信息遵循约定格式
  - `feat: add mock data for 3 halls and 5 movies`
  - `feat: implement user registration and login with localStorage`
  - `feat: implement order booking with seat lock`
  - `fix: sync seat state after payment`

---

## 三、建议的开发顺序

按依赖关系和"最先生效、最早可供其他模块联调"的原则：

```
第1步：A（Mock 数据准备）      → 产出三套影厅 + 电影 + 场次 + 初始座位状态
第2步：B（LocalStorage 层）    → 封装读写工具 + 启动初始化
第3步：C（用户注册登录）       → 认证体系跑通
第4步：E（座位状态管理）       → 座位查询/更新，供 A/B 联调
第5步：D（订单管理）          → 预订/支付/取消/退票全流程
第6步：F（热度数据）          → 热度初始值 + 售出更新
第7步：G（Store 重构整合）     → 所有接口收口
第8步：H（文档同步）          → 贯穿全程，阶段性记录
```

---

## 四、与其他模块的关键对接点

| 对接场景 | C 提供 | 消费方 | 注意 |
|----------|--------|--------|------|
| A 画座位图 | `seatState[]`（按 scheduleId） | A→`drawSeatMap()` | 需要暴露 `getSeatStateBySchedule(scheduleId)` |
| A 选座结果 | `selectedSeatIds` | C→创建订单 | seatIds 数组 |
| B 跑推荐 | `seatState[]` + `hall` | B→推荐算法 | B 需要知道哪些座位已售 |
| B 推荐结果 | `recommendedSeatIds` | C→可一键预订 | 作为 `createOrder` 的 seatIds 参数 |
| D 订单中心 UI | `getOrders()` | D→`renderOrders()` | 区分普通用户/管理员 |
| D 登录 UI | `login()` / `register()` / `getCurrentUser()` | D→登录/注册表单 | C 只管底层，UI 由 D 实现 |
| D 热度图 UI | `getHeatMapBySchedule()` | D→Canvas 热度图 | heatScore 0~1，颜色映射由前端做 |

---

## 五、风险与注意事项

1. **LocalStorage key 冲突**：严格按照 `smartcinema_*` 前缀，不自行发明 key。
2. **字段变更流程**：任何涉及 data-schema.md 的改动，先更新文档 → 微信群通知 → 再改代码。
3. **座位 ID 规则**：统一 `排号-座位号`（如 `F-8`），不可自行修改编号规则。
4. **`remainingSeats` 不手动维护**：必须由座位实时状态计算得出，否则会与 seatState 不一致。
5. **锁票超时**：锁票是前端模拟，页面关闭后定时器失效；需要在页面初始化时重新检查过期订单并释放。
6. **管理员权限**：不新建独立后台页面（除非 D 后续安排），在 Store 里暴露 `isAdmin()` 供 D 判断渲染权限即可。
7. **密码明文存储**：仅用于课程作业模拟，不做加密处理。