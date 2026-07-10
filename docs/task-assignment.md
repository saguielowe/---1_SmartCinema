# 当前分工与对接

这份是当前的工作边界，不是固定的人事安排。大家认领后只要在群里说一声，并在这里把负责人补上即可。重点是少互相踩文件、少在最后几天改字段。

| 模块 | 主要工作 | 主要文件 | 交付给谁 |
| --- | --- | --- | --- |
| A：选座组件 | Canvas 座位图、弧形排布、单选/Ctrl 多选、推荐高亮 | `js/seat-map.js` | `selectedSeatIds` 给 C 和 D |
| B：推荐与评分 | 连座搜索、年龄限制、推荐理由、体验评分 | `js/recommendation.js` | `recommendationResult` 给 A 和 D |
| C：账号与订单 | 注册登录、LocalStorage、订单、锁票、热度数据 | `js/store.js` | 座位状态、订单和热度数据给 A/B/D |
| D：页面整合 | 注册页和选座页 UI、响应式、无障碍、联调和文档收口 | `index.html`、`css/style.css`、`js/app.js` | 可演示的完整流程 |

## 先对齐的三件事

1. 座位 ID 统一为 `排号-座位号`，例如 `F-8`；不要在模块里另造一套编号。
2. 字段和 LocalStorage key 以 [数据约定](./data-schema.md) 为准。需要新增字段时，先在这里留一句说明。
3. 公共文件有冲突时，先在自己的分支完成模块逻辑，再由 D 或当周负责联调的人接入 `app.js`。

## 建议的接入顺序

1. C 先提供三套预设影厅、场次和座位状态的 mock 数据；每套影厅允许不同排座位数。
2. A 按 `hall + seatState` 画出座位图，并把点击结果交给 `selectedSeatIds`。
3. B 用同一份影厅和座位状态跑推荐，输出推荐座位和理由。
4. D 串起“选场次 - 推荐/手动选座 - 确认购票”，最后补响应式和无障碍模式。

## 分支约定

- `main`：只放可以打开演示的版本。
- 功能分支可用 `feature/canvas-seatmap`、`feature/recommendation`、`feature/order-storage`、`feature/ui-accessibility`。
- 改公共字段、座位 ID、LocalStorage key 或推荐输入输出时，同步更新 `docs/`；微信群只发结论和链接即可。
- 各模块阶段性完成后，在 `docs/contributions/` 补一页短记录，并把实际用过的 AI 工具和人工修改补到 `docs/ai-usage-report.md`。
