"""Monte Carlo & trajectory dynamics simulator for Beyond the Light Cone (v3).

Calibrations & fixes from v2 diagnostics:
1. Fixes double-sqrt bug in survey_and_focus_gain() and restricts long-baseline interferometry
   gain to narrow-beam G_focus (all-sky G_survey scales with array aperture only).
2. Enforces true "Great Silence" rarity (BAR_D_CIV = 600 ly, R_COSMOS = 500 ly, no forced min=1
   neighbor, realistic Tier 2/3 stealth & narrow sky-sweep probability).
3. Rebalances early B1a/B2 impacts into K/SDI shocks + minority fatalities so Cold-War SDI
   brinkmanship dominates the obs_rusher risk loop instead of t=0 meteorite wipes.
4. Adds DESIGN.md §5.3 strike tech SDI (+8/23/51/91%), multi-star coordination baseline tension,
   and R_SYNC0 = 1.40 ly so Tier 3 balanced empires maintain ~18% dynamic SDI tension instead of 0%.
"""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np


# --- Core Calibrated Constants ---
K0 = 0.73                 # 2026-11 humanity baseline
R_K = 0.0028              # logarithmic K growth rate (sim yr^-1)
K_STAR_1 = 1.05           # single-star ceiling
DELTA_K_STAR = 0.38       # multi-star ceiling uplift per ln(N)
C_N_ACCEL = 0.35          # multi-star research acceleration
LAMBDA_CHAOS = 1.00       # SDI brake on K growth

BETA_K = 2.85             # Cap(K) = exp(beta_K * (K - 0.73))
GAMMA_N = 0.65            # persistence ln(N) factor
M_RED = {0: 1.0, 1: 2.2, 2: 3.5, 3: 6.0, 4: 15.0}
R_SYNC0 = 1.40            # calibrated baseline sync radius (ly) -> 1.4..14.0 ly
M_SYNC = {0: 1.0, 1: 1.5, 2: 2.5, 3: 5.0, 4: 10.0}
DELTA_STRIKE = {0: 0.0, 1: 0.08, 2: 0.23, 3: 0.51, 4: 0.91}
DELTA_PERSIST_MAP = {0: 0.0, 1: 0.15, 2: 0.28, 3: 0.45, 4: 0.65}

# Observation engineering & complexity loads by level 0..4
PSI_ENG = {0: 0.5, 1: 1.3, 2: 3.0, 3: 5.8, 4: 15.0}
PSI_INFO = {0: 0.5, 1: 1.2, 2: 2.8, 3: 5.2, 4: 13.8}
THETA_ENG = 1.40
THETA_SOC = 1.40
ALPHA_ENG = 0.11
ALPHA_SOC = 0.13

# Cold-War Probabilistic Hazard Rate lambda(SDI) per 100 sim yr
SDI_SAFE = 0.38
H_MAX_CENTURY = 0.45
HAZARD_POWER = 2.0

# True Great Silence sparse cosmos (century-news scarcity across 5,000 sim yr)
BAR_D_CIV = 600.0         # rho_civ^(-1/3) = 600 ly -> ~2.4 total neighbors inside 500 ly across 6,500 yr
R_COSMOS = 500.0
SIM_YEARS = 5000.0
DT = 10.0                 # 10 sim yr per step

# Extinction & calibration from DESIGN.md §7.1
KAPPA_TH = 2e-4           # ly^-1
KAPPA_LASER = 5e-4        # ly^-1
D0 = 4.22                 # ly
N_BG = 4.0e-5
S_BASE_BY_TIER = {1: 0.001, 2: 0.080, 3: 4.0}


def k_max(n_nodes: int) -> float:
    return min(2.00, K_STAR_1 + DELTA_K_STAR * math.log(max(1, n_nodes)))


def cap_k(k: float) -> float:
    return math.exp(BETA_K * (k - K0))


def h_civic(lv_persist: int, n_nodes: int) -> float:
    return M_RED[lv_persist] * (1.0 + GAMMA_N * math.log(max(1, n_nodes)))


def obs_imbalance_sdi(lv_obs: int, lv_persist: int, n_nodes: int, k: float) -> float:
    re = PSI_ENG[lv_obs] / cap_k(k)
    rs = PSI_INFO[lv_obs] / h_civic(lv_persist, n_nodes)
    pe = ALPHA_ENG * (max(0.0, re - THETA_ENG) ** 2)
    ps = ALPHA_SOC * (max(0.0, rs - THETA_SOC) ** 2)
    return pe + ps


def hazard_rate_per_yr(sdi: float) -> float:
    if sdi <= SDI_SAFE:
        h_century = 0.0015 * ((sdi / SDI_SAFE) ** 3)
    else:
        x = (sdi - SDI_SAFE) / (1.0 - SDI_SAFE)
        h_century = 0.0015 + H_MAX_CENTURY * (x ** HAZARD_POWER)
    return h_century / 100.0


def survey_and_focus_gain(lv_obs: int, r_civ: float, n_nodes: int) -> tuple[float, float, float]:
    """Return (G_survey_eff, G_focus_eff, sweep_hit_prob_per_10yr) following DESIGN.md §5.3."""
    survey_map = {0: 0.6, 1: 1.0, 2: 2.5, 3: 8.0, 4: 25.0}
    focus_map = {0: 1.2, 1: 3.16, 2: 79.1, 3: 2530.0, 4: 1.0e6}
    beta_r_map = {0: 0.0, 1: 0.0, 2: 0.2, 3: 1.0, 4: 1.5}
    # Solid angle sky coverage fraction per 10 sim yr of active targeted scanning
    sweep_prob_map = {0: 0.0004, 1: 0.0030, 2: 0.0020, 3: 0.0010, 4: 0.0004}

    b_perp = max(0.01, r_civ * 0.8 if n_nodes >= 2 else 0.01)
    baseline_mult = 1.0 + beta_r_map[lv_obs] * math.log(b_perp / 0.01)
    g_surv = survey_map[lv_obs]
    g_foc = focus_map[lv_obs] * baseline_mult
    return g_surv, g_foc, sweep_prob_map[lv_obs]


def local_noise_factor(lv_obs: int, k: float) -> float:
    if lv_obs == 0:
        return 1.25
    if lv_obs == 1:
        return 0.70 if k >= 0.82 else 0.90
    if lv_obs == 2:
        return 0.45
    return 0.35


def thermal_detect_limit_survey(lv_obs: int, r_civ: float, n_nodes: int, k: float, source_tier: int = 2, stealth_m: float = 1.0, snr_thresh: float = 5.0) -> float:
    g_surv, _, _ = survey_and_focus_gain(lv_obs, r_civ, n_nodes)
    n_loc = local_noise_factor(lv_obs, k) * N_BG
    f_th = S_BASE_BY_TIER[source_tier] * stealth_m
    lo, hi = 0.1, 2500.0
    for _ in range(32):
        mid = 0.5 * (lo + hi)
        snr = (f_th * math.exp(-KAPPA_TH * mid) * g_surv) / (((mid / D0) ** 2) * n_loc)
        if snr >= snr_thresh:
            lo = mid
        else:
            hi = mid
    return lo


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
    """Sparse True Great Silence universe (bar_d_civ = 600 ly, R_COSMOS = 500 ly)."""
    rho = 1.0 / (BAR_D_CIV ** 3)
    vol = (4.0 / 3.0) * math.pi * (R_COSMOS ** 3)
    n_expected = rho * vol
    L = math.exp(-n_expected)
    k_cnt = 0
    p = 1.0
    while p > L:
        k_cnt += 1
        p *= rng.random()
    n_civs = max(0, k_cnt - 1)

    # Baseline 2026-11 survey detection thresholds
    g_surv0, _, _ = survey_and_focus_gain(0, 0.01, 1)
    n_loc0 = local_noise_factor(0, K0) * N_BG

    events: List[NeighborEmission] = []
    for _ in range(n_civs):
        dist = R_COSMOS * (rng.random() ** (1.0 / 3.0))
        if dist < 18.0:
            dist = 18.0 + rng.random() * 60.0

        t_birth = rng.uniform(-1500.0, 4300.0)
        # In a True Great Silence cosmos, most survivors adopt stealth quickly; only rare reckless/malfunctioning ones leak loud
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
            # Lv.4 background dust stealth (1e-4), Lv.3 heatsink (0.006), or anisotropic (0.04)
            stealth_m = 1e-4 if rng.random() < 0.50 else (0.006 if rng.random() < 0.78 else (0.04 if rng.random() < 0.80 else 1.0))

        # Ensure 2026-11 cold-start: zero pre-t=0 signals visible at SNR >= 1 under baseline survey
        snr0 = (S_BASE_BY_TIER[tier] * stealth_m * math.exp(-KAPPA_TH * dist) * g_surv0) / (((dist / D0) ** 2) * n_loc0)
        if snr0 >= 1.0 and t_loud + dist <= 0.0 and t_die + dist >= 0.0:
            t_loud = max(t_loud, -dist + rng.uniform(80.0, 900.0))
            t_die = max(t_die, t_loud + rng.uniform(400.0, 2000.0))

        events.append(NeighborEmission(dist_ly=dist, t_emit=t_loud, t_end=t_die, tier=tier, stealth_mult=stealth_m, beacon_flux=0.0))

        # Rare directional sweep / extinction flash whose beam geometrically hits Earth (~4% over lifetime)
        if rng.random() < 0.04:
            t_flash = rng.uniform(max(t_loud, -dist + 50.0), t_die)
            events.append(
                NeighborEmission(
                    dist_ly=dist,
                    t_emit=t_flash,
                    t_end=t_flash + 20.0,
                    tier=tier,
                    stealth_mult=stealth_m,
                    beacon_flux=1.5 if rng.random() < 0.5 else 0.05,
                    is_pulse=True,
                )
            )
    return events


def run_single(strategy: str, seed: int) -> Dict:
    rng = random.Random(seed)
    cosmos = generate_cosmos(rng)

    k = K0
    r_civ = 0.01
    n_nodes = 1
    lv_obs = 0
    lv_persist = 0
    lv_stealth = 0
    lv_strike = 0
    tier = 1
    alive = True
    cause_of_death = "Survived_5000yr"
    t_extinct: Optional[float] = None

    # Local Gaia-like stars around cradle [2.0, 3.2, 4.8, 6.8, 9.5, 13.0, 17.5]
    candidate_stars = [2.0, 3.2, 4.8, 6.8, 9.5, 13.0, 17.5]
    crisis_count = 0

    t_first_weak: Optional[float] = None
    t_first_lock: Optional[float] = None
    dist_first_lock: Optional[float] = None

    peak_g_surv = survey_and_focus_gain(0, 0.01, 1)[0]
    peak_g_foc = survey_and_focus_gain(0, 0.01, 1)[1]
    peak_sweep = survey_and_focus_gain(0, 0.01, 1)[2]
    peak_noise = local_noise_factor(0, K0)

    grid_samples: List[Dict] = []
    e_fixed = 0.0
    shock_decay = math.exp(-DT / 60.0)

    steps = int(SIM_YEARS / DT)
    for step in range(steps + 1):
        t = step * DT

        if alive:
            e_fixed *= shock_decay
            # --- 1. Determine Strategy Actions ---
            if strategy == "balanced":
                # Builds Persist & active asteroid deflection first, expands smoothly within R_sync = 1.4..14.0 ly
                if k >= 0.75 and lv_persist < 1:
                    lv_persist = 1
                if lv_persist >= 1 and k >= 0.78 and lv_obs < 1:
                    lv_obs = 1
                if lv_obs >= 1 and k >= 0.80 and lv_strike < 1:
                    lv_strike = 1  # kinetic asteroid deflection (+8% SDI per DESIGN.md §5.3)
                if lv_persist >= 1 and k >= 0.86 and r_civ < 2.2:
                    r_civ = 2.2    # capture 2nd star (2.0 ly), R_sync=2.1 -> safe lag
                if k >= 0.94 and lv_persist < 2:
                    lv_persist = 2
                if lv_persist >= 1 and k >= 0.96 and lv_obs < 2:
                    lv_obs = 2
                if lv_persist >= 2 and k >= 1.02 and r_civ < 3.6:
                    r_civ = 3.6    # capture 3rd star (3.2 ly), R_sync=3.5 -> safe lag
                if k >= 1.12 and lv_persist >= 2:
                    tier = max(tier, 2)
                if tier >= 2 and lv_persist >= 2 and k >= 1.24 and lv_obs < 3:
                    lv_obs = 3
                if k >= 1.30 and lv_persist < 3:
                    lv_persist = 3
                if lv_persist >= 3 and k >= 1.35 and r_civ < 5.2:
                    r_civ = 5.2    # capture 4th star (4.8 ly), R_sync=7.0 -> safe lag
                if k >= 1.45 and lv_persist < 4:
                    lv_persist = 4
                if lv_persist >= 4 and k >= 1.50:
                    tier = max(tier, 3)
                    r_civ = max(r_civ, 13.5) # capture up to 7 nodes, R_sync=14.0 -> sustainable Tier 3 giant bubble
                if tier >= 3 and lv_persist >= 4 and k >= 1.62 and lv_obs < 4:
                    lv_obs = 4

            elif strategy == "obs_rusher":
                # Cold-War observation gambler: pushes Obs Lv.2 immediately, then Lv.3 on minimal Persist, consolidates if lucky
                if k >= 0.73 and lv_obs < 1:
                    lv_obs = 1
                if k >= 0.75 and lv_obs < 2:
                    lv_obs = 2
                if k >= 0.85 and lv_persist < 1:
                    lv_persist = 1
                if lv_persist >= 1 and k >= 0.94 and lv_obs < 3:
                    lv_obs = 3
                if k >= 0.98 and lv_strike < 1:
                    lv_strike = 1
                if lv_persist >= 1 and k >= 1.01 and r_civ < 2.2:
                    r_civ = 2.2
                if k >= 1.08 and lv_persist < 2:
                    lv_persist = 2
                    tier = max(tier, 2)
                    r_civ = max(r_civ, 3.6)
                if k >= 1.26 and lv_persist < 3:
                    lv_persist = 3
                    r_civ = max(r_civ, 5.2)
                if k >= 1.42 and lv_persist < 4:
                    lv_persist = 4
                    tier = max(tier, 3)
                    r_civ = max(r_civ, 10.2)
                if tier >= 3 and lv_persist >= 4 and k >= 1.56 and lv_obs < 4:
                    lv_obs = 4

            elif strategy == "hermit":
                # Stays single-world microsphere (N=1), stacks Persist + Stealth safely
                r_civ = 0.03
                if k >= 0.75 and lv_persist < 1:
                    lv_persist = 1
                if k >= 0.80 and lv_stealth < 1:
                    lv_stealth = 1
                if k >= 0.84 and lv_obs < 1:
                    lv_obs = 1
                if k >= 0.93 and lv_persist < 2:
                    lv_persist = 2
                if k >= 0.98 and lv_obs < 2:
                    lv_obs = 2
                if k >= 1.02 and lv_stealth < 2:
                    lv_stealth = 2

            elif strategy == "expander":
                # Aggressively expands R_civ ~1.6x ahead of R_sync to capture stars/Tier fast (55-82% Cold-War sync edge)
                if k >= 0.75 and r_civ < 2.0:
                    r_civ = 2.0
                if k >= 0.82 and lv_persist < 1:
                    lv_persist = 1
                if k >= 0.86 and lv_strike < 1:
                    lv_strike = 1
                if k >= 0.88 and r_civ < 3.4:
                    r_civ = 3.4
                if k >= 0.96 and lv_obs < 2:
                    lv_obs = 2
                if k >= 1.05 and lv_persist < 2:
                    lv_persist = 2
                if lv_persist >= 2 and k >= 1.08:
                    tier = max(tier, 2)
                    r_civ = max(r_civ, 5.4)
                if k >= 1.26 and lv_persist < 3:
                    lv_persist = 3
                if k >= 1.38:
                    tier = max(tier, 3)
                    r_civ = max(r_civ, 10.6)
                if k >= 1.52 and lv_persist < 4:
                    lv_persist = 4
                    lv_obs = max(lv_obs, 3)
                    r_civ = max(r_civ, 15.0)

            n_nodes = 1 + sum(1 for d_star in candidate_stars if d_star <= r_civ)

            # --- 2. Compute SDI Components ---
            delta_density = 0.16 * (1.0 + 1.1 * (k - K0)) * math.sqrt(0.01 / r_civ)
            r_sync = R_SYNC0 * M_SYNC[lv_persist]
            delta_lag = 0.25 * ((r_civ / r_sync) ** 2) if r_civ > 0.2 else 0.0
            delta_tier = {1: 0.0, 2: 0.15, 3: 0.35}[tier]
            delta_gov = 0.08 * math.log(max(1, n_nodes))  # multi-star relativistic governance overhead
            delta_persist = DELTA_PERSIST_MAP[lv_persist]
            delta_over = obs_imbalance_sdi(lv_obs, lv_persist, n_nodes, k)

            s_raw = delta_density + delta_lag + delta_tier + DELTA_STRIKE[lv_strike] + delta_over + delta_gov - delta_persist + e_fixed
            sdi = min(1.0, max(0.0, s_raw))

            # --- 3. Update Peak Observation Profile (for Posthumous Callback) ---
            g_surv, g_foc, sweep_p = survey_and_focus_gain(lv_obs, r_civ, n_nodes)
            cur_n = local_noise_factor(lv_obs, k)
            if g_surv / cur_n > peak_g_surv / peak_noise:
                peak_g_surv = g_surv
                peak_g_foc = g_foc
                peak_sweep = sweep_p
                peak_noise = cur_n

            # --- 4. Check Signal Arrival & Detection while Alive (Asymmetric Survey vs Narrow Focus) ---
            for ev in cosmos:
                t_arr_start = ev.t_emit + ev.dist_ly
                t_arr_end = ev.t_end + ev.dist_ly
                if t_arr_start <= t <= t_arr_end:
                    flux = (
                        S_BASE_BY_TIER[ev.tier] * ev.stealth_mult * math.exp(-KAPPA_TH * ev.dist_ly)
                        + ev.beacon_flux * math.exp(-KAPPA_LASER * ev.dist_ly)
                    )
                    snr_surv = (flux * g_surv) / (((ev.dist_ly / D0) ** 2) * cur_n * N_BG)
                    if snr_surv >= 1.0:
                        if t_first_weak is None:
                            t_first_weak = t
                        # Once survey spots an anomaly, player turns narrow focus onto it -> uses g_foc!
                        snr_foc = (flux * g_foc) / (((ev.dist_ly / D0) ** 2) * cur_n * N_BG)
                        if snr_foc >= 5.0 and t_first_lock is None:
                            t_first_lock = t
                            dist_first_lock = ev.dist_ly
                    elif t_first_lock is None and rng.random() < sweep_p:
                        # Blind sky sweep occasionally happens to point narrow beam at target
                        snr_foc = (flux * g_foc) / (((ev.dist_ly / D0) ** 2) * cur_n * N_BG)
                        if snr_foc >= 1.0 and t_first_weak is None:
                            t_first_weak = t
                        if snr_foc >= 5.0:
                            t_first_lock = t
                            dist_first_lock = ev.dist_ly

        if step % 5 == 0:
            d_lim_t2 = thermal_detect_limit_survey(lv_obs, r_civ, n_nodes, k, source_tier=2, stealth_m=1.0, snr_thresh=5.0) if alive else 0.0
            grid_samples.append({
                "t": t,
                "k": k if alive else None,
                "sdi": sdi if alive else None,
                "n_nodes": n_nodes if alive else 0,
                "d_lim_t2": d_lim_t2,
                "alive": 1 if alive else 0,
                "locked": 1 if (t_first_lock is not None and t >= t_first_lock) else 0,
            })

        if alive and step < steps:
            # --- 5. Stochastic Hazard Check over [t, t + DT) (Cold-War Brinkmanship + External Great Filters) ---
            lam_int = hazard_rate_per_yr(sdi)
            p_fatal_step = 1.0 - math.exp(-lam_int * DT)
            if sdi >= 0.999 and rng.random() < 0.35:
                alive = False
                cause_of_death = "SDI_System_Collapse"
                t_extinct = t + DT
            elif rng.random() < p_fatal_step:
                alive = False
                cause_of_death = "ColdWar_SelfDestruct"
                t_extinct = t + DT
            elif sdi > 0.50 and rng.random() < lam_int * DT * 2.5:
                crisis_count += 1
                k = max(K0, k - 0.015)

            if alive:
                r_persist = M_RED[lv_persist] * (1.0 + GAMMA_N * math.log(max(1, n_nodes)))
                has_active_deflect = (lv_obs >= 1 and lv_strike >= 1)

                # B1a: Regional asteroid swarm (~1.2 / 1000 yr when unshielded; 22% lethal, 78% K/SDI crisis)
                if alive and not has_active_deflect and r_persist < 1.5 and rng.random() < (1.2 / 1000.0) * DT:
                    if rng.random() < 0.22:
                        alive = False
                        cause_of_death = "B1a_AsteroidSwarm"
                        t_extinct = t + DT
                    else:
                        crisis_count += 1
                        k = max(K0, k - 0.035)
                        e_fixed += 0.10
                # B1b: Chicxulub-class Planet-Killer Impactor (~0.28 / 1000 yr)
                if alive and rng.random() < (0.28 / 1000.0) * DT:
                    if not has_active_deflect:
                        if n_nodes == 1 and r_persist < 5.0:
                            alive = False
                            cause_of_death = "B1b_DinosaurKiller_Impact"
                            t_extinct = t + DT
                        elif n_nodes >= 2:
                            r_civ = max(0.05, r_civ * 0.72)
                            k = max(K0, k - 0.03)
                            e_fixed += 0.12
                # B2: Mother-star/planetary environment upheaval (~0.60 / 1000 yr; 40% lethal at N=1, else +15% SDI & -K)
                if alive and rng.random() < (0.60 / 1000.0) * DT:
                    if r_persist < 2.0:
                        if n_nodes == 1 and rng.random() < 0.40:
                            alive = False
                            cause_of_death = "B2_CoreUpheaval"
                            t_extinct = t + DT
                        else:
                            crisis_count += 1
                            k = max(K0, k - 0.04)
                            e_fixed += 0.15
                            if n_nodes >= 2:
                                r_civ = max(0.05, r_civ * 0.70)
                # B3: Super Carrington stellar particle storm (~0.60 / 1000 yr)
                if alive and rng.random() < (0.60 / 1000.0) * DT:
                    if r_persist < 3.2:
                        crisis_count += 1
                        k = max(K0, k - 0.025)
                        e_fixed += 0.10
                # B4: Nearby supernova/GRB (~0.22 / 1000 yr)
                if alive and lv_persist < 3 and rng.random() < (0.22 / 1000.0) * DT:
                    if n_nodes <= 1:
                        alive = False
                        cause_of_death = "B4_Supernova"
                        t_extinct = t + DT
                    else:
                        r_civ = max(0.05, r_civ * 0.65)
                        e_fixed += 0.15

            # --- 6. Advance K(t) over [t, t + DT) ---
            if alive:
                cap_now = k_max(n_nodes)
                phi_n = 1.0 + C_N_ACCEL * math.log(max(1, n_nodes))
                brake = max(0.0, 1.0 - LAMBDA_CHAOS * sdi)
                dk = R_K * phi_n * max(0.0, 1.0 - k / cap_now) * brake * DT
                k = min(cap_now, k + dk)

    # --- 7. Posthumous Light-Cone Callback Check (Option A) ---
    callback_coeval = False
    callback_any = False
    t_first_callback: Optional[float] = None
    if not alive and t_extinct is not None:
        for ev in cosmos:
            t_arr_start = ev.t_emit + ev.dist_ly
            t_arr_end = ev.t_end + ev.dist_ly
            if t_arr_end > t_extinct and t_arr_start <= SIM_YEARS:
                t_eff_arr = max(t_arr_start, t_extinct + DT)
                if t_eff_arr <= SIM_YEARS:
                    flux = (
                        S_BASE_BY_TIER[ev.tier] * ev.stealth_mult * math.exp(-KAPPA_TH * ev.dist_ly)
                        + ev.beacon_flux * math.exp(-KAPPA_LASER * ev.dist_ly)
                    )
                    # Callback strictly checks if the signal would have reached lock threshold on the tombstone's peak survey/watched gear
                    snr_surv = (flux * peak_g_surv) / (((ev.dist_ly / D0) ** 2) * peak_noise * N_BG)
                    snr_foc = (flux * peak_g_foc) / (((ev.dist_ly / D0) ** 2) * peak_noise * N_BG)
                    # Either all-sky visible OR sweeps across a sector the dead civ watched
                    would_catch = (snr_surv >= 1.0 and snr_foc >= 5.0) or (snr_foc >= 5.0 and rng.random() < min(1.0, peak_sweep * 2.0))
                    if would_catch:
                        callback_any = True
                        if ev.t_emit < t_extinct:
                            callback_coeval = True
                        if t_first_callback is None or t_eff_arr < t_first_callback:
                            t_first_callback = t_eff_arr

    return {
        "strategy": strategy,
        "alive_end": alive,
        "t_end": SIM_YEARS if alive else (t_extinct or 0.0),
        "cause": cause_of_death,
        "final_k": k,
        "t_first_weak": t_first_weak,
        "t_first_lock": t_first_lock,
        "dist_first_lock": dist_first_lock,
        "crisis_count": crisis_count,
        "callback_any": callback_any,
        "callback_coeval": callback_coeval,
        "t_first_callback": t_first_callback,
        "grid_samples": grid_samples,
    }


def main() -> None:
    strategies = ["balanced", "obs_rusher", "hermit", "expander"]
    n_runs = 1000
    summary = {}
    ensemble_curves = {}

    for s_idx, strat in enumerate(strategies):
        results = [run_single(strat, seed=10000 * s_idx + i) for i in range(n_runs)]
        surv_rate = sum(1 for r in results if r["alive_end"]) / n_runs
        mean_life = float(np.mean([r["t_end"] for r in results]))
        mean_k = float(np.mean([r["final_k"] for r in results]))

        locks = [r["t_first_lock"] for r in results if r["t_first_lock"] is not None]
        weaks = [r["t_first_weak"] for r in results if r["t_first_weak"] is not None]
        dead_runs = [r for r in results if not r["alive_end"]]
        dead_no_lock = [r for r in dead_runs if r["t_first_lock"] is None]
        cb_among_blind_dead = (
            sum(1 for r in dead_no_lock if r["callback_any"]) / len(dead_no_lock)
            if dead_no_lock else 0.0
        )
        cb_coeval_among_dead = (
            sum(1 for r in dead_no_lock if r["callback_coeval"]) / len(dead_no_lock)
            if dead_no_lock else 0.0
        )

        causes: Dict[str, int] = {}
        for r in results:
            causes[r["cause"]] = causes.get(r["cause"], 0) + 1

        summary[strat] = {
            "survival_5000yr": round(surv_rate, 4),
            "mean_lifespan_yr": round(mean_life, 1),
            "mean_final_k": round(mean_k, 3),
            "weak_detect_rate": round(len(weaks) / n_runs, 4),
            "lock_detect_rate": round(len(locks) / n_runs, 4),
            "median_t_lock_yr": round(float(np.median(locks)), 1) if locks else None,
            "median_dist_lock_ly": round(float(np.median([r["dist_first_lock"] for r in results if r["dist_first_lock"] is not None])), 1) if locks else None,
            "mean_near_miss_crises": round(float(np.mean([r["crisis_count"] for r in results])), 2),
            "dead_never_saw_rate": round(len(dead_no_lock) / n_runs, 4),
            "callback_among_blind_dead": round(cb_among_blind_dead, 4),
            "callback_coeval_among_blind_dead": round(cb_coeval_among_dead, 4),
            "causes": causes,
        }

        n_pts = len(results[0]["grid_samples"])
        curves = []
        for idx in range(n_pts):
            t_val = results[0]["grid_samples"][idx]["t"]
            samples = [r["grid_samples"][idx] for r in results]
            surv_pct = sum(s["alive"] for s in samples) / n_runs
            lock_pct = sum(s["locked"] for s in samples) / n_runs
            k_living = [s["k"] for s in samples if s["k"] is not None]
            sdi_living = [s["sdi"] for s in samples if s["sdi"] is not None]
            d_living = [s["d_lim_t2"] for s in samples if s["alive"] == 1]
            curves.append({
                "t": t_val,
                "surv_pct": round(surv_pct, 4),
                "lock_pct": round(lock_pct, 4),
                "mean_k": round(float(np.mean(k_living)), 4) if k_living else None,
                "mean_sdi": round(float(np.mean(sdi_living)), 4) if sdi_living else None,
                "mean_d_lim_t2": round(float(np.mean(d_living)), 2) if d_living else None,
            })
        ensemble_curves[strat] = curves

    out_dir = Path(__file__).resolve().parent
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "sim_results.json", "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "ensemble_curves": ensemble_curves}, f, indent=2)

    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
