# 当前分工与对接

这份是当前的工作边界和接入状态。A/B/C/D 的基础功能均已进入 `dev`；A 在 `feature/admin-dashboard` 上继续完成管理员场次运营台增强。

| 模块 | 主要工作 | 主要文件 | 交付给谁 |
| --- | --- | --- | --- |
| A：选座与运营台（后台增强待合并） | Canvas 座位图、弧形排布、单选/Ctrl 多选、推荐高亮；管理员场次概览、只读座位图、场次订单与跨场比较 | `js/seat-map.js`、`js/admin-dashboard.js`、`js/app.js`、`index.html`、`css/style.css` | 选座结果与可演示的管理员运营视图 |
| B：推荐与评分（已合入 `dev`） | 连座搜索、年龄限制、推荐理由、体验评分 | `js/recommendation.js` 或独立模块 | `recommendationResult` 给 A 和 D |
| C：账号与订单（已合入 `dev`） | 注册登录、游客会话、LocalStorage、订单、锁票、热度数据 | `js/store.js`、`js/mock-data.js` | 座位状态、订单和热度数据给 A/B/D |
| D：页面整合（已合入 `dev`） | 正式登录页、订单中心、响应式、无障碍、问答顾问、拖拽动画、实时同步、联调和文档收口 | `index.html`、`css/style.css`、`js/app.js`、`js/advisor.js`、`js/realtime.js` | 可演示的完整流程 |

## 先对齐的三件事

1. 座位 ID 统一为 `排号-座位号`，例如 `F-8`；不要在模块里另造一套编号。
2. 字段和 LocalStorage key 以 [数据约定](./data-schema.md) 为准。需要新增字段时，先在这里留一句说明。
3. 公共文件有冲突时，先在自己的分支完成模块逻辑，再由 D 或当周负责联调的人接入 `app.js`。

## 当前接入状态

1. C 已提供 100/200/300 座、均为 10 排的三套影厅，以及场次、座位状态、游客会话和订单 Store。
2. A 已完成 Canvas、手动选座、热度开关、支付对话框和 C 接线。
3. B 从 `store.getSeatStateBySchedule()` 等公共接口读取数据，输出标准座位 ID、体验评分和推荐理由，不直接修改 Canvas/订单状态。
4. D 已完成正式登录/注册、管理员视图、订单分页/筛选、三步流程、响应式、无障碍、问答顾问、连续拖选、WebSocket 模拟和个性化主题；Canvas 配色与远端状态通过 A 的组件参数接入。
5. A 已在 D 的管理员账号与订单视图基础上新增按场次运营后台：管理员不再填写观影需求，改为查看场次信息、只读座位图、该场订单和全部场次比较。

## 分支约定

- `main`：只放可以打开演示的版本。
- 功能分支可用 `feature/canvas-seatmap`、`feature/recommendation`、`feature/order-storage`、`feature/ui-accessibility`、`feature/admin-dashboard`。
- 改公共字段、座位 ID、LocalStorage key 或推荐输入输出时，同步更新 `docs/`；微信群只发结论和链接即可。
- 各模块阶段性完成后，在 `docs/contributions/` 补一页短记录，并把实际用过的 AI 工具和人工修改补到 `docs/ai-usage-report.md`。
