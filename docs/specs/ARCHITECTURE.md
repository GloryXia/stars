# 《光锥之外》技术架构

设计基线为 **GDD v0.17.0**。本文定义 M1–M4 的模块边界、**银河系尺度（100,000 ly）万级同服架构**、**海外 Web-First + Google 登录交付链路**、数据流与验收条件。规则与数值查 GDD，席位投影、幂等指令与预留 Agent 扩展总线查配套席位契约；技术选型、内部数据结构与待定口径默认方案属于实施提案。[GDD §9](../../DESIGN.md#implementation-and-acceptance) · [席位契约规格](SEAT-CONTRACT.md)

---

## 1. 总体架构

全服共用**单一长期运行、不强制清档的 100,000 光年扁平旋臂圆盘银河系**（$D_{\text{disk}}=100{,}000\ \mathrm{ly}$，有效薄盘厚度 $H_{\text{thin}}\approx 1{,}500\ \mathrm{ly}$，程序化恒星基数 $\sim 1.5\times 10^{11}$，活跃文明席位容量 $M=15{,}000$，可扩展至 $10{,}000\text{–}30{,}000$），采用**全服唯一时间倍率 `1 real min = 1.00 sim yr`（$\kappa_t=525{,}960$，$1\ \mathrm{ly}$ 光行时间 $\equiv 1\ \mathrm{real\ min}$）**，依托**中国大陆境外云区域 + 全球 Anycast CDN 边缘节点 + 海外独立域名**提供低延迟 HTTPS / WSS 服务。

服务端不执行强制删档清零，并借助**空间八叉树 + 最大波壳消散半径 $R_{\text{diss}}$ 剪枝 + 相对论因果前瞻分片（Causal Sector Shards）**支撑万级席位在同一连续宇宙空间内异步降生、全速离线演进（$m_{\text{offline}}=1.00$ + 5 槽 `build_queue` + 长线 `allocation_plan` 托管）与长期演化，严格杜绝跨分片超光速泄露。客户端 HUD（Web-first + Capacitor iOS/Android）、服务端 L1 确定性哨兵护航、内置生态 AI 以及 M4+ 预留扩展的外部 Agent 副官统一消费同口径 `SeatViewProjection`，所有控制指令均经统一 `SeatCommand` 仲裁入口进入仿真内核。[GDD §3](../../DESIGN.md#space-and-geometry) · [GDD §8](../../DESIGN.md#systems-and-constitution)

```mermaid
flowchart LR
    Web["Web 客户端（主端 · Three.js/WebGL2 浮动原点 + 响应式 HUD）"] <-->|"HTTPS / WSS (Google OIDC)"| Edge["海外全球 CDN + Anycast 会话网关集群"]
    Mob["iOS / Android 壳端（辅端 · Capacitor 复用 Web 包）"] <-->|"HTTPS / WSS (OIDC PKCE)"| Edge
    Edge <--> Auth["海外鉴权服务（Google OIDC 主接入 / Apple Sign-In iOS 合规）"]
    Edge <--> Router["空间席位路由与权限校验"]
    Router <-->|"SeatCommand / ViewDelta"| Sectors["因果前瞻星区分片集群（Spatial Octree + Lookahead Ghost Zone）"]
    Sectors <--> Sim["权威仿真核 sim-core（唯一时钟 κ_t=525960 + 波前队列 + 离线建造队列 + L1 护航）"]
    Sectors <--> Store[("海外托管 PostgreSQL + Redis + 1.5×10¹¹ 确定性星表/稀疏增量存储")]
    ExtAgent["[M4+ 预留] 外部 Agent / SDK 副官"] -.->|"M1–M4 默认关闭 · 统一 ActorPrincipal"| Router
```

| 层 | 推荐技术栈 | 交付与部署方式 |
| --- | --- | --- |
| **Web 游戏客户端（主交付）** | TypeScript、Three.js（WebGL2 / InstancedMesh + Camera-Relative Floating Origin）、原生响应式 HTML/CSS 暗室 HUD、Vite | 单套现代 Web 工程直出 PC 桌面浏览器与移动 Safari / Chrome，零应用商店包体审批周期，随海外 CDN 瞬时灰度更新。 |
| **移动端辅端（iOS / Android）** | Capacitor（复用 Web 工程构建产物 + 系统 Haptics / 安全区 / App-Switch PKCE 插件） | 辅端交付渠道；iOS 端在提供 Google 登录的同时按 App Store Guideline 4.8 预留 `Sign in with Apple` OIDC 对等槽位，与 Web 端账号体系互通。 |
| **海外边缘与鉴权** | Overseas Cloud + Global CDN + Anycast WSS + Google OAuth 2.0 / OIDC | 脱离微信小程序／小游戏与内地 ICP／白名单体系；采用海外域名、TLS 1.3、`httpOnly` 会话 Cookie + WSS 短期票据，无微信运行时依赖。 |
| **万级单图仿真集群** | TypeScript / Node.js Worker Threads 或 Rust / Go 高吞吐分片算核（M1–M2 先用 TS `sim-core` 统一参考语义） | 按三维星图八叉树将万级席位切分至多台扇区计算节点；相邻分片借助物理最大作用视界与 $c$ 有限光速建立**因果前瞻幽灵带（$\Delta t_{\text{lookahead}}=L_{\text{ghost}}/c$）**，保证分片结算与全图单线程参考结果逐比特一致。 |
| **星表与稀疏增量存储** | 2,700 扇区宏观编号注册表（`SEC-Rxx-Axx-Zx`）+ 确定性子细胞星表生成器 + PostgreSQL（稀疏增量与快照） + Redis（扇区路由与热缓存） | **不将 $\sim 1.5\times 10^{11}$ 颗恒星落库或常驻内存**：仅常驻 `25×36×3 = 2,700` 个宏观星域编号的物理摘要（恒星密度 $\rho_*$、星域不稳定性指数 $\mathcal{I}_{\text{sec}}$、原生诞生权重 $W_{\text{birth}}$、前身星比例与金属丰度梯度），局部恒星坐标与光谱仅按 `(galaxy_seed, sector_id, subcell_id)` 按需推导即弃；数据库与 WAL 仅持久化文明态、被占/修改/毁伤节点与既建信标设施（Sparse Delta Overlay）、在途波前与事件提交水位。 |
| **离线队列、加点托管、L1 哨兵与预留 Agent 接口** | 服务端 5 槽 `build_queue` + 20 步 `allocation_plan` 托管 + 3 槽确定性白名单 L1 哨兵自动机（M1–M4）；M4+ 可插拔 `external_agent` 网关 | **M1–M4 移除所有大模型运行时与 MCP Server**；以统一 `ActorPrincipal` 与 `SeatCommandEnvelope` 保留离线加点托管、哨兵规则防御与未来扩展面。[席位契约 §4](SEAT-CONTRACT.md#4-l1-离线确定性护航与-m4-外部-agent-扩展边界) |

| 代码目录 | 职责 |
| --- | --- |
| `packages/sim-core` | 零 UI / 网络依赖的几何计算、双时钟（$\kappa_t=525{,}960$）、人类拟合生产力与随机过程、预设建造队列、节点/链路、曝光积分、毁伤与事件队列。 |
| `packages/contracts` | 席位视图投影、统一指令信封 `SeatCommand`、`ActorPrincipal` 权限枚举与灭亡简报载荷及运行时校验（Web、Capacitor 与服务端共用）。 |
| `packages/ui-tokens` | 设计令牌（深空暗室色板、航电几何、字体、比例尺与静谧状态语义，CSS Variables 与 Three.js 材质常数同源）。 |
| `packages/i18n` | 双语本地化词典与格式化规则（首期支持 `en` 与 `zh-CN`，隔离机器契约字段与展示文案）。 |
| `apps/sim-cli`、`scenarios/m1` | 固定种子 CLI、M1 夹具复跑、单机万级空间分片差分校验、§9.2 大过滤器五策略蒙特卡洛回归对照。 |
| `apps/game-server` | 海外 OIDC 鉴权、Anycast WSS 网关、因果扇区分片调度器、稀疏持久化、内置生态 AI、全速离线队列与 L1 护航。 |
| `apps/web-client`、`apps/capacitor-shell` | Web-first 游戏主端（Three.js + Responsive HUD）与 iOS/Android Capacitor 原生薄壳打包工程。 |
| `website/` | 独立静态官网、游玩说明页（`/guide/`）及登录/注册/进入游戏/下载应用预留静态路由。 |

---

## 2. 仿真内核与万级单图数据所有权

| 状态域 | 内容、存储位置及更新条件 |
| --- | --- |
| **宏观星域注册表与按需背景星表** | 先由 `(galaxy_seed, sector_id)` 维护 `2,700` 个编号星域（`SEC-R00..R24-A00..A35-ZS/ZM/ZN`）的连续物理底图参数（$\rho_*$、$\mathcal I_{\text{sec}}$ 不稳定性、$W_{\text{birth}}$ 诞生权重、金属丰度与前身星占比）；局域恒星坐标、光谱型、系统年龄与光度权重 $\omega_i$ 再按子细胞哈希无状态按需计算，只读公开。 |
| **长期运行稀疏世界状态** | **仅存储偏离基准底图的稀疏增量**（Sparse Delta Overlay）：被占据/纳入/毁伤的恒星节点、行星据点数 $N_{\text{worlds}}$、文明包络轨迹段、既建物理引力波信标（`信标 Lv.4`）、灭绝废墟/死域与在途信号/武器；由物理仲裁与分片计算核持有。 |
| **节点当地状态** | 已部署设备、当地产能/冗余台账、当地已知链路与有效期、已抵达指令、L1 哨兵预授权规则（含 `b1_warning -> deflect_b1`、`vent_sink` 等）及当地观测采样。仅按该恒星系节点自身因果事件序更新。 |
| **指挥核知识状态** | 已确认受控节点与已确认能力摘要（`k_value`、`k_max_confirmed`、`r_persist`）、`links` 有向链路报告、`pending_frontier_requests`、多历元观测/星历证据、可见 SDI 分项、连续演化点流 `evo_points_avail` / $\Pi(t)$、预设建造队列 `build_queue` 与长线加点托管计划 `allocation_plan`。仅在指挥核当地事件与送达报告后更新，禁止远端物理损毁超光速同步 `k_value` 或资源可用状态。 |
| **席位视图投影** | 由指挥核知识裁剪生成的授权视图（应用世代局部 $SO(3)$ 旋转、隔离目标 ID 与字段白名单）。Web HUD、Capacitor 壳端、内置 AI 及未来外部 Agent 消费同一视图版本。[席位契约 §2](SEAT-CONTRACT.md#2-同口径席位视图投影read-projections) |

### 2.1 唯一时间倍率、全速离线队列与排程

- **物理模拟钟（`*_sim_s`）**负责波前传播、恒星自行、相对论载具轨迹、SDI 脉冲/应变衰减（$\tau_{\text{pulse}}=40\ \mathrm{sim\ yr},\,\tau_{\text{lag}}=15\ \mathrm{sim\ yr}$）、人类拟合生产力随机叠加步进（三模态周期 / OU 漂移 / Poisson 跃迁）与热力学积分。内部几何使用 IEEE-754 双精度光年坐标（在 $50{,}000\ \mathrm{ly}$ 处精度优于 $10^{-11}\ \mathrm{ly}$）。
- **现实操作钟（`*_real_s`）**与物理模拟钟通过**全服唯一锁定倍速 $\kappa_t = 525{,}960$（`1 real min = 1.00 sim yr`，$1\ \mathrm{ly}$ 光行时间 $\equiv 1\ \mathrm{real\ min} = 60\ \mathrm{real\ s}$）**严格换算：科技、`world_up` 施工、冷却与热沉窗口等**权威工期锚定 `sim_yr`**，`*_real_s` 只提供人机节奏换算读数；凝视驻留（$\tau_0=2.5\ \mathrm{real\ s}$）与 Lv.4 焦点轨重构（`45 real s = 0.75 sim yr`）为即时仪器阻尼反馈。[GDD §3.4](../../DESIGN.md#space-and-geometry) · [GDD §5.2](../../DESIGN.md#traits-and-tech)
- **连续演化点积分与全速离线队列／加点托管**：服务端在物理时间步按 $v_E(t)=v_{E0}\,\Pi(t)\,P_{\text{pop}}\,I_{\text{sci}}\,m_{\text{offline}}$（其中在线与离线统一取 **$m_{\text{offline}}=1.00$**）对连续点数 `evo_points_avail` 积分，升级按几何阶梯 `1 / 2 / 4 / 8 pts` 扣除；严格维护 `build_queue`（上限 5 项）与长线 `allocation_plan`（最多 20 步）的 FIFO 状态机（`ready` / `waiting_points` / `waiting_prerequisite`），在前项完工、积分跨过费用门槛、前置（含跨星回执）更新或移除队首时重估并仅扣点一次无缝开工。
- **事件队列与因果分片一致**：单个算核或扇区分片严格按 `(due_sim_ms, phase_rank, stable_seq)` 出队，到达时刻向上量化至整数模拟毫秒以杜绝早到，几何求交、剂量与指数曲线仍以 IEEE-754 双精度求值。由于真空中物理信号传播严格满足 $|\mathbf v|\le c$，分片边界设置厚度为 $L_{\text{ghost}}$ 的冗余邻区：分片内部可独立安全向前推进 $\Delta t_{\text{safe}} < L_{\text{ghost}}/c$ 而无需等待远区全局锁，边界外发事件通过有序因果邮箱（Causal Mailbox）按 `t_emit_sim_s` 投递；任何跨分片优化在 M3 须与 M1 全图单核参考实现做**逐事件差分等价测试**。

### 2.2 离散恒星网络、定向远征与波壳解耦

跨恒星扩张不再依靠“推大连续势力半径扫过真空”，而由指挥核显式下达 `dispatch_expedition` 从己方活跃枢纽向目标恒星派出 **$0.10c$ 定向远征舰队**（在途持续发射 $1.00c$ 扩散衰减的热与中微子信号波壳）；到达当地并建成节点后回传 $1.00c$ 确认回执，未抵前指挥端仅见等待态。**下达 `detach_outer_node`（手动或 L1 规则）绝不物理销毁已建远端恒星**，而是使其转入**断联自治待机**（卸载中心 $\Delta_{\text{lag}}$，重新接入仅需 $1.00c$ 往返握手）。链路预算与有向可用路径分开确认，迟到旧采样不覆写较新确认状态。[席位契约 §2](SEAT-CONTRACT.md#关键因果与网络摘要约束)

### 2.3 多信使波壳、观测、自毁与天灾毁伤

| 计算链 | 内核与分片处理 |
| --- | --- |
| **空间八叉树 → 物理接触** | 按各波段物理消散界限 $R_{\text{diss}}$ 做空间八叉树剪枝；彻底取消“真空球交叠摩擦”，仅当近距共享恒星节点／中继产生真实物理争夺且冲突报告以光速抵达指挥核时，连续收到冲突每满 `10 sim yr` 计入摩擦，双向 `[PING]` 或脱离报告抵达后清零。 |
| **多信使波壳抵达 → 信噪比 → 星历** | 对以 $1.00c$ 扩散的多信使波壳分别结算：① **电磁波（EM）** 按 $1/r^2\cdot e^{-\kappa r}$、多普勒 $\mathcal D_r^2\mathcal D_e^4$ 与波壳内EM杂波噪底 $N_{\text{local}}(t)$ 积分，跌破宇宙混杂消散门限 $F_{\text{diss,EM}}$ 即彻底消散（开启 `EMCON`/热沉后更早射出的光子继续外传形成**空心波壳**，绝不对虚拟面积施以 $R^2/R_0^2$ 乘子）；② **中微子（$\nu$）** 按 $1/r^2$（$\kappa_\nu\equiv 0$）无视 `heat_sink` / `blackbody_mimic` 与宿主光雾穿透，但在 `Obs Lv.3+` 仅产出 Stage 1 宽角误差锥；③ **引力波（GW）** 感测线性应变 **$h\propto 1/r$**（$\kappa_{\text{GW}}\equiv 0$、不可屏蔽），在 `Obs Lv.3+` 单星/双星仅出宽弧，须 **$\ge 3$ 颗非共线确认恒星三角定标**方可升级精密定位锁定；④ 长基线 $B_\perp$ 取已确认协同节点的真实空间跨度。 |
| **发射星历 → 在途轨迹 → 毁伤与连续物理天灾** | 发射锚定当时已确认星历及其不确定度；抵达时按真实节点、受照注量（如戴森光束散焦 vs 聚焦）及当地冗余裁定。**全席位统一适用连续星域物理导出的 `B1–B4` 天灾律**（成熟太阳类比带 `B2=0`、`B1b` 百万年尺度、`B4` 严格仅由星表存在真实 `progenitor_unstable` 触发且无前身星则零爆发；年轻碎屑盘、活跃耀斑 M 矮星与银心/OB 星协对应高 $\mathcal I_{\text{sec}}$ 高发险区；B1a/B1b 须手动或通过 L1 `b1_warning -> deflect_b1` 偏转；多恒星 B1b 真实摧毁 1 颗外围受创节点；全银河仍以真实 `~1.5 次/100 sim yr` 产生全盘可观测远方超新星波壳），人类席位无隐形免死。 |
| **当地与指挥核自毁指数（SDI）** | 区分结构分散拥挤度 $\Delta_{\text{density}}(N_{\text{worlds}}, N_{\text{stars,confirmed}})$（不依赖虚拟半径 $R_{\text{civ}}$）、**单行星高能生物圈闭环压力 $\Delta_{\text{conc}}$（$N_{\text{worlds}}=1$ 且 $K\ge K_{\text{crit}}$ 时随能级爬升，建地外据点立即泄压）**、脉冲、活跃恒星网跨度滞后应变（$R_{\text{active}}$ vs $R_{\text{sync}}$）、不衰减热过载与已抵达冲突摩擦并夹紧 `0..100%`；**全席位统一结算连续冷战自毁率 $\lambda_{100}(\mathrm{SDI})$ 与 $s_{\mathrm{raw}}\ge 100\%$ 临界崩解**（超距态触发外围永久叛离解列；否则消耗 `存续 Lv.3` 护盾或触发 `SDI_System_Collapse`）。 |
| **热力学 → 蓄热／排热／过载** | 热沉按启动基准热功率定容 $Q_{\max}=180\times 0.994\,P_{\text{anchor}}$ 并按模拟秒热量积分守恒结算：恒定功率下蓄热 `180 sim yr` 满载后须切入 `vent_sink` 排热（恒定功率下精确耗时 **`44.73 sim yr`**），未切换而继续封印将按 `+1.5 百分点/sim yr` 累计**不衰减的 `E_heat_overload`** 直至切入排热或过载自毁；蓄热期仅压低 EM 辐射，中微子泄漏照常向外传播。 |

---

## 3. 游戏客户端与海外 Web-First 交付链路

### 3.1 Web 优先、移动壳端共享工程

放弃微信小程序与小游戏生态、`wx.*` API 与重型传统引擎包袱；采用 **`apps/web-client`（TypeScript + Three.js WebGL2 + 响应式 HTML/CSS HUD + Vite）作为第一主端**，移动端发布通过 **`apps/capacitor-shell`（Capacitor 包装同一套 Web 构建产物）作为辅端**。两套交付共享 `packages/sim-core`、`packages/contracts`、`packages/ui-tokens` 及完整触控/键鼠交互逻辑：

| 发布目标 | 优先级与阶段 | 交付形态与主要验收 |
| --- | --- | --- |
| **桌面 & 移动 Web 浏览器** | **P0 · 主端（M2 预览，M3 上线）** | 海外域名前端直出桌面（Chrome / Safari / Edge / Firefox）与移动浏览器（iOS Safari / Android Chrome）；首屏 JS/资源增量分包加载，支持 URL 书签直入席位、响应式横/竖屏双布局。 |
| **iOS / Android App（Capacitor 壳端）** | **P1 · 辅端（M3 联调，M4 上架）** | 复用 Web-first 构建产物 + 原生插件（Web Haptics 映射原生 Taptic Engine、系统安全区适配、Google OAuth App-Switch PKCE 回跳、`Sign in with Apple` OIDC 合规入口）。 |

### 3.2 Google 登录与海外服务器／域名链路

```mermaid
sequenceDiagram
    participant U as 玩家浏览器 / Capacitor 壳端
    participant C as 海外 CDN + Web Static Host
    participant G as Google Identity (OIDC PKCE)
    participant API as 海外鉴权 & Anycast WSS 网关
    participant S as 空间分片集群

    U->>C: HTTPS 加载 Web-first 客户端资源
    U->>G: OAuth 2.0 + PKCE 获取 Google authorization_code / ID Token
    U->>API: HTTPS POST /auth/oidc/google (code + code_verifier)
    API->>G: 校验 Google JWKS 签名、aud、iss、nonce & sub
    API-->>U: 签发海外域名 httpOnly 会话 + 短期单次 WSS 接入票据
    U->>API: WSS 建连并订阅 (epoch_id, seat_id, civ_gen) 增量视图
    API->>S: 转发幂等 SeatCommandEnvelope (principal="human")
```

1. **身份与席位隔离**：玩家在 Web 或 Capacitor 壳端发起 **Google OAuth 2.0 / OIDC Authorization Code + PKCE** 登录；海外服务端校验 Google ID Token 签名、绑定唯一 `google_sub` 至内部 `account_id`，维护真人玩家在银河系内的当前席位与灭亡重开后的新世代会话主权。若上架 Apple App Store 需兼容多登录规范，增挂同口径 `apple_sub` OIDC 绑定同一 `account_id`。
2. **海外服务器与全链路传输**：生产集群部署于境外主流云区域（例如 Tokyo / Singapore / US-West / Frankfurt 多区域就近边缘接入，核心状态分片互通高速内网），绑定独立海外域名与全球 CDN；全站强制 HTTPS (TLS 1.3 + HSTS) 与 WSS 二进制/JSON 压缩信道。
3. **资源分发与轻量体验**：不再受小游戏 4MB/20MB 首包限制与微信域名白名单制约；首屏仅下发核心渲染脚本、当前语言包（`en` / `zh-CN`）与对应字体子集及星表着色器（$< 1.5\ \mathrm{MB}$ Brotli），天体纹理与切换语言增量包均由海外 CDN 按需懒加载与持久化 IndexedDB 缓存。

### 3.3 双视角、相机相对浮动原点与低打扰仪表

- **天球仪 & 三维星泡图（Camera-Relative Floating Origin）**：WebGL2 借助 `InstancedMesh` 与定制着色器在 100,000 ly 银河背景星表中高效绘制离散恒星网络、$0.10c$ 远征轨迹及以 $1.00c$ 向外扩张衰减的**多信使波壳（含 EMCON 空心光壳、$R_{\text{diss}}$ 消散外框、中微子粗方向锥与引力波四极涟漪）**；客户端始终以相机聚焦天体为双精度参考原点（$\Delta\mathbf x = \mathbf x_{\text{world}}-\mathbf x_{\text{cam}}$），彻底消除 $50{,}000\ \mathrm{ly}$ 处 `float32` 精度劣化，并严格按席位 $SO(3)$ 与因果抵达状态过滤可拾取对象。
- **人类拟合曲率、加点托管与遥测界面**：HUD 采用低打扰深空配色，展示当前「天时」模拟年、连续点流速 $v_E(t)$、最多 5 项 `build_queue` 与长线 `allocation_plan` 托管进度，以及已抵达的多信使光信；离线断线重连通过 `last_view_version` 增量补齐或快照重建，零丢失连续点数、队列与托管进度。

### 3.4 离线 L1 护航、规则防御与预留 Agent / 沉浸开关

M3 席位设置提供「离线护航与加点托管」面板，玩家可配置长线加点托管计划 `allocation_plan`、最多 5 项近期 `build_queue` 并以纯表单编辑最多 **3 条确定性白名单哨兵槽位**（如 `b1_warning -> deflect_b1` 自动偏转 B1 天灾、`heat_sink_pct >= 98 -> vent_sink` 及时排热防过载、`sdi >= 80 -> detach_outer_node / migrate_seed` 断联卸压或迁徙，支持 `offline_only` 与 `always_armed` 触发模式；系统不提供未配规则的免死兜底，亦不设独立休眠状态）；原「外部副官管理」入口在 M1–M4 展示为**预留扩展槽位说明**，同时在客户端预留 M4+ **极简观星视图开关**扩展点。[席位契约 §4](SEAT-CONTRACT.md#4-l1-离线确定性护航与-m4-外部-agent-扩展边界)

---

## 4. 会话、统一指令总线与 Agent 扩展接口

**读路径**：鉴权服务核验 Google OIDC 会话或内部 Worker 凭据，锁定 `(epoch_id, seat_id, civ_gen)` 映射并由所在扇区分片投影该席位专属视图，严格执行 `SO(3)` 坐标系转换与未披露节点 ID 隔离。

**写路径**：Web HUD、Capacitor 壳端、服务端 L1 护航自动机及内置生态 AI 一律提交统一格式 `SeatCommandEnvelope`，携带 `command_id`（全局幂等键）、`base_view_version` 与 `principal: ActorPrincipal`；同一 `(epoch_id, seat_id, civ_gen, principal.kind, command_id)` 重复投递返回原受理结果，同键异参返回 `409 IDEMPOTENCY_CONFLICT`；M1–M4 期间，网关拦截所有 `principal.kind === "external_agent"` 请求。[席位契约 §3–4](SEAT-CONTRACT.md#3-统一指令信封与领域控制原语)

**扩展性保障（M4+ 重新开放 Agent 辅助）**：`sim-core` 与星区分片 Worker 完全不感知调用方背后是真人玩家鼠标点击、L1 规则引擎还是 LLM Agent——一切逻辑均只识别 `ActorPrincipal.kind` 与 `granted_scopes`。未来随时可在不触动核心仿真、分片协议、PostgreSQL 表结构与 Web 客户端的前提下旁挂独立 `agent-gateway`（支持 MCP / OpenAI Tool / WebSocket SDK）。

---

## 5. 恢复、长期世界留存与灭亡简报

- **M1 复跑**：固定场景 `manifest + timeline.json` 完整保存随机流状态（含生产力随机过程 `harmonics/OU/jump` 状态）、双时钟及队列游标，确保跨机器 100% 数值一致。
- **M3 万级分片 Checkpoint 与 WAL 恢复**：每个扇区分片通过分布式单写者租约（Lease）按序提交权威事件批次与稀疏增量表，定期写入带全球一致因果水位 `epoch_sim_ms` 的快照；节点宕机时可从最近邻区幽灵缓冲与 PostgreSQL Checkpoint 秒级接管重建。
- **M4 长期异步世界留存与灭亡简报（不强制删档）**：
  - 不设全服大坍缩公投、局域系统公约、`monument_ascension` 或全服公共年鉴；
  - 若席位因 `ColdWar_SelfDestruct`、`SDI_System_Collapse`、可致灭绝的 B 类天灾（`B1a`/`B1b`/`B2`/`B4`）或打击灭亡，所在扇区分片按实际物理规律停止其可控活动、在 Sparse Delta Overlay 中原地仅留存物理废墟／死域（及生前已建成的 `信标 Lv.4` 引力波信标设施），继续推进灭亡前已发出的在途波前，并生成事实性 `extinction.report` **灭亡简报**（含死因、灭绝时刻及满足 §7.4 条件时作为灭亡后告知机制的死后光锥回响），供玩家直接重开新摇篮；全银河其余席位无中断继续运行。[GDD §8.3](../../DESIGN.md#systems-and-constitution)

---

## 6. 里程碑与验收

| 阶段 | 可交付结果 | 验收条件 |
| --- | --- | --- |
| **M1 仿真内核** | `sim-core` CLI、种子化场景、全图参考核、非线性生产力与建造队列引擎 | 以下 M1 固定场景（统一 `1 real min = 1.00 sim yr`）全部自动化断言通过；§9.2 人类曲线拟合 $R^2_{\log}\ge 0.99$ 与 5,000 局全席位统一大过滤器五策略分叉回归通过。 |
| **M2 Web 双视角** | Web-first 双视角原型（Three.js 浮动原点 + 低打扰 HUD + 预设队列）、离线时间线播放 | 桌面浏览器键鼠与移动浏览器触控均可完成 4 光年定向远征、波壳消散观测、视角切换、建造队列编排与超时分支；未知节点、中微子弱锥与二维锁不可三维拾取；记录首包 `< 1.5 MB` 与 60 FPS 帧耗时基线。 |
| **M3 万级在线服** | 海外 Google OIDC 登录、Anycast WSS 网关、银河系尺度因果空间八叉树分片（验证 10,000+ 并发/模拟席位）、全速离线托管与哨兵护航、内置生态 AI 与 Sparse Persistence | ① Web 端 Google 登录、离线全速加点托管与断网重连闭环；② 15,000 席位压测中跨分片因果裁定与 M1 全图参考核结果完全一致（差分 `0` 误判）；③ L1 三槽哨兵护航（B1 偏转、热沉自动排热、`detach_outer_node` 断联卸压与迁徙及离线/重连衔接）、统一自毁/天灾灭绝物理留存、灭亡简报（含 §7.4 死后光锥回响告知）与 `ActorPrincipal` 预留网关阻断测试通过。 |
| **M4 长期稳态 & 移动辅端** | 长期异步银盘稳态验证、灭亡简报与直接重开链路、Capacitor iOS/Android 封装 | 复核真人账户会话隔离、物理遗迹、既建 `信标 Lv.4` 设施与在途多信使衰减波壳按物理规律继续留存演进；验证 iOS/Android Capacitor 壳端触感、安全区与登录回跳。 |

### M1 固定场景（统一时间倍率 `κ_t = 525960`，`1 real min = 1.00 sim yr`）

| 场景 | 最小自动化断言 |
| --- | --- |
| **多信使波壳消散与 EMCON 空心壳** | Tier 1 稳态 EM 波壳在 `400 ly`（$> R_{\text{diss,EM}}\approx 206.7\ \mathrm{ly}$）跌破 `F_diss` 彻底消散，即便开启 `Obs Lv.4` 盲扫亦不误检；`50 ly` 处开启 `stealth = 1e-4` 前发出的强光壳于 `t = 120` 仍在途穿过接收者（空心光壳），随后步入 $1.00c$ 扩张的沉默暗腔。 |
| **中微子破壁与 GW $1/r$ 三角定标** | 距 `50 / 80 ly` 开 `blackbody_mimic`（`1e-4`）的 `Tier 2` 对 `Obs Lv.2` 全盲，而中微子经 $\kappa_\nu=0$ 穿透检出粗误差锥弱异常：`50 ly` 需 `Obs Lv.3`、`80 ly` 需 `Obs Lv.4`（Lv.3 作用距离上限约 `59.7 ly`，且仅凭中微子无法精密锁星）；`3,000 ly` EM-dark `信标 Lv.4` 验证 $h\propto 1/r$ 线性应变，单星/双星 `Obs Lv.3` 仅出宽弧，汇齐 `N_stars_confirmed = 3` 基线后三角收敛锁定。 |
| **包含与泡内凝视 / 弱异常** | 噪底随 EM 波壳抵达变化（$\nu$/GW 免疫宿主光雾）。弱信号由凝视检出；`SNR = 2` 弱异常凭 `coarse_dir_vec3` 与 `dir_sigma_rad` 完成转向并积分锁定，无测距证据时保持二维方位锁。 |
| **三角与链式拓扑** | 同一消息（4 ly 直达 vs 8 ly 经中继）在 **4.0／8.0 现实分钟**抵达，基线 4／8 光年。中继失效后链式组保留完好节点归属并继续当地运行，确认路径依报告或等待窗口更新。 |
| **跨星远征回执与断联自治** | 距指挥核 4 ly 候选节点：纯返程光行下，成功与无回执组在第 **4.0 现实分钟**（`240 现实秒`）前指挥端视图一致，成功组在第 **4.0 现实分钟**确认；含 `0.10c` 定向远征舰（`2,400 现实秒`、`40.0 sim yr`）的完整切片于 **`2,640 现实秒`（`44.0 现实分钟`）** 确认（`2,760 秒` 超时）；另验证真实 Tier 1 初态经 `SeatCommand` 跨越 `4.22 / 8.5 ly` 稀疏邻星升 Tier 2，以及 `detach_outer_node` 转断联自治待机与 $1.00c$ 握手恢复。 |
| **远端损毁、B1b 与点打击隔离** | `10 ly` 外节点受损世界与无损毁对照在报告抵达前指挥端全部遥测/点数/动作（含 $\Delta_{\text{density}}(N_{\text{stars,confirmed}})$）完全一致；点打击只移除命中节点，已毁节点不复活；多恒星 B1b 真实摧毁 1 颗外围受创节点；基准单星在内部探索下冗余恒为 1.00，不虚增热辐射或光学基线。 |
| **剂量、热守恒、过载自毁与 B4 物理** | 热沉满蓄 `180 现实分钟`（`180 sim yr`）后若未切入 `vent_sink` 排热，不衰减的 `E_heat_overload` 按 `+1.5 百分点/sim yr` 持续推高直至必然触发过载自毁；切换 `vent_sink` 后恒定基准功率精确耗时 **44.73 现实分钟** 排空且不自毁（功率变化时按热量积分结算）。戴森光束在 1 AU 散焦时无节点毁伤，聚焦达阈时判毁。B4 按星表前身星、反平方注量与喷流内外逐节点永久剥离，双观察者共享同源，主序星不可诱导超新星。 |
| **唯一时钟、队列托管、哨兵与灭绝留存** | 全服唯一倍速下 **45 现实秒等于 0.75 模拟年**。离线席位保持 `m_offline = 1.00` 全速发育，验证 `waiting_points` / `waiting_prerequisite` 自动恢复及 `allocation_plan` 托管不重复扣点。L1 哨兵验证 `b1_warning -> deflect_b1`、`vent_sink`、`detach_outer_node` 及重连冷却延续。灭绝夹具验证原址仅留废墟/遗迹（及既建 `信标 Lv.4`）、呈递灭亡简报（满足 §7.4 时附死后光锥回响告知），在途衰减波壳继续传播直至消散。 |

配对隔离测试仅改变未被该席位观测的世界真值，比较信息合法抵达前的 Web HUD 视图、指令错误和事件推送。性能压测在 100,000 光年单图万级设置下覆盖 `15,000` 席位全星图基准，校验八叉树剪枝与因果前瞻分片零语义漂移。[GDD §9.1–9.2](../../DESIGN.md#implementation-and-acceptance)

---

## 7. 待定口径

| 需定稿项 | 实施影响 |
| --- | --- |
| 前沿部署时长、链路预算、报告有效期与重试间隔 | M1 用显式夹具配置覆盖直达、中继、断联与迟到。全服默认参数待 M3 压测后锁定。 |
| 星历误差门限、动能 `D_ref` 到 `D_strike` 的映射 | 决定三维披露与动能毁伤边界（戴森光束基准剂量 $\Phi_{\text{kill},0}=2.0\times 10^{16}\ \mathrm{J/m^2}$ 与 B4 注量式已定稿于 GDD §6.2 / §7.3）。M1 参数化各门限，固定场景验证前后两侧。 |
| 因果前瞻幽灵带宽度 $L_{\text{ghost}}$ 与扇区再平衡周期 | 影响万级单图多核扩展上限；以“跨片大速度包络不突破前瞻窗口”为硬约束，支持负载热迁。 |
| 客户端平滑动效插值策略 | 确保连续点流速 $v_E(t)$ 在高频 WSS 推送中兼顾数值精确（后端按 GDD §5.2 已定稿的三模态谐波／OU／Poisson 参数双精度步进）与前端平滑显示。 |
| L1 白名单结构化条件枚举范围 | 在冻结 `packages/contracts` 前锁定 `ReflexCondition` 允许观察的弱信号／边界接触字段，供 M3 护航与未来 M4+ Agent 共用。 |
| iOS App Store 上架合规细节 | M4 Capacitor iOS 打包发布时同步提供 Google OIDC 与 `Sign in with Apple` 对等入口及海外隐私声明。 |
