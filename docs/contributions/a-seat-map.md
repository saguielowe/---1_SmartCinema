# A：Canvas 选座组件记录

## 当前进度

- 已完成 Canvas 交互选座、热度展示、游客购票主流程与 C 模块状态接线。
- 开发分支 `feature/canvas-seatmap` 已在提交 `93399d5` 快进合入 `dev`。
- 支付、取消、退票和订单卡片已有可运行版本；D 继续完成正式登录入口和大量订单场景的页面整合。

## 本次完成

- 根据 C 的 `hall.rows[].pattern` 和 `seatState` 绘制三种影厅。
- 修复座位编号：`X`（空白）和 `A`（过道）不计入编号，与 C 的 `generateSeatState()` 一致。
- 桌面普通点击替换当前编辑座位，Ctrl/Cmd + 点击增删多选。
- 支持 Ctrl/Cmd + 拖动批量增删座位；移动端直接点击增删。
- `sold` / `reserved` 座位不可选择。
- 按购票人数限制最多选择数量。
- 场次无默认值；选择场次后立即按人数、票种和偏好推荐并选中座位。
- 个人/情侣/家庭/团体票默认人数分别为 1/2/3/4；情侣票手改人数时自动回退个人票，人数不设固定上限。
- 无障碍模式默认切换为后排优先，普通模式默认中间区域优先。
- 支持方向键移动焦点、Enter/空格选择。
- 显示当前指向座位编号，解决大厅座位密集时编号难以辨认的问题。
- 每个影厅后排靠过道提供两个 `W` 无障碍座位，并使用始终可见的蓝色 `W` 徽标。
- 推荐座位圆本体在绿色与橙色之间呼吸闪烁；人数、票种或偏好变化时自动刷新。
- B 推荐只保留占位接口；清空占位后，普通点击替换、Ctrl/Cmd + 点击增删多选均由 A 独立维护，不再触发自动补座。
- 热度由已支付/锁定订单形成热源向邻座扩散，并叠加中间排和中间列位置权重；Canvas 底色严格使用蓝色冷门、黄色一般、红色热门。
- 支持选择本场放映日前一周的任意日期；订单热源按日期逐步加入，Canvas 动态重绘一周内的热度变化。
- 热度默认隐藏，通过“显示热度”开关按需叠加，避免热度色与座位状态色同时干扰选座。
- 选座数量等于人数时启用“确认座位”按钮，提交标准事件给 D。
- “确认座位”直接调用 C 的 `createOrder()` 锁票并重绘 Canvas；支付对话框调用 `payOrder()` 或 `cancelOrder()`。
- 个人订单中心在锁票、支付、取消后立即更新；订单持久化到 C 的 LocalStorage，管理员登录后可查看全量订单。
- 订单中心使用卡片展示影片、场次、影厅、座位、金额、状态、下单时间和取票码，并按状态提供支付、取消或退票操作。
- 推荐结果同时写入 `highlightedSeatIds` 和 `selectedSeatIds`，用户可直接确认。
- 通过自定义事件和公开接口输出 `selectedSeatIds`。

## A → D/C 对接接口

页面可监听：

```js
window.addEventListener("smartcinema:seat-selection-change", (event) => {
  const { scheduleId, selectedSeatIds } = event.detail;
});

window.addEventListener("smartcinema:seat-selection-submit", (event) => {
  const { scheduleId, selectedSeatIds, ticketType, peopleCount } = event.detail;
});
```

也可读取：

```js
window.__seatSelection.getScheduleId();
window.__seatSelection.getSelectedSeatIds();
window.__seatSelection.refreshRecommendation();
```

当前 `app.js` 已按以下方式把选择结果传给 C；D 整合页面时保持参数结构即可：

```js
store.createOrder({
  scheduleId,
  seatIds: selectedSeatIds,
  ticketType,
  peopleCount,
});
```

## 改动文件

| 文件 | 说明 |
| --- | --- |
| `03_源码/js/seat-map.js` | 可交互 Canvas、统一编号、命中检测、键盘操作和选择接口 |
| `03_源码/js/app.js` | 场次切换、人数限制、A/C 数据接线和选择结果输出 |
| `03_源码/index.html` | 场次、选择结果、座位提示和完整图例 |
| `03_源码/css/style.css` | 选择状态栏、锁定图例和焦点样式 |

## 功能验收

1. 打开 `http://localhost:8080/index.html`。
2. 场次列表应显示 12 个场次，可切换大/中/小厅。
3. 小厅/中厅/大厅均显示 A-J 共 10 排，每排分别为 10/20/30 座，总数严格为 100/200/300。
4. 初始场次为空，票种、人数和偏好已有默认值；确认座位按钮禁用。
5. 选择任一场次后应立即出现推荐座位，确认座位按钮直接启用。
6. 修改人数、票种或偏好后，推荐座位和说明应自动刷新，无需点击推荐按钮。
7. 清空推荐占位后，点击选择第一席，Ctrl/Cmd + 点击或 Ctrl/Cmd + Enter 可继续多选，不应被自动推荐覆盖。
8. 三个影厅最后一排靠过道位置均应显示两个蓝色方形 `W` 无障碍座位。
9. 热度默认隐藏；点击“显示热度”后，底色应按蓝/黄/红体现冷门/一般/热门，并支持切换一周日期动态重绘。
10. 确认座位后座位应先变为锁定并弹出支付对话框；支付后变已售，取消后恢复可选，订单中心同步更新。

## 已知待办

- D 模块需要增加正式登录/注册入口，并处理大量订单的分页、筛选或独立订单页；现有支付/取消/退款 UI 可作为接线基础。
- B 模块可继续把演示评分函数替换成正式推荐策略；A/C 接口无需变化。
