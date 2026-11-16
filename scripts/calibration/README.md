# 数值标定与蒙特卡洛仿真脚本

本目录保存 `DESIGN.md`（**GDD v0.17.0** §5.2、§6、§7、§9.2）对应的文明动力学、人类生产力拟合曲线、R1–R9 与**多信使星泡 / 定向远征模型**确定性验收校验，以及 5,000 年全席位统一大过滤器（`SDI` 自毁与 `B1–B4` 天灾）五策略蒙特卡洛验证脚本及产出（全服唯一时间倍率 `1 real min = 1.00 sim yr`，$\kappa_t = 525{,}960$）。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| [`sim_civ_dynamics.py`](sim_civ_dynamics.py) | 文明动力学仿真与验收脚本：验证人类风格化基准拟合 $\Pi_{\text{emp}}(\tau)=\exp(5.1332\,\tau^{3.6})$（1500–2022 年十个关键年份，$R^2_{\log}=0.9937$）；执行 R1–R9 与 v0.17.0 模型（$0.10c$ 定向跨星远征与离散星网、断联自治与 $1.00c$ 再并网、超距 `SDI>=100%` 外围叛离、多星 B1b 摧毁外围节点、EM $1/r^2 e^{-\kappa r}$ 空心光壳与消散阈值 $F_{\text{diss}}$、中微子 $\kappa_\nu=0$ 无视隐匿粗方向检出、引力波 $h\propto 1/r$ 振幅与 $\ge 3$ 星三角定位）确定性自检（`--verify`）；在 Gaia 太阳邻域泊松星场（$\rho_*=0.00233\ \mathrm{ly}^{-3}$，$R \le 25\ \mathrm{ly}$）与 100,000 ly 银盘多信使宇宙中，对 5 类演化策略在 4 种配对托管/护航模式下各跑 `N = 1,000` 次独立推演（5,000 仿真年，`dt = 5` 年） |
| [`plot_sim_svg.py`](plot_sim_svg.py) | 读取 `sim_results.json`，动态标注最新存活率并生成 6 联深空主题 SVG 标定曲线图（含存活率、规模 $K(t)$、加点速率 $v_E(t)$、累计演化点 $E_{\text{cum}}(t)$、脆弱度 $\text{SDI}(t)$、多信使邻域锁定率） |
| [`sim_results.json`](sim_results.json) | 20,000 局配对蒙特卡洛聚合数据、8h / 24h / 3.5d 生存与停工对比表、EM/$\nu$/GW 多信使检出统计、人类生产力拟合统计与五策略时序均线输出 |
| [`sim_curves.svg`](sim_curves.svg) | 6 联仿真拟合曲线矢量图（`1140×1210`） |
| [`sim_curves.png`](sim_curves.png) | 由 SVG 导出的位图快照（便于 GitHub / 评审阅览） |

## 本期核心标定结果（GDD v0.17.0 · 多信使衰减星泡 + $0.10c$ 定向远征 + 配对护航对照）

- **人类风格化生产力拟合**（1500–2022 年 522 年十个关键年份 `[1500, 1600, 1700, 1820, 1870, 1913, 1950, 1973, 2000, 2022]` 复合基准，归一化历程 $\tau \in [0, 1]$）：$\Pi_{\text{emp}}(\tau) = \exp(5.1332\,\tau^{3.6})$，$R^2_{\log} = 0.9937$，终点倍率 `169.56x`。
- **关键节点与多信使发现分布**（`balanced` 无 L1 基准）：`med_t_crit = 220 yr`、`med_t_ref = 325 yr`（340 年均值 $K = 0.737$）、`med_t_multiplanet = 350 yr`、`med_t_multistar = 865 yr`；EM 衰减消散阈值（`F_diss`）限制了早期弱辐射泛滥（`<= 345 yr` 锁定仅 `0.1%`），而后伴随多恒星网与 `观测 Lv.3–4` 解锁 **$1/r$ 引力波三角定位**（`lock_gw = 39.1%`，全信使总弱异常 `60.3%`、总锁定 `48.6%`，含独占中微子穿透隐匿弱异常 `1.1%`；`P25/P50/P75 = 1,635 / 1,975 / 3,035 yr`，中位距 `2,103.5 ly`），而停留在单恒星的 `system_hermit`（`0.0%` GW / $\nu$）仅靠 EM 取得 `16.5%` 锁定（中位距 `371.8 ly`）。
- **五策略大过滤器分离度（`N = 1,000` / 策略，真正无 L1 自动偏转 `no_deflect` vs 开启 L1 哨兵 `l1_armed_with_plan`）**：
  - `balanced`：**`66.1%` / `69.1%`**（均值寿命 `3,522.9 yr`，幸存者均 $K=1.549$、累计点 `80.4 pts`；启用 L1 使 `B1b` 死亡自 `94` 降至 `67`、`ColdWar` 自 `47` 降至 `43`；配对 `periodic_manual_no_queue` 因每 8h 上线一次停工达 `1,553.8 yr`、存活率降至 `34.2%`）
  - `system_hermit`：**`64.5%` / `64.5%`**（均值寿命 `3,509.6 yr`，幸存者均 $K=0.995$，停在摇篮内零 $\Delta_{\text{lag}}$ 与零远征但不能解锁 `存续 Lv.3` 与 `观测 Lv.3+` 致 `B4_Supernova = 151` 与 `B1b = 106`）
  - `expander`：**`35.6%` / `49.9%`**（均值寿命 `2,244.2 yr`，无 L1 时 `ColdWar_SelfDestruct = 320`；启用 L1 `sdi >= 80 -> detach` 断联自治卸压与 `deflect_b1` 后 `ColdWar` 降至 `185`，存活率升至 `49.9%`）
  - `obs_rusher`：**`33.4%` / `35.6%`**（均值寿命 `2,031.4 yr`，幸存者均 $K=1.560$，天灾 `B1a+B1b+B2+B4 = 554` 及 `25` 例 `SDI_System_Collapse`）
  - `planet_hermit`：**`14.7%` / `14.7%`**（均值寿命 `1,910.7 yr`，主死因 `B1b_Extinction_Impact = 565` + `B4_Supernova = 174`）

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
