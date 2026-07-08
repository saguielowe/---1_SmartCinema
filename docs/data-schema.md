# 字段设计

这份文档的目的不是一次性穷尽所有字段，而是先把核心实体统一，避免各模块各写一套。

## 约定

- 字段名先统一使用英文
- 枚举值尽量小写
- 时间先允许使用简单字符串或时间戳
- 后续可以扩展字段，但尽量不随意改已有字段名

## 用户 `user`

```js
{
  userId: "u001",
  username: "testUser",
  password: "123456",
  role: "user", // user | admin
  accessibilityMode: {
    largeText: false,
    highContrast: false,
    colorBlindFriendly: false,
    voicePrompt: false
  },
  preferences: {
    preferCenter: true,
    preferBack: false,
    preferAisle: false
  }
}
```

## 电影 `movie`

```js
{
  movieId: "m001",
  title: "Interstellar",
  duration: 169,
  poster: "assets/posters/interstellar.jpg",
  tags: ["sci-fi", "adventure"],
  showType: "imax", // 2d | 3d | imax
  rating: 9.3,
  language: "en"
}
```

建议最少准备 3 到 5 部电影，方便演示不同场次。

## 场次 `schedule`

```js
{
  scheduleId: "s001",
  movieId: "m001",
  hallId: "hall-imax",
  date: "2026-07-10",
  startTime: "19:30",
  endTime: "22:19",
  price: 58
}
```

## 影厅 `hall`

```js
{
  hallId: "hall-imax",
  hallName: "IMAX厅",
  hallType: "imax", // small | medium | large | imax
  screenLabel: "银幕",
  rows: [
    { rowLabel: "A", pattern: "XXSSSSAASSSSXX", offsetX: -8, curveDepth: 8 },
    { rowLabel: "B", pattern: "XSSSSSAASSSSSX", offsetX: -4, curveDepth: 8 },
    { rowLabel: "C", pattern: "SSSSSSAASSSSSS", offsetX: 0, curveDepth: 8 }
  ]
}
```

### `pattern` 字符约定

- `S`：普通座位
- `A`：过道
- `X`：空缺 / 不可坐
- `W`：无障碍座位

后面如果确实需要再扩展，不要先引入一堆没人用的类型。

### 渲染字段说明

- `rowLabel`：排号
- `pattern`：这一排的结构
- `offsetX`：整排横向偏移，帮助做斜走道或左右不对称
- `curveDepth`：这一排的弯曲程度，值越大弧度越明显

## 座位状态 `seatState`

```js
{
  scheduleId: "s001",
  seatId: "C-8",
  status: "available" // available | selected | reserved | sold
}
```

说明：

- `selected` 更适合作为前端临时状态
- 如果想让持久化更清晰，也可以只存 `available / reserved / sold`

## 推荐输入 `recommendationInput`

```js
{
  ticketType: "couple", // single | couple | family | group
  peopleCount: 2,
  ages: [21, 22],
  preferences: {
    preferCenter: true,
    preferBack: true,
    preferAisle: false,
    accessibilityNeeded: false
  }
}
```

### 补充说明

- `single`：个人票
- `couple`：情侣票
- `family`：家庭票
- `group`：团体票

如果做表单简化版，也至少要保留 `ticketType + peopleCount + ages`。

## 推荐输出 `recommendationResult`

```js
{
  recommendedSeatIds: ["F-8", "F-9"],
  fallbackSeatIds: ["G-8", "G-9"],
  score: "excellent", // excellent | good | normal
  reasons: ["中后排视角更舒适", "座位连续且靠近中心区域"]
}
```

## 订单 `order`

```js
{
  orderId: "o001",
  userId: "u001",
  scheduleId: "s001",
  seatIds: ["F-8", "F-9"],
  status: "booked", // booked | cancelled | purchased | refunded
  createdAt: 1780000000000
}
```

## 热度 `heatMapData`

```js
{
  scheduleId: "s001",
  seatId: "F-8",
  heatScore: 0.82
}
```

说明：

- `heatScore` 建议标准化到 `0 ~ 1`
- 热度图颜色可再由前端按区间映射

## 建议的 LocalStorage key

```txt
smartcinema_users
smartcinema_movies
smartcinema_schedules
smartcinema_halls
smartcinema_orders
smartcinema_seat_state
smartcinema_current_user
```

## 当前接口边界

### A 需要的最小输入

- `hall`
- `seatState`
- `recommendedSeatIds`

### B 需要的最小输入

- `recommendationInput`
- `hall`
- `seatState`

### C 需要维护的最小状态

- 用户信息
- 当前登录状态
- 订单信息
- 当前场次座位状态
- 热度数据
