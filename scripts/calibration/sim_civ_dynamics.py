"""Calibrated Monte Carlo Simulator (GDD v0.15.0 — Human-Fitted Exponential Productivity & Stochastic Dynamics).

Pure Mathematical Civilization Growth & Point Economy (Basic-Science & Historical-Era Lore Stripped):
1. Pure Dimensionless Initial State (K0 = 0.56, normalized productivity Pi0 = 1.0):
   - Zero historical dating/basic-science milestones (no 1687/1945/2026 tech-era locks).
   - Smooth baseline survey gain G_0(K) = 0.08 + 0.52 / (1 + exp(-28*(K - 0.675))) at Lv.0.
   - Smooth high-density concentration stress Delta_conc activates above dimensionless K >= K_CRIT (0.65),
     mitigated by multi-world / multi-star spatial dispersion.
2. Human-Fitted Exponential Productivity Curve + Stochastic Superposition:
   - Empirical human macro-output composite (normalized Maddison real output & energy capture)
     fits Pi_emp(tau) = exp(5.133 * tau^3.6) with R^2_log = 0.9937.
   - Embedded into state-coupled dynamical system with node capacity ceiling K_max(N_worlds, N_eff)
     and chaos damping max(0, 1 - lambda_chaos * SDI):
       Pi_exp(K) = exp(ALPHA_K * (K - K0))
       eta(t)    = clamp(harmonics(t) + Z_OU(t) + J_poisson(t), -0.65, +0.65)
       Pi(t)     = Pi_exp(K) * exp(eta(t)) * max(0, 1 - lambda_chaos * SDI)
   - Productivity directly drives Evolution Point accrual velocity (non-linear point accumulation):
       dE/dt = V_E0 * Pi(t) * P_pop * I_sci
   - Non-linear tech upgrade costs follow 2^(L-1): Lv.1=1, Lv.2=2, Lv.3=4, Lv.4=8 pts (15/branch, 75 total);
     world_up & k_tier_up consume 0 pts (single build slot + duration only).
3. 3-Stage Hierarchy inside Preserved Light-Year Sphere (R_civ in [0.01, 20.0] ly):
   - Single-Planet (N_worlds = 1, N_stars = 1, R_civ = 0.01): K <= 0.86; vulnerable to B1b/B4.
   - Multi-Planetary System (N_worlds = 2..4, N_stars = 1, R_civ in [0.03, 0.20]): K_max <= 1.05.
   - Multi-Star Network (N_stars >= 2, R_civ in [2.0, 20.0]): K_max = min(2.00, 1.05 + 0.38*ln(N_eff)).
"""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

OUT_DIR = Path(__file__).resolve().parent

# --- Dimensionless Scale & Mathematical Growth Constants ---
K0 = 0.56                  # Dimensionless initial scale state
K_CRIT = 0.65              # Concentration stress threshold
K_REF = 0.73               # Dimensionless inflection / SNR reference scale
K_PLANET_MAX = 0.86        # Single-world capacity ceiling
K_STAR_1 = 1.05            # Full multi-world home-system ceiling (N_worlds = 4)
DELTA_K_WORLD = 0.14       # 0.86 + 0.14*ln(W) -> 0.957 (2w), 1.014 (3w), 1.05 (4w)
DELTA_K_STAR = 0.38        # 1.05 + 0.38*ln(N_eff)

R_K = 0.00182              # Mathematical scale compounding rate
ALPHA_K = 1.35             # Exponential productivity slope vs K
V_E0 = 0.0056              # Base evolution point accrual rate (0.56 pts / 100 sim yr at Pi = 1)
LAMBDA_CHAOS = 1.00

BETA_K = 2.85              # Engineering load capability exp(BETA_K * (K - K_REF))
GAMMA_W = 0.35             # Intra-system multi-planet persistence factor
GAMMA_N = 0.65             # Interstellar multi-star persistence factor

M_RED = {0: 1.0, 1: 2.2, 2: 3.5, 3: 6.0, 4: 15.0}
R_SYNC0 = 1.40
M_SYNC = {0: 1.0, 1: 1.5, 2: 2.5, 3: 5.0, 4: 10.0}
DELTA_STRIKE = {0: 0.0, 1: 0.08, 2: 0.23, 3: 0.51, 4: 0.91}
DELTA_PERSIST_MAP = {0: 0.0, 1: 0.15, 2: 0.28, 3: 0.45, 4: 0.65}

PSI_ENG = {0: 0.5, 1: 1.3, 2: 3.0, 3: 5.8, 4: 15.0}
PSI_INFO = {0: 0.5, 1: 1.2, 2: 2.8, 3: 5.2, 4: 13.8}
THETA_ENG = 1.40
THETA_SOC = 1.40
ALPHA_ENG = 0.11
ALPHA_SOC = 0.13

SDI_SAFE = 0.38
H_MAX_CENTURY = 0.45
HAZARD_POWER = 2.0

# Uniform ecological sim-clock relaxation constants
TAU_PULSE_SIM_YR = 40.0    # 40 sim yr pulse decay
TAU_LAG_SIM_YR = 15.0      # EWMA causal strain relaxation timescale

# Nonlinear upgrade point costs (2^(L-1)) & build workloads
TECH_COST = {1: 1.0, 2: 2.0, 3: 4.0, 4: 8.0}
TECH_BUILD_DUR = {1: 15.0, 2: 45.0, 3: 90.0, 4: 180.0}
STRIKE_BUILD_DUR = {1: 20.0, 2: 60.0, 3: 120.0, 4: 240.0}
TIER_BUILD_DUR = {2: 60.0, 3: 150.0}
WORLD_BUILD_DUR = 30.0     # Free of evo pts; single-slot off-world habitat infrastructure

D_B4_SCALE = 4.5           # Spatial attenuation scale (ly) for continuous B4 dose

BAR_D_CIV = 600.0
R_COSMOS = 500.0
SIM_YEARS = 5000.0
DT = 10.0

KAPPA_TH = 2e-4
KAPPA_LASER = 5e-4
D0 = 4.22
N_BG = 4.0e-5
S_BASE_BY_TIER = {1: 0.001, 2: 0.080, 3: 4.0}


def verify_human_productivity_fit() -> Dict[str, float]:
    """Fit power-exponential mathematical curve to normalized human macro-civilization trajectory.

    Uses composite geometric index of Maddison global real output and primary energy capture
    across a 522-year pre-industrial-to-modern takeoff arc (normalized tau in [0, 1]).
    """
    taus = [0.000, 0.192, 0.383, 0.613, 0.709, 0.791, 0.862, 0.906, 0.958, 1.000]
    composite = [1.00, 1.24, 1.42, 2.42, 4.01, 9.08, 17.35, 46.83, 87.73, 149.40]
    ys = [math.log(c) for c in composite]
    y_mean = sum(ys) / len(ys)
    ss_tot = sum((y - y_mean) ** 2 for y in ys)

    gamma = 3.6
    num = sum((t ** gamma) * y for t, y in zip(taus, ys))
    den = sum((t ** (2.0 * gamma)) for t in taus)
    alpha_fit = num / den
    ss_res = sum((y - alpha_fit * (t ** gamma)) ** 2 for t, y in zip(taus, ys))
    r2_log = 1.0 - ss_res / ss_tot

    return {
        "alpha_fit": round(alpha_fit, 4),
        "gamma": gamma,
        "r2_log": round(r2_log, 5),
        "terminal_ratio": round(math.exp(alpha_fit), 2),
    }


def sample_traits_13(rng: random.Random) -> Dict[str, float]:
    """Sample 12 zero-sum traits (product in [0.85, 1.15]) + independent 13th D_self."""
    ranges = {
        "X_g": (0.85, 1.15), "R_orb": (0.85, 1.15), "W_em": (0.88, 1.12),
        "L_0": (0.88, 1.12), "M_bio": (0.90, 1.10), "P_pop": (0.88, 1.12),
        "eta_E": (0.90, 1.10), "eta_th": (0.88, 1.12), "eta_fab": (0.90, 1.10),
        "I_sci": (0.90, 1.10), "C_info": (0.88, 1.12), "S_org": (0.88, 1.12),
    }
    while True:
        traits = {}
        prod = 1.0
        for name, (lo, hi) in ranges.items():
            val = math.exp(rng.uniform(math.log(lo), math.log(hi)))
            traits[name] = val
            prod *= val
        if 0.85 <= prod <= 1.15:
            break
    traits["D_self"] = math.exp(rng.uniform(math.log(0.85), math.log(1.15)))
    phi = (traits["X_g"] * traits["M_bio"] * traits["S_org"] * (traits["R_orb"] ** 0.5)) / traits["D_self"]
    traits["Phi_trait"] = max(0.80, min(1.25, phi))
    return traits


def k_max(n_eff_stars: float, n_worlds: int) -> float:
    if n_eff_stars <= 1.0 + 1e-9:
        if n_worlds <= 1:
            return K_PLANET_MAX
        return min(K_STAR_1, K_PLANET_MAX + DELTA_K_WORLD * math.log(n_worlds))
    return min(2.00, K_STAR_1 + DELTA_K_STAR * math.log(n_eff_stars))


def cap_k(k: float) -> float:
    return math.exp(BETA_K * (k - K_REF))


def r_persist_total(phi_trait: float, lv_persist: int, n_worlds: int, n_stars: int) -> float:
    return (
        phi_trait
        * M_RED[lv_persist]
        * (1.0 + GAMMA_W * math.log(max(1, n_worlds)))
        * (1.0 + GAMMA_N * math.log(max(1, n_stars)))
    )


def obs_imbalance_sdi(lv_obs: int, lv_persist: int, n_worlds: int, n_stars: int, k: float) -> float:
    re = PSI_ENG[lv_obs] / cap_k(k)
    h_soc = (
        M_RED[lv_persist]
        * (1.0 + 0.25 * math.log(max(1, n_worlds)))
        * (1.0 + GAMMA_N * math.log(max(1, n_stars)))
    )
    rs = PSI_INFO[lv_obs] / h_soc
    return ALPHA_ENG * (max(0.0, re - THETA_ENG) ** 2) + ALPHA_SOC * (max(0.0, rs - THETA_SOC) ** 2)


def hazard_rate_per_yr(sdi: float) -> float:
    if sdi <= SDI_SAFE:
        h_century = 0.0015 * ((sdi / SDI_SAFE) ** 3)
    else:
        x = (sdi - SDI_SAFE) / (1.0 - SDI_SAFE)
        h_century = 0.0015 + H_MAX_CENTURY * (x ** HAZARD_POWER)
    return h_century / 100.0


def survey_and_focus_gain(lv_obs: int, r_civ: float, n_stars: int, k: float) -> Tuple[float, float, float]:
    """Return (G_survey, G_focus, serendipity_sweep_prob) using pure smooth mathematical G_0(K)."""
    g0_surv = 0.08 + 0.52 / (1.0 + math.exp(-28.0 * (k - 0.675)))
    survey_map = {0: g0_surv, 1: 1.0, 2: 2.5, 3: 8.0, 4: 25.0}
    focus_map = {0: 1.2, 1: 3.16, 2: 79.1, 3: 2530.0, 4: 1.0e6}
    beta_r_map = {0: 0.0, 1: 0.0, 2: 0.2, 3: 1.0, 4: 1.5}
    sweep_prob_map = {0: 0.0004, 1: 0.0030, 2: 0.0020, 3: 0.0010, 4: 0.0004}

    b_perp = max(0.01, r_civ * 0.8 if n_stars >= 2 else 0.01)
    baseline_mult = 1.0 + beta_r_map[lv_obs] * math.log(b_perp / 0.01)
    return survey_map[lv_obs], focus_map[lv_obs] * baseline_mult, sweep_prob_map[lv_obs]


def local_noise_factor(lv_obs: int, k: float) -> float:
    if lv_obs == 0:
        return 1.25
    if lv_obs == 1:
        return 0.70 if k >= 0.82 else 0.90
    if lv_obs == 2:
        return 0.45
    return 0.35


def t2_survey_horizon_ly(g_surv: float, w_obs_trait: float, cur_n: float) -> float:
    """Solve SNR_surv = 1 for reference Tier-2 target (0.080 * 0.50 = 0.040)."""
    d = D0
    coeff = (0.040 * g_surv * w_obs_trait) / (cur_n * N_BG)
    for _ in range(5):
        d = D0 * math.sqrt(max(1e-9, coeff * math.exp(-KAPPA_TH * d)))
    return d


@dataclass
class NeighborEmission:
    dist_ly: float
    t_emit: float
    t_end: float
    tier: int
    stealth_mult: float
    beacon_flux: float
    is_pulse: bool = False


def generate_cosmos(rng: random.Random) -> List[NeighborEmission]:
    """Generate Poisson neighbor universe calibrated to Great Silence early window (t <= 345 sim yr)."""
    rho = 1.0 / (BAR_D_CIV ** 3)
    vol = (4.0 / 3.0) * math.pi * (R_COSMOS ** 3)
    n_expected = rho * vol
    l_exp = math.exp(-n_expected)
    k_cnt = 0
    p = 1.0
    while p > l_exp:
        k_cnt += 1
        p *= rng.random()
    n_civs = max(0, k_cnt - 1)

    g_surv_ref = 0.60
    n_loc_ref = local_noise_factor(0, K_REF) * N_BG

    events: List[NeighborEmission] = []
    for _ in range(n_civs):
        dist = R_COSMOS * (rng.random() ** (1.0 / 3.0))
        if dist < 18.0:
            dist = 18.0 + rng.random() * 60.0

        t_birth = rng.uniform(-1200.0, 4300.0)
        roll = rng.random()
        if roll < 0.62:
            tier = 1
            t_loud = t_birth
            t_die = t_birth + rng.uniform(300.0, 2400.0)
            stealth_m = 0.50 if rng.random() < 0.85 else 1.0
        elif roll < 0.92:
            tier = 2
            t_loud = t_birth + rng.uniform(450.0, 1000.0)
            t_die = t_loud + rng.uniform(600.0, 2600.0)
            stealth_m = 0.006 if rng.random() < 0.45 else (0.04 if rng.random() < 0.85 else 0.50)
        else:
            tier = 3
            t_loud = t_birth + rng.uniform(1100.0, 2000.0)
            t_die = t_loud + rng.uniform(500.0, 2200.0)
            stealth_m = 1e-4 if rng.random() < 0.50 else (0.006 if rng.random() < 0.78 else (0.04 if rng.random() < 0.80 else 1.0))

        snr_ref = (
            S_BASE_BY_TIER[tier] * stealth_m * math.exp(-KAPPA_TH * dist) * g_surv_ref
        ) / (((dist / D0) ** 2) * n_loc_ref)
        if snr_ref >= 1.0 and t_loud + dist <= 345.0 and t_die + dist >= 0.0:
            t_loud = max(t_loud, 345.0 - dist + rng.uniform(50.0, 800.0))
            t_die = max(t_die, t_loud + rng.uniform(400.0, 2000.0))

        events.append(NeighborEmission(
            dist_ly=dist, t_emit=t_loud, t_end=t_die,
            tier=tier, stealth_mult=stealth_m, beacon_flux=0.0,
        ))
        if rng.random() < 0.04:
            t_flash = rng.uniform(max(t_loud, 345.0 - dist + 20.0), t_die)
            events.append(NeighborEmission(
                dist_ly=dist, t_emit=t_flash, t_end=t_flash + 20.0,
                tier=tier, stealth_mult=stealth_m,
                beacon_flux=1.5 if rng.random() < 0.5 else 0.05,
                is_pulse=True,
            ))
    return events


def sample_star_catalog(rng: random.Random) -> List[Tuple[float, float, Tuple[float, float, float]]]:
    """Build cradle (0,0,0) + 7 neighborhood shells with random 3D isotropy & luminosity weights omega_i."""
    shells = [(2.0, 0.75), (3.2, 1.05), (4.8, 0.90), (6.8, 1.35), (9.5, 0.85), (13.0, 1.15), (17.5, 1.25)]
    catalog = [(0.0, 1.0, (0.0, 0.0, 0.0))]
    for dist, weight in shells:
        cos_theta = rng.uniform(-1.0, 1.0)
        sin_theta = math.sqrt(max(0.0, 1.0 - cos_theta * cos_theta))
        phi = rng.uniform(0.0, 2.0 * math.pi)
        xyz = (dist * sin_theta * math.cos(phi), dist * sin_theta * math.sin(phi), dist * cos_theta)
        catalog.append((dist, weight, xyz))
    return catalog


def run_single(strategy: str, seed: int) -> Dict:
    rng = random.Random(seed)
    traits = sample_traits_13(rng)
    cosmos = generate_cosmos(rng)
    star_catalog = sample_star_catalog(rng)

    w_obs_trait = traits["W_em"] * traits["eta_fab"] * traits["C_info"]

    k = K0
    r_civ = 0.01
    r_target = 0.01
    n_worlds = 1
    n_stars = 1
    n_eff_stars = 1.0

    lv_obs = 0
    lv_persist = 0
    lv_stealth = 0
    lv_strike = 0
    tier = 1
    alive = True
    cause_of_death = "Survived_5000yr"
    t_extinct: Optional[float] = None

    # Continuous non-linear point economy (no fixed-interval linear drop / mandate wipe)
    evo_points = 0.0
    evo_points_earned = 0.0
    active_build: Optional[Tuple[str, int, float]] = None

    # Stochastic superposition state on top of exponential productivity curve
    # 1) Multi-frequency random-phase harmonics (period modulated mildly by L_0)
    harm_amps = [0.10, 0.07, 0.04]
    l0_scale = traits["L_0"]
    harm_omegas = [
        2.0 * math.pi / (780.0 * l0_scale),
        2.0 * math.pi / (290.0 * l0_scale),
        2.0 * math.pi / (115.0 * l0_scale),
    ]
    harm_phases = [rng.uniform(0.0, 2.0 * math.pi) for _ in range(3)]
    # 2) Ornstein-Uhlenbeck process Z_ou (tau = 250 sim yr, stationary std = 0.10)
    z_ou = 0.0
    ou_decay = math.exp(-DT / 250.0)
    ou_std = 0.10 * math.sqrt(1.0 - math.exp(-2.0 * DT / 250.0))
    # 3) Poisson random jump shocks J (tau = 120 sim yr, rate = 0.008 / sim yr)
    j_jump = 0.0
    jump_decay = math.exp(-DT / 120.0)

    shield_used = False
    collapse_armed = True
    lag_strain_u = 0.0
    a_check_accum = 0.0

    crisis_count = 0
    t_crit: Optional[float] = None
    t_ref: Optional[float] = None
    t_multiplanet: Optional[float] = None
    t_multistar: Optional[float] = None
    k_at_340yr: Optional[float] = None

    t_first_weak: Optional[float] = None
    t_first_lock: Optional[float] = None
    dist_first_lock: Optional[float] = None

    peak_g_surv, peak_g_foc, peak_sweep = survey_and_focus_gain(0, 0.01, 1, K0)
    peak_noise = local_noise_factor(0, K0)
    callback_first_t: Optional[float] = None
    callback_coeval = False

    e_fixed = 0.0
    shock_decay = math.exp(-DT / TAU_PULSE_SIM_YR)
    lag_alpha = 1.0 - math.exp(-DT / TAU_LAG_SIM_YR)

    sample_stride = 5  # every 50 sim yr
    trace_alive: List[int] = []
    trace_locked: List[int] = []
    trace_k: List[Optional[float]] = []
    trace_sdi: List[Optional[float]] = []
    trace_v_e: List[Optional[float]] = []      # pts / 100 sim yr
    trace_e_cum: List[Optional[float]] = []    # cumulative points earned

    steps = int(SIM_YEARS / DT)
    for step in range(steps + 1):
        t = step * DT
        if alive and t == 340.0:
            k_at_340yr = k

        cur_sdi_val: Optional[float] = None
        cur_v_e_val: Optional[float] = None

        if alive:
            e_fixed *= shock_decay
            max_dr = (0.10 if r_target >= r_civ else 0.25) * DT
            if abs(r_target - r_civ) <= max_dr:
                r_civ = r_target
            elif r_target > r_civ:
                r_civ += max_dr
            else:
                r_civ -= max_dr

            captured = [(d, w, xyz) for d, w, xyz in star_catalog if d <= r_civ]
            n_stars = len(captured)
            n_eff_stars = sum(w for _, w, _ in captured)

            if t_crit is None and k >= K_CRIT:
                t_crit = t
            if t_ref is None and k >= K_REF:
                t_ref = t
            if t_multiplanet is None and n_worlds >= 2:
                t_multiplanet = t
            if t_multistar is None and n_stars >= 2:
                t_multistar = t

            if active_build is not None:
                b_kind, b_lv, work_rem = active_build
                rate = traits["P_pop"] * (traits["I_sci"] if b_kind in ("obs", "persist", "stealth", "strike") else 1.0)
                work_rem -= rate * DT
                if work_rem <= 0.0:
                    if b_kind == "obs":
                        lv_obs = b_lv
                    elif b_kind == "persist":
                        lv_persist = b_lv
                        if b_lv == 3:
                            e_fixed -= 0.30
                    elif b_kind == "stealth":
                        lv_stealth = b_lv
                    elif b_kind == "strike":
                        lv_strike = b_lv
                    elif b_kind == "tier":
                        tier = max(tier, b_lv)
                    elif b_kind == "world":
                        n_worlds = max(n_worlds, b_lv)
                    active_build = None
                else:
                    active_build = (b_kind, b_lv, work_rem)

            if active_build is None:
                def queue(kind: str, lv: int) -> None:
                    nonlocal active_build, evo_points
                    if kind in ("obs", "persist", "stealth", "strike"):
                        cost = TECH_COST[lv]
                        if evo_points < cost:
                            return
                        dur = STRIKE_BUILD_DUR[lv] if kind == "strike" else TECH_BUILD_DUR[lv]
                        evo_points -= cost
                        active_build = (kind, lv, dur)
                    elif kind == "tier":
                        active_build = ("tier", lv, TIER_BUILD_DUR[lv])
                    elif kind == "world":
                        active_build = ("world", lv, WORLD_BUILD_DUR)

                if strategy == "balanced":
                    if k >= 0.62 and lv_persist < 1 and evo_points >= TECH_COST[1]:
                        queue("persist", 1)
                    elif lv_persist >= 1 and k >= 0.68 and lv_obs < 1 and evo_points >= TECH_COST[1]:
                        queue("obs", 1)
                    elif lv_obs >= 1 and k >= 0.71 and lv_strike < 1 and evo_points >= TECH_COST[1]:
                        queue("strike", 1)
                    elif k >= 0.75 and n_worlds < 2:
                        r_target = max(r_target, 0.03)
                        queue("world", 2)
                    elif k >= 0.83 and n_worlds < 3:
                        r_target = max(r_target, 0.08)
                        queue("world", 3)
                    elif k >= 0.85 and lv_persist < 2 and evo_points >= TECH_COST[2]:
                        queue("persist", 2)
                    elif k >= 0.91 and n_worlds < 4:
                        r_target = max(r_target, 0.15)
                        queue("world", 4)
                    elif lv_persist >= 2 and k >= 0.94 and lv_obs < 2 and evo_points >= TECH_COST[2]:
                        queue("obs", 2)
                    elif n_worlds >= 3 and lv_persist >= 2 and k >= 0.98 and r_target < 2.2:
                        r_target = 2.2
                    elif k >= 1.03 and tier < 2 and n_stars >= 2:
                        queue("tier", 2)
                    elif n_stars >= 2 and lv_persist >= 2 and k >= 1.10 and r_target < 3.6:
                        r_target = 3.6
                    elif tier >= 2 and lv_persist >= 2 and k >= 1.20 and lv_obs < 3 and evo_points >= TECH_COST[3]:
                        queue("obs", 3)
                    elif k >= 1.22 and lv_persist < 3 and evo_points >= TECH_COST[3]:
                        queue("persist", 3)
                    elif lv_persist >= 3 and k >= 1.30 and r_target < 5.2:
                        r_target = 5.2
                    elif k >= 1.38 and lv_persist < 4 and evo_points >= TECH_COST[4]:
                        queue("persist", 4)
                    elif lv_persist >= 4 and k >= 1.46 and tier < 3 and n_stars >= 4:
                        queue("tier", 3)
                    elif tier >= 3 and lv_persist >= 4 and r_target < 13.5:
                        r_target = 13.5
                    elif tier >= 3 and lv_persist >= 4 and k >= 1.56 and lv_obs < 4 and evo_points >= TECH_COST[4]:
                        queue("obs", 4)

                elif strategy == "obs_rusher":
                    if k >= 0.62 and lv_obs < 1 and evo_points >= TECH_COST[1]:
                        queue("obs", 1)
                    elif k >= 0.74 and lv_obs < 2 and evo_points >= TECH_COST[2]:
                        queue("obs", 2)
                    elif k >= 0.80 and n_worlds < 2:
                        r_target = max(r_target, 0.03)
                        queue("world", 2)
                    elif k >= 0.82 and lv_persist < 1 and evo_points >= TECH_COST[1]:
                        queue("persist", 1)
                    elif lv_persist >= 1 and k >= 0.86 and lv_obs < 3 and evo_points >= TECH_COST[3]:
                        queue("obs", 3)
                    elif k >= 0.90 and n_worlds < 3:
                        queue("world", 3)
                    elif k >= 0.94 and lv_strike < 1 and evo_points >= TECH_COST[1]:
                        queue("strike", 1)
                    elif k >= 0.96 and n_worlds < 4:
                        queue("world", 4)
                    elif k >= 1.00 and r_target < 2.2:
                        r_target = 2.2
                    elif k >= 1.08 and tier < 2 and n_stars >= 2:
                        queue("tier", 2)
                    elif tier >= 2 and lv_persist < 2 and evo_points >= TECH_COST[2]:
                        queue("persist", 2)
                    elif lv_persist >= 2 and r_target < 3.6:
                        r_target = 3.6
                    elif k >= 1.26 and lv_persist < 3 and evo_points >= TECH_COST[3]:
                        queue("persist", 3)
                    elif lv_persist >= 3 and r_target < 5.2:
                        r_target = 5.2
                    elif k >= 1.42 and lv_persist < 4 and evo_points >= TECH_COST[4]:
                        queue("persist", 4)
                    elif lv_persist >= 4 and k >= 1.50 and tier < 3 and n_stars >= 4:
                        queue("tier", 3)
                    elif tier >= 3 and r_target < 10.2:
                        r_target = 10.2
                    elif tier >= 3 and lv_persist >= 4 and k >= 1.58 and lv_obs < 4 and evo_points >= TECH_COST[4]:
                        queue("obs", 4)

                elif strategy == "planet_hermit":
                    r_target = 0.01
                    if k >= 0.62 and lv_persist < 1 and evo_points >= TECH_COST[1]:
                        queue("persist", 1)
                    elif k >= 0.72 and lv_stealth < 1 and evo_points >= TECH_COST[1]:
                        queue("stealth", 1)
                    elif k >= 0.76 and lv_obs < 1 and evo_points >= TECH_COST[1]:
                        queue("obs", 1)
                    elif k >= 0.82 and lv_persist < 2 and evo_points >= TECH_COST[2]:
                        queue("persist", 2)

                elif strategy == "system_hermit":
                    if k >= 0.62 and lv_persist < 1 and evo_points >= TECH_COST[1]:
                        queue("persist", 1)
                    elif k >= 0.70 and lv_obs < 1 and evo_points >= TECH_COST[1]:
                        queue("obs", 1)
                    elif k >= 0.76 and n_worlds < 2:
                        r_target = max(r_target, 0.03)
                        queue("world", 2)
                    elif k >= 0.80 and lv_stealth < 1 and evo_points >= TECH_COST[1]:
                        queue("stealth", 1)
                    elif k >= 0.84 and n_worlds < 3:
                        r_target = max(r_target, 0.08)
                        queue("world", 3)
                    elif k >= 0.88 and lv_persist < 2 and evo_points >= TECH_COST[2]:
                        queue("persist", 2)
                    elif k >= 0.92 and n_worlds < 4:
                        r_target = max(r_target, 0.15)
                        queue("world", 4)
                    elif k >= 0.96 and lv_obs < 2 and evo_points >= TECH_COST[2]:
                        queue("obs", 2)
                    elif k >= 1.00 and lv_stealth < 2 and evo_points >= TECH_COST[2]:
                        queue("stealth", 2)

                elif strategy == "expander":
                    if k >= 0.68 and lv_persist < 1 and evo_points >= TECH_COST[1]:
                        queue("persist", 1)
                    elif k >= 0.72 and n_worlds < 2:
                        queue("world", 2)
                    elif lv_persist >= 1 and k >= 0.76 and r_target < 2.2:
                        r_target = 2.2
                    elif k >= 0.82 and lv_persist < 2 and evo_points >= TECH_COST[2]:
                        queue("persist", 2)
                    elif k >= 0.84 and n_worlds < 3:
                        queue("world", 3)
                    elif lv_persist >= 2 and k >= 0.90 and r_target < 3.6:
                        r_target = 3.6
                    elif k >= 0.94 and n_worlds < 4:
                        queue("world", 4)
                    elif k >= 0.98 and lv_obs < 1 and evo_points >= TECH_COST[1]:
                        queue("obs", 1)
                    elif k >= 1.02 and lv_strike < 1 and evo_points >= TECH_COST[1]:
                        queue("strike", 1)
                    elif lv_persist >= 2 and k >= 1.08 and tier < 2 and n_stars >= 2:
                        queue("tier", 2)
                    elif tier >= 2 and r_target < 4.8:
                        r_target = 4.8
                    elif k >= 1.24 and lv_persist < 3 and evo_points >= TECH_COST[3]:
                        queue("persist", 3)
                    elif k >= 1.38 and tier < 3 and n_stars >= 4:
                        queue("tier", 3)
                    elif tier >= 3 and r_target < 9.6:
                        r_target = 9.6
                    elif k >= 1.52 and lv_persist < 4 and evo_points >= TECH_COST[4]:
                        queue("persist", 4)

            planet_crowding = 1.0 / (1.0 + 0.45 * math.log(max(1, n_worlds)))
            delta_density = 0.16 * traits["P_pop"] * (1.0 + 1.1 * max(0.0, k - K0)) * math.sqrt(0.01 / r_civ) * planet_crowding

            if k < K_CRIT:
                delta_conc = 0.0
            elif n_stars >= 2:
                delta_conc = 0.0
            elif n_worlds >= 2:
                delta_conc = 0.05
            else:
                delta_conc = 0.12

            delta_colony = 0.05 * math.log(max(1, n_worlds))
            r_sync = R_SYNC0 * traits["S_org"] * M_SYNC[lv_persist]
            inst_lag = (r_civ / r_sync) ** 2
            lag_strain_u = (1.0 - lag_alpha) * lag_strain_u + lag_alpha * inst_lag
            delta_lag = 0.25 * lag_strain_u

            delta_tier = {1: 0.0, 2: 0.15, 3: 0.35}[tier]
            delta_gov = 0.08 * math.log(max(1, n_stars))
            delta_persist = DELTA_PERSIST_MAP[lv_persist]
            delta_over = obs_imbalance_sdi(lv_obs, lv_persist, n_worlds, n_stars, k)

            s_raw = traits["D_self"] * (
                delta_density + delta_conc + delta_colony + delta_lag
                + delta_tier + DELTA_STRIKE[lv_strike] + delta_over + delta_gov - delta_persist
            ) + e_fixed
            sdi = min(1.0, max(0.0, s_raw))
            cur_sdi_val = sdi

            g_surv, g_foc, sweep_p = survey_and_focus_gain(lv_obs, r_civ, n_stars, k)
            cur_n = local_noise_factor(lv_obs, k)
            if g_surv / cur_n > peak_g_surv / peak_noise:
                peak_g_surv, peak_g_foc, peak_sweep, peak_noise = g_surv, g_foc, sweep_p, cur_n

        # Observation & Posthumous Light-Cone Callback check
        for ev in cosmos:
            t_arr_start = ev.t_emit + ev.dist_ly
            t_arr_end = ev.t_end + ev.dist_ly
            if t_arr_start <= t <= t_arr_end:
                flux = (
                    S_BASE_BY_TIER[ev.tier] * ev.stealth_mult * math.exp(-KAPPA_TH * ev.dist_ly)
                    + ev.beacon_flux * math.exp(-KAPPA_LASER * ev.dist_ly)
                )
                if alive:
                    snr_surv = (flux * g_surv * w_obs_trait) / (((ev.dist_ly / D0) ** 2) * cur_n * N_BG)
                    if snr_surv >= 1.0:
                        if t_first_weak is None:
                            t_first_weak = t
                        snr_foc = (flux * g_foc * w_obs_trait) / (((ev.dist_ly / D0) ** 2) * cur_n * N_BG)
                        if snr_foc >= 5.0 and t_first_lock is None:
                            t_first_lock = t
                            dist_first_lock = ev.dist_ly
                    elif t_first_lock is None and rng.random() < sweep_p:
                        snr_foc = (flux * g_foc * w_obs_trait) / (((ev.dist_ly / D0) ** 2) * cur_n * N_BG)
                        if snr_foc >= 1.0 and t_first_weak is None:
                            t_first_weak = t
                        if snr_foc >= 5.0:
                            t_first_lock = t
                            dist_first_lock = ev.dist_ly
                elif t_first_lock is None and callback_first_t is None:
                    snr_dead_surv = (flux * peak_g_surv * w_obs_trait) / (((ev.dist_ly / D0) ** 2) * peak_noise * N_BG)
                    hit = False
                    if snr_dead_surv >= 1.0:
                        snr_dead_foc = (flux * peak_g_foc * w_obs_trait) / (((ev.dist_ly / D0) ** 2) * peak_noise * N_BG)
                        if snr_dead_foc >= 5.0:
                            hit = True
                    elif rng.random() < peak_sweep:
                        snr_dead_foc = (flux * peak_g_foc * w_obs_trait) / (((ev.dist_ly / D0) ** 2) * peak_noise * N_BG)
                        if snr_dead_foc >= 5.0:
                            hit = True
                    if hit:
                        callback_first_t = t
                        if t_extinct is not None and ev.t_emit <= t_extinct:
                            callback_coeval = True

        # Compute instantaneous productivity & point accrual rate before stepping
        if alive:
            wave = sum(a * math.sin(w * t + p) for a, w, p in zip(harm_amps, harm_omegas, harm_phases))
            eta_stoch = max(-0.65, min(0.65, wave + z_ou + j_jump))
            pi_exp = math.exp(ALPHA_K * (k - K0))
            chaos_damp = max(0.0, 1.0 - LAMBDA_CHAOS * sdi)
            pi_prod = pi_exp * math.exp(eta_stoch) * chaos_damp
            v_e = V_E0 * pi_prod * traits["P_pop"] * traits["I_sci"]
            cur_v_e_val = v_e * 100.0  # pts / 100 sim yr

        if step % sample_stride == 0:
            trace_alive.append(1 if alive else 0)
            trace_locked.append(1 if (t_first_lock is not None and t_first_lock <= t) else 0)
            trace_k.append(k if alive else None)
            trace_sdi.append((cur_sdi_val * 100.0) if (alive and cur_sdi_val is not None) else None)
            trace_v_e.append(cur_v_e_val if (alive and cur_v_e_val is not None) else None)
            trace_e_cum.append(evo_points_earned if alive else None)

        if alive and step < steps:
            if s_raw < 1.0:
                collapse_armed = True
            elif collapse_armed and s_raw >= 1.0:
                collapse_armed = False
                if r_civ > r_sync:
                    crisis_count += 1
                    r_civ = max(0.01, r_civ * 0.30)
                    r_target = r_civ
                    e_fixed = max(0.0, e_fixed * 0.5 - 0.15)
                elif lv_persist >= 3 and not shield_used:
                    shield_used = True
                    e_fixed = min(e_fixed, 0.50 - s_raw + e_fixed)
                else:
                    alive = False
                    cause_of_death = "SDI_System_Collapse"
                    t_extinct = t + DT

            if alive:
                a_check_accum += DT
                if a_check_accum >= 30.0:
                    a_check_accum -= 30.0
                    if s_raw > 0.70 and rng.random() < 0.10:
                        if n_stars == 1 and n_worlds == 1 and r_persist_total(traits["Phi_trait"], lv_persist, n_worlds, n_stars) < 1.5:
                            alive = False
                            cause_of_death = "SDI_System_Collapse"
                            t_extinct = t + DT
                        else:
                            crisis_count += 1
                            r_civ = max(0.01, r_civ * 0.60)
                            r_target = min(r_target, r_civ)

            if alive:
                lam_int = hazard_rate_per_yr(sdi)
                p_fatal_step = 1.0 - math.exp(-lam_int * DT)
                if rng.random() < p_fatal_step:
                    alive = False
                    cause_of_death = "ColdWar_SelfDestruct"
                    t_extinct = t + DT
                elif sdi > 0.50 and rng.random() < lam_int * DT * 2.5:
                    crisis_count += 1
                    k = max(K0, k - 0.015)

            if alive:
                rp = r_persist_total(traits["Phi_trait"], lv_persist, n_worlds, n_stars)
                has_deflect = (lv_obs >= 1 and lv_strike >= 1)

                if alive and not has_deflect and rp < 1.5 and rng.random() < (1.2 / 1000.0) * DT:
                    if n_worlds == 1 and n_stars == 1 and rng.random() < 0.22:
                        alive = False
                        cause_of_death = "B1a_AsteroidSwarm"
                        t_extinct = t + DT
                    else:
                        crisis_count += 1
                        k = max(K0, k - 0.03)
                        e_fixed += 0.10

                if alive and rng.random() < (0.28 / 1000.0) * DT:
                    if not has_deflect:
                        if n_stars == 1 and n_worlds == 1 and rp < 5.0:
                            alive = False
                            cause_of_death = "B1b_Extinction_Impact"
                            t_extinct = t + DT
                        elif n_stars == 1 and n_worlds >= 2:
                            crisis_count += 1
                            n_worlds = max(1, n_worlds - 1)
                            k = max(K0, k - 0.08)
                            e_fixed += 0.20
                        elif n_stars >= 2:
                            crisis_count += 1
                            r_civ = max(0.05, r_civ * 0.72)
                            r_target = min(r_target, r_civ)
                            k = max(K0, k - 0.03)
                            e_fixed += 0.12

                if alive and rng.random() < (0.60 / 1000.0) * DT:
                    if rp < 2.0:
                        if n_stars == 1 and n_worlds == 1 and rng.random() < 0.40:
                            alive = False
                            cause_of_death = "B2_CoreUpheaval"
                            t_extinct = t + DT
                        else:
                            crisis_count += 1
                            if n_stars == 1 and n_worlds >= 2 and rng.random() < 0.40:
                                n_worlds = max(1, n_worlds - 1)
                            k = max(K0, k - 0.04)
                            e_fixed += 0.15

                if alive and rng.random() < (0.22 / 1000.0) * DT:
                    if lv_persist < 3:
                        if n_stars == 1:
                            alive = False
                            cause_of_death = "B4_Supernova"
                            t_extinct = t + DT
                        else:
                            captured_now = [(d, w, xyz) for d, w, xyz in star_catalog if d <= r_civ]
                            tot_w = sum(w for _, w, _ in captured_now)
                            pick = rng.uniform(0.0, tot_w)
                            acc = 0.0
                            epi_xyz = captured_now[0][2]
                            for _, w, xyz in captured_now:
                                acc += w
                                if acc >= pick:
                                    epi_xyz = xyz
                                    break
                            u_beam = rng.uniform(0.65, 1.0)
                            dose_num = 0.0
                            for _, w, xyz in captured_now:
                                d3d = math.sqrt(
                                    (xyz[0] - epi_xyz[0]) ** 2
                                    + (xyz[1] - epi_xyz[1]) ** 2
                                    + (xyz[2] - epi_xyz[2]) ** 2
                                )
                                dose_num += w * math.exp(-d3d / D_B4_SCALE)
                            lambda_b4 = u_beam * (dose_num / max(1e-9, tot_w))
                            if lambda_b4 >= 0.88:
                                alive = False
                                cause_of_death = "B4_Supernova"
                                t_extinct = t + DT
                            else:
                                crisis_count += 1
                                r_civ = max(2.0 if lambda_b4 < 0.72 else 0.05, r_civ * (1.0 - 0.65 * lambda_b4))
                                r_target = min(r_target, r_civ)
                                k = max(K0, k - 0.12 * lambda_b4)
                                e_fixed += 0.25 * lambda_b4

            if alive:
                # Ledger clamp K immediately to surviving physical capacity
                captured_now = [(d, w, xyz) for d, w, xyz in star_catalog if d <= r_civ]
                n_eff_now = sum(w for _, w, _ in captured_now)
                cap_now = k_max(n_eff_now, n_worlds)
                k = min(k, cap_now)

                # Advance stochastic processes
                z_ou = z_ou * ou_decay + ou_std * rng.gauss(0.0, 1.0)
                j_jump *= jump_decay
                if rng.random() < 0.008 * DT:
                    j_jump += -0.18 if rng.random() < 0.45 else 0.22

                # Integrate non-linear point accumulation from productivity curve
                d_evo = v_e * DT
                evo_points += d_evo
                evo_points_earned += d_evo

                # Advance mathematical scale K
                tech_ramp = 0.18 + 0.82 * min(1.0, max(0.0, (k - K0) / (K_REF - K0)))
                wall = max(0.0, 1.0 - (k / cap_now) ** 4)
                accel = (
                    tech_ramp
                    * (pi_exp ** 0.35)
                    * math.exp(0.30 * eta_stoch)
                    * (1.0 + 0.18 * math.log(max(1, n_worlds)) + 0.35 * math.log(max(1.0, n_eff_now)))
                    * traits["I_sci"]
                    * (traits["D_self"] ** 0.35)
                )
                dk = R_K * accel * wall * chaos_damp * DT
                k = min(cap_now, k + dk)

    return {
        "alive": alive,
        "cause": cause_of_death,
        "lifespan": SIM_YEARS if alive else (t_extinct or 0.0),
        "k_end": k,
        "k_340yr": k_at_340yr,
        "e_earned": evo_points_earned,
        "t_crit": t_crit,
        "t_ref": t_ref,
        "t_multiplanet": t_multiplanet,
        "t_multistar": t_multistar,
        "crises": crisis_count,
        "t_weak": t_first_weak,
        "t_lock": t_first_lock,
        "dist_lock": dist_first_lock,
        "callback_hit": callback_first_t is not None,
        "callback_coeval": callback_coeval,
        "trace_alive": trace_alive,
        "trace_locked": trace_locked,
        "trace_k": trace_k,
        "trace_sdi": trace_sdi,
        "trace_v_e": trace_v_e,
        "trace_e_cum": trace_e_cum,
    }


def main() -> None:
    human_fit = verify_human_productivity_fit()
    strategies = ["balanced", "system_hermit", "expander", "obs_rusher", "planet_hermit"]
    n_runs = 1000
    summary = {}
    ensemble_curves = {}

    sample_stride = 5
    t_grid = [int(step * DT) for step in range(0, int(SIM_YEARS / DT) + 1, sample_stride)]

    for s_idx, strat in enumerate(strategies):
        res = [run_single(strat, 30000 * s_idx + i) for i in range(n_runs)]
        causes: Dict[str, int] = {}
        for r in res:
            causes[r["cause"]] = causes.get(r["cause"], 0) + 1

        def median_of(key: str) -> Optional[float]:
            vals = sorted(r[key] for r in res if r[key] is not None)
            return round(vals[len(vals) // 2], 1) if vals else None

        k340 = [r["k_340yr"] for r in res if r["k_340yr"] is not None]
        blind_dead = [r for r in res if (not r["alive"]) and r["t_lock"] is None]
        cb_hits = sum(1 for r in blind_dead if r["callback_hit"])
        cb_coeval = sum(1 for r in blind_dead if r["callback_coeval"])
        surv_runs = [r for r in res if r["alive"]]

        summary[strat] = {
            "survival_5000yr": round(len(surv_runs) / n_runs, 3),
            "mean_lifespan": round(sum(r["lifespan"] for r in res) / n_runs, 1),
            "mean_k_end": round(sum(r["k_end"] for r in res) / n_runs, 3),
            "mean_k_survivors": round(
                sum(r["k_end"] for r in surv_runs) / max(1, len(surv_runs)), 3
            ),
            "mean_e_earned_survivors": round(
                sum(r["e_earned"] for r in surv_runs) / max(1, len(surv_runs)), 1
            ),
            "mean_k_340yr": round(sum(k340) / len(k340), 3) if k340 else None,
            "med_t_crit": median_of("t_crit"),
            "med_t_ref": median_of("t_ref"),
            "med_t_multiplanet": median_of("t_multiplanet"),
            "med_t_multistar": median_of("t_multistar"),
            "weak_detect_rate": round(sum(1 for r in res if r["t_weak"] is not None) / n_runs, 3),
            "lock_detect_rate": round(sum(1 for r in res if r["t_lock"] is not None) / n_runs, 3),
            "median_t_lock_yr": median_of("t_lock"),
            "median_dist_lock_ly": median_of("dist_lock"),
            "dead_never_saw_rate": round(len(blind_dead) / n_runs, 3),
            "callback_among_blind_dead": round(cb_hits / max(1, len(blind_dead)), 3) if blind_dead else None,
            "callback_coeval_among_blind_dead": round(cb_coeval / max(1, len(blind_dead)), 3) if blind_dead else None,
            "mean_crises": round(sum(r["crises"] for r in res) / n_runs, 2),
            "causes": causes,
        }

        surv_pct: List[float] = []
        lock_pct: List[float] = []
        mean_k: List[Optional[float]] = []
        mean_sdi: List[Optional[float]] = []
        mean_v_e: List[Optional[float]] = []
        mean_e_cum: List[Optional[float]] = []

        for gi in range(len(t_grid)):
            surv_pct.append(round(100.0 * sum(r["trace_alive"][gi] for r in res) / n_runs, 2))
            lock_pct.append(round(100.0 * sum(r["trace_locked"][gi] for r in res) / n_runs, 2))
            ks = [r["trace_k"][gi] for r in res if r["trace_k"][gi] is not None]
            sdis = [r["trace_sdi"][gi] for r in res if r["trace_sdi"][gi] is not None]
            ves = [r["trace_v_e"][gi] for r in res if r["trace_v_e"][gi] is not None]
            ecs = [r["trace_e_cum"][gi] for r in res if r["trace_e_cum"][gi] is not None]
            mean_k.append(round(sum(ks) / len(ks), 4) if ks else None)
            mean_sdi.append(round(sum(sdis) / len(sdis), 2) if sdis else None)
            mean_v_e.append(round(sum(ves) / len(ves), 3) if ves else None)
            mean_e_cum.append(round(sum(ecs) / len(ecs), 2) if ecs else None)

        ensemble_curves[strat] = {
            "t": t_grid,
            "surv_pct": surv_pct,
            "lock_pct": lock_pct,
            "mean_k": mean_k,
            "mean_sdi": mean_sdi,
            "mean_v_e": mean_v_e,
            "mean_e_cum": mean_e_cum,
        }

    out_path = OUT_DIR / "sim_results.json"
    out_path.write_text(
        json.dumps(
            {
                "human_curve_fit": human_fit,
                "summary": summary,
                "ensemble_curves": ensemble_curves,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(json.dumps({"human_curve_fit": human_fit, "summary": summary}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
