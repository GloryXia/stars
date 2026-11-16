> [!NOTE]
> 本文档为 **GDD v0.14.0** 阶段起草的大模型 / MCP 外部 L2 副官规格存档。依据最新架构决策（**GDD v0.15.0**）：M1–M4 暂移除大模型运行时与 MCP Server，优先稳定万级单图同服架构、Google 登录海外 Web-first 客户端与纯数学演化曲线；外部 Agent 副官统一通过 [`docs/specs/SEAT-CONTRACT.md`](../specs/SEAT-CONTRACT.md) 预留的 `ActorPrincipal` 与 `SeatCommand` 幂等总线在 M4+ 后扩展接入。


# 《光锥之外》MCP 接口规格（v0.14.0 · 文明球因果闭合版）

本附录定义 M3 的观测、控制与 L1 自治接口，以及 M4 的宪政投票接口。物理规则与数值定义以 [当前 GDD（v0.14.0）](../../DESIGN.md) 为准。服务端采用 JSON-RPC 2.0 与 Streamable HTTP，支持资源更新通知。若提供本地 CLI 桥接，桥接与远程入口共用同一鉴权、光锥裁剪与权限裁定。

## 1. 文明席位、坐标系与双时钟口径

- **坐标系**：方向向量、可见位置与控制参数采用调用者世代局部坐标（以出生球心为原点施加该席位独立随机 $SO(3)$ 正交旋转）。角度以度计，距离以 $\mathrm{ly}$ 计，SDI 以百分点计。观测方向已包含端站相对论光行差。
- **双时钟严格分离**：
  - **模拟物理时间字段（后缀 `*_sim_s`）**：距纪元起点的模拟儒略秒，用于 `t_emit_sim_s`、`t_arrive_sim_s`、`t_source_sim_s`、`t_impact_sim_s` 等天体物理传播与运动学时间戳；
  - **现实操作时间字段（后缀 `*_real_s`）**：现实秒，用于 `mandate_remaining_real_s`、`strike_cd_rem_real_s`、`beacon_cd_rem_real_s`、`heat_vent_rem_real_s`、`dwell_real_s`、`slew_rem_real_s` 等人机节奏与冷却。
  - 每个文明席位按其自身本底 $L_0$ 在全局一致的物理时钟上运行独立世代寿命 $L_{\text{init}}=L_{\text{std}}L_0$；换算关系 $1\ \mathrm{real\ s}=\kappa_t\ \mathrm{sim\ s}$。

| Resource URI | 返回内容 |
| :--- | :--- |
| `civilization://self/telemetry` | `k_tier`、`k_value`、`stage`（`"single_planet" \| "multi_planet" \| "multi_star"`）、`n_worlds`、`n_eff_stars`、`r_civ`、`r_target`、`controlled_node_count`、`known_reachable_node_count`、`r_persist`（最近确认的网络摘要，口径见下文）、`sdi_total`、`sdi_breakdown`（内卷、核威慑 `nuke`、行星后勤 `colony`、延迟记忆 `lag_strain_u`、能级科技、脉冲、固定事件、已抵达的交叠摩擦 `overlap_arrived`）、`sdi_pulse_rem_sim_s`（生态衰减绑定 `40 sim yr` 时轴；客户端按 $\kappa_t$ 换算展示）、`strike_cd_rem_real_s`、`beacon_cd_rem_real_s`、`decoy_active_count`、`heat_sink_pct`、`heat_vent_rem_real_s`、`dormancy_active`、`migrate_cd_rem_real_s`、`m_recoil_active`、`traits_13`、`tech_levels_5`、`evo_points_avail`、`mandate_remaining_real_s`、`local_clutter_noise_ratio`（已抵达波前决定的局地噪底倍率）、`telescope: {theta, phi, omega_a, dwell_real_s, slew_rem_real_s, eta_int}`。 |
| `civilization://self/network` | 指挥核持有的节点状态报告 `nodes`、已知有向链路 `links` 和当地待回执的前沿请求 `pending_frontier_requests`。各记录保留其报告时间或本地排程时间。 |
| `civilization://lightcone/wavefronts` | 已抵达且 $\mathrm{SNR}\ge 1$ 的波前观测数组。基础项含 `event_id`、`t_arrive_sim_s`、`band`（`ir` / `radio` / `nir_laser` / `gw` / `xray_shock`）与 `snr_current`。**二维方位／光谱锁（$\mathrm{SNR}\ge 5$，单站）**返回 `local_dir_vec3`、`dir_sigma_rad`、`apparent_angle_deg`、`doppler_shift_est`、`spectrum_k_est`、`is_decoy_verified`、`ping_payload`，**不直接返回三维坐标**。**仅当满足 GDD §7.2 三维星历定位证据**（`ranging_evidence`: `"catalog_match" \| "parallax" \| "two_way_echo"`）后，才追加 `ranging_evidence`、`t_source_sim_s`、`local_pos_vec3`、`pos_sigma_ly`、`local_velocity_vec3`、`vel_sigma_mps`、`progenitor_unstable` 及作用域内 `target_node_id`。符合迁徙条件的公开导航节点附 `navigation_node_id`。 |
| `civilization://dormancy/reflex_rules` | `{max_slots: 3, active_rules: [{slot, condition_expr, action_cmd, cooldown_rem_real_s}]}`。条件与动作均为白名单结构化枚举。 |
| `civilization://constitution/status` | M4 返回 `{proposal_id, stage, stage_deadline_real_s, t_close_sim_s?, cosign_count, active_electorate_n, whitepaper_stats, ballot_participation_rate}`。仅在光锥内合法观测到发起者后提供 `initiative_proposer_dir`。终投期仅公开参与率。 |

- **严禁超光速信息泄露**：交叠边界告警 `kind: "boundary_contact"` 与交叠摩擦 `overlap_arrived` 均在接触／干扰波前实际抵达己方指挥核后方才生成与累加（`t_arrive_sim_s` 后方可见）；不返回交叠深度、对方半径、球心坐标或节点 ID。包含态与纯真空未争端交叠不提前暴露对方存在。
- B1 预警以 `kind: "b1_warning"` 返回（含 `t_arrive_sim_s` 与 `t_impact_sim_s`），仅对已完成观测 Lv.1 的本席位可见。

### 指挥核的网络视图

- `nodes` 的各项含席位可见的 `node_id`、`last_confirmed_status`、`t_source_sim_s` 和 `t_arrive_sim_s`。源时刻是报告采样时刻，抵达时刻是指挥核收到报告的时刻。已无法发报的节点可由实际取得证据的其他端站报告。节点状态按最新已确认采样更新，迟到的旧报告不覆盖新状态。指挥核的 `controlled_node_count` 只计最新已确认状态为完好且仍受控的节点，`r_persist` 以同一集合计算。界面标明汇总来自最近确认的报告，记录可由 `nodes` 查验。远端节点损毁对指挥核 SDI 的影响仅在相应报告送达后记入，同一损毁事件去重。
- `links` 的各项含 `from_node_id`、`to_node_id`、最近确认的可用状态、`t_source_sim_s`、`t_arrive_sim_s` 和报告有效期截止时刻 `valid_until_sim_s`。`known_reachable_node_count` 统计沿最近报告可从指挥核经仍在有效期内的已知可用有向路径抵达的已确认受控远端节点。过期时显示链路待确认。出站路径和回传路径分别确认。各跳按实际发射和接收位置结算光行时间，中继另计收信、等待与转发。
- `pending_frontier_requests` 只反映指挥核已知的前沿请求，包括 `request_id`、接入或退网意图、`t_created_sim_s`、如已发出则有 `t_sent_sim_s`，以及本地等待状态。仅当目标已合法披露时附节点标识。无回执时显示等待或本地超时，并保留上次确认的状态及其时间。接入、退网和链路变化的结果通过送达的报告更新。HUD、MCP 与指挥核的自治规则共用这些记录。

## 2. 局内控制工具

各写入请求须提交 `epoch_id` 与 `client_request_id`。

| Tool | 业务入参 | 物理与权限裁定 |
| :--- | :--- | :--- |
| `set_sphere_radius` | `{r_target: number}` | 有限数值。指挥核按已知能级上限、备份摇篮下限 $R_{\text{floor}}$ 与状态约束钳制，返回已接受的目标半径。包络按 $\le 0.25c$ 演化并驱动前沿策略。接入与退网在相应节点按已抵达的指令或已授权的当地条件执行。指挥核通过实际回执得知结果。 |
| `orient_telescope` | `{theta_deg: number, phi_deg: number, omega_deg2: number}` | 校验视场与观测科技允许范围。改指向或收窄视场按 GDD §7.2 重置驻留积分；观测 Lv.4 转向 $>15^\circ$ 结算 **45 real s** 焦点轨重构延迟。 |
| `allocate_evolution_point` | `{dimension: "obs" \| "beacon" \| "stealth" \| "strike" \| "persist" \| "world_up" \| "k_tier_up"}` | 副官须有 `ALLOW_AGENT_TECH_ALLOC`。校验点数、前置、能级、单一施工位及闪电服工期倍率；`world_up`（摇篮内多行星扩展，`30 real min` 基准）与 `k_tier_up` 均不扣进化点。 |
| `set_stealth_mode` | `{mode: "none" \| "emcon" \| "hemisphere" \| "heat_sink" \| "vent_sink" \| "blackbody_mimic", axis_vec3?}` | 切换隐匿或热沉排热：`heat_sink` 蓄热上限 180 real min（总排热 $0.006$）；`vent_sink` 以 $5.0\times$ 稳态排热，满载精确耗时 **44.73 real min**（未满按比例缩时）；`blackbody_mimic` 检查 $R_{\text{civ}}\le 0.05\ \mathrm{ly}$ 并禁发信标与扩张。 |
| `emit_directed_ray` | `{ray_type, local_dir_vec3: [x,y,z], options?: {decoy_radius?: number, target_node_id?: string, message?: string}}` | `ray_type` 取 `ping`、`laser`、`decoy_probe`、`kinetic_pulse`、`rkv`、`berserker`、`dyson_beam` 或 `induce_grb`。副官发射打击须有 `ALLOW_AGENT_STRIKE`。指向打击须引用已获得三维星历定位的 `target_node_id`，瞄准直接计入定位误差 $(\boldsymbol\sigma_x,\boldsymbol\sigma_v)$；`dyson_beam` 按聚焦／误差斑受照注量结算毁伤；`induce_grb` 额外校验 `progenitor_unstable == true`。 |
| `deflect_b1` | `{event_id: string}` | 偏转已预警且未结算的 B1 事件，须已完成观测 Lv.1 与打击 Lv.1，不占用常规打击冷却。 |
| `set_dormancy` | `{active: boolean}` | 校验存续 Lv.2，发起 10 real min 进入或唤醒过渡（重复同向请求幂等返回）。 |
| `migrate_seed` | `{destination_node_id: string}` | 校验存续 Lv.4、冷却与合法 `navigation_node_id`；半径归 $R_{\min}$ 并按 $0.25c$ 航行，起步与入轨各 10 real min 带 $4.0\times$ 尾焰。 |
| `configure_dormancy_reflex` | `{slot: 1 \| 2 \| 3, condition: ReflexCondition, action: ReflexAction}` | 每文明最多 3 个槽位，只允许白名单遥测／已抵达告警条件与球半径、隐匿、B1 偏转、火种迁徙动作；不接受任意脚本。 |

## 3. 局外宪政、权限与重试

- `cast_constitutional_ballot` 接受 `{action: "propose" | "cosign" | "stance" | "secret_vote" | "density_vote", proposal_id?, value?, human_auth_sig?, ballot_credential?}`。仅真人主权席位可参与；首倡须真人确认并检验扣除后仍满足底线；终投使用一次性匿名票据。公投通过时锁定本局冻结时刻 `t_close_sim_s` 并停受理新打击，已在途武器与信号沿物理轨迹运行至 `t_close_sim_s` 后连同状态归档，局内停火按各节点收到停火令的因果时刻生效。
- 令牌按席位与能力域授权，撤销即时生效。`client_request_id` 与 JSON-RPC ID 分离，幂等去重；未知与无权访问目标统一返回同一错误口径。
- M3 网络验收用同一组指挥核观测与收放操作，分别让远端节点成功接入、退网或失去回执。结果报告抵达前，网络摘要及节点损毁 SDI 只反映此前已知证据。另测单向链路、经中继晚到的旧报告及回执重放，确保 HUD、MCP 与指挥核自治同口径。

## 4. 外部副官授权与 M3 联调

每个真人席位最多有一个有效 L2 副官授权。授权绑定账号、纪元、席位、文明世代和外部客户端。初始授权建议只开放席位资源读取和订阅，玩家可另授半径控制等具体写入能力。科技分配与打击分别使用 `ALLOW_AGENT_TECH_ALLOC` 和 `ALLOW_AGENT_STRIKE`，默认关闭。L1 配置单独授权，副官配置规则时需同时具备相应动作权限。宪政投票由真人主权席位本人完成。[GDD §3.3](../../DESIGN.md#space-and-geometry) · [GDD §8](../../DESIGN.md#systems-and-constitution)

1. 玩家在外部 MCP 客户端配置服务端 URL。客户端发现受保护资源及授权服务，发起 OAuth 授权。玩家使用已绑定游戏账号确认纪元、席位和权限。需要在手机上确认时，可在已登录的游戏界面打开对应的一次性授权请求。授权请求在服务端绑定原 OAuth 事务。
2. 外部客户端用授权码与 PKCE 换取面向该 MCP 服务的访问令牌，随后通过 Streamable HTTP 读资源、订阅或调用工具。资源端验证令牌目标服务、有效期、当前席位和能力。微信登录凭证用于建立游戏会话，外部客户端持有独立的 MCP 令牌。[MCP 授权规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
3. 玩家可撤销或替换副官。替换时服务端在同一事务内使旧授权失效并启用新授权。撤销提交后，旧授权的读取、写入、续期和更新通知停止，已有订阅关闭。此前已受理的指令继续按既有规则裁定，已发出的信号按原轨迹传播。

| M3 首条联调链路 | 通过条件 |
| --- | --- |
| 读与订阅 | 外部客户端读取 `civilization://self/telemetry` 与 `civilization://self/network`。收到已授权资源的更新通知后重读，同席位 HUD 与 MCP 显示相同的已确认节点及报告时间。 |
| 写与回执 | 只读授权调用 `set_sphere_radius` 被拒绝。授予半径控制后，副官发起 4 光年接入。受理时两端显示待确认，指挥核收到远端回执后两端才确认第二个节点。无回执时按同一窗口显示未确认。相同 `client_request_id` 重试只受理一次。 |
| 切后台与撤销 | 退出游戏界面后，授权仍有效时副官可读取资源。玩家返回并撤销后，旧令牌无法继续读取或发令，订阅停止。另测越席位、越纪元及替换旧副官。 |

[4 光年接入场景](M1-M2-FRONTIER.md) · [前端副官管理](ARCHITECTURE.md#34-mcp-副官管理)
