# B 模块接口说明：智能推荐与体验评分

本文档说明 `03_源码/js/recommendation.js` 对外提供的接口、推荐规则和评分实现方式，供 A 选座组件、C 数据模块和 D 页面整合联调用。

## 对外函数

### `recommendSeats(recommendationInput, { hall, seatState })`

根据购票信息、影厅布局和当前座位状态，返回推荐座位、备选座位、系统评分和推荐理由。

```js
import { recommendSeats } from "./js/recommendation.js";

const result = recommendSeats(
  {
    ticketType: "family",
    peopleCount: 3,
    ages: [40, 38, 12],
    passengers: [
      { name: "张三", age: 40 },
      { name: "李四", age: 38 },
      { name: "小张", age: 12 }
    ],
    preferences: {
      preferCenter: true,
      preferBack: true,
      preferAisle: false,
      accessibilityNeeded: false
    }
  },
  {
    hall,
    seatState
  }
);
```

兼容旧写法：`recommendSeats(input, hall, seatState)`。

### `evaluateViewingExperience(seatIds, { hall, seatState })`

只计算一组已知座位的系统体验评分，适合订单完成后或用户手动改选后复算评分。

```js
const score = evaluateViewingExperience(["F-5", "F-6", "F-7"], {
  hall,
  seatState
});
```

首页订单中心会在已支付订单上调用该接口复算“系统评分”，再与观众观影后的手动评分合成综合结果。

### `debugRecommendation(recommendationInput, { hall, seatState, schedule })`

返回适合肉眼查看的调试报告，包含文本版总结、候选座位 Top 列表和原始结果对象。

```js
const report = debugRecommendation(input, { hall, seatState, schedule });
console.log(report.text);
```

## 输入约定

### `recommendationInput`

核心字段沿用 `docs/data-schema.md`。

```js
{
  ticketType: "single", // single | couple | family | group
  peopleCount: 2,
  selectedScheduleId: "s001",
  preferenceMode: "none", // none | center | back | aisle
  ages: [21, 22],
  passengers: [
    { name: "张三", age: 21 },
    { name: "李四", age: 22 }
  ],
  needAccessibility: false,
  preferences: {
    preferCenter: true,
    preferBack: false,
    preferAisle: false,
    accessibilityNeeded: false
  }
}
```

说明：

- `single` 固定按 1 人搜索。
- `couple` 固定按 2 人连续座位搜索。
- `family` 按输入人数搜索，默认偏向中后排。
- `group` 默认 5 人，界面从个人票人数改为 2 人及以上时会自动切换为团体票；算法按实际人数搜索，最多支持 20 人。
- 年龄可以从 `passengers[].age` 或 `ages[]` 提供；两者都有时优先使用 `passengers`。
- `preferenceMode` 表示用户明确选择的座位偏好；`none` 不附加中区、后排或过道倾向。

### `hall`

使用公共影厅结构。推荐模块按 `pattern` 中的 `S/W` 生成座位，座位 ID 为 `排号-座位号`，座位号只统计真实座位，不统计 `A/X`。

### `seatState`

只推荐 `status` 为空或 `available` 的座位。`selected`、`reserved`、`sold` 都视为不可推荐。传入 `selectedScheduleId` 时，只读取该场次或未标场次的状态，避免不同场次互相影响。

## 输出约定

```js
{
  recommendedSeatIds: ["F-5", "F-6", "F-7"],
  fallbackSeatIds: ["E-5", "E-6", "E-7"],
  score: "excellent", // excellent | good | normal
  scoreLabel: "极佳", // 极佳 | 优秀 | 一般
  scoreValue: 85, // 0-100
  recommendedArea: "middle-back",
  reasons: [
    "家庭票已匹配 3 个同排连续空座。",
    "排距处于舒适观影区，既不过近也不过远。"
  ],
  warnings: ["含 15 岁以下少年，推荐已避开前三排。"],
  scoreDetails: {
    angle: 0.69,
    distance: 0.9,
    spacing: 1,
    preference: 0.96
  }
}
```

`fallbackSeatIds` 优先返回与首选不重叠的备选连座。没有满足规则的座位时，首选和备选均为空，并在 `warnings` 中说明原因。

## 推荐规则

- 少年：年龄 `< 15`，不推荐前三排。
- 老年人：年龄 `> 60`，不推荐最后三排。
- 情侣票：优先中间区域连续双座。
- 家庭票：优先中后排连续座位。
- 团体票：2 到 20 人，优先同排连续；若中央走道或已售座位使最长连座不足，则按相邻的多个连续座位区兜底推荐，并在 `warnings` 和 `reasons` 中说明拆分情况；票种下拉框选中团体票时默认 5 人。
- 有少年和老人同时出现时，同时应用两条年龄限制，只在中间可用排里搜索。
- 需要无障碍时，候选连座中至少包含一个 `W` 座位；该硬约束优先于年龄对应的前后排建议。

## 评分实现

系统评分为 0 到 100 分，最终映射为：

- `excellent / 极佳`：`>= 85`
- `good / 优秀`：`65 - 84`
- `normal / 一般`：`< 65`

当前权重：

| 指标 | 权重 | 实现方式 |
| --- | --- | --- |
| 视角 `angle` | 25% | 根据座位组中心点距离影厅中轴线的偏移计算，越靠中间越高 |
| 距离 `distance` | 25% | 根据平均排位与目标舒适排位的差值计算，后排偏好会把目标区后移 |
| 周边空位 `spacing` | 15% | 统计同排左右和前后相邻座位中仍可用的比例，空位越多干扰越少 |
| 偏好匹配 `preference` | 35% | 优先响应用户明确选择的中间、后排或过道偏好；无偏好时仅保留较弱的票种倾向 |

推荐理由直接来自这些评分项和规则命中情况，保证结果可解释，便于写入报告。

## 观众手动评分与综合结果

观众完成模拟支付后，订单中心会出现“观影评分”按钮。订单所属观众可以在观影后提交 1 到 5 分和一条可选短评，数据写入订单对象：

```js
viewerRating: {
  ratingValue: 4,
  comment: "视线清楚，旁边空位多",
  createdAt: 1780003600000,
  updatedAt: 1780003600000
}
```

综合结果采用：

```txt
综合评分 = 系统评分 * 70% + 观众评分折算值 * 30%
观众评分折算值 = ratingValue * 20
```

没有观众手动评分时，订单中心只展示系统评分作为临时综合结果，并提示“观影后可手动补充”。综合评分仍按 85 / 65 两个阈值映射为“极佳 / 优秀 / 一般”。

## 已知边界

- B 推荐模块只负责推荐和系统评分；观众手动评分由 C 的订单存储接口 `submitViewingRating()` 持久化，由首页 UI 计算并展示综合结果。
- 仅当可用座位总数仍不足、或无障碍/年龄等硬约束无法满足时，团体票才会没有结果；最长连座不足时会退化为多个相邻连续座位区。
- 推荐模块按公共字段约定编号；A 模块绘制和点击命中也应使用相同的 `排号-座位号` 规则。

## 调试方式

- 打开 `03_源码/debug-recommendation.html`，直接看文本结果。
- 浏览器 Console 调用 `window.__recommendationDebug.run()` 可得到同样的报告对象。
- 推荐结果和原因优先看 `report.text`，需要结构化数据时看 `report.result` 和 `report.candidates`。
- 首页 `index.html` 的订单中心可做人眼调试：完成一次选座和模拟支付后，已支付订单卡片会展示系统评分、观众评分、综合结果和评分原因；点击“观影评分”提交不同星级后，可直接观察综合结果如何变化。
