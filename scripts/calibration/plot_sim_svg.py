"""Generate a crisp 4-panel dark-room astronomical chart SVG from sim_results.json."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / "sim_results.json").read_text(encoding="utf-8"))
summary = data["summary"]
curves = data["ensemble_curves"]

STYLES = {
    "balanced": {"label": "① 稳健均衡（先存续扩星后冲观测）", "color": "#6FE3FF", "dash": ""},
    "obs_rusher": {"label": "② 冷战赌徒（裸奔狂点接收能力）", "color": "#FF8A3D", "dash": "6 3"},
    "hermit": {"label": "③ 单星隐士（N=1微球低噪龟缩）", "color": "#A98BFF", "dash": "2 3"},
    "expander": {"label": "④ 激进扩泡（疆域快于组织同步）", "color": "#FF4FA3", "dash": "9 3 2 3"},
}

W, H = 1120, 820


def map_x(t: float, x0: float, pw: float) -> float:
    return x0 + (t / 5000.0) * pw


def map_y(val: float, vmin: float, vmax: float, y0: float, ph: float) -> float:
    frac = (val - vmin) / (vmax - vmin)
    return y0 + ph - max(0.0, min(1.0, frac)) * ph


def polyline_pts(strat: str, key: str, vmin: float, vmax: float, x0: float, y0: float, pw: float, ph: float) -> str:
    pts = []
    for row in curves[strat]:
        v = row[key]
        if v is None:
            break
        pts.append(f"{map_x(row['t'], x0, pw):.1f},{map_y(v, vmin, vmax, y0, ph):.1f}")
    return " ".join(pts)


svg: list[str] = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="PingFang SC, Noto Sans SC, sans-serif">',
    '<style>',
    '  .title { fill:#E6EEF7; font-size:17px; font-weight:600; letter-spacing:0.6px; }',
    '  .sub { fill:#9AA9BA; font-size:11.5px; }',
    '  .ptitle { fill:#E6EEF7; font-size:13.5px; font-weight:600; }',
    '  .ax { fill:#5C6B7D; font-size:10px; font-family:JetBrains Mono, Menlo, monospace; }',
    '  .lab { fill:#9AA9BA; font-size:10.5px; }',
    '  .grid { stroke:#1A2434; stroke-width:1; }',
    '  .axis { stroke:#2C3E55; stroke-width:1.2; }',
    '</style>',
    f'<rect width="{W}" height="{H}" fill="#05070B"/>',
    '<text x="36" y="34" class="title">真·大沉默宇宙（v3 校准 · 5,000 模拟年 · N=4,000 次蒙特卡洛）四策略演化相图</text>',
    '<text x="36" y="54" class="sub">参数口径：bar_d_civ = 600 ly · K(0)=0.73 · R_sync0 = 1.40 ly · 冷战连续危险率 λ(SDI) + 恐龙级撞击 B1b / 超新星 B4 外部过滤器</text>',
]

# Legend row
lx = 36
for strat, st in STYLES.items():
    svg.append(f'<line x1="{lx}" y1="74" x2="{lx+26}" y2="74" stroke="{st["color"]}" stroke-width="2.2" stroke-dasharray="{st["dash"]}"/>')
    svg.append(f'<text x="{lx+34}" y="78" fill="#E6EEF7" font-size="11">{st["label"]}</text>')
    lx += 265


def draw_panel_box(x0: float, y0: float, pw: float, ph: float, title: str, yticks: list[tuple[float, str]], vmin: float, vmax: float, xunit: bool = True):
    svg.append(f'<rect x="{x0}" y="{y0}" width="{pw}" height="{ph}" rx="6" fill="#080C12" stroke="#1E2B3D"/>')
    svg.append(f'<text x="{x0}" y="{y0-10}" class="ptitle">{title}</text>')
    # Y grid
    for yv, ylab in yticks:
        yy = map_y(yv, vmin, vmax, y0, ph)
        svg.append(f'<line x1="{x0}" y1="{yy:.1f}" x2="{x0+pw}" y2="{yy:.1f}" class="grid"/>')
        svg.append(f'<text x="{x0-8}" y="{yy+3.5:.1f}" text-anchor="end" class="ax">{ylab}</text>')
    # X grid
    for tx in [0, 1000, 2000, 3000, 4000, 5000]:
        xx = map_x(tx, x0, pw)
        svg.append(f'<line x1="{xx:.1f}" y1="{y0}" x2="{xx:.1f}" y2="{y0+ph}" class="grid"/>')
        if xunit:
            svg.append(f'<text x="{xx:.1f}" y="{y0+ph+15}" text-anchor="middle" class="ax">{tx}y</text>')


# Panel 1: Survival Curve S(t)
p1x, p1y, pw, ph = 70, 120, 460, 235
draw_panel_box(p1x, p1y, pw, ph, "① 文明存活曲线 S(t)：多星冗余破局 vs 内外双过滤器", [(0, "0%"), (0.25, "25%"), (0.5, "50%"), (0.75, "75%"), (1.0, "100%")], 0.0, 1.0)
for strat, st in STYLES.items():
    pts = polyline_pts(strat, "surv_pct", 0.0, 1.0, p1x, p1y, pw, ph)
    svg.append(f'<polyline fill="none" stroke="{st["color"]}" stroke-width="2.2" stroke-dasharray="{st["dash"]}" points="{pts}"/>')
b_surv = summary["balanced"]["survival_5000yr"] * 100
r_surv = summary["obs_rusher"]["survival_5000yr"] * 100
h_surv = summary["hermit"]["survival_5000yr"] * 100
e_surv = summary["expander"]["survival_5000yr"] * 100
svg.append(f'<text x="{p1x+pw-8}" y="{map_y(summary["balanced"]["survival_5000yr"],0,1,p1y,ph)-8:.1f}" text-anchor="end" fill="#6FE3FF" font-size="10.5">{b_surv:.1f}% 跨过幼年期稳健永续</text>')
svg.append(f'<text x="{p1x+pw-8}" y="{map_y(summary["obs_rusher"]["survival_5000yr"],0,1,p1y,ph)-8:.1f}" text-anchor="end" fill="#FF8A3D" font-size="10">冷战赌徒 {r_surv:.1f}% 险胜转正</text>')
svg.append(f'<text x="{p1x+pw-8}" y="{map_y(0.08,0,1,p1y,ph)-30:.1f}" text-anchor="end" fill="#A98BFF" font-size="10">激进扩泡 {e_surv:.1f}% / 单星隐士 {h_surv:.1f}%</text>')

# Panel 2: Mean K(t) among survivors
p2x, p2y = 615, 120
draw_panel_box(p2x, p2y, pw, ph, "② 在世者卡尔达肖夫能级 K(t)：单星天花板 vs 多星突破", [(0.73, "0.73"), (1.05, "1.05"), (1.40, "1.40"), (1.80, "1.80")], 0.70, 1.85)
y_cap1 = map_y(1.05, 0.70, 1.85, p2y, ph)
svg.append(f'<line x1="{p2x}" y1="{y_cap1:.1f}" x2="{p2x+pw}" y2="{y_cap1:.1f}" stroke="#5C6B7D" stroke-dasharray="4 3"/>')
svg.append(f'<text x="{p2x+pw-8}" y="{y_cap1-5:.1f}" text-anchor="end" fill="#9AA9BA" font-size="9.5">单星物理天花板 K₁ = 1.05</text>')
for strat, st in STYLES.items():
    pts = polyline_pts(strat, "mean_k", 0.70, 1.85, p2x, p2y, pw, ph)
    svg.append(f'<polyline fill="none" stroke="{st["color"]}" stroke-width="2.2" stroke-dasharray="{st["dash"]}" points="{pts}"/>')
svg.append(f'<text x="{p2x+pw-8}" y="{map_y(1.66,0.70,1.85,p2y,ph)+14:.1f}" text-anchor="end" fill="#6FE3FF" font-size="10">Tier 3 多星网络稳态演化</text>')

# Panel 3: Mean SDI(t) among survivors + Cold War zone
p3x, p3y = 70, 425
y_cw_top = map_y(0.85, 0.0, 1.0, p3y, ph)
y_cw_bot = map_y(0.55, 0.0, 1.0, p3y, ph)
svg.append(f'<rect x="{p3x}" y="{y_cw_top:.1f}" width="{pw}" height="{y_cw_bot-y_cw_top:.1f}" fill="#FF3B47" fill-opacity="0.08"/>')
draw_panel_box(p3x, p3y, pw, ph, "③ 在世者系统脆弱度 SDI(t)：稳态动态张力 vs 55–85% 冷战走钢丝带", [(0, "0%"), (0.38, "38%"), (0.55, "55%"), (0.85, "85%"), (1.0, "100%")], 0.0, 1.0)
svg.append(f'<rect x="{p3x}" y="{y_cw_top:.1f}" width="{pw}" height="{y_cw_bot-y_cw_top:.1f}" fill="#FF3B47" fill-opacity="0.07"/>')
y_safe = map_y(0.38, 0.0, 1.0, p3y, ph)
svg.append(f'<line x1="{p3x}" y1="{y_safe:.1f}" x2="{p3x+pw}" y2="{y_safe:.1f}" stroke="#4CF2A0" stroke-opacity="0.45" stroke-dasharray="4 3"/>')
svg.append(f'<text x="{p3x+pw-8}" y="{y_cw_top+13:.1f}" text-anchor="end" fill="#FF8A3D" font-size="9.5">冷战边缘危险带 (55%–85% · 概率自毁爬升)</text>')
svg.append(f'<text x="{p3x+pw-8}" y="{y_safe+12:.1f}" text-anchor="end" fill="#4CF2A0" font-size="9.5">安全线 38% 以下（后期稳态保留 ~18% 张力）</text>')
for strat, st in STYLES.items():
    pts = polyline_pts(strat, "mean_sdi", 0.0, 1.0, p3x, p3y, pw, ph)
    svg.append(f'<polyline fill="none" stroke="{st["color"]}" stroke-width="2.2" stroke-dasharray="{st["dash"]}" points="{pts}"/>')

# Panel 4: Cumulative discovery curve scaled cleanly to 0..40%
p4x, p4y = 615, 425
draw_panel_box(p4x, p4y, pw, ph, "④ 累计发现他者比例 D(t)：真·大沉默下的“世纪大新闻”稀缺度", [(0, "0%"), (0.10, "10%"), (0.20, "20%"), (0.30, "30%"), (0.40, "40%")], 0.0, 0.40)
for strat, st in STYLES.items():
    pts = polyline_pts(strat, "lock_pct", 0.0, 0.40, p4x, p4y, pw, ph)
    svg.append(f'<polyline fill="none" stroke="{st["color"]}" stroke-width="2.2" stroke-dasharray="{st["dash"]}" points="{pts}"/>')
b_lock = summary["balanced"]["lock_detect_rate"] * 100
svg.append(f'<text x="{p4x+pw-8}" y="{map_y(summary["balanced"]["lock_detect_rate"],0,0.40,p4y,ph)-8:.1f}" text-anchor="end" fill="#6FE3FF" font-size="10.5">{b_lock:.1f}% 终生发现他者（约 70% 终身未见邻居）</text>')

# Bottom summary banner dynamically driven by sim_results.json
bx, by = 70, 695
svg.append(f'<rect x="{bx}" y="{by}" width="1005" height="104" rx="8" fill="#05070B" fill-opacity="0.92" stroke="#24344A"/>')
svg.append(f'<text x="{bx+16}" y="{by+24}" fill="#E6EEF7" font-size="12" font-weight="600">关键生态涌现统计（v3 真·大沉默校准：每组 1,000 次蒙特卡洛演化，跨度 5,000 模拟年）</text>')
hb_b4 = (summary["hermit"]["causes"].get("B1b_DinosaurKiller_Impact", 0) + summary["hermit"]["causes"].get("B4_Supernova", 0)) / 10.0
ecw = summary["expander"]["causes"].get("ColdWar_SelfDestruct", 0) / 10.0
rows = [
    (bx + 20, by + 54, "#6FE3FF", f"稳健流: 5000年存活 {b_surv:.1f}%, 锁定 {b_lock:.1f}% (中位 {summary['balanced']['median_t_lock_yr']:.0f} yr), 冷战自毁仅 {summary['balanced']['causes'].get('ColdWar_SelfDestruct',0)/10:.1f}%"),
    (bx + 520, by + 54, "#FF8A3D", f"赌徒流: 存活 {r_surv:.1f}%, 均经历 {summary['obs_rusher']['mean_near_miss_crises']:.2f} 次危机, 盲亡者 {summary['obs_rusher']['callback_among_blind_dead']*100:.1f}% 触发亡灵 Callback"),
    (bx + 20, by + 82, "#A98BFF", f"单星隐士: 存活 {h_surv:.1f}%, 0 自毁但 {hb_b4:.1f}% 死于 B1b 恐龙撞击 / B4 超新星"),
    (bx + 520, by + 82, "#FF4FA3", f"激进扩泡: 存活 {e_surv:.1f}%, 均经历 {summary['expander']['mean_near_miss_crises']:.2f} 次危机, {ecw:.1f}% 死于冷战同步分裂"),
]
for rx, ry, c, txt in rows:
    svg.append(f'<circle cx="{rx}" cy="{ry-3.5}" r="3.5" fill="{c}"/>')
    svg.append(f'<text x="{rx+11}" y="{ry}" fill="#C7D3E3" font-size="11">{txt}</text>')

svg.append('</svg>')
out_svg = ROOT / "sim_curves.svg"
out_svg.write_text("\n".join(svg), encoding="utf-8")
print(f"Wrote {out_svg}")
