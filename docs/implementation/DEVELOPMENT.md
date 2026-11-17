# 本地运行与验证

要求 Node.js 22.12+、pnpm 10.15.1；联调后端需要 Docker 或 PostgreSQL 17。当前是 GDD v0.17.0 的 M1 基础框架，采用 `dispatch_expedition` / `set_node_coordination`，不包含完整 M1/M2 游戏功能。

## 只看前端回放

```sh
pnpm install --frozen-lockfile
pnpm dev:web
```

打开终端显示的 Vite 地址。该命令先从仿真核生成合法席位投影，再复制到 Web 静态目录；不需要数据库。派出远征后可暂停、拖动时间线、切换双语与视角。2639 秒仍只有 1 个确认节点，2640 秒变为 2；选择回执缺失分支后，2760 秒显示超时未确认。播放倍率不改变物理时钟。

## 数据库 → 后端 → 前端联调

```sh
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

已有 `.env` 时保留原文件，按示例补齐配置。数据库就绪后再迁移。Web 页面下方展开“开发服务连接”，输入 `.env` 中的 `DEV_AUTH_TOKEN`。令牌仅在浏览器内存中使用。后端默认监听 `127.0.0.1:3000`，Vite 将 `/api` 和 `/health` 代理给后端。若修改后端端口，也需同步 Vite 代理。

`GET /health/live` 为进程存活检查，`GET /health/ready` 为数据库检查。真实服务固定倍率演进，支持关闭浏览器后继续推进及重启恢复；在线模式无调速/重置接口。开发夹具只受理首次向 B 的远征，重复同幂等键返回原结果；seed 不清空已有世界。旧半径模型快照被明确拒绝，不会被悄悄清零。

数据库卷保留数据；停止用 `docker compose -f infra/compose.yaml stop`。Redis 当前只是基础设施预留。生产鉴权尚未接入，生产模式启动会拒绝运行开发适配器。

## 验证

新建空席位默认从 Tier 1 开始，先在“文明建设”面板扩建世界、升级存续，才能远征。旧存档保留原模式与进度，不自动改成新文明；`db:seed` 也不会重置它。无需数据库的成长复跑命令为 `pnpm sim:growth`，结果位于 `artifacts/growth/cold-start.json`（先升级存续的路线）和 `cold-start-risky.json`（低冗余远征后自毁的路线）。`pnpm sim:m1` 与前端本地回放继续保留原 4 ly Tier 2 协议夹具。

```sh
pnpm check
# 可选：使用独立、可写的测试数据库，不能指向生产库
TEST_DATABASE_URL=postgres://user:password@127.0.0.1:5432/test_stars pnpm test
```

`check` 执行全部 TypeScript 检查、单元/SQL测试、夹具生成及 Web 构建。无测试数据库时，3 项 PostgreSQL 集成测试明确跳过，PGlite SQL 测试照常执行。服务端和共享包当前直接通过 tsx 运行 TypeScript，其 build 脚本负责类型验证；Web 输出到 `apps/web-client/dist`。

K 成长与生产力随机过程已接入新建 Tier 1 席位；动态 SDI 已接入新席位的增长和建设面板；新建动态 SDI 文明已启用局部危机、冷战自毁、超载解列/护盾/崩解及灭绝报告。灭绝后停止增长与建设并拒绝新指令，尚无文明重开入口。v2–v6 旧存档保留原模式，不自动启用失稳；面板会标明。自然天灾、科技完整物理反馈与戴森/B4 毁伤仍待实现。真实 Tier 1 成长、建造/托管、L1、完整波壳观测投影、OIDC/WSS、分片及移动壳发布的状态见 [实施基线](FOUNDATION.md)。

## 本轮验证记录（2026-11-16）

- 全工作区 TypeScript 检查、31 项默认测试、CLI 时间线生成与 Web 构建通过。
- 在独立 PostgreSQL 17 测试实例补跑 3 项集成测试通过：迁移/seed 重跑、并发席位行锁、HTTP 并发幂等与重启恢复。
- 独立 Chromium 会话验证 2639/2640 秒节点确认边界、2760 秒缺回执超时、语言和视角切换不改变投影；375 px 窄屏和 1440 px 桌面无横向溢出。截图在本地 `output/playwright/`（不纳入 Git）。
- 修正天球仪初始朝向，使公开 B 星位于初始视野；时间线末端标签与 3000 秒/50 模拟年一致。
- 尚未完成 iOS Safari/Android 真机、Firefox、60 FPS/内存性能或完整 M2 三层观测验收。当前 Web 构建仍提示单个 JS chunk 超过 500 kB；压缩约 148 kB gzip，后续按渲染模块拆包。
