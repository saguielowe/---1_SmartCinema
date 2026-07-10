# Git 协作约定

目标：降低互相改代码和合并冲突的概率。

## 分支怎么开

- `main`：始终保持可运行
- A：`feature/canvas-seatmap`
- B：`feature/recommendation`
- C：`feature/order-storage`
- D：`feature/ui-accessibility`
- `docs/*`：文档相关改动

## 基本原则

1. 不直接在 `main` 上堆未完成代码
2. 每个人先从 `main` 拉自己的功能分支，在自己的分支上开发；完成一个可演示的小功能后再提交和合并
3. 公共字段改动先更新 `docs/data-schema.md`
4. 合并前先自己跑通对应功能

## 推荐提交信息

```txt
feat: add initial hall schema
feat: implement recommendation rules
fix: sync seat state after booking
docs: update collaboration notes
style: refine accessibility theme
```

## 模块改动前先同步的内容

- 改字段名
- 改座位 id 规则
- 改 LocalStorage key
- 改推荐输入输出结构

这些变动不要只在微信里说，优先改仓库文档。

## 建议的协作节奏

1. 先定字段与接口
2. 各自并行开发
3. 至少每周同步一次当前进度
4. 合并前先处理冲突再联调

## 文档更新原则

- 微信只发提醒和结论
- 详细规范以仓库文档为准
- 后续若字段调整，尽量追加说明，不要无痕改动

## 每个人要留下什么

不用每个人各写一份正式报告，但每人负责的模块都要留下一页短记录，放在 `docs/contributions/`：

| 模块 | 分支 | 记录文件 |
| --- | --- | --- |
| A：选座组件 | `feature/canvas-seatmap` | `docs/contributions/a-seat-map.md` |
| B：推荐与评分 | `feature/recommendation` | `docs/contributions/b-recommendation.md` |
| C：账号与订单 | `feature/order-storage` | `docs/contributions/c-order-storage.md` |
| D：页面整合 | `feature/ui-accessibility` | `docs/contributions/d-ui-accessibility.md` |

每次模块做到一个阶段时，顺手补四件事：做了什么、改了哪些文件、怎么手动测试、遇到的问题和最后怎么处理。这样最后写报告时不用翻提交记录猜。

## AI 使用记录怎么记

- 每个人只记录自己实际用过的 AI：工具/模型、用来做什么、采纳了什么、自己改了什么。
- 先把一两句事实追加到 `docs/ai-usage-report.md` 的“成员记录”里，不写空泛的“AI 提高效率”。
- D 在提交前把四个人的记录合并到 `report.pdf`，统一补上参考资料和最终设计判断。
