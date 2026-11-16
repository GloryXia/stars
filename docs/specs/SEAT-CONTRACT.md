# 《光锥之外》席位契约与指令总线规格（v0.16.0 · 10 万光年永续银河、全速离线队列与 Agent 预留版）

本文档定义人类玩家客户端（Web-first + Capacitor iOS/Android）、服务端全速离线队列与 L1 确定性离线护航、内置 AI 席位，以及 M4+ 后可选扩展的外部 Agent 副官共同遵守的**同口径席位视图、局部坐标系、双时钟、幂等指令总线与身份扩展接口**。原 v0.14.0 的在线大模型 / MCP 运行时文档已归档至 [`MCP-v0.14.0-deferred.md`](../archive/MCP-v0.14.0-deferred.md)。

---

## 1. 文明席位、坐标系与双时钟口径

所有读视图与写指令严格绑定 `(epoch_id, seat_id, civ_gen)` 文明世代上下文，**严禁跨席位、跨世代或超光速泄漏状态** [GDD §3](../../DESIGN.md#space-and-geometry) · [GDD §7](../../DESIGN.md#observation-and-combat)：

- **世代局部惯性系（`SO(3)`）与相机相对浮动原点**：方向向量、恒星与波前相对坐标以及瞄准控制参数均采用调用者当前文明世代的局部坐标（以出生摇篮星系球心为原点，对该席位本世代施加独立随机正交旋转 $R \in SO(3)$）；客户端在渲染 100,000 ly 银盘时以当前聚焦天体为浮动原点（Camera-Relative Floating Origin）传入 GPU。角度以度（`deg`）计，距离以光年（`ly`）计，SDI 以百分点（`0..100`）计；观测方向已计入端站相对论光行差。
- **物理模拟钟（后缀 `*_sim_s`）**：距银盘纪元起点的模拟儒略秒，严格用于 `t_emit_sim_s`、`t_arrive_sim_s`、`t_source_sim_s`、`t_impact_sim_s`、`valid_until_sim_s`、`sdi_pulse_rem_sim_s` 等天体物理传播、波前因果与生态衰减时间轴 [GDD §3.4](../../DESIGN.md#space-and-geometry)。
- **现实操作钟（后缀 `*_real_s`）**：现实连续秒，用于 `strike_cd_rem_real_s`、`beacon_cd_rem_real_s`、`heat_vent_rem_real_s`、`dwell_real_s`、`slew_rem_real_s`、`cooldown_rem_real_s` 等人机节奏与施工工期；通过**全服唯一锁定倍速 $\kappa_t = 525{,}960$（`1 real min = 1.00 sim yr`，$1\ \mathrm{ly}$ 光行时间 $\equiv 1\ \mathrm{real\ min} = 60\ \mathrm{real\ s}$）**与模拟钟严格换算。

---

## 2. 同口径席位视图投影（Read Projections）

客户端 HUD（WebGL2 + HTML/CSS）、L1 护航规则求值器、内置 AI 与未来的外部 Agent 统一消费以下五类只读视图快照与增量事件（WSS / HTTPS 二进制或 JSON 帧，M1 单机基准以 `timeline.json` 校验同构字段）：

| 视图键 | 核心字段与物理口径 |
| --- | --- |
| `self.telemetry` | `k_tier`、`k_value`、`stage`（`"single_planet" \| "multi_planet" \| "multi_star"`）、`n_worlds`、`n_eff_stars`、`r_civ`、`r_target`、`controlled_node_count`、`known_reachable_node_count`、`r_persist`（最近确认网络摘要）、`sdi_total`（自毁指数，全席位统一适用连续冷战自毁率与 $s_{\mathrm{raw}}\ge 100\%$ 崩解判据）、`sdi_breakdown`（`involution` 内卷、`concentration` 凝聚威慑应力、`colony` 行星后勤、`lag_strain_u` 延迟记忆、`tier_tech` 能级科技、`pulse` 脉冲、`fixed` 固定事件、`overlap_arrived` 已抵达交叠摩擦）、`sdi_pulse_rem_sim_s`（绑定 `40 sim yr` 生态衰减轴）、`strike_cd_rem_real_s`、`beacon_cd_rem_real_s`、`decoy_active_count`、`heat_sink_pct`、`heat_vent_rem_real_s`、`dormancy_active`、`migrate_cd_rem_real_s`、`m_recoil_active`、`traits_13`、`tech_levels_5`、`active_construction`（`{dimension, rem_sim_s, rem_real_s} \| null`）、`build_queue`（最多 5 项预设建造队列 `Array<{dimension, target_level?, queued_at_sim_s}>`，离线期间按 $m_{\text{offline}}=1.00$ 全速自动流转）、`evo_points_avail`（连续浮点演化点）、`evo_points_earned_total`、`v_e_rate_per_real_h`、`v_e_rate_per_sim_yr`、`pi_productivity`（`{total, pi_exp, xi_stochastic_factor}` 文明生产力拟合与随机叠加因子）、`local_clutter_noise_ratio`、`telescope: {theta, phi, omega_a, dwell_real_s, slew_rem_real_s, eta_int}`。 |
| `self.network` | 指挥核当前已知的节点状态报告 `nodes`、已知有向链路 `links` 与本地待回执前沿请求 `pending_frontier_requests`；所有记录保留源采样时刻或本地排程时刻，不隐式超光速同步。 |
| `lightcone.wavefronts` | 已抵达且 $\mathrm{SNR}\ge 1$ 的波前观测数组。基础项含 `event_id`、`t_arrive_sim_s`、`band`（`ir` / `radio` / `nir_laser` / `gw` / `xray_shock`）与 `snr_current`。**二维方位／光谱锁（$\mathrm{SNR}\ge 5$，单站）**返回 `local_dir_vec3`、`dir_sigma_rad`、`apparent_angle_deg`、`doppler_shift_est`、`spectrum_k_est`、`is_decoy_verified`、`ping_payload`，**不直接返回三维坐标**。**仅当满足 GDD §7.2 三维星历定位证据**（`ranging_evidence`: `"catalog_match" \| "parallax" \| "two_way_echo"`）后，才追加 `ranging_evidence`、`t_source_sim_s`、`local_pos_vec3`、`pos_sigma_ly`、`local_velocity_vec3`、`vel_sigma_mps`、`progenitor_unstable` 及席位作用域内 `target_node_id`。符合迁徙条件的公开导航节点附 `navigation_node_id`。 |
| `dormancy.reflex_rules` | `{max_slots: 3, active_rules: [{slot, condition_expr, action_cmd, cooldown_rem_real_s}]}`。3 个反射槽位的条件与动作严格限定为白名单结构化枚举（支持 `b1_warning -> deflect_b1`、`heat_sink_pct >= 98 -> set_stealth_mode("vent_sink")`、`sdi >= 80 -> shrink / set_dormancy / migrate_seed`），服务端确定性求值、离线全时生效，不依赖大模型推理（无服务端免死保底）。 |
| `extinction.report` | 灭亡简报与死后告知视图：`{extinct: boolean, cause?: "ColdWar_SelfDestruct" \| "SDI_System_Collapse" \| "B1a_AsteroidSwarm" \| "B1b_Extinction_Impact" \| "B2_CoreUpheaval" \| "B4_Supernova" \| "strike", t_extinct_sim_s?, physical_remnants?: string, posthumous_callbacks: [...]}`。文明存活时 `extinct` 为 `false`；灭亡后停止可控活动，仅向玩家呈递一份简洁的灭亡简报（满足 GDD §7.4 条件时附带作为灭亡后告知机制的死后光锥回响）以便直接重开，严禁泄露仍在玩席位坐标。 |

### 关键因果与网络摘要约束
1. **严禁超光速信息泄露**：交叠边界告警 `kind: "boundary_contact"` 与交叠摩擦 `overlap_arrived` 均在接触或干扰波前实际抵达己方指挥核后方才生成与累加（`t_arrive_sim_s` 后可见）；不返回对方半径、交叠深度、球心坐标或未知节点 ID。包含态与纯真空未争端交叠不提前暴露对方存在。
2. **灾变预警与条件反射偏转**：B1 预警以 `kind: "b1_warning"` 返回（含 `t_arrive_sim_s` 与 `t_impact_sim_s`），仅对已完成观测 Lv.1 的本席位开放；须由玩家上线手动提交 `deflect_b1` 或通过已配置的 3 槽 L1 反射规则（`b1_warning -> deflect_b1`，要求已解锁 `观测 Lv.1 + 打击 Lv.1`）在撞击前执行无损偏转。
3. **节点报告与口径（`nodes`）**：每项含席位作用域内可见的 `node_id`、`last_confirmed_status`、`t_source_sim_s` 与 `t_arrive_sim_s`。节点状态按最新源采样更新，迟到的旧报告不覆盖新状态；`controlled_node_count` 与 `r_persist` 仅统计最新确认完好且受控的节点，远端损毁对指挥核 SDI 的影响仅在对应报告抵达后去重记入。
4. **有向链路（`links`）**：每项含 `from_node_id`、`to_node_id`、最近确认可用状态、`t_source_sim_s`、`t_arrive_sim_s` 与 `valid_until_sim_s`。`known_reachable_node_count` 统计沿仍在有效期内的已知可用有向路径可从指挥核抵达的已确认受控远端节点；出站与回传路径分别确认。
5. **前沿请求（`pending_frontier_requests`）**：反映指挥核已排程的前沿请求，含 `request_id`、接入/退网意图、`t_created_sim_s`、`t_sent_sim_s?` 及本地等待状态；仅当目标已合法披露时附目标节点标识，无回执前不假设远端已成功接入。

---

## 3. 统一指令信封与领域控制原语

所有局内操作与局外交涉一律封装为统一 `SeatCommand` 信封提交权威仲裁队列，保证 **单次触发幂等、同口径校验、可离线回放**：

```ts
export interface SeatCommandEnvelope {
  command_id: string;        // 全局唯一幂等键 (UUIDv7)
  epoch_id: string;
  seat_id: string;
  civ_gen: number;           // 防止跨世代复活幽灵指令命中旧席位
  base_view_version: number; // 客户端观测版本号
  principal: ActorPrincipal; // 身份来源：人类主权 / L1 护航 / 内置AI / 预留外部Agent
  action: SeatActionPayload;
}
```

### 3.1 局内 9 项核心控制指令

| 指令名 | 参数载荷 | 权威仲裁规则与约束 |
| --- | --- | --- |
| `set_sphere_radius` | `{r_target: number}` | 有限正数值。指挥核按已知能级上限、多节点兜底下限 $R_{\text{floor}}$ 与热/隐匿约束钳制并返回接受值；包络按 $\le 0.25c$ 演化，接入与退网在对应端站按抵达指令结算，通过回执反馈指挥核。 |
| `orient_telescope` | `{theta_deg: number, phi_deg: number, omega_deg2: number}` | 校验视场与观测等级允许范围；改指向或收窄视场按 GDD §7.2 重置驻留积分；观测 Lv.4 转向 $>15^\circ$ 结算 **45 real s**（`0.75 sim yr`）焦点轨重构延迟。 |
| `allocate_evolution_point` | `{dimension: "obs" \| "beacon" \| "stealth" \| "strike" \| "persist" \| "world_up" \| "k_tier_up", queue_op?: "enqueue" \| "remove_at", queue_index?: number}` | 校验连续演化点 `evo_points_avail`、前置与单一在建施工位；若当前施工位繁忙或传入 `queue_op: "enqueue"`，自动追加至 `build_queue`（上限 5 项，当前项完工且点数满足时服务端无缝自动流转下一项）；五科技分支升级耗 **非线性几何递增点 $C(L)=2^{L-1}$（`1 / 2 / 4 / 8 pts`）**，工期 `15 / 45 / 90 / 180 sim yr`（即 `15 / 45 / 90 / 180 real min`）；`world_up`（`30 sim yr = 30 real min`）与 `k_tier_up` 不耗演化点。 |
| `set_stealth_mode` | `{mode: "none" \| "emcon" \| "hemisphere" \| "heat_sink" \| "vent_sink" \| "blackbody_mimic", axis_vec3?}` | 切换隐匿或热沉：蓄热上限 `180 sim yr`（`180 real min`，总排热 $0.006$），**满蓄后若仍未手动或经 L1 规则（`heat_sink_pct >= 98 -> vent_sink`）切换至 `vent_sink` 排热，绝热过载按 `+1.5 百分点/sim yr` 持续推高 `sdi_total` 直至切换排热（$5.0\times$ 稳态排热精确耗时 `44.73 sim yr = 44.73 real min`）或触发过载自毁**；`blackbody_mimic` 校验 $R_{\text{civ}}\le 0.05\ \mathrm{ly}$ 且禁止广播与扩张。 |
| `emit_directed_ray` | `{ray_type, local_dir_vec3: [x,y,z], options?: {decoy_radius?: number, target_node_id?: string, message?: string}}` | `ray_type` 取 `ping`、`laser`、`decoy_probe`、`kinetic_pulse`、`rkv`、`berserker`、`dyson_beam` 或 `induce_grb`。指向打击须引用已获得三维星历定位的 `target_node_id` 并计入定位误差 $(\boldsymbol\sigma_x,\boldsymbol\sigma_v)$；`dyson_beam` 按光束发散与受照注量结算毁伤；`induce_grb` 额外校验 `progenitor_unstable == true`。 |
| `deflect_b1` | `{event_id: string}` | 偏转已预警且未结算的 B1 事件，须已完成观测 Lv.1 与打击 Lv.1，不占用常规打击冷却；可由玩家手动提交或由 L1 反射规则（`b1_warning -> deflect_b1`）在撞击前确定性触发（未配置规则且未手动执行则按 GDD §6.2 撞击毁灭律结算）。 |
| `set_dormancy` | `{active: boolean}` | 校验存续 Lv.2，发起 `10 sim yr`（`10 real min`）进入或唤醒过渡（重复同向请求幂等返回）。 |
| `migrate_seed` | `{destination_node_id: string}` | 校验存续 Lv.4、冷却与合法 `navigation_node_id`；半径归 $R_{\min}$ 并按 $0.25c$ 航行，起步与入轨各 `10 sim yr`（`10 real min`）带 $4.0\times$ 尾焰。 |
| `configure_dormancy_reflex` | `{slot: 1 \| 2 \| 3, condition: ReflexCondition, action: ReflexAction}` | 每文明最多 **3 个确定性槽位**，仅允许白名单遥测／已抵达告警条件（`b1_warning`、`heat_sink_pct >= 98`、`sdi >= 80`、`boundary_contact` 等）与 `deflect_b1`、`set_stealth_mode("vent_sink")`、半径收缩、休眠、火种迁徙动作；拒绝任意脚本。 |

### 3.2 文明灭亡后的停摆与重开

- 全服永续运行，取消全服公投、`sector_pact`、`monument_ascension` 及任何“主动封碑飞升”指令，不再设 `cast_governance_ballot`。
- 当席位因 `ColdWar_SelfDestruct`、`SDI_System_Collapse`、`B1–B4` 天灾或打击灭亡后，该席位停止接收操控指令、原地按物理规律留存废墟／死域（及生前已建成的 `信标 Lv.4`）与在途波前；仅向玩家给出一份简洁的 `extinction.report` **灭亡简报**（含死因、灭绝时刻及满足 GDD §7.4 条件时作为灭亡后告知机制的死后光锥回响），玩家即可直接在银盘未占用恒星重开（分配新 `seat_id` / `civ_gen`），**全服永不删档或中断其余席位** [GDD §8.3](../../DESIGN.md#systems-and-constitution)。

---

## 4. L1 离线确定性护航与 M4+ 外部 Agent 扩展边界

本架构将“当前移除大模型与 MCP 运维负担”与“未来零破坏接入智能体生态”通过 `ActorPrincipal` 清晰解耦：

```ts
export type ActorKind =
  | "human"          // Google OIDC 登录的真人玩家（全权局内控制与重开）
  | "l1_reflex"      // 服务端确定性 L1 自动机（M1–M4 启用：3 槽位白名单）
  | "internal_ai"    // 服务端生态 AI 席位（M3–M4 启用：填补空席与新手期生态）
  | "external_agent"; // [M4+ 预留] 外部 AI / MCP / SDK 副官（M1–M4 运行时默认关闭）

export type CapabilityScope =
  | "READ_SEAT_VIEW"         // 只读订阅本席位 5 类同口径视图
  | "CONTROL_SPHERE_STEALTH" // 半径钳制、隐匿、观测与 B1 偏转
  | "CONFIGURE_REFLEX"       // 调整 3 个 L1 白名单槽位
  | "ALLOW_AGENT_TECH_ALLOC" // [高危显式授权] 分配非线性演化点
  | "ALLOW_AGENT_STRIKE";    // [高危显式授权] 发射定向波前或打击

export interface ActorPrincipal {
  kind: ActorKind;
  subject_id: string;        // Google sub / service worker id / agent delegation id
  granted_scopes: CapabilityScope[]; // human 具备全部局内控制能力
}
```

### 扩展演进约束（M1–M4 -> M4+）
1. **M1–M4 现阶段实现**：网关仅签发 `"human"`、`"l1_reflex"` 与 `"internal_ai"` 凭据，凡 `kind === "external_agent"` 的建连或指令均在网关鉴权层返回 `501 AGENT_EXTENSION_DISABLED`（可配置开关，不触及 `sim-core` 仿真内核）。
2. **L1 确定性护航（零 LLM 零外部进程）**：当真人玩家离线、切换应用或网络中断超过宽限期时，扇区计算节点在服务端本地直接根据已抵达当地的波前告警与 `self.telemetry` 评估最多 3 条 `dormancy.reflex_rules` 白名单规则，生成 `principal.kind = "l1_reflex"` 的标准 `SeatCommandEnvelope` 进入同一裁定入口。
3. **M4+ 平滑开放**：未来重开外部 Agent 副官时，仅需在边界新增 `agent-gateway`（例如 REST / Streamable HTTP / MCP Adapter），负责 OAuth 委托校验、读取 `SeatViewProjection` 并投递携带 `principal.kind = "external_agent"` 与受限 `granted_scopes` 的 `SeatCommandEnvelope`，**无需改动空间分片内核、物理仲裁状态机或任何前端视图口径**。
