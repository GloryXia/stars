# 4 光年定向远征协议夹具

依据 GDD v0.17.0 和更新后的 M1–M2 开发规格。根目录执行 `pnpm sim:m1`，输出 `artifacts/m1/{success,no-ack,unavailable}.json` 与独立 `catalog.json`。时间线只包含指挥核投影，不包含世界快照、当地接入状态或回执在途队列。分支文件名仅用于离线演示选择。

`manifest.json` 记录固定场景参数。没有随机过程，因此本版本不消费 RNG 状态；待生产力实现后再加入版本化随机流。世代局部系使用单位 SO(3) 旋转。

核心入口在 `@stars/sim-core`：`createSimulation`、`acceptCommand`、`advanceToRealSeconds`、`projectSeat`、`serializeSimulation`、`restoreSimulation`。推进时间是场景绝对现实秒，倍率永远为 525960；播放快进只改变播放游标。事件按整数模拟毫秒、phase、稳定序号排序，同刻回执先于超时。权威快照版本为 2，旧半径规划快照不可读取。

指挥核以 `dispatch_expedition(target_node_id="B")` 派出 0.10c 航队，240 秒授权抵达 B，2400 秒航队当地到达，2640 秒回执抵达后 B 才成为已确认节点。不可用与无回执分支在 2640 秒前投影完全相同，无回执到 2760 秒显示结果未确认。2400 秒的 `awaiting_receipt` 是己方预定轨迹完成后的本地等待态，不声称知道远端成功。合法迟到回执可以更新超时。

协议夹具同时支持已确认 B 的 `set_node_coordination`：`detach_outer_node` 从指挥核协同统计中移除 B，保留实体与当地运行；`sync` 发起 240 秒出站 + 240 秒回程握手，回执前不恢复多星加成。迟到旧样本、重复回执、非握手确认不会撤销本地脱网，已知毁坏节点不能被在途握手复活。

该夹具只接受一次向 B 的远征；相同指令重试幂等，新的第二次远征返回 `SCENARIO_ALREADY_STARTED`。它没有人为半径上限，但公开目标集暂时只有 B。完整星表、任意方向远征、波壳观测管线、演化/建设及真实 Tier 1 成长仍待后续实现，不代表已完成全部 M1 验收。
