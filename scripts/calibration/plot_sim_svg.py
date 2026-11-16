#!/usr/bin/env python3
"""
Generate dark-mode 6-panel calibration SVG from sim_results.json (GDD v0.15.0).
Includes survival, scale trajectory K(t), non-linear point speed v_E(t),
cumulative evolution points E_cum(t), systemic fragility SDI(t), and neighbor lock rate.
"""
from __future__ import annotations

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
IN_JSON = os.path.join(HERE, "sim_results.json")
OUT_SVG = os.path.join(HERE, "sim_curves.svg")

STRATEGIES = [
    ("balanced", "Balanced", "#4CF2A0", "none"),
    ("obs_rusher", "Obs-Rusher (Sensor Blitz)", "#C084FC", "6,3"),
    ("system_hermit", "System Hermit (No Interstellar)", "#38BDF8", "none"),
    ("expander", "Blind Expander (No Def/Gov)", "#F59E0B", "none"),
    ("planet_hermit", "Planet Hermit (No Off-World)", "#F43F5E", "none"),
]

W, H = 1140, 1210


def lerp_x(t: float, px: float, pw: float) -> float:
    return px + (t / 5000.0) * pw


def lerp_y(val: float, ymin: float, ymax: float, py: float, ph: float) -> float:
    clamped = max(ymin, min(ymax, val))
    return py + ph - ((clamped - ymin) / (ymax - ymin)) * ph


def main() -> None:
    with open(IN_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    curves = data["ensemble_curves"]
    summary = data["summary"]
    fit = data["human_curve_fit"]

    svg: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        '<defs>',
        '<style>',
        '  text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif; }',
        '  .title { fill: #F8FAFC; font-size: 19px; font-weight: 700; }',
        '  .subtitle { fill: #94A3B8; font-size: 12px; }',
        '  .panel-title { fill: #E2E8F0; font-size: 14px; font-weight: 600; }',
        '  .axis-label { fill: #94A3B8; font-size: 11px; }',
        '  .grid { stroke: #1E293B; stroke-width: 1; }',
        '  .axis { stroke: #475569; stroke-width: 1.2; }',
        '  .legend { fill: #CBD5E1; font-size: 11.5px; font-weight: 500; }',
        '  .note { fill: #94A3B8; font-size: 10.5px; }',
        '</style>',
        '</defs>',
        f'<rect width="{W}" height="{H}" fill="#0B1018"/>',
        '<text x="75" y="34" class="title">Beyond the Light Cone (GDD v0.15.0) — 5-Strategy Monte Carlo Ensemble (N = 1,000 / strategy)</text>',
        (
            f'<text x="75" y="54" class="subtitle">'
            f'Human Curve Fit R2_log = {fit["r2_log"]:.4f} | '
            f'Exponential Productivity + Stochastic Superposition -> Continuous Point Rate v_E(t) | '
            f'Upgrade Costs 1 / 2 / 4 / 8 pts'
            f'</text>'
        ),
    ]

    # Top Legend (2 clean non-overlapping rows)
    legend_coords = [
        (75, 76),
        (360, 76),
        (705, 76),
        (75, 98),
        (410, 98),
    ]
    for idx, (key, label, color, dash) in enumerate(STRATEGIES):
        lx, ly = legend_coords[idx]
        dash_attr = f' stroke-dasharray="{dash}"' if dash != "none" else ""
        surv = summary[key]["survival_5000yr"] * 100
        svg.append(f'<line x1="{lx}" y1="{ly - 4}" x2="{lx + 22}" y2="{ly - 4}" stroke="{color}" stroke-width="2.5"{dash_attr}/>')
        svg.append(f'<text x="{lx + 28}" y="{ly}" class="legend">{label} ({surv:.1f}%)</text>')

    panels = [
        ("A. Civilization Survival Curve  S(t)", 75, 134, 455, 260, 0.0, 100.0, "%", "surv_pct"),
        ("B. Mean Civilization Scale  K(t)  [K0 = 0.56]", 625, 134, 455, 260, 0.50, 2.00, "K", "mean_k"),
        ("C. Mean Point Accrual Speed  v_E(t)  [pts / 100 sim yr]", 75, 474, 455, 260, 0.0, 3.0, "", "mean_v_e"),
        ("D. Mean Cumulative Earned Points  E_cum(t)", 625, 474, 455, 260, 0.0, 100.0, " pts", "mean_e_cum"),
        ("E. Mean Systemic Fragility  SDI(t)", 75, 814, 455, 260, 0.0, 100.0, "%", "mean_sdi"),
        ("F. Cumulative Neighbor Lock Rate  P(Lock)", 625, 814, 455, 260, 0.0, 25.0, "%", "lock_pct"),
    ]

    y_ticks_map = {
        "surv_pct": [0, 20, 40, 60, 80, 100],
        "mean_k": [0.56, 0.73, 0.86, 1.05, 1.35, 1.65, 2.00],
        "mean_v_e": [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
        "mean_e_cum": [0, 25, 50, 75, 100],
        "mean_sdi": [0, 20, 40, 60, 80, 100],
        "lock_pct": [0, 5, 10, 15, 20, 25],
    }

    for title, px, py, pw, ph, ymin, ymax, unit, field in panels:
        svg.append(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="6" fill="#121A26" stroke="#24344A"/>')
        svg.append(f'<text x="{px}" y="{py - 12}" class="panel-title">{title}</text>')

        for yt in y_ticks_map[field]:
            yy = lerp_y(yt, ymin, ymax, py, ph)
            svg.append(f'<line x1="{px}" y1="{yy:.1f}" x2="{px + pw}" y2="{yy:.1f}" class="grid"/>')
            lbl = f"{yt:.2f}" if field == "mean_k" else (f"{yt:.1f}" if field == "mean_v_e" else f"{int(yt)}{unit}")
            svg.append(f'<text x="{px - 8}" y="{yy + 4:.1f}" text-anchor="end" class="axis-label">{lbl}</text>')

        for xt in [0, 1000, 2000, 3000, 4000, 5000]:
            xx = lerp_x(xt, px, pw)
            svg.append(f'<line x1="{xx:.1f}" y1="{py}" x2="{xx:.1f}" y2="{py + ph}" class="grid"/>')
            svg.append(f'<text x="{xx:.1f}" y="{py + ph + 16}" text-anchor="middle" class="axis-label">{xt}y</text>')

        # Reference lines
        if field == "mean_k":
            for ref_k, ref_lbl in [(0.73, "Crit Ref K=0.73"), (0.86, "1-Planet Cap 0.86"), (1.05, "System Cap 1.05")]:
                ry = lerp_y(ref_k, ymin, ymax, py, ph)
                svg.append(f'<line x1="{px}" y1="{ry:.1f}" x2="{px + pw}" y2="{ry:.1f}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="3,3" opacity="0.45"/>')
                svg.append(f'<text x="{px + pw - 6}" y="{ry - 3:.1f}" text-anchor="end" class="note" style="fill:#38BDF8;opacity:0.8">{ref_lbl}</text>')
        elif field == "mean_e_cum":
            ry = lerp_y(75.0, ymin, ymax, py, ph)
            svg.append(f'<line x1="{px}" y1="{ry:.1f}" x2="{px + pw}" y2="{ry:.1f}" stroke="#FBBF24" stroke-width="1.1" stroke-dasharray="4,3" opacity="0.75"/>')
            svg.append(f'<text x="{px + 8}" y="{ry - 4:.1f}" class="note" style="fill:#FBBF24">Max 5-Branch Tech Cap (75 pts)</text>')

        svg.append(f'<line x1="{px}" y1="{py}" x2="{px}" y2="{py + ph}" class="axis"/>')
        svg.append(f'<line x1="{px}" y1="{py + ph}" x2="{px + pw}" y2="{py + ph}" class="axis"/>')

        for key, _, color, dash in STRATEGIES:
            c = curves[key]
            pts = []
            for tv, yv in zip(c["t"], c[field]):
                xx = lerp_x(tv, px, pw)
                yy = lerp_y(yv, ymin, ymax, py, ph)
                pts.append(f"{xx:.1f},{yy:.1f}")
            dash_attr = f' stroke-dasharray="{dash}"' if dash != "none" else ""
            svg.append(f'<polyline fill="none" stroke="{color}" stroke-width="2.2"{dash_attr} points="{" ".join(pts)}"/>')

        # Panel annotations
        if field == "surv_pct":
            svg.append(f'<text x="{px + 280}" y="{py + 88}" class="note" style="fill:#4CF2A0">Balanced: 62.2%</text>')
            svg.append(f'<text x="{px + 280}" y="{py + 128}" class="note" style="fill:#C084FC">Obs-Rusher: 48.1%</text>')
            svg.append(f'<text x="{px + 280}" y="{py + 150}" class="note" style="fill:#38BDF8">System Hermit (B4): 27.2%</text>')
            svg.append(f'<text x="{px + 12}" y="{py + 226}" class="note" style="fill:#F59E0B">Expander: 12.1% (Cold War)</text>')
            svg.append(f'<text x="{px + 12}" y="{py + 242}" class="note" style="fill:#F43F5E">Planet Hermit: 6.4% (B1b + B4)</text>')
        elif field == "mean_v_e":
            svg.append(f'<text x="{px + 12}" y="{py + 20}" class="note">Ensemble mean of +/-65% OU, harmonic &amp; jump ripples</text>')
        elif field == "mean_sdi":
            svg.append(f'<text x="{px + 12}" y="{py + 20}" class="note">Threshold >= 45% triggers Cold War fragility risk</text>')
            ry_sdi = lerp_y(45.0, ymin, ymax, py, ph)
            svg.append(f'<line x1="{px}" y1="{ry_sdi:.1f}" x2="{px + pw}" y2="{ry_sdi:.1f}" stroke="#F59E0B" stroke-width="1" stroke-dasharray="4,3" opacity="0.65"/>')

    svg.append(
        f'<text x="75" y="{H - 22}" class="note">'
        f'Sim Engine: scripts/calibration/sim_civ_dynamics.py (GDD v0.15.0, pure mathematical growth model) | Horizon 5,000 sim yr | dt = 10y'
        f'</text>'
    )
    svg.append('</svg>')

    with open(OUT_SVG, "w", encoding="utf-8") as f:
        f.write("\n".join(svg))
    print(f"Wrote {OUT_SVG} ({len(svg)} lines)")


if __name__ == "__main__":
    main()
