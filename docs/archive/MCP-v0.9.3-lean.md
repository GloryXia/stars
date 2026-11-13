# 《光锥之外》MCP 接口规格

本附录定义 M3 的观测、控制和 L1 配置接口，以及 M4 的宪政接口。游戏状态和规则以 [GDD v0.9.3-lean](GDD-v0.9.3-lean.md) 为准。服务端采用 JSON-RPC 2.0 与 Streamable HTTP，提供资源更新通知。若提供本地 CLI 桥接，桥接与远程入口共用同一鉴权和裁定。

## 1. 坐标、时间与读权限

方向向量、可见位置和指令参数采用调用者本地坐标（GDD §12.3）。角度以度计，距离以 ly 计，时间戳为距纪元起点的秒数，冷却与驻留时间以秒计，SDI 以百分点计。其他单位见正文。权限与数据裁剪由服务端执行，调用者只可读取自己授权席位可见的数据。WebGL 与 MCP 在相同逻辑时刻、状态、视场和驻留条件下取得等价的局内观测。

| Resource URI | 返回字段 |
| :--- | :--- |
| `civilization://self/telemetry` | `k_tier`、`r_civ`、`r_target`、`v_civ`、`sdi_total`、`sdi_breakdown`、`sdi_pulse_rem`、`strike_cd_rem`、`beacon_cd_rem`、`decoy_active_count`、`heat_sink_pct`、`dormancy_active`、`migrate_cd_rem`、`m_recoil_active`、`r_persist`、`traits_13`、`tech_levels_5`、`evo_points_avail`、`telescope: {theta, phi, omega_a, dwell_sec, eta_int}`。与正文的点数和 SDI 分项一致。 |
| `civilization://lightcone/wavefronts` | 观测数组。基础项含调用者作用域内的 `event_id`、`t_arrive` 和 `deconv_locked`。按 §8 的披露等级可给出 `local_dir_vec3`、`apparent_angle_deg`、`snr_current`、`spectrum_k_est`、`is_decoy_verified`、`ping_payload`。已锁定的可打击节点另返回调用者作用域内的 `target_node_id`、`t_source`、`local_pos_vec3` 和 `local_velocity_vec3`，表示源采样时刻及其允许公开的位置／运动估计。符合迁徙条件的公开导航候选可附调用者作用域内的 `navigation_node_id`。 |
| `civilization://dormancy/reflex_rules` | `{max_slots: 3, active_rules: [{slot, condition_expr, action_cmd, cooldown_rem}]}`。条件与动作是结构化枚举。 |
| `civilization://constitution/status` | M4 返回 `{proposal_id, stage, stage_deadline, cosign_count, active_electorate_n, whitepaper_stats, ballot_participation_rate}`。仅已合法观测到发起者时才有相应的 `initiative_proposer_dir`。白皮书提供统计，终投期间只公开参与率。 |

- 波前中尚未抵达或低于观测阈值的信号不产生公开记录。已披露事件的 ID 对同一席位在同一代内保持稳定，便于断线恢复与去重。弱异常只发粗略方向和强度，合法锁定后才返回对应节点能力。诱饵核验遵从 §8 的独立门槛，消息载荷也只在规则允许接收时给出。
- 外切或部分交叠的边界告警是独立事件，含 `event_id`、`t_arrive`、`kind: "boundary_contact"`、接触类别与粗方向扇区。`t_arrive` 是真实接触时间向上取整到整分钟的发布时刻，客户端在该时刻才收到告警。可与波前一同订阅，但不返回目标节点 ID、连续交叠深度、精确位置或可据以反推距离的半径。包含态和内切依 GDD §4 的分支判定。
- B1 自身预警按 §7.4 披露。它使用独立的 `kind: "b1_warning"` 记录，含预警 `event_id`、`t_arrive` 与 `t_impact`。只有具有该预警能力的本方席位可见。
- `target_node_id` 与当前纪元、文明代和锁定资格绑定。它不是星表索引，也不提供比观测允许范围更新的位置。重连不改变已披露的数据，换代重新取得观测权限。

## 2. 工具入参与状态约束

下表列出业务入参。各修改请求还须提交 `epoch_id` 和 `client_request_id`，分别限定当前纪元和重试操作。

| Tool | 业务入参 | 校验与结果 |
| :--- | :--- | :--- |
| `set_sphere_radius` | `{r_target: number}` | 有限数值。按能级范围钳制，服从收放限速、节点、状态与冷却规则，返回实际接受的目标半径。 |
| `orient_telescope` | `{theta_deg: number, phi_deg: number, omega_deg2: number}` | 校验视场与科技允许的范围。实际变更指向或收窄视场时按 §8 重置驻留，观测 Lv.4 转向延迟也按正文处理。 |
| `allocate_evolution_point` | `{dimension: "obs" \| "beacon" \| "stealth" \| "strike" \| "persist" \| "k_tier_up"}` | 副官须有 `ALLOW_AGENT_TECH_ALLOC`。校验点数、链式前置、能级、施工与防自爆条件，`k_tier_up` 不耗点。成功返回被接受的研发或施工状态。 |
| `emit_directed_ray` | `{ray_type, local_dir_vec3: [x,y,z], options?: {decoy_radius?: number, target_node_id?: string, message?: string}}` | `ray_type` 取 `ping`、`laser`、`decoy_probe`、`kinetic_pulse`、`rkv`、`berserker`、`dyson_beam` 或 `induce_grb`。方向必须有限且非零，服务端单位化。选项按类型校验，仅合法可用的节点 ID 可作锁定目标。副官发射打击须有 `ALLOW_AGENT_STRIKE`。校验蓄能、冷却、在途上限、阶段与防自爆条件。 |
| `deflect_b1` | `{event_id: string}` | 只能偏转自己尚未结算且已预警的 B1 事件。须已完成观测 Lv.1 与打击 Lv.1，且在撞击时刻前提交。成功只标记一次偏转，不占用普通打击冷却。副官须有所有者对该防御操作的授权。 |
| `set_dormancy` | `{active: boolean}` | 校验存续 Lv.2 和当前阶段。按 §6.2 发起进入或唤醒转换，返回转换状态与逻辑完成时刻。相同方向的转换已在进行时，返回该转换，不重复启动。 |
| `migrate_seed` | `{destination_node_id: string}` | 校验存续 Lv.4、冷却、迁徙状态及调用者可用的 `navigation_node_id`。按 §10.3 原子接受迁徙和预留落点，返回出发、巡航与入轨的时间计划。 |
| `configure_dormancy_reflex` | `{slot: 1 \| 2 \| 3, condition: ReflexCondition, action: ReflexAction}` | 仅能写自己有权管理的席位，替换该槽。条件引用自身遥测和可见告警，动作引用服务端允许的控制项。校验所需科技与权限，触发时再次检查。 |
| `cast_constitutional_ballot` | `{action: "propose" \| "cosign" \| "stance" \| "secret_vote" \| "density_vote", proposal_id?: string, value?: string, human_auth_sig?: string, ballot_credential?: string}` | M4 工具，按 §11 校验。除首倡外须指向当前动议。首倡须有绑定该次动议内容和请求的真人确认。联署可在预授权下代签。终投提交使用真人确认后签发、只对本动议有效的一次性匿名票据，票面不携带可关联的真人签名。公开表态取 `reset` 或 `preserve`，终投取 `yes` 或 `no`，密度票取 `high`、`medium` 或 `low`。 |

`ReflexCondition` 只支持白名单遥测比较和事件类别，诸如已到达的 RKV 尾迹、合法边界接触或自身外围感染。`ReflexAction` 只支持正文规定的半径调节、已解锁的隐匿调整、B1 偏转和合格的火种迁徙。配置入口不接受脚本，L1 仍经相同的状态机和权限校验。正式接口须提供上述类型与各射线选项的 JSON Schema。

## 3. 权限、重试与错误

- 副官按所属席位和当前令牌范围操作。服务端在接收请求时检查身份，并在产生实际副作用时复核权限和状态。撤销授权后，已有反射规则也不得借旧权限触发动作。硅基席位不能首倡、附议或投票。
- `client_request_id` 是发起者在同一纪元中的操作标识，与 JSON-RPC 的传输请求 ID 分开。同一标识和同一请求内容的重试返回已记录的结果，不重复扣点、发射、推进阶段或计票。复用标识提交不同内容时拒绝。过期纪元的请求不能重放进新纪元。秘密投票的重试仅按匿名票据和请求标识去重。投票端验票据，无须把真人会话身份与票面一同提交或记入日志。
- 所有修改由服务端在逻辑时钟上排定。返回值说明请求已接受或被拒绝。需要等待的动作返回其排定时刻或当前进度。错误包含可判别的类别及该用户可以看到的原因，例如权限不足、参数非法、当前阶段不允许、科技未解锁、冷却未结束或观测锁定无效。未知与不可见目标使用同一错误口径。
- M3 验收同一席位的 HUD／MCP 可见性、收放和视场的参数边界、撤销副官权限、断线后复读同一事件及重发同一动作。M4 增加重复票据、跨世代重连、阶段截止和全服重启幂等验收。
