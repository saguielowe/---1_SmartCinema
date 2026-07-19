# A：Canvas 选座组件记录

## 当前进度

- 已完成第一版 Canvas 交互选座与 C 模块座位状态接线。
- 开发分支：`feature/canvas-seatmap`。
- 推荐算法和确认下单按钮不属于本模块，本模块只输出选择结果。

## 本次完成

- 根据 C 的 `hall.rows[].pattern` 和 `seatState` 绘制三种影厅。
- 修复座位编号：`X`（空白）和 `A`（过道）不计入编号，与 C 的 `generateSeatState()` 一致。
- 桌面普通点击替换当前编辑座位，Ctrl/Cmd + 点击增删多选。
- 支持 Ctrl/Cmd + 拖动批量增删座位；移动端直接点击增删。
- `sold` / `reserved` 座位不可选择。
- 按购票人数限制最多选择数量。
- 切换场次时清空选择并重置键盘焦点。
- 支持方向键移动焦点、Enter/空格选择。
- 显示当前指向座位编号，解决大厅座位密集时编号难以辨认的问题。
- 每个影厅后排靠过道提供两个 `W` 无障碍座位，并使用蓝色双圈标识。
- 选座数量等于人数时启用“确认座位”按钮，提交标准事件给 D。
- 接收 B 的 `highlightedSeatIds` 并以青色光圈高亮。
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
window.__seatSelection.clear();
```

D 模块确认人数与登录状态后，把结果传给 C：

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
3. 大厅/中厅/小厅分别显示来自 C 的 320/220/130 条座位状态。
4. 默认人数为 2：普通点击新座位替换当前编辑座位，Ctrl/Cmd + 点击追加第二席，第三席被人数上限拦截。
5. 选满两席后“确认座位”按钮启用；取消一席后重新禁用。
6. 切换场次后选择清空，再次操作从当前影厅第一个可用座位开始。
7. 聚焦 Canvas 后使用方向键移动，按 Enter 替换，Ctrl/Cmd + Enter 多选；座位提示同步更新。
8. 三个影厅 J 排靠过道位置均应显示两个带蓝色双圈和 `W` 标识的无障碍座位。
9. 点击“显示推荐位置”后，B 返回且当前可用的推荐座位显示青色光圈。

## 已知待办

- D 模块需要增加正式登录、确认购票、支付/取消/退款 UI。
- B 模块需要用真实场次、人数、偏好和座位状态替换当前固定推荐结果。
- C 模块的影厅 `capacity` 字段与 pattern 实际座位数不一致，A 当前以 `seatState.length` 为准。
