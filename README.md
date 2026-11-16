# 《光锥之外》

一款围绕**银河系尺度（直径约 100,000 光年）**、**人类文明真实演化跨度**与**光速因果限制**构建的慢节奏星际文明演化与巡天模拟游戏。

全服共处于一座**长期运行、不强制清档的 100,000 光年扁平旋臂银河系**（划分 **`2,700` 个可编址宏观星域** `SEC-R00..R24-A00..A35-ZS/ZM/ZN`，由子细胞哈希按需推导 $\sim 1.5\times 10^{11}$ 颗程序化恒星并按稀疏增量持久化，可容纳万级活跃文明席位）。除时间流速锁死为全服唯一倍率 **`1 现实分钟 = 1.00 模拟年`**（$1\ \mathrm{ly}$ 光行时间 $\equiv 1\ \mathrm{real\ min}$）外，恒星间距、星域诞生权重与物理不稳定性（银心核球高危低生、旋臂宜居带低危高生、外盘稀疏静默）、信号衰减与文明演进跨度严格对齐物理事实与人类历史。

文明从单行星摇篮起步，在统一物理规律与连续星域天灾／内源高能生物圈自毁风险（`SDI` 与依星域不稳定性及恒星物理导出的 `B1–B4`，人机同律）下通过多行星建设与 **$0.10c$ 定向星际远征**构建离散恒星网络；文明发出的电磁波、中微子与引力波则以 **$1.00c$ 扩散衰减直至消散的多信使信号波壳**形态在银河中传播。支持全速离线演进（`allocation_plan` 托管计划、5 槽 `build_queue` 建造队列与 3 槽确定性 L1 哨兵规则）。若文明灭亡，原地留存物理遗迹与既建 `信标 Lv.4` 设施，玩家查收灭亡简报后即可另选摇篮重开。

---

## 文档与工程目录

| 分类 | 内容 | 入口 |
| --- | --- | --- |
| **核心游戏设计** | 世界尺度、离散星网、多信使波壳、生产力曲线、SDI 与 B1–B4 天灾规则 | [GDD v0.17.0](DESIGN.md) |
| **技术架构** | 银河系万级分片架构、浮动原点、海外 Web-First + OIDC 登录与移动辅端 | [技术架构](docs/specs/ARCHITECTURE.md) |
| **席位契约** | 同口径只读投影、局部 $SO(3)$ 坐标系、10 项幂等指令与 L1 / Agent 边界 | [席位契约规格（v0.17.0）](docs/specs/SEAT-CONTRACT.md) |
| **首个开发切片** | 4 光年定向远征场景、双视角交互流程与 M1–M2 自动化验收 | [M1–M2 开发规格](docs/specs/M1-M2-FRONTIER.md) |
| **界面与视听规范** | 航天遥测 HUD 布局、配色与面积配比、确定性图形语法与 `zh-CN`/`en` 双语规范 | [美学设计（Art Direction v0.3）](docs/specs/AESTHETICS.md) |
| **当前实施基线** | 当前仓库代码边界、M1/M2 已实现范围与延后项说明 | [框架实施基线](docs/implementation/FOUNDATION.md) |
| **静态官网与游玩说明** | 独立官网目录（含登录、注册、进入游戏、iOS/安卓下载预留路由及 `/guide/` 游玩说明） | [官网目录](website/README.md) |
| **数值标定** | 人类历史生产力经验拟合、全席位统一大过滤器标定与 6 联曲线 | [数值标定说明](scripts/calibration/README.md) |
| **历史归档与复审** | 早期设计稿、延迟规格与设计复审记录 | [v0.9.3-lean](docs/archive/GDD-v0.9.3-lean.md) · [MCP v0.14.0](docs/archive/MCP-v0.14.0-deferred.md) · [v0.17.0 复审](docs/reviews/GDD-v0.17.0-review.md) · [v0.16.0 复审](docs/reviews/GDD-v0.16.0-review.md) · [v0.13.0 复审](docs/reviews/GDD-v0.13.0-civ-growth-math-review.md) · [v0.9.2 复审](docs/reviews/GDD-v0.9.2-review-and-revision-plan.md) · [v0.9.1 复审](docs/reviews/GDD-v0.9.1-review.md) · [v0.9.1](docs/archive/GDD-v0.9.1.md) · [MCP v0.9.3](docs/archive/MCP-v0.9.3-lean.md) |

---

## 代码目录结构

- `packages/sim-core`：无 UI/网络依赖的确定性仿真内核（双时钟、定向远征、波壳衰减、队列与事件队列）。
- `packages/contracts`：席位视图 Schema、幂等指令信封与运行时校验（投影实现位于 `sim-core` 的 `projectSeat`）。
- `packages/database`：PostgreSQL 稀疏增量持久化迁移与事务仓储。
- `packages/ui-tokens` / `packages/i18n`：CSS 与 Three.js 共用的视觉令牌、`zh-CN`/`en` 双语字典。
- `apps/game-server`：Fastify HTTP/API 边界与开发鉴权适配器（M3 扩展为 OIDC / WSS 分片网关）。
- `apps/web-client`：Web-First 主端（TypeScript + Three.js WebGL2 浮动原点 + 响应式 HUD）。
- `apps/sim-cli` / `scenarios/m1`：M1 确定性时间线夹具与命令行复跑；`scripts/export-web-fixtures.mjs` 将 `artifacts/m1/*.json` 导出到 `apps/web-client/public/fixtures/` 供离线回放。
- `infra/compose.yaml`：本地 PostgreSQL + Redis（Redis 仅预留）；`.github/workflows/check.yml` 跑 `pnpm check`；`.env.example` 列出 `DEV_AUTH_*` 与 `DATABASE_URL` 约定（生产 fail-closed）。
- `apps/capacitor-shell`：M4 iOS / Android 原生壳端预留目录。
- `website/`：独立静态官网与玩法说明站点（零构建依赖，可直接静态托管）。
