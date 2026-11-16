# 《光锥之外》席位契约与指令总线规格（v0.17.0 · 银河系尺度、多信使星泡、定向远征与 Agent 预留版）

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
| `self.telemetry` | `k_tier`、`k_value`、`k_max_confirmed`、`stage`（`"single_planet" \| "multi_planet" \| "multi_star"`）、`n_worlds`、`n_eff_stars`（以上均为指挥核已确认口径）、`cradle_span_ly`、`active_sync_span_ly`、`expeditions_in_flight_count`、`controlled_node_count`、`detached_autonomous_node_count`、`known_reachable_node_count`、`r_persist`（最近确认网络摘要）、`sdi_total`（自毁指数，全席位统一适用连续冷战自毁率与 $s_{\mathrm{raw}}\ge 100\%$ 崩解判据）、`sdi_breakdown`（`involution` 内卷、`concentration` 单行星生物圈与凝聚威慑应力、`colony` 行星后勤、`lag_strain_u` 延迟记忆、`tier_tech` 能级科技、`pulse` 脉冲、`fixed` 衰减事件脉冲、`heat_overload` 不衰减热沉过载应力、`overlap_arrived` 已抵达设施冲突摩擦）、`sdi_pulse_rem_sim_s`（绑定 `40 sim yr` 生态衰减轴）、`strike_cd_rem_real_s`、`beacon_cd_rem_real_s`、`decoy_active_count`、`heat_sink_pct`、`heat_vent_rem_real_s`、`migrate_cd_rem_real_s`、`m_recoil_active`、`traits_13`、`tech_levels_5`、`active_construction`（`{dimension, target_level?, rem_sim_s, rem_real_s} \| null`）、`build_queue`（最多 5 项近期建造队列 `Array<{dimension, target_level?, queued_at_sim_s, status: "queued" \| "waiting_points" \| "waiting_prerequisite"}>`）、`allocation_plan`（长线加点与基建托管计划 `{enabled: boolean, template_id?: string, cursor_index: number, items: Array<{dimension, target_level?, min_k?}>}`，最多 20 步；离线期间按 $m_{\text{offline}}=1.00$ 全速自动补入队列流转）、`evo_points_avail`（连续浮点演化点）、`evo_points_earned_total`、`v_e_rate_per_real_h`、`v_e_rate_per_sim_yr`、`pi_productivity`（`{total, pi_exp, xi_stochastic_factor}` 文明生产力拟合与随机叠加因子）、`local_clutter_noise_ratio`、`telescope: {theta, phi, omega_a, dwell_real_s, slew_rem_real_s, eta_int}`。 |
| `self.network` | 指挥核当前已知的节点状态报告 `nodes`（含 `confirmed` / `detached_autonomous` / `destroyed` / `seceded`）、已知有向链路 `links`、在途 $0.10c$ 定向远征 `active_expeditions` 与本地待回执请求 `pending_frontier_requests`；所有记录保留源采样时刻或本地排程时刻，不隐式超光速同步。 |
| `lightcone.wavefronts` | 已抵达且超过各信使物理消散门限（$I_{\text{recv}}\ge F_{\text{diss}}$ 或 $h_{\text{recv}}\ge H_{\text{diss}}$）并满足 $\mathrm{SNR}\ge 1$ 的多信使波壳观测数组（源端开启 `EMCON`/热沉后，先前发出的 EM 波段继续以 $1.00c$ 外传成**空心波壳**，中心形成向内扩展的沉默暗腔直至外圈消散）。**弱异常检出（$1\le\mathrm{SNR}<5$、中微子或非三角 GW）**即含 `event_id`、`t_arrive_sim_s`、`band`（`ir` / `radio` / `nir_laser` / `neutrino` / `gw` / `xray_shock`）、`messenger_class`（`"em" \| "neutrino" \| "gw"`）、`snr_current`、`dissipation_margin_ratio`、**`coarse_dir_vec3`（含粗噪声误差的世代局部单位方向向量或 GW 天区环带参数）与 `dir_sigma_rad`（$\sigma_\theta\approx\theta_{\text{PSF}}/\mathrm{SNR}$）**（其中 **`neutrino` 在 `Obs Lv.3+` 无视 `heat_sink` / `blackbody_mimic` 与宿主光雾，但物理受限仅停留在宽角弱异常；`gw` 在 $N_{\text{stars,confirmed}}<3$ 时亦仅停留在宽弧弱异常**）。**二维方位／光谱锁（EM $\mathrm{SNR}\ge 5$，单站）**返回精密 `local_dir_vec3`、收窄后的 `dir_sigma_rad`、`apparent_angle_deg`、`doppler_shift_est`、`spectrum_k_est`、`is_decoy_verified`、`ping_payload`，**仍不返回三维坐标或 `target_node_id`**。**仅当满足 GDD §7.2 三维星历定位证据**（`ranging_evidence`: `"catalog_match" \| "parallax" \| "two_way_echo" \| "gw_triangulation"`，其中 `"gw_triangulation"` 要求 `Obs Lv.3+` 且 **$N_{\text{stars,confirmed}}\ge 3$ 非共线协同节点**）后，才追加 `ranging_evidence`、`t_source_sim_s`、`local_pos_vec3`、`pos_sigma_ly`、`local_velocity_vec3`、`vel_sigma_mps`、`progenitor_unstable` 及席位作用域内 `target_node_id`。符合迁徙条件的公开导航节点附 `navigation_node_id`。 |
| `sentinel.reflex_rules` | `{max_slots: 3, trigger_mode: "offline_only" \| "always_armed", grace_period_real_s: number, armed_now: boolean, active_rules: [{slot, condition_expr, action_cmd, cooldown_rem_real_s}]}`。3 个 L1 哨兵槽位的条件与动作严格限定为白名单结构化枚举（支持 `b1_warning -> deflect_b1`、`heat_sink_pct >= 98 -> set_stealth_mode("vent_sink")`、`sdi >= 80 -> detach_outer_node / migrate_seed`），服务端确定性求值，不依赖大模型推理（无服务端免死保底，亦无独立休眠效果）。 |
| `extinction.report` | 灭亡简报与死后告知视图：`{extinct: boolean, cause?: "ColdWar_SelfDestruct" \| "SDI_System_Collapse" \| "B1a_AsteroidSwarm" \| "B1b_Extinction_Impact" \| "B2_CoreUpheaval" \| "B4_Supernova" \| "strike", t_extinct_sim_s?, physical_remnants?: string, posthumous_callbacks: [...]}`。文明存活时 `extinct` 为 `false`；灭亡后停止可控活动，已发在途多信使波壳继续以 $1.00c$ 扩散衰减直至消散，仅向玩家呈递一份简洁的灭亡简报（满足 GDD §7.4 条件时附带作为灭亡后告知机制的死后光锥回响）以便直接重开，严禁泄露仍在玩席位坐标。 |

### 关键因果与网络摘要约束
1. **严禁超光速信息泄露与真空伪摩擦**：交叠边界告警 `kind: "boundary_contact"` 与交叠摩擦 `overlap_arrived` 均仅在共享恒星节点／中继／物理设施产生争夺且报告以光速抵达己方指挥核后方才生成与累加（`t_arrive_sim_s` 后可见；纯真空波壳交叉零摩擦）；若处于宿主 EM 波壳覆盖下，仅电磁通道杂波噪底 `N_local` 随实际抵达波前升高，中微子与引力波保持透明穿透。
2. **灾变预警与哨兵条件偏转**：B1 预警以 `kind: "b1_warning"` 返回（含 `t_arrive_sim_s` 与 `t_impact_sim_s`），仅对已完成观测 Lv.1 的本席位开放；须由玩家上线手动提交 `deflect_b1` 或通过已配置的 3 槽 L1 哨兵规则（`b1_warning -> deflect_b1`，要求已解锁 `观测 Lv.1 + 打击 Lv.1`）在撞击前执行无损偏转。
3. **节点报告、能力摘要与口径（`nodes`）**：每项含席位作用域内可见的 `node_id`、`last_confirmed_status`、`t_source_sim_s` 与 `t_arrive_sim_s`。节点状态按最新源采样更新，迟到的旧报告不覆盖新状态；`controlled_node_count`、`n_eff_stars`、`k_max_confirmed`、`k_value`（及 `v_e` 流速）与 `r_persist` **仅依据指挥核最新确认完好且处于活跃协同网内的节点更新**——远端节点损毁在物理报告或路径超时失效抵达前不得改变指挥核 `k_value` 或资源可用状态；通信失联或因 `detach_outer_node`（手动或 L1 规则）挂起进入断联自治待机的完好节点保留当地实体与产线运行，不按损毁处理（退出中心同步跨度 `active_sync_span_ly` 与多星加成，待重新发起 `set_node_coordination(..., "sync")` 时按 $1.00c$ 握手再并网）；远端损毁对指挥核 SDI 的影响仅在对应报告抵达后按事件 ID 去重记入 `E_fixed`。
4. **有向链路（`links`）**：每项含 `from_node_id`、`to_node_id`、最近确认可用状态、`t_source_sim_s`、`t_arrive_sim_s` 与 `valid_until_sim_s`。`known_reachable_node_count` 统计沿仍在有效期内的已知可用有向路径可从指挥核抵达的已确认受控远端节点；出站与回传路径分别确认。
5. **在途远征与回执请求（`active_expeditions` & `pending_frontier_requests`）**：反映指挥核已排程的 $0.10c$ 定向远征与 $1.00c$ 并网/退网请求，含 `request_id` / `exp_id`、动作意图、`t_created_sim_s`、`t_launch_sim_s?`、`eta_sim_s?` 及本地等待状态；仅当目标已合法披露时附目标节点标识，无回执前不假设远端已成功接入。

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

### 3.1 局内 11 项核心控制指令

| 指令名 | 参数载荷 | 权威仲裁规则与约束 |
| --- | --- | --- |
| `dispatch_expedition` | `{target_node_id: string, origin_node_id?: string, local_dir_vec3?: [number, number, number], drive_mode?: "standard_010c"}` | 解锁跨星远征（`N_worlds < 2 \|\| persist < 1` 前受限母星系摇篮内 `world_up` 拓展，达到 `N_worlds >= 2 && persist >= 1` 后开放）后，向目标候选恒星系派出受 $0.10c$ 航行与 $1.00c$ 因果时延约束的定向开拓船团（**取消硬性 `8.00 / 20.0 ly` 玻璃墙**）。`target_node_id` 必填（公开星表目标）；`origin_node_id` 可选指定出发枢纽（缺省取最短航程的己方活跃协同枢纽）；`local_dir_vec3` 为 M3+ 方向导航预留（M1 子集不受理）。派出瞬间记录在途远征并按 $1.00c$ 扩散出发尾迹／信标波前，**远端建成并回传 `1.00c` 确认报抵达指挥核前，严禁计入 `n_eff_stars` 或 `k_value`**；远征往返光时差同步写入延迟记忆应力 $\Delta_{\text{lag}}$ 自然制约扩张节奏。 |
| `set_node_coordination` | `{node_id: string, mode: "detach_outer_node" \| "sync"}` | 控制已入网远端节点的协同状态：`detach_outer_node` 可由玩家或 L1 规则（`sdi >= 80`）触发，将外围恒星节点挂起为断联自治待机（**保留物理实体与本地产线不作物理抹除**，退出 `active_sync_span_ly` 与多星加成以迅速压低集中与延迟摩擦）；`"sync"` 对完好待机节点重新发起 $1.00c$ 并网请求，须待对方确认回执按光速抵达指挥核后才恢复多星同步计数（彻底舍弃节点须显式提交 `abandon_node` 指令）。 |
| `abandon_node` | `{node_id: string}` | 显式自愿弃守一个非摇篮的己方节点：当地基地按物理规律拆解为废墟，节点转 `seceded`/废墟态并退出 $N_{\text{stars,confirmed}}$ 与全部加成；与 `detach_outer_node`（临时断联自治、保留实体）严格区分。须指挥端已确认该节点且非锚定摇篮；弃守指令本身按 $1.00c$ 抵达该节点后才当地生效。M1 子集暂不受理（返回明确拒绝）。 |
| `orient_telescope` | `{theta_deg: number, phi_deg: number, omega_deg2: number}` | 校验视场与观测等级允许范围；改指向或收窄视场按 GDD §7.2 重置驻留积分；观测 Lv.4 转向 $>15^\circ$ 结算 **45 real s**（`0.75 sim yr`）焦点轨重构延迟。 |
| `allocate_evolution_point` | `{dimension: "obs" \| "beacon" \| "stealth" \| "strike" \| "persist" \| "world_up" \| "k_tier_up", queue_op?: "enqueue" \| "remove_at", queue_index?: number}` | 校验连续演化点 `evo_points_avail`、前置与单一在建施工位。若 `active_construction` 繁忙、指定 `queue_op: "enqueue"` 或当前点数/前置暂未满足，则追加至 `build_queue`（上限 5 项，**不提前扣点**）。严密 FIFO 队首状态可为 `ready` / `waiting_points` / `waiting_prerequisite`；当施工位空闲时，在**工程完工、`evo_points_avail` 积分跨过费用 $C(L)$、前置条件（含跨星回执）达成或移除队首**时立即重估队首，满足时原子扣点（仅一次）并弹出转入 `active_construction`。五科技分支升级耗 **非线性几何递增点 $C(L)=2^{L-1}$（`1 / 2 / 4 / 8 pts`）**，工期 `15 / 45 / 90 / 180 sim yr`（即 `15 / 45 / 90 / 180 real min`）；`world_up`（`30 sim yr = 30 real min`）与 `k_tier_up` 不耗演化点。 |
| `configure_allocation_plan` | `{enabled: boolean, template_id?: string, items: Array<{dimension, target_level?, min_k?}>}` | 预设并托管长线加点与扩建序列（最多 20 步，支持选用预设路线模板或自定义顺序与可选 `min_k` 门槛）；校验各项有效维度与目标等级，不提前扣点。开启托管后，每当 `build_queue` 有空位且 `active_construction` 可衔接时，服务端按游标顺序自动将下一未完成步送入 `build_queue` 按同口径点数与前置状态机执行（`cursor_index` 随完成推进，玩家随时可覆盖或暂停托管）。 |
| `set_stealth_mode` | `{mode: "none" \| "emcon" \| "hemisphere" \| "heat_sink" \| "vent_sink" \| "blackbody_mimic", axis_vec3?}` | 切换隐匿或热沉：以基准功率定容 $Q_{\max}=180\times 0.994\,P_{\text{anchor}}$（恒定功率下满蓄 `180 sim yr`，`vent_sink` $5.0\times$ 稳态净排空精确耗时 `44.73 sim yr`，功率变化按热量积分结算）；**满蓄后若仍未手动或经 L1 哨兵（`heat_sink_pct >= 98 -> vent_sink`）切换至 `vent_sink` 排热，不衰减的绝热过载应力 `E_heat_overload` 按 `+1.5 百分点/sim yr` 持续累加直至触发过载自毁（切入 `vent_sink` 后随排空比例线性清零）**；`blackbody_mimic` 校验处于单星紧凑尘埃包层尺度（`cradle_span_ly <= 0.05 ly` 且无活跃跨星同步）并禁止广播与远征扩张；**`heat_sink` 与 `blackbody_mimic` 仅屏蔽或伪装 EM 通道，无法遮蔽自身反应堆 $\nu$ 本底与高能级四极 GW 波壳**。 |
| `emit_directed_ray` | `{ray_type, local_dir_vec3: [x,y,z], options?: {decoy_radius?: number, target_node_id?: string, message?: string}}` | `ray_type` 取 `ping`、`laser`、`decoy_probe`、`kinetic_pulse`、`rkv`、`berserker`、`dyson_beam` 或 `induce_grb`。指向打击须引用已获得三维星历定位（含视差／回波／星表匹配或 `N_stars,confirmed >= 3` 非共线 `gw_triangulation` 锁定）的 `target_node_id` 并计入定位误差 $(\boldsymbol\sigma_x,\boldsymbol\sigma_v)$；`dyson_beam` 按光束发散与受照注量结算毁伤；`induce_grb` 额外校验 `progenitor_unstable == true`。 |
| `deflect_b1` | `{event_id: string}` | 偏转已预警且未结算的 B1 事件，须已完成观测 Lv.1 与打击 Lv.1，不占用常规打击冷却；可由玩家手动提交或由 L1 哨兵规则（`b1_warning -> deflect_b1`）在撞击前确定性触发（未配置规则且未手动执行则按 GDD §6.2 撞击毁灭律结算）。 |
| `migrate_seed` | `{destination_node_id: string}` | 校验存续 Lv.4、冷却与合法 `navigation_node_id`；剥离或挂起外围非锚定协同节点、将指挥核收敛为单星火种后按 $0.25c$ 航行，起步与入轨各 `10 sim yr`（`10 real min`）带 $4.0\times$ 尾焰（原址既往波壳继续以 $1.00c$ 外扩至消散）。 |
| `configure_sentinel_reflex` | `{slot?: 1 \| 2 \| 3, condition?: ReflexCondition, action?: ReflexAction, trigger_mode?: "offline_only" \| "always_armed"}` | 每文明最多 **3 个确定性哨兵槽位**，支持切换触发模式（默认 `"offline_only"` 离线宽限期后接管，可选 `"always_armed"` 在线同时值守）；仅允许白名单遥测／已抵达告警条件（`b1_warning`、`heat_sink_pct >= 98`、`sdi >= 80`、`boundary_contact` 等）与 `deflect_b1`、`set_stealth_mode("vent_sink")`、`set_node_coordination(..., "detach_outer_node")`、火种迁徙动作；拒绝任意脚本。 |

### 3.2 文明灭亡后的停摆与重开

- 全服长期运行（不强制删档），取消全服公投、`sector_pact`、`monument_ascension` 及任何“主动封碑飞升”指令，不再设 `cast_governance_ballot`。
- 若局部打击／天灾摧毁摇篮而尚存已授权备用接管计划的完好受控远端节点，按 [GDD §3.2](../../DESIGN.md#space-and-geometry) 就近移交摇篮、不瞬间关闭远端自治节点；仅当全席位已无幸存受控节点或核心体系因 `ColdWar_SelfDestruct`、`SDI_System_Collapse`、可致灭绝的 B 类天灾（`B1a`/`B1b`/`B2`/`B4`，B3 不直接致灭）或打击彻底灭亡后，该席位方停止接收操控指令、原地按物理规律留存废墟／死域（及生前已建成的 `信标 Lv.4`）与在途波前；仅向玩家给出一份简洁的 `extinction.report` **灭亡简报**（含死因、灭绝时刻及满足 GDD §7.4 条件时作为灭亡后告知机制的死后光锥回响），玩家即可直接在银盘未占用恒星重开（分配新 `seat_id` / `civ_gen`），**全服永不删档或中断其余席位** [GDD §8.3](../../DESIGN.md#systems-and-constitution)。

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
  | "CONTROL_SPHERE_STEALTH" // 定向远征、节点协/断联、隐匿、观测与 B1 偏转（v0.16「控制半径」遗留枚举名，仅保持线兼容，语义已按 v0.17 离散星网理解）
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
2. **L1 确定性哨兵护航（零 LLM 零外部进程）**：依据 `sentinel.reflex_rules.trigger_mode` 运行：
   - `"offline_only"`（默认）：当真人玩家离线、切换应用或网络中断超过宽限期 `grace_period_real_s` 后进入 `armed_now = true`；
   - `"always_armed"`：在线观星与离线期间全时处于 `armed_now = true` 自动值守。
   在 `armed_now == true` 期间，扇区计算节点在服务端本地直接根据已抵达当地的波前告警与 `self.telemetry` 评估最多 3 条 `sentinel.reflex_rules` 白名单规则，生成 `principal.kind = "l1_reflex"` 的标准 `SeatCommandEnvelope` 进入同一裁定入口。**重连与既有告警衔接**：规则冷却 `cooldown_rem_real_s` 在线与离线连续计时、不在重连时清零；进入设防态时若存在尚未结算且未过期的 `b1_warning` 或持续越线状态（如 `heat_sink_pct >= 98`、`sdi_total >= 80`），按 `event_id` 去重/冷却门控立即补发一次并保持状态延续；玩家重连上线时，既已发出或完成的哨兵指令不回滚、不重复触发。
3. **M4+ 平滑开放**：未来重开外部 Agent 副官时，仅需在边界新增 `agent-gateway`（例如 REST / Streamable HTTP / MCP Adapter），负责 OAuth 委托校验、读取 `SeatViewProjection` 并投递携带 `principal.kind = "external_agent"` 与受限 `granted_scopes` 的 `SeatCommandEnvelope`，**无需改动空间分片内核、物理仲裁状态机或任何前端视图口径**。
