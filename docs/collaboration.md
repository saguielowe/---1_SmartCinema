# Git 协作约定

目标：降低互相改代码和合并冲突的概率。

## 分支建议

- `main`：始终保持可运行
- `feature/canvas-seatmap`
- `feature/recommendation`
- `feature/order-storage`
- `feature/ui-accessibility`
- `docs/*`：文档相关改动

## 基本原则

1. 不直接在 `main` 上堆未完成代码
2. 每个模块尽量单独分支开发
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
3. 每天同步一次当前进度
4. 合并前先处理冲突再联调

## 文档更新原则

- 微信只发提醒和结论
- 详细规范以仓库文档为准
- 后续若字段调整，尽量追加说明，不要无痕改动
