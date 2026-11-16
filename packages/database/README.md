# 数据库基础层

PostgreSQL 17 是持久化真源。迁移只创建稀疏状态、世代、事件和身份数据；程序化恒星目录不落全库。Redis 是后续分片路由与缓存的基础设施预留，当前单核参考流程不依赖它。

在仓库根目录运行：

```sh
cp .env.example .env
docker compose -f infra/compose.yaml --env-file .env up -d
set -a
source .env
set +a
pnpm db:migrate
pnpm db:seed
```

`db:migrate` 使用会话 advisory lock 串行迁移，每个迁移在事务中提交，并校验历史 SQL 的 SHA-256。不要修改已应用的迁移，应新增文件。`db:seed` 只补齐固定开发账号、M1 纪元和席位，不重置任何状态；生产环境拒绝执行 seed。

开发 ID：epoch `00000000-0000-4000-8000-000000000001`、seat `00000000-0000-4000-8000-000000000002`、account `00000000-0000-4000-8000-000000000003`、`civ_gen = 1`。首次应用启动可在锁定 generation 后初始化空的 `state_snapshot`。

所有席位状态写入应使用 `withLockedSeat`：先检查 `account_id` 和当前世代，再在同一事务中读取/写入 `command_receipts`、更新 `state_snapshot` 和 `seat_knowledge_snapshots`。数据库层不会代替服务端进行授权或由世界真值生成客户端视图。PostgreSQL `bigint` 默认返回字符串，请在转为 JavaScript number 前验证安全整数范围。

`pending_events` 与遗迹不级联删除，因此文明灭亡不删除在途事件或物理留存。`sectors` 中 lease 与 fencing 字段为 M3 预留；当前不宣称已实现多写者分片调度。`world_event_log`、checkpoint 与稀疏节点表同为后续权威写入接口准备。

`pnpm --filter @stars/database test` 使用 PGlite 执行真实 PostgreSQL SQL，覆盖迁移、跨世代外键、唯一时钟、指令幂等唯一键、事务回滚与灭绝留存。它不替代生产 PostgreSQL 的多连接锁和故障恢复测试。Compose 使用持久卷；停止服务用 `docker compose -f infra/compose.yaml stop`，避免对永续世界执行带 `-v` 的删除命令。

另可将 `TEST_DATABASE_URL` 指向独立测试库，运行相同命令验证真实 PostgreSQL 的迁移重跑、seed 重跑与双连接席位行锁。测试会向该库写入测试纪元和开发席位，不能指向生产库。本轮已经在独立 PostgreSQL 17 临时实例上通过这两项集成测试。
