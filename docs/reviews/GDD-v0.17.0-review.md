# GDD v0.17.0 评审报告

评审日期：2026-11-16。基线：`665b63c`。

范围：`DESIGN.md`（GDD v0.17.0）、README、席位契约、M1–M2 切片、技术架构、美学规格、`docs/implementation/FOUNDATION.md`、`website/README.md`，并与仓库代码现状及 `scripts/calibration/` 标定产物交叉核对。方法：v0.16.0 遗留问题逐条回归、公式边界推导与数值复算、跨文档术语/口径比对、文档与代码交付清单对照。本次评审核对项目内部一致性，不将参考文献的存在视为物理真实性已获验证，也未开展外部天体物理文献审计。

## 结论

**v0.17.0 是一次质量显著的修订，v0.16.0 的全部 10 项问题（R1–R10）均已修复或删除**；核心数值底座（κ_t=525,960、`1 ly = 1 real min`、4 ly 切片 2400/2640/2760 real s、EM 消散 206.7 ly、热沉 180/44.73 sim yr）与 §9.2 标定数字、`sim_results.json` 验算一致。

本轮识别出 **3 项 P1、8 项 P2、8 项 P3**。P1 表示数值/口径错误或真源分裂，会直接误导实现；P2 表示应在对应模块实现前消除的歧义、缺参或范围标注失同步；P3 为措辞、残留与索引清理。不将尚未实现的系统本身视为缺陷，但把「未实现内容被写成验收通过条件」视为文档缺陷（P2-F 组）。

### v0.16.0 遗留问题回归（全部关闭）

| 编号 | 结论 | v0.17.0 处理 |
| :--- | :--- | --- |
| R1 循环解锁 | 已修复 | `dispatch_expedition` 取代半径墙；§3.2/§9.1 含 4.22/8.5 ly 真实 Tier 1 冷启动验收 |
| R2 远端夹紧绕过光锥 | 已修复 | §5.2 光锥因果隔离、三账分立，失联≠损毁 |
| R3 免费自动偏转 | 已修复 | 「不享有免费自动偏转特权」；§9.2 改无 L1/配 L1 配对对照 |
| R4 B4 标定模型不符 | 已修复 | 前身星 1.00c 辐射壳、逐节点通量判定与永久剥离 |
| R5 大沉默改写早期信号 | 已修复 | 无早期信号剧本；脚本改 `generate_cosmos_unbiased` |
| R6 弱异常缺方向 | 已修复 | `coarse_dir_vec3`/`dir_sigma_rad` 闭合巡天→凝视操作链 |
| R7 K 方程不一致 | 已修复 | §5.2 标注权威唯一形式，与脚本逐项一致 |
| R8 热沉过载衰减 | 已修复 | `E_heat_overload` 独立不衰减、单调累加 |
| R9 队首再开工条件 | 已修复 | `ready`/`waiting_points`/`waiting_prerequisite` 三态与原子扣点 |
| R10 休眠无数值效果 | 已删除 | 休眠整体移除，避险改 `detach_outer_node`/`migrate_seed` |

## P1：冻结 M1 前必须修订

### R1. §3.4 时空圈层表 0.10c 列两格换算错误 60 倍

**位置：** `DESIGN.md` §3.4 表「早晚信使圈 300 ly」「跨日星历圈 1,440 ly」行 × `0.10c` 定向跨星远征舰队列（关键词「125 天」「600 天」）。

按全文基准 `1 ly = 1 real min`，300 ly/0.10c = 3,000 min ≈ **2.1 天**、1,440 ly/0.10c = 14,400 min = **10 天**；表中 125 天/600 天恰为误用「1 ly = 1 小时」的结果。同表其余格（4.22 ly→42.2 min、20 ly→200 min、0.25c 各格）均正确。

**建议：** 两格改为 ~2.1 天 / 10 天，并对整表按 `t = d/β × 1 real min` 复核。

### R2. §4.1「真实消散极限 R_diss」列 ν/GW 口径混用

**位置：** `DESIGN.md` §4.1 三信使表「真实消散极限」列（ν 格「60–119 ly / 298–597 ly」、GW 格「8,440–21,100+ ly 全盘传播」），对照 §7.1。

ν 的 59.7/119.4、298/597 ly 恰为 `G_ν=1/4` 的 SNR=1 距离，真正跌破 `F_diss,ν=N_bg,ν/6` 的消散距离约为 T2 ≈ 146 ly、T3 ≈ 731 ly；GW 的 8,440/21,100 ly 恰为 `G_GW=1.0/2.5` 的 SNR=1 距离，跌破 `H_bg/3.5` 的消散距离 ≈ 29,500 ly。同列 EM 数值等于 `I=F_diss,EM` 的解，全列口径不统一。GW 格自称「全盘传播」亦与 100,000 ly 盘径及自身消散极限矛盾。

**建议：** ν/GW 两格改标「SNR≥1 检出视界」并另补真实消散半径，或整列统一为消散距离口径。直接实现波壳剪枝的工程口径。

### R3. `dispatch_expedition` 参数签名三方分裂

**位置：** `DESIGN.md` §3.2；`docs/specs/SEAT-CONTRACT.md` §3.1；`docs/implementation/FOUNDATION.md`「v0.17 文档更新适配」。

GDD 写 `dispatch_expedition(target_node_id, origin_node_id?)`（target 必填、可选出发枢纽）；SEAT-CONTRACT 写 `{target_node_id?, local_dir_vec3?, drive_mode?}`（target 可选、以方向向量导航、无 `origin_node_id`）；FOUNDATION 又将 `target_node_id` 收紧为必填、「方向导航尚未实现」，形成第三种口径。M1-M2 同时声称「与 SEAT-CONTRACT 保持单一真源命名」。

**建议：** 以 SEAT-CONTRACT 为协议载荷单一真源；GDD 的 `origin_node_id?`（枢纽选择语义）并入载荷或从 GDD 删除，`local_dir_vec3` 盲航语义补写进 GDD §3.2；FOUNDATION 的必填收窄标注为「M1 子集偏差」并回写契约说明。

## P2：实现前补齐

### A 组：口径与命名

- **R4. 解锁前置条件写反。** `SEAT-CONTRACT.md` §3.1 写 `N_worlds >= 2 || persist < 1` 前受限、`N_worlds >= 2 && persist >= 1` 后开放（前半句与后半句互斥）；GDD §2/§3.2/§5.2 统一为「`N_worlds≥2` 且 `存续 Lv.1`」；AESTHETICS 写正确的否命题 `N_worlds < 2 || 存续 < 1`。以 GDD 为准，契约前半句改 `N_worlds < 2 || persist < 1`。
- **R5. 弃守指令命名冲突且缺席指令清单。** GDD `abandon_node` + 模式值 `"detach"` vs 契约 `leave` + `"detach_outer_node"`；弃守不在契约「10 项」表内。以契约为命名真源统一，并入 `set_node_coordination` 第三模式或补入清单。
- **R6. M1 中微子观测档位冲突。** GDD §7.1/§9.1 为 50 ly=`Obs Lv.3`、80 ly=`Obs Lv.4`（Lv.3 上限 59.7 ly）；ARCHITECTURE M1 表与 M1-M2 §2.3 泛写「Obs Lv.3+」。以 GDD 为准补分档。
- **R7. 双时钟职责矛盾。** GDD §3.4 称 real 钟「仅用于」望远镜驻留与焦点转向两项；契约 §1 列 `strike_cd_rem_real_s`/`heat_vent_rem_real_s` 等归 real 钟，架构 §2.1 亦称 real 钟负责施工/冷却/热沉窗口。以 GDD 为准（工期锚定 sim yr），或明确「权威工期锚定 sim yr，`*_real_s` 仅为人机节奏换算显示」，三处同表述。
- **R8. GW 锁定距离与「全盘传播」表述矛盾。** §7.1「SNR_GW·M_tri≥5 升级为横跨 8,440–21,100+ ly 的精确锁定」把检出距离当锁定距离：B_perp=8 ly 时 M_tri=2.768，锁定约 4,670/11,700 ly；锁到 8,440 ly 需 B_perp≈110 ly，远超 R_sync≤14 ly。「全盘」与 100,000 ly 盘径、≈29,500 ly 消散极限矛盾。锁定距离按 `SNR·M_tri≥5` 给出。

### B 组：缺参与量纲

- **R9. SDI 量纲混用。** `clamp(s_raw,0,100%)`、`sdi>=80` 是百分制；λ₁₀₀ 式 `(SDI-0.38)/0.62` 与 K 方程阻尼项是分数制；λ₁₀₀ 的时间基准（每 sim yr 或每 100 sim yr）未定义。内部统一 0–1，UI/L1 阈值注明 ×100，并注明 λ₁₀₀ 时间单位。
- **R10. 毁伤剂量缺参。** `Λ_B4=√(Φ_B4/Φ_ref)` 中 Φ_ref 全文无定义；Φ_B4 无注量式（§7.3 引用的「§6.2 B4 注量公式」名不副实）；P_beam/η_beam/t_dwell/Φ_kill 无基准值，4A/4B/B4 无法结算。
- **R11. 其余未定义符号。** `N_eff=1+Σω_i` 求和域（含不含摇篮 ω₀=1.0）影响 K_max 与判毁式；§7.2 G_obs 的 `η_int`、`R_{A,baseline}` 未定义；§5.2 随机叠加 Ξ(t) 的 A_m/ω_m/φ_m/Z_OU/J(t) 无基准值；`d_star`（§9.1）未定义；γ_N 前向引用。

### C 组：文档 vs 代码范围标注（M1-M2 验收超前）

FOUNDATION.md 已明确「真实 Tier 1 成长、完整队列、弱异常凝视等不在本轮范围」，但 `M1-M2-FRONTIER.md` §2.3 仍将对应内容列为「自动化验收」通过条件，两文直接矛盾：

- **R12.** 「合法冷启动与断联恢复」行：`world_up`、`存续 Lv.1+`、升 Tier 2 全仓零实现（后半 `detach_outer_node`/`sync` 已实现有测试，`packages/sim-core/src/index.test.ts`）。
- **R13.** 「队列点数恢复与托管」行：`waiting_points`/`waiting_prerequisite`/`allocation_plan` 零引用，队列引擎未实现。
- **R14.** 多信使行 ④⑤：无 `orient_telescope`；GW 三角锁仅是非共线几何门（`signals.ts` 注释 "Geometry gate only"），未接 `N_stars_confirmed>=3`。①②③ 已有测试。
- **R15.** §2.2 交付表三处措辞过时：「定向 0.10c 远征队列」实为单槽；「CLI 开发诊断可查看权威事件」不存在；「scenarios/m1 时间断言」实际在 `packages/sim-core` 测试。§3.3 的「性能记录」「跨端验收记录」无文件落库。

## P3：清理与索引

- **R16.** v0.16「半径操作」残留：`M1-M2-FRONTIER.md` §3.3 末段；契约 `CONTROL_SPHERE_STEALTH` 枚举名（已注兼容遗留，建议加迁移注记）。
- **R17.** M1 冷启动距离集合不一致：GDD `4.22/5.5/8.5 ly` vs M1-M2/ARCHITECTURE `4.22/8.5 ly`。
- **R18.** GDD §5.3 表头工期 `15/20、45/60、90/120、180/240` 第二组数字无定义，其余文档统一 `15/45/90/180`。
- **R19.** 「B1–B4 天灾……灭亡」措辞与 B3 不致灭绝规则冲突（死因枚举无 B3），见契约 §3.2、架构 §5、AESTHETICS。
- **R20.** AESTHETICS 节点状态表缺 `seceded` 字形；§9 锚点仍指向 ARCHITECTURE 旧标题「正念面板」。
- **R21.** README 代码目录「席位视图投影」职责错置（实现是 sim-core `projectSeat`，contracts 仅 schema）；`scripts/export-web-fixtures.mjs`、`infra/compose.yaml`、`.github/workflows`、`.env.example` 未入文档。
- **R22.** README 归档行漏列 `docs/archive/GDD-v0.9.1.md`、`MCP-v0.9.3-lean.md`、`docs/reviews/GDD-v0.13.0-*.md`、`GDD-v0.9.1-review.md`；website/README 对接点漏 `webClientDev`/`webClientDist`。
- **R23.** §3.2「约 12.8% 种子第 4 颗邻星在 8 ly 之外」off-by-one：按 ρ*=0.00233、λ≈5.0，应为「第 3 颗…约 12.5%」或「第 4 颗…约 26.5%」。另 §6.2「单星单行星冗余倍率恒为 1.00」与 R_persist 公式矛盾（应仅指 ln 乘子）。

## 做得好、可保持的部分

- FOUNDATION.md「当前实施决定 / v0.17 文档更新适配」与代码逐条吻合（schema 0.2.0、两类指令、kappa_t=525960、signals.ts 职责边界、开发鉴权 fail-closed、bigint 预留、Redis 仅预留）。
- website/README 路由表与实际 1:1；README 文档表 9 个链接全部有效、版本准确。
- v0.16 旧模型（连续势力球、8–20 ly 玻璃墙、真空面积热暴露、缩球删殖民地）均以明确否定句式出现，与 v0.17.0 新模型无混杂。
- §9.1 验收用例与前文机制、M1 时间线（40/44 sim yr = 2,400/2,640 real s、≥11×d_star、h(2000)=0.5h(1000)、44.73 排空）精确对应。
- κ_t、相对论 γ/动能/Δt_warn、K 各档功率与 K_max、热沉 180/44.73、EM 消散七档距离、SNR 校准表逐项验算通过。

## 验证记录与修订顺序

- 逐条回归 v0.16.0 R1–R10：全部关闭（见上表）。
- 复算 §3.4 表 0.10c 列两格（R1）与 §4.1 ν/GW 消散口径（R2），确认错误。
- 对照 `packages/sim-core`、`packages/contracts`、`apps/`、`scenarios/m1`、`website/` 现状核查 M1-M2 交付与验收清单（R12–R15）。
- 抽验 `scripts/calibration/sim_results.json` 汇总与 §9.2 表一致（66.1%/69.1%、865 yr、48.6%、2,103.5 ly 等）。

建议修订顺序：先修 R1、R2 的数值/口径与 R3–R5 的真源与命名；随后按 FOUNDATION 对齐 M1-M2 §2.2–2.3 的实现范围标注（R12–R15）；再补 R6–R11 的分档、量纲与缺参；最后清理 R16–R23。R10–R11 中需要新增数值基准的项（Φ_ref、Φ_kill、P_beam、Ξ(t) 参数）在补齐前应显式标注「待定」，不得空缺引用。
