# 数值标定与蒙特卡洛仿真脚本

本目录保存 `DESIGN.md`（**GDD v0.16.0** §5.2、§6、§9.2）对应的文明动力学、人类生产力拟合曲线与 5,000 年全席位统一大过滤器（`SDI` 自毁与 `B1–B4` 天灾）五策略蒙特卡洛验证脚本及产出（全服唯一时间倍率 `1 real min = 1.00 sim yr`，$\kappa_t = 525{,}960$）。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| [`sim_civ_dynamics.py`](sim_civ_dynamics.py) | 文明动力学仿真脚本：验证人类宏观复合生产力拟合 $\Pi_{\text{emp}}(\tau)=\exp(5.1332\,\tau^{3.6})$（$R^2_{\log}=0.9937$），并以状态耦合指数生产力曲线 + 三模态随机谐波 / Ornstein-Uhlenbeck 漂移 / Poisson 随机跃迁驱动连续演化点产出速度 $v_E(t)$ 与非线性科技成本（`1 / 2 / 4 / 8 pts`），对 5 组无 L1 自动防线的经典演化策略各跑 `N = 1,000` 次独立推演（5,000 仿真年，`dt = 10` 年） |
| [`plot_sim_svg.py`](plot_sim_svg.py) | 读取 `sim_results.json`，生成 6 联深空主题 SVG 标定曲线图（含存活率、规模 $K(t)$、加点速率 $v_E(t)$、累计演化点 $E_{\text{cum}}(t)$、脆弱度 $\text{SDI}(t)$、邻域锁定率） |
| [`sim_results.json`](sim_results.json) | 5,000 局蒙特卡洛聚合数据、人类生产力拟合统计与五策略时序均线输出 |
| [`sim_curves.svg`](sim_curves.svg) | 6 联仿真拟合曲线矢量图（`1140×1210`） |
| [`sim_curves.png`](sim_curves.png) | 由 SVG 导出的位图快照（便于 GitHub / 评审阅览） |

## 本期核心标定结果（GDD v0.16.0 · 全席位统一大过滤器基准）

- **人类宏观生产力拟合**（Maddison GDP 与初级能源复合锚点，归一化历程 $\tau \in [0, 1]$）：$\Pi_{\text{emp}}(\tau) = \exp(5.1332\,\tau^{3.6})$，$R^2_{\log} = 0.9937$，终点倍率 `169.56x`。
- **关键节点与加点速率**：临界点中位数 `med_t_crit = 230 yr`（`3.83 real h`）、参考标定中位数 `med_t_ref = 340 yr`（`5.67 real h`，均值 $K = 0.728$）；连续非线性加点成本为 $C(L)=2^{L-1}$（`1 / 2 / 4 / 8 pts`，单分支满级 15 点，五分支满级 75 点），`world_up` / `k_tier_up` 不耗演化点。
- **全席位统一大过滤器五策略分离度**（`N = 1,000` / 策略，人机同律——无论人类玩家或 AI，若未建立多行星冗余、研发防御并配置 L1 离线反射规则 `b1_warning -> deflect_b1` 等，同样面临以下自毁与天灾淘汰风险）：
  - `balanced`：`62.2%` 存活（均值寿命 `3,251.1 yr`，幸存者均 $K=1.792$，幸存者累计点 `92.2 pts`，邻域锁定 `19.1%`，危机 `0.43` 次）
  - `obs_rusher`：`48.1%` 存活（均值寿命 `2,612.0 yr`，幸存者均 $K=1.724$，早期防卫/治理滞后导致 `B1a+B1b+B2=326` 及 `14` 例 `SDI_System_Collapse`）
  - `system_hermit`：`27.2%` 存活（均值寿命 `2,480.4 yr`，`K <= 1.05` 上限，主死因 `B4_Supernova = 515`）
  - `expander`：`12.1%` 存活（均值寿命 `1,507.8 yr`，盲目扩张引发冷战自毁 `ColdWar_SelfDestruct = 586`，平均危机 `5.31` 次）
  - `planet_hermit`：`6.4%` 存活（均值寿命 `1,584.5 yr`，主死因 `B1b_Extinction_Impact = 455` + `B4_Supernova = 349`）

## 复现运行

```bash
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
