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
  nickname: "子嘉",
  createdAt: 1780000000000,
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

说明：

- 当前注册建议先简化为 `username + password`
- `nickname` 可选，没有时间可以不做
- 不必为了这次作业单独做邮箱验证

## 电影 `movie`

```js
{
  movieId: "m001",
  title: "Interstellar",
  duration: 169,
  poster: "assets/posters/interstellar.jpg",
  tags: ["sci-fi", "adventure", "可自行添加"],
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
  price: 58,
  remainingSeats: 86,
  status: "on_sale" // on_sale | closed
}
```

## 影厅 `hall`

```js
{
  hallId: "hall-imax",
  hallName: "IMAX厅",
  hallType: "imax", // small | medium | large | imax
  capacity: 120,
  rowCount: 8,
  screenLabel: "银幕",
  rows: [
    { rowLabel: "A", pattern: "XXSSSSAASSSSXX", offsetX: -8, curveDepth: 8 },
    { rowLabel: "B", pattern: "XSSSSSAASSSSSX", offsetX: -4, curveDepth: 8 },
    { rowLabel: "C", pattern: "SSSSSSAASSSS", offsetX: 0, curveDepth: 8 } // 居中布局，每排座位数允许不一样。
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
  status: "available", // available | selected | reserved | sold
  userId: "",
  orderId: "",
  lockedUntil: null,
  updatedAt: 1780000000000
}
```

说明：

- `selected` 更适合作为前端临时状态
- 如果想让持久化更清晰，也可以只存 `available / reserved / sold`
- `reserved` 表示锁票 / 已预订但未最终购票
- `lockedUntil` 用来做假支付场景下的锁票倒计时

## 推荐输入 `recommendationInput`

```js
{
  ticketType: "couple", // single | couple | family | group
  peopleCount: 2,
  ages: [21, 22],
  selectedMovieId: "m001",
  selectedScheduleId: "s001",
  needAccessibility: false,
  passengers: [
    { name: "Alice", age: 21 },
    { name: "Bob", age: 22 }
  ],
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
- 可以通过 `passengers` 自动判断是否有儿童或老人
- 建议把“儿童/老人判断”放在年龄规则里，而不是额外拆出很多票种

如果做表单简化版，也至少要保留 `ticketType + peopleCount + ages`。

## 推荐输出 `recommendationResult`

```js
{
  recommendedSeatIds: ["F-8", "F-9"],
  fallbackSeatIds: ["G-8", "G-9"],
  score: "excellent", // excellent | good | normal
  reasons: ["中后排视角更舒适", "座位连续且靠近中心区域"],
  recommendedArea: "middle-back",
  warnings: []
}
```

## 订单 `order`

```js
{
  orderId: "o001",
  userId: "u001",
  scheduleId: "s001",
  seatIds: ["F-8", "F-9"],
  ticketType: "couple",
  peopleCount: 2,
  totalPrice: 116,
  status: "booked", // booked | cancelled | purchased | refunded
  paymentStatus: "pending", // pending | paid | closed
  paymentMethod: "mock", // mock
  createdAt: 1780000000000,
  updatedAt: 1780000005000,
  expiresAt: 1780000900000
}
```

说明：

- `booked` 对应“已预订 / 已锁票”
- `purchased` 对应“假支付成功后完成购票”
- `expiresAt` 用于预订超时自动释放座位
- 不需要接真实支付，做一个假支付确认页或弹窗即可

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
smartcinema_heat_map
```

## 推荐的锁票机制

为了让“预订”和“支付”流程更像真实系统，建议统一成下面这套简单机制：

1. 用户点“预订”
   - 创建 `order`
   - 对应座位 `status` 变成 `reserved`
   - 写入 `userId / orderId / lockedUntil`

2. 用户点“支付”
   - 不接真实支付
   - 可以弹出一个假支付面板
   - 点击“确认支付”后，把 `order.paymentStatus` 置为 `paid`
   - 把座位 `status` 从 `reserved` 改成 `sold`

3. 用户取消或超时
   - 把 `order.status` 改成 `cancelled`
   - 把座位恢复成 `available`
   - 清空 `userId / orderId / lockedUntil`

## 页面与权限建议

### 普通用户

- 登录 / 注册
- 选择电影和场次
- 查看余票
- 智能推荐
- 手动选座
- 预订 / 假支付 / 退票
- 查看“我的订单”

### 管理员

- 登录后台
- 查看全部订单
- 查看全部场次余票
- 查看热度统计
- 必要时调整订单或座位状态

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
- 锁票超时信息
