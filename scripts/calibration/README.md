# 数值标定与蒙特卡洛仿真脚本

本目录保存 `DESIGN.md`（**v0.18.0 编号星域与连续物理场** §3.3、§5.2、§6、§7、§9.2）对应的文明动力学、人类生产力拟合曲线、`2,700` 个编号宏观星域注册表（星域不稳定性与银河宜居带原生诞生权重）、R1–R9 与**多信使星泡 / 定向远征模型**确定性验收校验，以及 5,000 年全席位统一大过滤器（单行星生物圈瓶颈 `SDI` 与连续星域物理导出的 `B1–B4`）五策略蒙特卡洛验证脚本及产出（全服唯一时间倍率 `1 real min = 1.00 sim yr`，$\kappa_t = 525{,}960$）。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| [`sim_civ_dynamics.py`](sim_civ_dynamics.py) | 文明动力学仿真与验收脚本：验证人类风格化基准拟合 $\Pi_{\text{emp}}(\tau)=\exp(5.1332\,\tau^{3.6})$（1500–2022 年十个关键年份，$R^2_{\log}=0.9937$）；校验 `2,700` 个编号宏观星域 `SEC-R{00..24}-A{00..35}-{ZS/ZM/ZN}` 的 GHZ 诞生权重与不稳定性分布、R1–R9 与多信使物理确定性自检（`--verify`）；并按真实星域诞生权重与恒星连续参数（光谱 `F/G/K/M`、系统年龄、残余碎屑盘、耀斑活性及前身星绑定 `B4`）对 5 类演化策略在 4 种配对托管/护航模式下各跑 `N = 1,000` 次独立推演（5,000 仿真年，`dt = 5` 年） |
| [`plot_sim_svg.py`](plot_sim_svg.py) | 读取 `sim_results.json`，动态标注最新存活率并生成 6 联深空主题 SVG 标定曲线图（含存活率、规模 $K(t)$、加点速率 $v_E(t)$、累计演化点 $E_{\text{cum}}(t)$、脆弱度 $\text{SDI}(t)$、多信使邻域锁定率） |
| [`sim_results.json`](sim_results.json) | 20,000 局配对连续银河蒙特卡洛聚合数据、2,700 星域汇总、连续分位带/径向/光谱切片、15,000 席位全服投影及五策略时序均线输出 |
| [`sim_curves.svg`](sim_curves.svg) | 6 联仿真拟合曲线矢量图（`1140×1210`） |
| [`sim_curves.png`](sim_curves.png) | 由 SVG 导出的位图快照（便于 GitHub / 评审阅览） |

## 本期核心标定结果（v0.18.0 · 2,700 编号星域 + 连续天文物理灾变 + 单行星生物圈瓶颈）

- **人类风格化生产力拟合**（1500–2022 年 522 年十个关键年份 `[1500, 1600, 1700, 1820, 1870, 1913, 1950, 1973, 2000, 2022]` 复合基准，归一化历程 $\tau \in [0, 1]$）：$\Pi_{\text{emp}}(\tau) = \exp(5.1332\,\tau^{3.6})$，$R^2_{\log} = 0.9937$，终点倍率 `169.56x`。
- **2,700 个编号宏观星域分布**：银心核球 `SEC-R00..R04`（540 个）中面平均不稳定性 `0.716`，原生诞生占比压低至 `6.48%`；内盘旋臂 `SEC-R05..R08`（432 个）中面 `0.399`，占比 `31.62%`；银河宜居带 `SEC-R09..R16`（864 个，含太阳环 `SEC-R13-A10-ZM`）中面 `0.188`，原生诞生占比峰值 **`51.14%`**；外盘稀疏带 `SEC-R17..R24`（864 个）中面 `0.091`，占比 `10.75%`。
- **关键节点与多信使发现分布**（`balanced` 无 L1 基准）：`med_t_crit = 220 yr`、`med_t_ref = 335 yr`（340 年均值 $K = 0.733$）、`med_t_multiplanet = 360 yr`、`med_t_multistar = 880 yr`；EM 消散阈值（`F_diss`）维系了开局大沉默（`<= 345 yr` 锁定仅 `0.1%`），而后伴随多恒星网与 `观测 Lv.3–4` 解锁 **$1/r$ 引力波三角定位**（`lock_gw = 50.2%`，总弱异常 `83.2%`、总锁定 `65.3%`；`P25/P50/P75 = 1,625 / 1,995 / 3,045 yr`，中位距 `1,987.6 ly`），而单恒星 `system_hermit`（`0.0%` GW / $\nu$）仅靠近距 EM 取得 `25.5%` 锁定（中位距 `365.4 ly`）。
- **五策略大过滤器分离度（`N = 1,000` / 策略，真正无 L1 自动偏转 `no_deflect` vs 开启 L1 哨兵 `l1_armed_with_plan`）**：
  - `system_hermit`：**`98.5%` / `98.5%`**（均值寿命 `4,928.9 yr`，幸存者均 $K=1.050$，离开单星生物圈后不跨星、极低滞后，唯锁死 $K\le 1.05$ 且无多星 GW 阵）
  - `balanced`：**`88.8%` / `90.3%`**（均值寿命 `4,611.4 yr`，幸存者均 $K=1.575$、累计点 `85.0 pts`；**86.5% 摇篮 `B2=0`、97.3% 无局部 `B4`**，总天灾死因仅 `0.8%`，主风险转为稀疏外盘跨星同步滞后 `ColdWar = 10.4% → 8.9%`；配对 `periodic_manual_no_queue` 因停工 `3,412.5 yr` 存活率降至 `77.2%`）
  - `expander`：**`55.1%` / `70.4%`**（均值寿命 `3,315.6 yr`，无 L1 时 `ColdWar_SelfDestruct = 437`；启用 L1 `sdi >= 80 -> detach` 断联自治卸压后 `ColdWar` 降至 `284`，存活率升至 `70.4%`）
  - `planet_hermit`：**`25.3%` / `25.3%`**（均值寿命 `2,651.6 yr`，受单行星高能生物圈闭环瓶颈驱动，主死因转为 `ColdWar_SelfDestruct = 733`，长尾天灾合计仅 `14` 例）
  - `obs_rusher`：**`19.1%` / `19.6%`**（均值寿命 `1,596.3 yr`，前期单行星叠加超前观测负荷 $\Delta_{\text{obs}}$ 致 `SDI_System_Collapse = 487` + `ColdWar = 307` + 天灾 `15` 例）
- **全银河 15,000 席位投影（每 `1,000 sim yr`）**：全盘约爆发 `15.0` 次远距可观测银河级超新星光壳，全服期望事件为 `B1a ≈ 4,255.5`、`B1b ≈ 40.1`、`B2 ≈ 182.5`、`B3 ≈ 7,018.6`、局部 `B4 ≈ 91.2`（集中分布于高不稳定性、高碎屑与 OB 星协区）。

## 复现运行

```bash
python3 scripts/calibration/sim_civ_dynamics.py --verify
python3 scripts/calibration/sim_civ_dynamics.py
python3 scripts/calibration/plot_sim_svg.py
```

如需从 SVG 更新 `sim_curves.png`（macOS 示例）：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --screenshot="scripts/calibration/sim_curves.png" \
  --window-size=1140,1210 --hide-scrollbars --force-device-scale-factor=1 \
  "file://$(pwd)/scripts/calibration/sim_curves.svg"
```
