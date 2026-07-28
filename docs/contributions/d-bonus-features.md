# D：加分功能实现记录

## 完成内容

- 新增本地问答式观影顾问，识别人数、票种、儿童、老人、无障碍、视角、噪音和进出便利诉求。
- 自动把自然语言转换成现有推荐算法参数，并输出视角、噪音、便捷性与成员规则理由。
- 将 Ctrl/Cmd 拖选改为基于起点和终点的完整区间选择，修复快速拖动漏座。
- 增加 Canvas 选择/取消扩散动画，并兼容“减少动画”设置。
- 新增原生 WebSocket 客户端和 Python 标准库服务端，广播临时选座、场次切换和离开状态。
- 自动推荐和手动选座均会排除其他观众正在选择的座位。
- WebSocket 不可用时使用 BroadcastChannel 完成本机多标签模拟。
- 增加午夜青、星河紫、暖金幕三套个性化主题。
- 强化大字体、高对比度和 Canvas 标签的实际视觉差异。

## 新增文件

- `03_源码/js/advisor.js`
- `03_源码/js/realtime.js`
- `scripts/realtime-server.py`
- `04_测试与验收/advisor.test.mjs`
- `04_测试与验收/accessibility-settings.test.mjs`
- `04_测试与验收/requirements-static.test.mjs`
- `04_测试与验收/seat-map-drag.test.mjs`
- `04_测试与验收/realtime-websocket.test.mjs`
- `04_测试与验收/功能要求审查报告.md`

## 主要修改文件

- `03_源码/index.html`
- `03_源码/css/style.css`
- `03_源码/js/app.js`
- `03_源码/js/seat-map.js`
- `03_源码/js/store.js`
- `scripts/start-preview.ps1`
- `README.md`

## 验收摘要

- 四口之家能正确解析为 4 人，不再按家庭默认 3 人处理。
- 相同需求在两个实时页面中分别推荐 `G-12～G-15` 与 `G-16～G-19`，没有冲突。
- 1440×900、1024×768、390×844 均无页面级横向溢出。
- 浏览器实时测试页面均无 JavaScript error。
- 三项自动化回归测试全部通过。
