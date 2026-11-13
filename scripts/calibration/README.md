# 数值标定与蒙特卡洛生态仿真（GDD v0.13.0）

本目录保存与 [`DESIGN.md`](../../DESIGN.md)（v0.13.0）第 9 节对应的**离线数值标定与生态推演参考实现**（Python）。

> [!NOTE]
> 本目录脚本仅用于数值标定、平衡性验证与图表回归，**不是** M1 阶段 [`docs/specs/ARCHITECTURE.md`](../../docs/specs/ARCHITECTURE.md) 规划的正式 TypeScript 运行时（`packages/sim-core`、`scenarios/m1`）。后续进入 M1 开发时，可将其常量与分布作为 `sim-core` 单元测试的参考真值。

## 文件说明

| 文件 | 作用 |
| :--- | :--- |
| `sim_civ_dynamics.py` | 4 套策略（`balanced`、`obs_rusher`、`hermit`、`expander`）× 1,000 次、跨度 5,000 模拟年的蒙特卡洛仿真（确定性种子 `10000 * s_idx + i`），输出 `sim_results.json` |
| `plot_sim_svg.py` | 读取 `sim_results.json` 并生成四联演化曲线图 `sim_curves.svg` |
| `sim_results.json` | GDD `v0.13.0 §9.2` 对应的 4,000 次仿真参考统计数据与系综曲线 |
| `sim_curves.svg` | 四联演化曲线矢量图（存活率、平均危机概率、PSI 双通道压力、累计发现他者比例） |
| `sim_curves.png` | 由无头 Chrome 导出的位图预览（`1120×820`） |

## 依赖环境

- Python 3（仅额外依赖 `numpy`）
- 可选：Google Chrome（仅在需要重新将 `sim_curves.svg` 栅格化为 `sim_curves.png` 时使用）

## 运行方式

在仓库根目录执行：

```bash
python3 scripts/calibration/sim_civ_dynamics.py
python3 scripts/calibration/plot_sim_svg.py
```

如需更新 PNG 预览图（macOS）：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --window-size=1120,820 \
  --screenshot=scripts/calibration/sim_curves.png \
  "file://$(pwd)/scripts/calibration/sim_curves.svg"
```

## 参考基准（对应 GDD v0.13.0 §9.2）

- **稳健流 (`balanced`)**：5,000 年存活率 `89.7%`，终生锁定邻近信号 `29.2%`（中位时间 `2075 yr`，中位距离 `354.7 ly`），盲亡比例 `10.2%`
- **激进观测赌徒流 (`obs_rusher`)**：5,000 年存活率 `29.2%`，终生锁定 `10.2%`，人均濒危危机 `1.44` 次，盲亡者中 `10.95%` 触发死后光锥回响
- **单星隐士 (`hermit`)**：5,000 年存活率 `8.2%`，冷战自毁 `0` 次，主要因不扩泡而暴露于 `B1b` 恐龙级小行星撞击（488/1000）与 `B4` 超新星近爆（419/1000）
- **激进扩泡 (`expander`)**：5,000 年存活率 `10.4%`，`832/1000` 死于高 `SDI` 同步撕裂触发的冷战自毁（人均 `2.57` 次濒危危机）
