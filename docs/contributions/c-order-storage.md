# C：账号与订单记录

## 当前进度

- ✅ C 的公共数据、Store、订单、锁票、热度和持久化接口已完成，并已与 A 主流程联通。
- 原开发分支：`feature/order-storage`；当前集成基线为 `dev@93399d5`。
- 负责人：C

## 本次完成

### Mock 数据层（类别 A，6 项）
- 三套影厅（星光厅 100 座 / 银幕厅 200 座 / 巨幕厅 300 座，均为 10 排）
- 五部电影（星际穿越 / 流浪地球3 / 哪吒 / 奥本海默 / 蜘蛛侠）
- 十二个场次（横跨 4 天，覆盖三种影厅规模）
- 完整座位状态（`generateSeatState` + `generateAllSeatStates` + `allSeatStates`，12 场次共 2500 条）
- 预设游客、普通用户和管理员（guest + testuser/123456 + admin/admin123）
- 提供匿名化订单热源 `getSeatDemandBySchedule`，供前端计算动态扩散热度

### LocalStorage 持久化层（类别 B，4 项）
- `loadFromStorage` / `saveToStorage` / `removeFromStorage` 封装
- `initStore()`：首次运行写入 mock → LS，非首次从 LS 恢复（含登录会话 + 锁票定时器）
- 未检测到登录会话时自动使用 `guest` 游客账户，方便直接跑通选座、锁票、支付和订单流程；正式登录会覆盖游客会话。
- 细粒度 `persistUsers` / `persistOrders` / `persistSeatStates` / `persistHeatMaps` 自动同步
- `clearAllData()` 调试用清除

### 用户注册与登录（类别 C，5 项）
- `register(username, password)`：校验唯一 + 非空，成功自动登录
- `login(username, password)`：支持 user/admin 角色，LS 持久化会话
- `getCurrentUser()` / `isLoggedIn()` / `isAdmin()` / `logout()`

### 订单管理（类别 D，9 项）
- `createOrder`：创建订单 + 锁票（15 分钟超时），校验登录 + 座位可用 + 场次存在
- `payOrder`：模拟支付，booked→purchased，reserved→sold，热度 +0.05
- `cancelOrder` / `refundOrder`：取消/退票，释放座位，热度 -0.02
- `submitViewingRating(orderId, { ratingValue, comment })`：已支付订单提交或更新观众观影后手动评分
- `getOrders(filter?)`：普通用户只看自己，管理员全量，按 status/scheduleId 筛选
- `getOrderById(orderId)`
- 锁票超时自动释放 + 页面刷新后定时器恢复

### 座位状态管理（类别 E，4 项）
- `getSeatStateBySchedule` → 完整座位状态数组
- `getRemainingSeats` → 实时计算 available 数，不依赖 `schedule.remainingSeats`
- `updateSeatStatus` → 批量更新 + 立即持久化
- 所有订单操作自动同步 `smartcinema_seat_state`

### 热度数据（类别 F，5 项）
- 已支付订单权重 1，锁票订单权重 0.65；历史 sold/reserved 状态作为补充样本
- 每个订单座位作为热源，按排距和列距向周围座位衰减扩散
- 扩散需求占最终热度 58%，中间排/中间列位置权重占 42%
- 查询仍兼容 `getHeatMapBySchedule` + `getHeatMapByMovie`

### Store 整合（类别 G，4 项）
- `createStore()` 内整合全部 5 个子模块
- `functions.md §〇` 提供 A/B/D 三组接口速查（25+ 方法签名 + 调用示例）
- `app.js` 重构为新的 `store` 单例（`import { store } from "./store.js"`）
- `window.__store = store` 供 Console 调试

## 改动文件

| 文件 | 变更说明 |
|------|---------|
| `03_源码/js/mock-data.js` | 从 25 行占位→600+ 行完整 mock 数据（3 halls / 5 movies / 12 schedules / users / orders / heatMap / seatState 生成函数） |
| `03_源码/js/store.js` | 从 21 行占位→860 行完整 Store（B/C/D/E/F 全部接口 + LS 持久化 + 锁票定时器） |
| `03_源码/js/app.js` | 重构为新的 store 单例调用，接入 initStore + renderOrders + A 接线 |
| `03_源码/test-store.html` | 新建 visual cargo test 面板（4 区域 + 综合日志 + Full Flow 自动化） |
| `C_function_interface.md` | mock-data.js 导出、store.js 公共接口与对接速查 |
| `C_draft.md` | 历史开发规划（已归档说明，不作为当前状态依据） |
| `docs/contributions/c-order-storage.md` | 本文档 |

## 手动测试

1. 启动 Python HTTP 服务器：`cd 03_源码 && python -m http.server 8080`
2. 打开 `http://localhost:8080/test-store.html`
3. 测试流程：
   - 点击 **initStore()** → 验证 5 movies / 12 schedules / 3 halls / 2500 seats
   - 点击 **Check LS Data** → 验证 8 个 smartcinema_* key
   - Login（testuser/123456）→ SUCCESS
   - 选 s001，座 E-5,E-6 → Create Order → 验证 orderId / totalPrice / expires
   - Pay → 验证 booked→purchased + 座位 reserved→sold
   - Cancel / Refund → 验证座位释放
   - Run Full Flow → 自动化 5 步 verify
   - 热度区 → Show Heat Data / Overview / Update
4. Console 测试：`window.__store.login('testuser','123456')` 等

## 问题与处理

| 问题 | 处理 |
|------|------|
| `onclick` + `type="module"` 作用域问题（onclick 在模块执行前解析） | 全部改为 `addEventListener` 绑定 |
| `file://` 协议下 ES module import 被 CORS 阻止 | 通过 Python HTTP 服务器 `python -m http.server 8080` 访问 |
| `cancelOrderInternal` 中调用 `updateHeatScore`（store 方法，定义晚于内部函数） | 改为直接调用内部函数 `updateHeatScoreInternal` + `persistHeatMaps()` |
| `allMockData.seatStates` / `heatMaps` 初始仅含 s001 | 新增 `generateAllSeatStates()` / `generateAllHeatMaps()` 预生成全部 12 场次 |
| 向后兼容：`hallMock` / `seatStateMock` / `heatMapMock` 仍可用 | 保留旧引用指向新数据源 |
