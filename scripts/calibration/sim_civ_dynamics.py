"""Calibrated Monte Carlo Simulator & Acceptance Verifier (GDD v0.17.0 Multi-Messenger Bubble & Directed Expeditions).

Implements the unified GDD physics, causal isolation, progression & survival rules:
1. R1: Valid Tier 1 -> First Directed Interstellar Expedition (N_worlds >= 2, persist >= 1, no hard 8/20 ly
   radius glass walls; limited naturally by 0.10c transit & R_sync lag strain) -> receipt confirmation
   -> K_max unlock -> Tier 2 (N_stars >= 2, K >= 1.10) -> Tier 3 (N_stars >= 4, K >= 1.50).
   Uses Gaia solar-neighborhood density rho_* = 0.00233 ly^-3 (median nearest star ~4.14 ly).
2. Star Bubble = Multi-Messenger 1.00c Attenuating Signal Shells (decoupled from colonization):
   - Interstellar expansion is performed by discrete directed 0.10c expeditions to chosen star nodes,
     forming a discrete stellar network rather than sweeping a solid colonization sphere.
   - Electromagnetism (EM): S_EM * M_stealth * exp(-kappa * d) / (d/d0)^2. Enabling EM stealth leaves
     previously emitted EM waves expanding outward as a fading hollow shell while a dark silent cavity
     grows at 1.00c inside; waves past R_diss (below cosmic confusion floor F_diss) dissipate.
   - Neutrinos (nu): S_nu / (d/d0)^2 with kappa_nu = 0 and ZERO heat-sink/blackbody_mimic shielding;
     yields coarse wide-cone weak detections at Obs Lv.3+ even through cloaked dust shells/clutter.
   - Gravitational Waves (GW): linear strain h ~ h0 * (d0 / d) (1/r scaling, kappa_gw = 0, unshieldable)
     from massive quadrupole sources (Beacon Lv.4 GW monuments, Tier 3 megastructures, B4); requires
     Obs Lv.3+ AND multi-star triangulation (N_stars_confirmed >= 3) for precision lock.
   - Detaching outer synced nodes (L1/A1) suspends central sync (autonomous standby) without destroying
     physical colonies; re-joining uses 1.00c round-trip handshake; SDI >= 100% while over-extended
     causes permanent secession; multi-star B1b hits one outer star causally; B_perp uses real stars.
3. R2: Strict light-cone separation between local node physical state and core-confirmed telemetry.
4. R3: Paired comparison across identical world seeds for defense/queue regimes at 8h, 24h, ~3.5d.
5. R4: Physical catalog-based B4 supernova/GRB radiation shells with command-core handover re-anchoring.
6. R5: Unbiased neighbor emission catalog (conserved luminosity, EM hollow shells, nu & GW beacons).
7. R7/R8/R9/R10: Single authoritative dK/dt, energy-integrated heat sink, 5-slot FIFO queue & L1.
"""

from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

OUT_DIR = Path(__file__).resolve().parent

# --- Dimensionless Scale & Mathematical Growth Constants ---
K0 = 0.56
K_CRIT = 0.65
K_REF = 0.73
K_PLANET_MAX = 0.86
K_STAR_1 = 1.05
DELTA_K_WORLD = 0.14
DELTA_K_STAR = 0.38

R_K = 0.00182
ALPHA_K = 1.35
V_E0 = 0.0056
LAMBDA_CHAOS = 1.00

BETA_K = 2.85
GAMMA_W = 0.35
GAMMA_N = 0.65

M_RED = {0: 1.0, 1: 2.2, 2: 3.5, 3: 6.0, 4: 15.0}
R_SYNC0 = 1.40
# Calibrated to Gaia solar-neighborhood spacing (~4.14 ly median nearest, ~8.2 ly P90 4th star):
M_SYNC = {0: 1.0, 1: 1.5, 2: 3.5, 3: 6.0, 4: 10.0}
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

TAU_PULSE_SIM_YR = 40.0
TAU_LAG_SIM_YR = 15.0

TECH_COST = {1: 1.0, 2: 2.0, 3: 4.0, 4: 8.0}
TECH_BUILD_DUR = {1: 15.0, 2: 45.0, 3: 90.0, 4: 180.0}
STRIKE_BUILD_DUR = {1: 20.0, 2: 60.0, 3: 120.0, 4: 240.0}
TIER_BUILD_DUR = {2: 60.0, 3: 150.0}
WORLD_BUILD_DUR = 30.0

RHO_STAR_LOCAL = 0.00233  # Gaia 10-pc stellar/BD system density (ly^-3)
R_LOCAL_CATALOG = 25.0
R_HORIZON_MAX = 100.0  # Sanity horizon bound (no arbitrary 8/20 ly Tier walls after interstellar unlock)
R_B4_CATALOG = 60.0

BAR_D_CIV = 600.0
R_COSMOS = 500.0
SIM_YEARS = 5000.0
DT = 5.0

KAPPA_TH = 2e-4
KAPPA_LASER = 5e-4
KAPPA_NU = 0.0
KAPPA_GW = 0.0
D0 = 4.22
N_BG = 4.0e-5
N_BG_NU = 4.0e-5
H_BG_GW = 4.0e-5
# Wave dissipation thresholds (below cosmic confusion floor at instrument ceiling -> physically dissipated):
G_CEILING_EM = 100.0
F_DISS_EM = N_BG / G_CEILING_EM  # 4.0e-7 -> T1/T2/T3 IR ~207/1607/6777 ly, T3+S4 ~132 ly
G_CEILING_NU = 6.0
F_DISS_NU = N_BG_NU / G_CEILING_NU
G_CEILING_GW = 3.5
H_DISS_GW = H_BG_GW / G_CEILING_GW
S_BASE_BY_TIER = {1: 0.001, 2: 0.080, 3: 4.0}
S_NU_BY_TIER = {1: 0.0, 2: 0.008, 3: 0.20}
V_EXPEDITION_C = 0.10
R_GW_COSMOS = 12000.0  # Galactic disk annulus for rare Tier 3 / Beacon Lv.4 GW & laser monuments


def verify_human_productivity_fit() -> Dict[str, object]:
    """Fit power-exponential mathematical curve to 10 stylized human benchmark milestones (1500-2022).

    Note: `taus` correspond to (year - 1500) / 522 for Maddison/energy milestone years
    [1500, 1600, 1700, 1820, 1870, 1913, 1950, 1973, 2000, 2022].
    `r2_log` measures goodness-of-fit to this stylized 10-point benchmark array;
    in-game dynamics use the state-coupled Pi(K, t) and dK/dt equations, not historical replay.
    """
    years = [1500, 1600, 1700, 1820, 1870, 1913, 1950, 1973, 2000, 2022]
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
        "anchor_years": years,
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


def poisson_count(rng: random.Random, expected: float) -> int:
    if expected <= 0.0:
        return 0
    l_exp = math.exp(-expected)
    k_cnt = 0
    p = 1.0
    while p > l_exp:
        k_cnt += 1
        p *= rng.random()
    return max(0, k_cnt - 1)


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


def survey_and_focus_gain(lv_obs: int, baseline_span_ly: float, n_stars: int, k: float) -> Tuple[float, float, float]:
    g0_surv = 0.08 + 0.52 / (1.0 + math.exp(-28.0 * (k - 0.675)))
    survey_map = {0: g0_surv, 1: 1.0, 2: 2.5, 3: 8.0, 4: 25.0}
    focus_map = {0: 1.2, 1: 3.16, 2: 79.1, 3: 2530.0, 4: 1.0e6}
    beta_r_map = {0: 0.0, 1: 0.0, 2: 0.2, 3: 1.0, 4: 1.5}
    sweep_prob_map = {0: 0.0004, 1: 0.0030, 2: 0.0020, 3: 0.0010, 4: 0.0004}

    # Physical interferometric baseline comes from real confirmed synced stellar separation, not empty vacuum radius.
    b_perp = max(0.01, baseline_span_ly * 0.7071 if n_stars >= 2 else 0.01)
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


def neutrino_and_gw_gains(lv_obs: int, baseline_span_ly: float, n_stars_conf: int) -> Tuple[float, float, float]:
    """Return (G_nu, G_gw_strain, GW_triangulation_mult) for Obs Lv.0-4.

    - Neutrinos (Obs Lv.3+): wide-cone weak detections only; zero dust/stealth attenuation.
    - Gravitational waves (Obs Lv.3+): 1/r strain sensitivity; single/pair star gives wide sky arc
      only, requiring n_stars_conf >= 3 real spatial baseline for triangulated lock.
    """
    if lv_obs < 3:
        return 0.0, 0.0, 1.0
    g_nu = 1.0 if lv_obs == 3 else 4.0
    g_gw = 1.0 if lv_obs == 3 else 2.5
    if n_stars_conf >= 3:
        tri_mult = 1.0 + 0.85 * math.log(max(1.0, baseline_span_ly))
    else:
        tri_mult = 1.0
    return g_nu, g_gw, tri_mult


@dataclass
class NeighborEmission:
    dist_ly: float
    t_emit: float
    t_end: float
    tier: int
    stealth_mult: float
    beacon_flux: float
    s_nu: float = 0.0
    h0_gw: float = 0.0
    is_pulse: bool = False


@dataclass
class Expedition:
    exp_id: str
    target_node_id: int
    origin_node_id: int
    dist_ly: float
    t_launch: float
    t_arrive: float
    v_ship: float = V_EXPEDITION_C
    resolved: bool = False


def observe_emission_step(
    ev: NeighborEmission,
    g_surv: float,
    g_foc: float,
    sweep_p: float,
    cur_n: float,
    g_nu: float,
    g_gw: float,
    gw_tri_mult: float,
    n_stars_conf: int,
    w_obs_trait: float,
    sw_roll: float,
) -> Tuple[bool, bool, Optional[str], Optional[str]]:
    """Evaluate EM, Neutrino, and GW detection at arrival time.

    Returns (weak_hit, lock_hit, weak_channel, lock_channel).
    EM cuts off above R_diss when irradiance falls below F_DISS_EM.
    Neutrinos bypass EM stealth & dust extinction, yielding weak coarse-cone hits only.
    GW strain decays as 1/r (kappa_gw=0) and locks only with n_stars_conf >= 3 triangulation.
    """
    weak_hit = False
    lock_hit = False
    weak_ch: Optional[str] = None
    lock_ch: Optional[str] = None

    inv_sq = (ev.dist_ly / D0) ** 2

    # 1) Electromagnetic messenger: 1/r^2 * exp(-kappa * d), EMCON/stealth damped, R_diss cutoff
    flux_em = (
        S_BASE_BY_TIER[ev.tier] * ev.stealth_mult * math.exp(-KAPPA_TH * ev.dist_ly)
        + ev.beacon_flux * math.exp(-KAPPA_LASER * ev.dist_ly)
    )
    irrad_em = flux_em / inv_sq
    if irrad_em >= F_DISS_EM:
        snr_surv = (irrad_em * g_surv * w_obs_trait) / (cur_n * N_BG)
        if snr_surv >= 1.0:
            weak_hit = True
            weak_ch = "em"
            snr_foc = (irrad_em * g_foc * w_obs_trait) / (cur_n * N_BG)
            if snr_foc >= 5.0:
                lock_hit = True
                lock_ch = "em"
        elif sw_roll < sweep_p:
            snr_foc = (irrad_em * g_foc * w_obs_trait) / (cur_n * N_BG)
            if snr_foc >= 1.0:
                weak_hit = True
                weak_ch = "em"
            if snr_foc >= 5.0:
                lock_hit = True
                lock_ch = "em"

    # 2) Neutrino messenger: 1/r^2, kappa_nu = 0, immune to heat-sink / blackbody_mimic, coarse cone only
    if g_nu > 0.0 and ev.s_nu > 0.0:
        irrad_nu = ev.s_nu / inv_sq
        if irrad_nu >= F_DISS_NU:
            snr_nu = (irrad_nu * g_nu * w_obs_trait) / N_BG_NU
            if snr_nu >= 1.0:
                weak_hit = True
                if weak_ch is None:
                    weak_ch = "nu"

    # 3) Gravitational Wave messenger: linear 1/r strain amplitude, kappa_gw = 0, >=3 star triangulation
    if g_gw > 0.0 and ev.h0_gw > 0.0:
        strain_gw = ev.h0_gw * (D0 / ev.dist_ly)
        if strain_gw >= H_DISS_GW:
            snr_gw = (strain_gw * g_gw * w_obs_trait) / H_BG_GW
            if snr_gw >= 1.0:
                weak_hit = True
                if weak_ch is None:
                    weak_ch = "gw"
            if n_stars_conf >= 3 and (snr_gw * gw_tri_mult) >= 5.0:
                lock_hit = True
                if lock_ch is None:
                    lock_ch = "gw"

    return weak_hit, lock_hit, weak_ch, lock_ch


@dataclass
class StarNode:
    node_id: int
    dist_ly: float
    weight: float
    xyz: Tuple[float, float, float]
    progenitor_unstable: bool = False
    captured_local: bool = False
    confirmed_at_core: bool = False
    destroyed: bool = False
    synced_with_core: bool = False
    seceded: bool = False
    d_core: float = 0.0

    def __post_init__(self) -> None:
        if self.d_core == 0.0 and self.dist_ly > 0.0:
            self.d_core = self.dist_ly


@dataclass
class B4BurstEvent:
    event_id: str
    xyz: Tuple[float, float, float]
    t_emit: float
    d_ref_ly: float
    is_beamed: bool
    jet_dir: Tuple[float, float, float]
    jet_cos_half: float
    beam_boost: float
    off_beam_factor: float


@dataclass
class B1Event:
    event_id: str
    kind: str  # "B1a" or "B1b"
    t_warn: float
    t_impact: float
    deflected: bool = False
    resolved: bool = False


@dataclass
class CataclysmSchedule:
    b1_events: List[B1Event]
    b2_times: List[float]
    b2_rolls: List[Tuple[bool, bool]]  # (core_fatal_single, multiworld_loss)
    b4_events: List[B4BurstEvent]


@dataclass
class ReceiptEvent:
    event_id: str
    node_id: int
    kind: str  # "capture", "resync", or "destroy"
    t_source: float
    t_arrive: float
    sdi_pulse: float = 0.0
    k_drop: float = 0.0


@dataclass
class PlanStep:
    dimension: str  # "obs" | "persist" | "stealth" | "strike" | "world_up" | "k_tier_up"
    target_level: int
    min_k: float = 0.0


def random_unit_vec(rng: random.Random) -> Tuple[float, float, float]:
    cos_t = rng.uniform(-1.0, 1.0)
    sin_t = math.sqrt(max(0.0, 1.0 - cos_t * cos_t))
    phi = rng.uniform(0.0, 2.0 * math.pi)
    return (sin_t * math.cos(phi), sin_t * math.sin(phi), cos_t)


def vec_dist(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def generate_cosmos_unbiased(rng: random.Random) -> List[NeighborEmission]:
    """Generate observer-independent Poisson multi-messenger emission shells (EM hollow shells, nu, GW)."""
    rho = 1.0 / (BAR_D_CIV ** 3)
    vol = (4.0 / 3.0) * math.pi * (R_COSMOS ** 3)
    n_civs = poisson_count(rng, rho * vol)

    events: List[NeighborEmission] = []
    for _ in range(n_civs):
        dist = max(0.5, R_COSMOS * (rng.random() ** (1.0 / 3.0)))
        t_birth = rng.uniform(-1200.0, 4300.0)
        roll = rng.random()
        if roll < 0.62:
            tier = 1
            t_loud = t_birth
            t_die = t_birth + rng.uniform(300.0, 2400.0)
            stealth_m = 0.50 if rng.random() < 0.85 else 1.0
            events.append(NeighborEmission(
                dist_ly=dist, t_emit=t_loud, t_end=t_die,
                tier=tier, stealth_mult=stealth_m, beacon_flux=0.0, s_nu=0.0, h0_gw=0.0,
            ))
        elif roll < 0.92:
            tier = 2
            t_loud = t_birth + rng.uniform(450.0, 1000.0)
            t_die = t_loud + rng.uniform(600.0, 2600.0)
            stealth_cloaked = 0.006 if rng.random() < 0.45 else (0.04 if rng.random() < 0.85 else 0.50)
            s_nu = S_NU_BY_TIER[2]
            if rng.random() < 0.35 and stealth_cloaked < 0.50:
                # Initially loud EM phase leaves an expanding hollow wave shell once EMCON starts
                t_emcon = t_loud + rng.uniform(0.15, 0.50) * (t_die - t_loud)
                events.append(NeighborEmission(
                    dist_ly=dist, t_emit=t_loud, t_end=t_emcon,
                    tier=tier, stealth_mult=0.50, beacon_flux=0.0, s_nu=s_nu, h0_gw=0.0,
                ))
                events.append(NeighborEmission(
                    dist_ly=dist, t_emit=t_emcon, t_end=t_die,
                    tier=tier, stealth_mult=stealth_cloaked, beacon_flux=0.0, s_nu=s_nu, h0_gw=0.0,
                ))
            else:
                events.append(NeighborEmission(
                    dist_ly=dist, t_emit=t_loud, t_end=t_die,
                    tier=tier, stealth_mult=stealth_cloaked, beacon_flux=0.0, s_nu=s_nu, h0_gw=0.0,
                ))
        else:
            tier = 3
            t_loud = t_birth + rng.uniform(1100.0, 2000.0)
            t_die = t_loud + rng.uniform(500.0, 2200.0)
            stealth_cloaked = 1e-4 if rng.random() < 0.50 else (0.006 if rng.random() < 0.78 else (0.04 if rng.random() < 0.80 else 1.0))
            s_nu = S_NU_BY_TIER[3]
            h0_gw = 0.080 if rng.random() < 0.15 else (0.015 if rng.random() < 0.45 else 0.0)
            if rng.random() < 0.45 and stealth_cloaked < 1.0:
                t_emcon = t_loud + rng.uniform(0.15, 0.50) * (t_die - t_loud)
                events.append(NeighborEmission(
                    dist_ly=dist, t_emit=t_loud, t_end=t_emcon,
                    tier=tier, stealth_mult=1.0, beacon_flux=0.0, s_nu=s_nu, h0_gw=h0_gw,
                ))
                events.append(NeighborEmission(
                    dist_ly=dist, t_emit=t_emcon, t_end=t_die,
                    tier=tier, stealth_mult=stealth_cloaked, beacon_flux=0.0, s_nu=s_nu, h0_gw=h0_gw,
                ))
            else:
                events.append(NeighborEmission(
                    dist_ly=dist, t_emit=t_loud, t_end=t_die,
                    tier=tier, stealth_mult=stealth_cloaked, beacon_flux=0.0, s_nu=s_nu, h0_gw=h0_gw,
                ))

        if rng.random() < 0.04 and t_die > t_loud + 20.0:
            t_flash = rng.uniform(t_loud, t_die - 20.0)
            events.append(NeighborEmission(
                dist_ly=dist, t_emit=t_flash, t_end=t_flash + 20.0,
                tier=tier, stealth_mult=1.0,
                beacon_flux=1.5 if rng.random() < 0.5 else 0.05,
                s_nu=0.05 if tier >= 2 else 0.008,
                h0_gw=0.025 if tier == 3 else 0.0,
                is_pulse=True,
            ))

    # Thin-disk outer annulus (500..12,000 ly): rare Tier 3 / Beacon Lv.4 GW Star Monuments
    n_gw_far = poisson_count(rng, 10.0)
    for _ in range(n_gw_far):
        dist = math.sqrt(500.0 ** 2 + (R_GW_COSMOS ** 2 - 500.0 ** 2) * rng.random())
        t_emit = rng.uniform(-dist, 4500.0)
        t_end = t_emit + rng.uniform(600.0, 2500.0)
        events.append(NeighborEmission(
            dist_ly=dist, t_emit=t_emit, t_end=t_end,
            tier=3, stealth_mult=1e-4,
            beacon_flux=1.2 if rng.random() < 0.25 else 0.0,
            s_nu=S_NU_BY_TIER[3],
            h0_gw=0.080,
            is_pulse=False,
        ))
    return events


def sample_local_star_catalog(rng: random.Random) -> List[StarNode]:
    """Sample Gaia solar-neighborhood 3D Poisson star field (rho_* = 0.00233 ly^-3, R <= 25 ly)."""
    cradle = StarNode(
        node_id=0, dist_ly=0.0, weight=1.0, xyz=(0.0, 0.0, 0.0),
        progenitor_unstable=False, captured_local=True, confirmed_at_core=True,
        destroyed=False, synced_with_core=True,
    )
    vol = (4.0 / 3.0) * math.pi * (R_LOCAL_CATALOG ** 3)
    n_other = poisson_count(rng, RHO_STAR_LOCAL * vol)
    nodes = [cradle]
    for idx in range(1, n_other + 1):
        d = max(0.35, R_LOCAL_CATALOG * (rng.random() ** (1.0 / 3.0)))
        ux, uy, uz = random_unit_vec(rng)
        w = rng.uniform(0.75, 1.35)
        nodes.append(StarNode(
            node_id=idx, dist_ly=d, weight=w, xyz=(d * ux, d * uy, d * uz),
            progenitor_unstable=(rng.random() < 0.015),
        ))
    nodes.sort(key=lambda n: n.dist_ly)
    for i, node in enumerate(nodes):
        node.node_id = i
    return nodes


def generate_b4_catalog_events(rng: random.Random, horizon: float = SIM_YEARS) -> List[B4BurstEvent]:
    """Generate real unstable-progenitor B4 events in R <= 60 ly.

    Physically scaled so Lambda_B4 = 1.0 (requiring R_persist >= 4.5) occurs around d_ref ~ 18-26 ly
    for isotropic supernovae and farther inside relativistic GRB cones (~18% beamed), with burst
    frequency calibrated to ~0.22 / 1,000 yr lethal exposure for unprotected single-world baseline.
    """
    expected_bursts = 0.36 * (horizon / 1000.0)
    n_bursts = poisson_count(rng, expected_bursts)
    bursts: List[B4BurstEvent] = []
    for bi in range(n_bursts):
        d = max(2.5, R_B4_CATALOG * (rng.random() ** (1.0 / 3.0)))
        ux, uy, uz = random_unit_vec(rng)
        t_emit = rng.uniform(-d, horizon)
        is_beamed = rng.random() < 0.25
        d_ref = rng.uniform(18.0, 26.0) if not is_beamed else rng.uniform(22.0, 32.0)
        bursts.append(B4BurstEvent(
            event_id=f"b4_{bi}",
            xyz=(d * ux, d * uy, d * uz),
            t_emit=t_emit,
            d_ref_ly=d_ref,
            is_beamed=is_beamed,
            jet_dir=random_unit_vec(rng),
            jet_cos_half=math.cos(math.radians(24.0)),
            beam_boost=3.2,
            off_beam_factor=0.22,
        ))
    return bursts


def b4_lambda_at_node(burst: B4BurstEvent, node_xyz: Tuple[float, float, float]) -> Tuple[float, float]:
    """Return (dist_ly, Lambda_B4) at a specific node coordinate using inverse-square + beaming."""
    dx = node_xyz[0] - burst.xyz[0]
    dy = node_xyz[1] - burst.xyz[1]
    dz = node_xyz[2] - burst.xyz[2]
    d = max(0.1, math.sqrt(dx * dx + dy * dy + dz * dz))
    beam_mult = 1.0
    if burst.is_beamed:
        cos_ang = abs((dx * burst.jet_dir[0] + dy * burst.jet_dir[1] + dz * burst.jet_dir[2]) / d)
        beam_mult = burst.beam_boost if cos_ang >= burst.jet_cos_half else burst.off_beam_factor
    flux_ratio = ((burst.d_ref_ly / d) ** 2) * beam_mult * math.exp(-KAPPA_LASER * d)
    return d, math.sqrt(max(0.0, flux_ratio))


def generate_cataclysms(rng: random.Random, horizon: float = SIM_YEARS) -> CataclysmSchedule:
    """Pre-generate identical B1/B2/B4 schedules for paired strategy/regime comparison."""
    b1_events: List[B1Event] = []
    for kind, rate in (("B1a", 1.2 / 1000.0), ("B1b", 0.28 / 1000.0)):
        cnt = poisson_count(rng, rate * horizon)
        for j in range(cnt):
            t_imp = rng.uniform(35.0, horizon)
            b1_events.append(B1Event(
                event_id=f"{kind}_{j}",
                kind=kind,
                t_warn=t_imp - 30.0,
                t_impact=t_imp,
            ))
    b1_events.sort(key=lambda e: e.t_impact)

    n_b2 = poisson_count(rng, (0.60 / 1000.0) * horizon)
    b2_times = sorted(rng.uniform(10.0, horizon) for _ in range(n_b2))
    b2_rolls = [(rng.random() < 0.40, rng.random() < 0.40) for _ in range(n_b2)]

    b4_events = generate_b4_catalog_events(rng, horizon=horizon)
    return CataclysmSchedule(b1_events=b1_events, b2_times=b2_times, b2_rolls=b2_rolls, b4_events=b4_events)


def strategy_plan(strategy: str) -> List[PlanStep]:
    """Return explicit allocation_plan steps per strategy archetype (honoring Tier prerequisites)."""
    if strategy == "balanced":
        return [
            PlanStep("persist", 1, 0.62),
            PlanStep("world_up", 2, 0.72),
            PlanStep("obs", 1, 0.74),
            PlanStep("strike", 1, 0.76),
            PlanStep("world_up", 3, 0.80),
            PlanStep("persist", 2, 0.84),
            PlanStep("world_up", 4, 0.90),
            PlanStep("obs", 2, 0.94),
            PlanStep("k_tier_up", 2, 1.10),
            PlanStep("persist", 3, 1.15),
            PlanStep("obs", 3, 1.22),
            PlanStep("persist", 4, 1.38),
            PlanStep("k_tier_up", 3, 1.50),
            PlanStep("obs", 4, 1.56),
        ]
    if strategy == "obs_rusher":
        return [
            PlanStep("obs", 1, 0.62),
            PlanStep("obs", 2, 0.74),
            PlanStep("world_up", 2, 0.80),
            PlanStep("persist", 1, 0.82),
            PlanStep("world_up", 3, 0.88),
            PlanStep("strike", 1, 0.92),
            PlanStep("world_up", 4, 0.96),
            PlanStep("persist", 2, 1.00),
            PlanStep("k_tier_up", 2, 1.10),
            PlanStep("obs", 3, 1.14),
            PlanStep("persist", 3, 1.26),
            PlanStep("persist", 4, 1.42),
            PlanStep("k_tier_up", 3, 1.50),
            PlanStep("obs", 4, 1.58),
        ]
    if strategy == "system_hermit":
        return [
            PlanStep("persist", 1, 0.62),
            PlanStep("obs", 1, 0.70),
            PlanStep("world_up", 2, 0.76),
            PlanStep("stealth", 1, 0.80),
            PlanStep("world_up", 3, 0.84),
            PlanStep("persist", 2, 0.88),
            PlanStep("world_up", 4, 0.92),
            PlanStep("obs", 2, 0.96),
            PlanStep("stealth", 2, 1.00),
        ]
    if strategy == "expander":
        return [
            PlanStep("persist", 1, 0.68),
            PlanStep("world_up", 2, 0.72),
            PlanStep("world_up", 3, 0.84),
            PlanStep("world_up", 4, 0.94),
            PlanStep("obs", 1, 0.98),
            PlanStep("persist", 2, 1.02),
            PlanStep("strike", 1, 1.04),
            PlanStep("k_tier_up", 2, 1.10),
            PlanStep("persist", 3, 1.24),
            PlanStep("k_tier_up", 3, 1.50),
            PlanStep("persist", 4, 1.52),
        ]
    # planet_hermit
    return [
        PlanStep("persist", 1, 0.62),
        PlanStep("stealth", 1, 0.72),
        PlanStep("obs", 1, 0.76),
        PlanStep("persist", 2, 0.82),
    ]


@dataclass
class WorldSeedData:
    traits: Dict[str, float]
    cosmos: List[NeighborEmission]
    star_catalog: List[StarNode]
    cataclysms: CataclysmSchedule
    harm_phases: List[float]
    ou_gauss: List[float]
    jump_rolls: List[Tuple[bool, bool]]
    a_check_rolls: List[float]
    coldwar_rolls: List[Tuple[float, float]]
    sweep_rolls: List[float]


def build_world_seed(seed: int, steps: int) -> WorldSeedData:
    rng = random.Random(seed)
    traits = sample_traits_13(rng)
    cosmos = generate_cosmos_unbiased(rng)
    star_catalog = sample_local_star_catalog(rng)
    cataclysms = generate_cataclysms(rng)
    harm_phases = [rng.uniform(0.0, 2.0 * math.pi) for _ in range(3)]
    ou_gauss = [rng.gauss(0.0, 1.0) for _ in range(steps + 1)]
    jump_rolls = [(rng.random() < 0.008 * DT, rng.random() < 0.45) for _ in range(steps + 1)]
    a_check_rolls = [rng.random() for _ in range(steps + 1)]
    coldwar_rolls = [(rng.random(), rng.random()) for _ in range(steps + 1)]
    sweep_rolls = [rng.random() for _ in range(steps + 1)]
    return WorldSeedData(
        traits=traits, cosmos=cosmos, star_catalog=star_catalog, cataclysms=cataclysms,
        harm_phases=harm_phases, ou_gauss=ou_gauss, jump_rolls=jump_rolls,
        a_check_rolls=a_check_rolls, coldwar_rolls=coldwar_rolls, sweep_rolls=sweep_rolls,
    )


def clone_star_catalog(src: List[StarNode]) -> List[StarNode]:
    return [
        StarNode(
            node_id=s.node_id, dist_ly=s.dist_ly, weight=s.weight, xyz=s.xyz,
            progenitor_unstable=s.progenitor_unstable,
            captured_local=s.captured_local, confirmed_at_core=s.confirmed_at_core,
            destroyed=s.destroyed, synced_with_core=s.synced_with_core, seceded=s.seceded,
            d_core=s.dist_ly,
        )
        for s in src
    ]


def clone_cataclysms(src: CataclysmSchedule) -> CataclysmSchedule:
    return CataclysmSchedule(
        b1_events=[B1Event(e.event_id, e.kind, e.t_warn, e.t_impact) for e in src.b1_events],
        b2_times=list(src.b2_times),
        b2_rolls=list(src.b2_rolls),
        b4_events=list(src.b4_events),
    )


def can_dispatch_expedition(
    tier: int,
    n_worlds: int,
    lv_persist: int,
    n_stars_local: int,
    n_in_flight: int,
) -> bool:
    """Unlock check for 0.10c directed interstellar expeditions (no arbitrary 8/20 ly glass walls)."""
    if tier >= 2:
        return True
    if n_worlds >= 2 and lv_persist >= 1:
        return (n_stars_local + n_in_flight) < 2
    return False


def habitation_density_factor(n_worlds: int, n_stars_synced: int) -> float:
    """Population/waste-heat crowding relief from multi-planet habitats & synced star hubs (no r_civ)."""
    w = max(1, n_worlds)
    s = max(1, n_stars_synced)
    return 1.0 / ((w ** 1.05) * (1.0 + 0.28 * math.log(w)) * (1.0 + 0.20 * math.log(s)))


def cradle_orbital_span(n_worlds: int) -> float:
    """Physical stellar-system span across planetary/orbital bastions (0.01-0.15 ly)."""
    if n_worlds <= 1:
        return 0.01
    if n_worlds == 2:
        return 0.05
    if n_worlds == 3:
        return 0.10
    return 0.15


def run_single_world(
    strategy: str,
    world: WorldSeedData,
    defense_regime: str = "no_deflect",  # "no_deflect" | "periodic_manual" | "l1_armed"
    use_hosted_plan: bool = True,
    max_queue_slots: int = 5,
    dt: float = DT,
    horizon: float = SIM_YEARS,
    initial_tier: int = 1,
    initial_n_worlds: int = 1,
    initial_lv_persist: int = 0,
) -> Dict:
    traits = world.traits
    cosmos = world.cosmos
    stars = clone_star_catalog(world.star_catalog)
    stars_by_core = sorted(stars, key=lambda s: s.d_core)
    cat = clone_cataclysms(world.cataclysms)
    w_obs_trait = traits["W_em"] * traits["eta_fab"] * traits["C_info"]

    k = K0
    n_worlds = initial_n_worlds
    tier = initial_tier
    alive = True
    cause_of_death = "Survived_5000yr"
    t_extinct: Optional[float] = None

    lv_obs = 0
    lv_persist = initial_lv_persist
    lv_stealth = 0
    lv_strike = 0

    evo_points = 0.0
    evo_points_earned = 0.0
    active_build: Optional[Tuple[str, int, float]] = None
    build_queue: List[PlanStep] = []
    plan = strategy_plan(strategy)
    plan_idx = 0
    queue_downtime_yr = 0.0

    harm_amps = [0.10, 0.07, 0.04]
    l0_scale = traits["L_0"]
    harm_omegas = [
        2.0 * math.pi / (780.0 * l0_scale),
        2.0 * math.pi / (290.0 * l0_scale),
        2.0 * math.pi / (115.0 * l0_scale),
    ]
    z_ou = 0.0
    ou_decay = math.exp(-dt / 250.0)
    ou_std = 0.10 * math.sqrt(1.0 - math.exp(-2.0 * dt / 250.0))
    j_jump = 0.0
    jump_decay = math.exp(-dt / 120.0)

    shield_used = False
    collapse_armed = True
    lag_strain_u = 0.0
    a_check_accum = 0.0
    crisis_count = 0

    e_fixed = 0.0
    e_heat_overload = 0.0
    shock_decay = math.exp(-dt / TAU_PULSE_SIM_YR)
    lag_alpha = 1.0 - math.exp(-dt / TAU_LAG_SIM_YR)

    # Directed expeditions, light-cone receipts & deduplication
    active_expeditions: List[Expedition] = []
    exp_seq = 0
    pending_receipts: List[ReceiptEvent] = []
    seen_receipt_ids: set[str] = set()
    resync_inflight_nodes: set[int] = set()
    b4_arrival_processed: set[Tuple[str, int]] = set()
    b2_idx = 0
    b1_idx = 0
    core_node_id = 0
    t_deflect_unlocked: Optional[float] = None
    l1_detach_hold_until = -1.0

    t_crit: Optional[float] = None
    t_ref: Optional[float] = None
    t_multiplanet: Optional[float] = None
    t_multistar: Optional[float] = None
    k_at_340yr: Optional[float] = None
    t_first_weak: Optional[float] = None
    t_first_lock: Optional[float] = None
    dist_first_lock: Optional[float] = None
    first_weak_channel: Optional[str] = None
    first_lock_channel: Optional[str] = None
    t_first_nu_weak: Optional[float] = None
    t_first_gw_weak: Optional[float] = None
    t_first_gw_lock: Optional[float] = None
    callback_first_t: Optional[float] = None
    callback_coeval = False
    peak_g_surv, peak_g_foc, peak_sweep = survey_and_focus_gain(0, 0.01, 1, K0)
    peak_noise = local_noise_factor(0, K0)
    peak_g_nu, peak_g_gw, peak_gw_tri, peak_n_stars_conf = 0.0, 0.0, 1.0, 1

    alive_8h = alive_24h = alive_3d5 = True
    downtime_8h = downtime_24h = downtime_3d5 = 0.0

    sample_stride = max(1, int(round(50.0 / dt)))
    trace_alive: List[int] = []
    trace_locked: List[int] = []
    trace_k: List[Optional[float]] = []
    trace_sdi: List[Optional[float]] = []
    trace_v_e: List[Optional[float]] = []
    trace_e_cum: List[Optional[float]] = []

    def current_level(dim: str) -> int:
        if dim == "obs":
            return lv_obs
        if dim == "persist":
            return lv_persist
        if dim == "stealth":
            return lv_stealth
        if dim == "strike":
            return lv_strike
        if dim == "world_up":
            return n_worlds
        return tier

    def prereq_met(step_item: PlanStep, n_stars_conf: int) -> bool:
        if k < step_item.min_k:
            return False
        dim, lv = step_item.dimension, step_item.target_level
        if dim in ("obs", "persist", "stealth", "strike"):
            if current_level(dim) >= lv:
                return False
            if current_level(dim) != lv - 1:
                return False
            if lv == 3 and tier < 2:
                return False
            if lv == 4 and tier < 3:
                return False
            return True
        if dim == "world_up":
            return n_worlds == lv - 1 and lv <= 4
        if dim == "k_tier_up":
            if lv == 2:
                return tier == 1 and n_stars_conf >= 2 and k >= 1.10
            if lv == 3:
                return tier == 2 and n_stars_conf >= 4 and k >= 1.50
        return False

    def step_cost(step_item: PlanStep) -> float:
        if step_item.dimension in ("obs", "persist", "stealth", "strike"):
            return TECH_COST[step_item.target_level]
        return 0.0

    def step_duration(step_item: PlanStep) -> float:
        if step_item.dimension == "strike":
            return STRIKE_BUILD_DUR[step_item.target_level]
        if step_item.dimension in ("obs", "persist", "stealth"):
            return TECH_BUILD_DUR[step_item.target_level]
        if step_item.dimension == "world_up":
            return WORLD_BUILD_DUR
        return TIER_BUILD_DUR[step_item.target_level]

    def try_advance_queue(n_stars_conf: int, allow_refill: bool) -> None:
        nonlocal active_build, evo_points, plan_idx
        while allow_refill and plan_idx < len(plan) and len(build_queue) < max_queue_slots:
            cand = plan[plan_idx]
            if current_level(cand.dimension) >= cand.target_level:
                plan_idx += 1
                continue
            build_queue.append(cand)
            plan_idx += 1
        while active_build is None and build_queue:
            head = build_queue[0]
            if current_level(head.dimension) >= head.target_level:
                build_queue.pop(0)
                continue
            if not prereq_met(head, n_stars_conf):
                break  # waiting_prerequisite
            cost = step_cost(head)
            if evo_points + 1e-12 < cost:
                break  # waiting_points
            evo_points = max(0.0, evo_points - cost)
            build_queue.pop(0)
            active_build = (head.dimension, head.target_level, step_duration(head))
            if allow_refill and plan_idx < len(plan) and len(build_queue) < max_queue_slots:
                cand = plan[plan_idx]
                if current_level(cand.dimension) < cand.target_level:
                    build_queue.append(cand)
                    plan_idx += 1

    def is_online_session(t_now: float) -> bool:
        # Online every 8 hours (480 sim yr) for 20 sim yr
        return (t_now % 480.0) < 20.0

    steps = int(round(horizon / dt))
    for step_idx in range(steps + 1):
        t = step_idx * dt
        if alive and abs(t - 340.0) < 1e-6:
            k_at_340yr = k

        cur_sdi_val: Optional[float] = None
        cur_v_e_val: Optional[float] = None

        if alive:
            e_fixed *= shock_decay
            r_sync = R_SYNC0 * traits["S_org"] * M_SYNC[lv_persist]

            # 1) Process light-cone receipts arriving at command core (R2 causal isolation)
            remaining_receipts: List[ReceiptEvent] = []
            for rc in pending_receipts:
                if rc.t_arrive <= t + 1e-9:
                    if rc.event_id not in seen_receipt_ids:
                        seen_receipt_ids.add(rc.event_id)
                        node = stars[rc.node_id]
                        if rc.kind == "resync":
                            resync_inflight_nodes.discard(rc.node_id)
                        if rc.kind in ("capture", "resync") and not node.destroyed and not node.seceded and node.synced_with_core:
                            node.confirmed_at_core = True
                            e_fixed += rc.sdi_pulse
                        elif rc.kind == "destroy":
                            node.confirmed_at_core = False
                            e_fixed += rc.sdi_pulse
                            if rc.k_drop > 0.0:
                                k = max(K0, k - rc.k_drop)
                else:
                    remaining_receipts.append(rc)
            pending_receipts = remaining_receipts

            # Confirmed core star counts (R2: only confirmed nodes update core K_max / SDI)
            confirmed_stars = [s for s in stars if s.confirmed_at_core]
            n_stars_conf = max(1, len(confirmed_stars))
            n_eff_conf = max(1.0, sum(s.weight for s in confirmed_stars))
            cap_conf = k_max(n_eff_conf, n_worlds)
            k = min(k, cap_conf)

            # Local intact star counts (physically colonized vs centrally synced)
            local_stars = [s for s in stars if s.captured_local and not s.destroyed and not s.seceded]
            n_stars_local = max(1, len(local_stars))
            local_synced_stars = [s for s in local_stars if s.synced_with_core]
            n_stars_synced = max(1, len(local_synced_stars))

            def detach_outer_synced_stars(target_max_r: float) -> None:
                nonlocal n_stars_synced
                for st in local_synced_stars:
                    if st.node_id != core_node_id and st.d_core > target_max_r and st.synced_with_core:
                        st.synced_with_core = False
                        st.confirmed_at_core = False
                        resync_inflight_nodes.discard(st.node_id)
                        n_stars_synced = max(1, n_stars_synced - 1)

            # 2) Resolve directed 0.10c interstellar expeditions arriving at target star systems
            remaining_exps: List[Expedition] = []
            for ex in active_expeditions:
                if ex.t_arrive <= t + 1e-9:
                    tgt = stars[ex.target_node_id]
                    if not tgt.destroyed and not tgt.seceded and not tgt.captured_local:
                        if tier >= 2 or n_stars_local < 2:
                            tgt.captured_local = True
                            tgt.synced_with_core = True
                            n_stars_local += 1
                            n_stars_synced += 1
                            local_stars.append(tgt)
                            local_synced_stars.append(tgt)
                            pending_receipts.append(ReceiptEvent(
                                event_id=f"cap_{tgt.node_id}_{int(round(ex.t_arrive))}",
                                node_id=tgt.node_id, kind="capture",
                                t_source=ex.t_arrive, t_arrive=ex.t_arrive + tgt.d_core,
                            ))
                else:
                    remaining_exps.append(ex)
            active_expeditions = remaining_exps

            if t_crit is None and k >= K_CRIT:
                t_crit = t
            if t_ref is None and k >= K_REF:
                t_ref = t
            if t_multiplanet is None and n_worlds >= 2:
                t_multiplanet = t
            if t_multistar is None and n_stars_conf >= 2:
                t_multistar = t

            # 3) Advance active construction
            if active_build is not None:
                b_kind, b_lv, work_rem = active_build
                rate = traits["P_pop"] * (traits["I_sci"] if b_kind in ("obs", "persist", "stealth", "strike") else 1.0)
                work_rem -= rate * dt
                if work_rem <= 0.0:
                    if b_kind == "obs":
                        lv_obs = b_lv
                    elif b_kind == "persist":
                        lv_persist = b_lv
                        r_sync = R_SYNC0 * traits["S_org"] * M_SYNC[lv_persist]
                        if b_lv == 3:
                            e_fixed -= 0.30
                    elif b_kind == "stealth":
                        lv_stealth = b_lv
                    elif b_kind == "strike":
                        lv_strike = b_lv
                    elif b_kind == "k_tier_up":
                        tier = max(tier, b_lv)
                    elif b_kind == "world_up":
                        n_worlds = max(n_worlds, b_lv)
                    if t_deflect_unlocked is None and lv_obs >= 1 and lv_strike >= 1:
                        t_deflect_unlocked = t
                    active_build = None
                else:
                    active_build = (b_kind, b_lv, work_rem)

            # 4) Strategy directed-expedition & 1.00c re-sync intent (no R_civ sweep or 8/20 ly walls)
            if t >= l1_detach_hold_until:
                d_first = 25.0
                d_fourth = 25.0
                found_cnt = 0
                for s in stars_by_core:
                    if s.node_id != core_node_id and not s.destroyed and not s.seceded:
                        found_cnt += 1
                        if found_cnt == 1:
                            d_first = s.d_core
                        d_fourth = s.d_core
                        if found_cnt == 3:
                            break
                desired_stars = 1
                desired_span = 0.0
                if strategy == "balanced":
                    if n_worlds >= 4 and lv_persist >= 2 and k >= 1.01:
                        desired_stars = 2
                        desired_span = d_first + 0.05
                    if tier >= 2 and lv_persist >= 3:
                        desired_stars = 4
                        desired_span = max(desired_span, min(d_fourth + 0.05, r_sync * 1.25))
                    if tier >= 3 and lv_persist >= 4:
                        desired_stars = 8
                        desired_span = max(desired_span, min(13.5, r_sync * 0.96))
                elif strategy == "obs_rusher":
                    if n_worlds >= 3 and lv_persist >= 2 and k >= 0.98:
                        desired_stars = 2
                        desired_span = d_first + 0.05
                    if tier >= 2 and lv_persist >= 3:
                        desired_stars = 4
                        desired_span = max(desired_span, d_fourth + 0.05)
                    if tier >= 3:
                        desired_stars = 8
                        desired_span = max(desired_span, 10.2)
                elif strategy == "expander":
                    if n_worlds >= 2 and lv_persist >= 1:
                        desired_stars = 2
                        desired_span = d_first + 0.05
                    if tier >= 2:
                        desired_stars = 8
                        desired_span = max(desired_span, 6.0)
                    if tier >= 3:
                        desired_stars = 12
                        desired_span = max(desired_span, 12.0)

                if desired_stars > 1 and desired_span > 0.25:
                    in_flight_targets = {ex.target_node_id for ex in active_expeditions}
                    for s in stars_by_core:
                        if s.node_id == core_node_id or s.destroyed or s.seceded:
                            continue
                        if s.d_core > desired_span:
                            break
                        if s.captured_local and not s.synced_with_core:
                            # Intact detached autonomous colony: re-sync via 1.00c round-trip handshake
                            if s.node_id not in resync_inflight_nodes:
                                s.synced_with_core = True
                                n_stars_synced += 1
                                local_synced_stars.append(s)
                                resync_inflight_nodes.add(s.node_id)
                                pending_receipts.append(ReceiptEvent(
                                    event_id=f"resync_{s.node_id}_{int(round(t))}",
                                    node_id=s.node_id, kind="resync",
                                    t_source=t, t_arrive=t + 2.0 * s.d_core,
                                ))
                        elif (
                            not s.captured_local
                            and s.node_id not in in_flight_targets
                            and (n_stars_local + len(active_expeditions)) < desired_stars
                            and can_dispatch_expedition(tier, n_worlds, lv_persist, n_stars_local, len(active_expeditions))
                        ):
                            hub = min(local_synced_stars, key=lambda h: vec_dist(h.xyz, s.xyz))
                            hop_dist = max(0.35, vec_dist(hub.xyz, s.xyz))
                            exp_seq += 1
                            active_expeditions.append(Expedition(
                                exp_id=f"exp_{exp_seq}_{s.node_id}",
                                target_node_id=s.node_id,
                                origin_node_id=hub.node_id,
                                dist_ly=hop_dist,
                                t_launch=t,
                                t_arrive=t + hop_dist / V_EXPEDITION_C,
                            ))
                            in_flight_targets.add(s.node_id)

            # 5) Evaluate build_queue (always runs offline) + hosted allocation_plan refill (R9)
            # Note: when max_queue_slots == 0, player only starts 1 immediate build while online (no offline queue)
            if max_queue_slots == 0:
                if is_online_session(t) and active_build is None and plan_idx < len(plan):
                    while plan_idx < len(plan) and current_level(plan[plan_idx].dimension) >= plan[plan_idx].target_level:
                        plan_idx += 1
                    if plan_idx < len(plan):
                        cand = plan[plan_idx]
                        if prereq_met(cand, n_stars_conf) and evo_points + 1e-12 >= step_cost(cand):
                            evo_points = max(0.0, evo_points - step_cost(cand))
                            plan_idx += 1
                            active_build = (cand.dimension, cand.target_level, step_duration(cand))
            else:
                try_advance_queue(n_stars_conf, allow_refill=(use_hosted_plan or is_online_session(t)))
            if active_build is None and not build_queue and plan_idx < len(plan):
                next_step = plan[plan_idx]
                if prereq_met(next_step, n_stars_conf) and evo_points >= step_cost(next_step):
                    queue_downtime_yr += dt

            # 6) Compute core-visible SDI (strictly causally isolated via core-confirmed stars, R2)
            density_factor = habitation_density_factor(n_worlds, n_stars_conf)
            delta_density = 0.16 * traits["P_pop"] * (1.0 + 1.1 * max(0.0, k - K0)) * density_factor
            if k < K_CRIT or n_stars_conf >= 2:
                delta_conc = 0.0
            elif n_worlds >= 2:
                delta_conc = 0.05
            else:
                delta_conc = 0.12
            delta_colony = 0.05 * math.log(max(1, n_worlds))
            r_active = cradle_orbital_span(n_worlds)
            for s in confirmed_stars:
                if s.node_id != core_node_id and s.d_core > r_active:
                    r_active = s.d_core
            inst_lag = (r_active / r_sync) ** 2
            lag_strain_u = (1.0 - lag_alpha) * lag_strain_u + lag_alpha * inst_lag
            delta_lag = 0.25 * lag_strain_u
            delta_tier = {1: 0.0, 2: 0.15, 3: 0.35}[tier]
            delta_gov = 0.08 * math.log(max(1, n_stars_conf))
            delta_persist = DELTA_PERSIST_MAP[lv_persist]
            delta_over = obs_imbalance_sdi(lv_obs, lv_persist, n_worlds, n_stars_conf, k)

            s_raw = traits["D_self"] * (
                delta_density + delta_conc + delta_colony + delta_lag
                + delta_tier + DELTA_STRIKE[lv_strike] + delta_over + delta_gov - delta_persist
            ) + e_fixed + e_heat_overload
            sdi = min(1.0, max(0.0, s_raw))
            cur_sdi_val = sdi

            # L1 Sentinel Rule: sdi >= 80 -> detach outermost remote stars into autonomous standby safely
            if defense_regime == "l1_armed" and sdi >= 0.80 and t >= l1_detach_hold_until and r_active > max(0.20, r_sync * 0.95):
                detach_outer_synced_stars(max(0.20, r_sync * 0.95))
                l1_detach_hold_until = t + 120.0

            baseline_span_ly = 0.0
            if len(confirmed_stars) >= 2:
                for ci in range(len(confirmed_stars)):
                    for cj in range(ci + 1, len(confirmed_stars)):
                        d_pair = vec_dist(confirmed_stars[ci].xyz, confirmed_stars[cj].xyz)
                        if d_pair > baseline_span_ly:
                            baseline_span_ly = d_pair
            g_surv, g_foc, sweep_p = survey_and_focus_gain(lv_obs, baseline_span_ly, n_stars_conf, k)
            cur_n = local_noise_factor(lv_obs, k)
            g_nu, g_gw, gw_tri_mult = neutrino_and_gw_gains(lv_obs, baseline_span_ly, n_stars_conf)
            if g_surv / cur_n > peak_g_surv / peak_noise:
                peak_g_surv, peak_g_foc, peak_sweep, peak_noise = g_surv, g_foc, sweep_p, cur_n
                peak_g_nu, peak_g_gw, peak_gw_tri, peak_n_stars_conf = g_nu, g_gw, gw_tri_mult, n_stars_conf
            elif g_nu > peak_g_nu or n_stars_conf > peak_n_stars_conf:
                peak_g_nu = max(peak_g_nu, g_nu)
                peak_g_gw = max(peak_g_gw, g_gw)
                peak_gw_tri = max(peak_gw_tri, gw_tri_mult)
                peak_n_stars_conf = max(peak_n_stars_conf, n_stars_conf)

        # 7) Multi-messenger observation (EM + Neutrino + GW) & posthumous light-cone callback
        sw_roll = world.sweep_rolls[step_idx]
        for ev in cosmos:
            t_arr_start = ev.t_emit + ev.dist_ly
            t_arr_end = ev.t_end + ev.dist_ly
            if t_arr_start <= t <= t_arr_end:
                if alive:
                    w_hit, l_hit, w_ch, l_ch = observe_emission_step(
                        ev, g_surv, g_foc, sweep_p, cur_n,
                        g_nu, g_gw, gw_tri_mult, n_stars_conf,
                        w_obs_trait, sw_roll,
                    )
                    if w_hit:
                        if t_first_weak is None:
                            t_first_weak = t
                            first_weak_channel = w_ch
                        if w_ch == "nu" and t_first_nu_weak is None:
                            t_first_nu_weak = t
                        if w_ch == "gw" and t_first_gw_weak is None:
                            t_first_gw_weak = t
                    if l_hit:
                        if t_first_lock is None:
                            t_first_lock = t
                            dist_first_lock = ev.dist_ly
                            first_lock_channel = l_ch
                        if l_ch == "gw" and t_first_gw_lock is None:
                            t_first_gw_lock = t
                elif t_first_lock is None and callback_first_t is None:
                    _, l_hit_cb, _, _ = observe_emission_step(
                        ev, peak_g_surv, peak_g_foc, peak_sweep, peak_noise,
                        peak_g_nu, peak_g_gw, peak_gw_tri, peak_n_stars_conf,
                        w_obs_trait, sw_roll,
                    )
                    if l_hit_cb:
                        callback_first_t = t
                        if t_extinct is not None and ev.t_emit <= t_extinct:
                            callback_coeval = True

        # 8) Productivity & point rate
        if alive:
            wave = sum(a * math.sin(w * t + p) for a, w, p in zip(harm_amps, harm_omegas, world.harm_phases))
            eta_stoch = max(-0.65, min(0.65, wave + z_ou + j_jump))
            pi_exp = math.exp(ALPHA_K * (k - K0))
            chaos_damp = max(0.0, 1.0 - LAMBDA_CHAOS * sdi)
            pi_prod = pi_exp * math.exp(eta_stoch) * chaos_damp
            v_e = V_E0 * pi_prod * traits["P_pop"] * traits["I_sci"]
            cur_v_e_val = v_e * 100.0

        if step_idx % sample_stride == 0:
            trace_alive.append(1 if alive else 0)
            trace_locked.append(1 if (t_first_lock is not None and t_first_lock <= t) else 0)
            trace_k.append(k if alive else None)
            trace_sdi.append((cur_sdi_val * 100.0) if (alive and cur_sdi_val is not None) else None)
            trace_v_e.append(cur_v_e_val if (alive and cur_v_e_val is not None) else None)
            trace_e_cum.append(evo_points_earned if alive else None)

        if abs(t - 480.0) < 1e-6:
            alive_8h = alive
            downtime_8h = queue_downtime_yr
        if abs(t - 1440.0) < 1e-6:
            alive_24h = alive
            downtime_24h = queue_downtime_yr
        if abs(t - horizon) < 1e-6:
            alive_3d5 = alive
            downtime_3d5 = queue_downtime_yr

        if alive and step_idx < steps:
            t_next = t + dt
            # SDI critical collapse
            if s_raw < 1.0:
                collapse_armed = True
            elif collapse_armed and s_raw >= 1.0:
                collapse_armed = False
                if r_active > r_sync:
                    # Over-extended coordination collapse: outer stars permanently secede beyond retreated limit
                    crisis_count += 1
                    retract_limit = max(0.01, min(r_active * 0.50, r_sync * 0.80))
                    for s in local_stars:
                        if s.node_id != core_node_id and s.captured_local and not s.destroyed and not s.seceded:
                            if s.d_core > retract_limit:
                                s.seceded = True
                                s.captured_local = False
                                s.synced_with_core = False
                                s.confirmed_at_core = False
                                resync_inflight_nodes.discard(s.node_id)
                    e_fixed = max(0.0, e_fixed * 0.5 - 0.15)
                    l1_detach_hold_until = max(l1_detach_hold_until, t + 120.0)
                elif lv_persist >= 3 and not shield_used:
                    shield_used = True
                    e_fixed = min(e_fixed, 0.50 - s_raw + e_fixed)
                else:
                    alive = False
                    cause_of_death = "SDI_System_Collapse"
                    t_extinct = t_next

            if alive:
                a_check_accum += dt
                if a_check_accum >= 30.0:
                    a_check_accum -= 30.0
                    if s_raw > 0.70 and world.a_check_rolls[step_idx] < 0.10:
                        rp_conf = r_persist_total(traits["Phi_trait"], lv_persist, n_worlds, n_stars_conf)
                        if n_stars_conf == 1 and n_worlds == 1 and rp_conf < 1.5:
                            alive = False
                            cause_of_death = "SDI_System_Collapse"
                            t_extinct = t_next
                        else:
                            crisis_count += 1
                            if r_active > 0.25:
                                # Suspend central sync on outer colonies -> detached autonomous standby
                                detach_outer_synced_stars(max(0.20, r_active * 0.70))
                                l1_detach_hold_until = max(l1_detach_hold_until, t + 60.0)
                            else:
                                e_fixed += 0.05

            if alive:
                lam_int = hazard_rate_per_yr(sdi)
                p_fatal_step = 1.0 - math.exp(-lam_int * dt)
                cw_r1, cw_r2 = world.coldwar_rolls[step_idx]
                if cw_r1 < p_fatal_step:
                    alive = False
                    cause_of_death = "ColdWar_SelfDestruct"
                    t_extinct = t_next
                elif sdi > 0.50 and cw_r2 < lam_int * dt * 2.5:
                    crisis_count += 1
                    k = max(K0, k - 0.015)

            # B1a/B1b events with true warning + regime-dependent deflection check (R3)
            if alive:
                rp_local = r_persist_total(traits["Phi_trait"], lv_persist, n_worlds, n_stars_synced)
                while b1_idx < len(cat.b1_events) and cat.b1_events[b1_idx].t_impact <= t_next + 1e-9:
                    b1 = cat.b1_events[b1_idx]
                    b1_idx += 1
                    # Check if deflected before t_impact (requiring obs Lv.1 + strike Lv.1 before impact)
                    can_deflect = False
                    if lv_obs >= 1 and lv_strike >= 1 and t_deflect_unlocked is not None:
                        if defense_regime == "l1_armed":
                            can_deflect = True
                        elif defense_regime == "periodic_manual":
                            # Deflected only if an online session overlapped [max(t_warn, t_deflect_unlocked), t_impact]
                            start_w = max(b1.t_warn, t_deflect_unlocked)
                            if start_w <= b1.t_impact:
                                step_check = max(0, int(math.ceil(start_w / dt)))
                                end_check = int(math.floor(b1.t_impact / dt))
                                for sc in range(step_check, end_check + 1):
                                    if is_online_session(sc * dt):
                                        can_deflect = True
                                        break
                    if can_deflect:
                        b1.deflected = True
                        continue

                    if b1.kind == "B1a":
                        if rp_local < 1.5:
                            if n_worlds == 1 and n_stars_synced == 1 and (hash((b1.event_id, step_idx)) % 100) < 22:
                                alive = False
                                cause_of_death = "B1a_AsteroidSwarm"
                                t_extinct = t_next
                                break
                            else:
                                crisis_count += 1
                                k = max(K0, k - 0.03)
                                e_fixed += 0.10
                    else:  # B1b
                        if n_stars_local == 1 and n_worlds == 1 and rp_local < 5.0:
                            alive = False
                            cause_of_death = "B1b_Extinction_Impact"
                            t_extinct = t_next
                            break
                        elif n_stars_local == 1 and n_worlds >= 2:
                            crisis_count += 1
                            n_worlds = max(1, n_worlds - 1)
                            k = max(K0, k - 0.08)
                            e_fixed += 0.20
                        elif n_stars_local >= 2:
                            # Multi-star B1b impacts one outer stellar node rather than magically shrinking vacuum radius by 0.72x
                            crisis_count += 1
                            outer_targets = [
                                s for s in local_stars
                                if s.node_id != core_node_id and s.captured_local and not s.destroyed and not s.seceded
                            ]
                            if outer_targets:
                                victim = max(outer_targets, key=lambda x: x.d_core)
                                victim.destroyed = True
                                victim.captured_local = False
                                was_synced = victim.synced_with_core or victim.confirmed_at_core
                                victim.synced_with_core = False
                                if was_synced:
                                    d_victim = victim.d_core
                                    pending_receipts.append(ReceiptEvent(
                                        event_id=f"b1bloss_{b1.event_id}_{victim.node_id}",
                                        node_id=victim.node_id, kind="destroy",
                                        t_source=t_next, t_arrive=t_next + d_victim,
                                        sdi_pulse=0.12, k_drop=0.03,
                                    ))

            # B2 core upheaval
            if alive:
                rp_local = r_persist_total(traits["Phi_trait"], lv_persist, n_worlds, n_stars_synced)
                while b2_idx < len(cat.b2_times) and cat.b2_times[b2_idx] <= t_next + 1e-9:
                    roll_fatal, roll_world = cat.b2_rolls[b2_idx]
                    b2_idx += 1
                    if rp_local < 2.0 and roll_fatal:
                        if n_stars_local == 1 and n_worlds == 1:
                            alive = False
                            cause_of_death = "B2_CoreUpheaval"
                            t_extinct = t_next
                            break
                        else:
                            crisis_count += 1
                            if n_stars_local == 1 and n_worlds >= 2 and roll_world:
                                n_worlds = max(1, n_worlds - 1)
                            k = max(K0, k - 0.04)
                            e_fixed += 0.15

            # B4 real catalog radiation shell per-node physical check (R4)
            if alive:
                for burst in cat.b4_events:
                    for s in local_stars:
                        if not s.captured_local or s.destroyed or s.seceded:
                            continue
                        key = (burst.event_id, s.node_id)
                        if key in b4_arrival_processed:
                            continue
                        d_burst, lam_b4 = b4_lambda_at_node(burst, s.xyz)
                        t_arr_node = burst.t_emit + d_burst
                        if t_arr_node <= t_next + 1e-9:
                            b4_arrival_processed.add(key)
                            if lv_persist >= 3:
                                continue
                            active_net_stars = (
                                len([x for x in local_stars if x.captured_local and not x.destroyed and not x.seceded and x.synced_with_core])
                                if s.synced_with_core else 1
                            )
                            rp_node = r_persist_total(
                                traits["Phi_trait"], lv_persist,
                                n_worlds if s.node_id == core_node_id else 1,
                                max(1, active_net_stars),
                            )
                            if rp_node < 4.5 * lam_b4:
                                s.destroyed = True
                                s.captured_local = False
                                s.synced_with_core = False
                                if s.node_id == core_node_id:
                                    s.confirmed_at_core = False
                                    surviving_remote = [
                                        x for x in local_stars
                                        if x.captured_local and not x.destroyed and not x.seceded
                                    ]
                                    if not surviving_remote:
                                        alive = False
                                        cause_of_death = "B4_Supernova"
                                        t_extinct = t_arr_node
                                        break
                                    # §3.2 handover: re-anchor command core to nearest surviving synced/detached node
                                    new_core = min(
                                        surviving_remote,
                                        key=lambda x: (0 if x.synced_with_core else 1, x.d_core),
                                    )
                                    core_node_id = new_core.node_id
                                    new_core.synced_with_core = True
                                    new_core.confirmed_at_core = True
                                    for st in stars:
                                        st.d_core = vec_dist(st.xyz, new_core.xyz)
                                        if (
                                            st.node_id != core_node_id
                                            and st.synced_with_core
                                            and st.d_core > max(0.20, r_sync * 0.90)
                                        ):
                                            st.synced_with_core = False
                                            st.confirmed_at_core = False
                                            resync_inflight_nodes.discard(st.node_id)
                                    stars_by_core = sorted(stars, key=lambda st: st.d_core)
                                    l1_detach_hold_until = max(l1_detach_hold_until, t + 90.0)
                                    n_worlds = 1
                                    crisis_count += 1
                                    e_fixed += 0.25 * lam_b4
                                else:
                                    crisis_count += 1
                                    pending_receipts.append(ReceiptEvent(
                                        event_id=f"b4loss_{burst.event_id}_{s.node_id}",
                                        node_id=s.node_id, kind="destroy",
                                        t_source=t_arr_node,
                                        t_arrive=t_arr_node + s.d_core,
                                        sdi_pulse=0.25 * lam_b4,
                                    ))
                            else:
                                # Survived flux dose adds +25 * Lambda_B4 to E_fixed (when reported to core)
                                if s.node_id == core_node_id:
                                    e_fixed += 0.25 * lam_b4
                                elif s.synced_with_core:
                                    pending_receipts.append(ReceiptEvent(
                                        event_id=f"b4dose_{burst.event_id}_{s.node_id}",
                                        node_id=s.node_id, kind="capture",  # keeps confirmed, carries dose
                                        t_source=t_arr_node,
                                        t_arrive=t_arr_node + s.d_core,
                                        sdi_pulse=0.10 * lam_b4,
                                    ))
                    if not alive:
                        break

            if alive:
                # Advance stochastic processes
                z_ou = z_ou * ou_decay + ou_std * world.ou_gauss[step_idx]
                j_jump *= jump_decay
                do_jump, jump_neg = world.jump_rolls[step_idx]
                if do_jump:
                    j_jump += -0.18 if jump_neg else 0.22

                # Integrate points & advance K using core-confirmed cap_conf (R2 + R7)
                d_evo = v_e * dt
                evo_points += d_evo
                evo_points_earned += d_evo

                tech_ramp = 0.18 + 0.82 * min(1.0, max(0.0, (k - K0) / (K_REF - K0)))
                wall = max(0.0, 1.0 - (k / cap_conf) ** 4)
                accel = (
                    tech_ramp
                    * (pi_exp ** 0.35)
                    * math.exp(0.30 * eta_stoch)
                    * (1.0 + 0.18 * math.log(max(1, n_worlds)) + 0.35 * math.log(max(1.0, n_eff_conf)))
                    * traits["I_sci"]
                    * (traits["D_self"] ** 0.35)
                )
                dk = R_K * accel * wall * chaos_damp * dt
                k = min(cap_conf, k + dk)

    return {
        "alive": alive,
        "alive_8h": alive_8h,
        "alive_24h": alive_24h,
        "alive_3d5": alive_3d5,
        "downtime_8h": round(downtime_8h, 1),
        "downtime_24h": round(downtime_24h, 1),
        "downtime_3d5": round(downtime_3d5, 1),
        "cause": cause_of_death,
        "lifespan": horizon if alive else (t_extinct or 0.0),
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
        "first_weak_channel": first_weak_channel,
        "first_lock_channel": first_lock_channel,
        "t_nu_weak": t_first_nu_weak,
        "t_gw_weak": t_first_gw_weak,
        "t_gw_lock": t_first_gw_lock,
        "callback_hit": callback_first_t is not None,
        "callback_coeval": callback_coeval,
        "final_stars_captured": sum(1 for s in stars if s.captured_local and not s.destroyed and not s.seceded),
        "final_stars_synced": sum(1 for s in stars if s.synced_with_core and not s.destroyed and not s.seceded),
        "final_stars_confirmed": sum(1 for s in stars if s.confirmed_at_core),
        "final_stars_seceded": sum(1 for s in stars if s.seceded),
        "trace_alive": trace_alive,
        "trace_locked": trace_locked,
        "trace_k": trace_k,
        "trace_sdi": trace_sdi,
        "trace_v_e": trace_v_e,
        "trace_e_cum": trace_e_cum,
    }


def verify_acceptance_cases() -> None:
    """Deterministic unit/acceptance checks for R1-R10, directed expeditions & multi-messenger bubbles."""
    # R1: Tier 1 cold start -> world_up -> persist -> 4.22 / 5.5 / 8.5 ly directed 0.10c expedition -> Tier 2
    for d_second in (4.22, 5.5, 8.5):
        world = build_world_seed(101, int(SIM_YEARS / DT))
        world.cataclysms = CataclysmSchedule([], [], [], [])
        world.star_catalog = [
            StarNode(0, 0.0, 1.0, (0.0, 0.0, 0.0), False, True, True, False, True, False),
            StarNode(1, d_second, 1.0, (d_second, 0.0, 0.0), False, False, False, False, False, False),
        ]
        res = run_single_world("balanced", world, defense_regime="l1_armed", use_hosted_plan=True)
        assert res["alive"] and res["t_multistar"] is not None and res["k_end"] > 1.10, (
            f"R1 failed for neighbor at {d_second} ly: {res['t_multistar']}, k_end={res['k_end']}"
        )
        # Directed 0.10c physics: confirmation cannot precede min travel + receipt time (d/0.10c + d/c = 11*d)
        assert res["t_multistar"] >= 11.0 * d_second - 1e-6, (
            f"R1 directed expedition violated 0.10c+1.00c causality: t_multistar={res['t_multistar']}"
        )

    # R2: 10 ly remote damage causal isolation (identical core telemetry before t = 10 sim yr, diverges after)
    def run_pair(damage_at_0: bool, horizon_yr: float) -> Tuple[float, float, bool, int]:
        w = build_world_seed(202, 40)
        w.cataclysms = CataclysmSchedule([], [], [], [])
        w.star_catalog = [
            StarNode(0, 0.0, 1.0, (0.0, 0.0, 0.0), False, True, True, False, True, False),
            StarNode(1, 10.0, 1.0, (10.0, 0.0, 0.0), False, True, True, False, True, False),
        ]
        if damage_at_0:
            w.cataclysms.b4_events = [
                B4BurstEvent("test_b4", (10.0, 0.0, 0.0), -0.5, 12.0, False, (1.0, 0.0, 0.0), 1.0, 1.0, 1.0)
            ]
        r = run_single_world(
            "balanced", w, defense_regime="no_deflect", dt=1.0, horizon=horizon_yr,
            initial_tier=2, initial_n_worlds=4, initial_lv_persist=2,
        )
        return round(r["k_end"], 12), round(r["e_earned"], 12), r["alive"], r["final_stars_confirmed"]

    assert run_pair(False, 5.0) == run_pair(True, 5.0) == (*run_pair(False, 5.0)[:3], 2), (
        "R2 failed: core telemetry diverged before 10 ly report arrival"
    )
    assert run_pair(False, 12.0)[3] == 2 and run_pair(True, 12.0)[3] == 1, (
        "R2 failed: remote B4 destruction should propagate to core after 10 ly"
    )

    # Realistic Star Bubble & Multi-Messenger Checks:
    # (a) Physical baseline B_perp uses real star separation, not empty vacuum radius
    _, g_single, _ = survey_and_focus_gain(3, 0.0, 1, 1.2)
    _, g_wide, _ = survey_and_focus_gain(3, 10.0, 2, 1.2)
    assert g_wide > g_single, "Realistic baseline failed: real 10 ly star span should increase focus gain"

    # (b) Multi-star B1b destroys an outer star instead of shrinking vacuum radius by 0.72x
    w_b1b = build_world_seed(606, 120)
    w_b1b.cataclysms = CataclysmSchedule([B1Event("b1b_outer", "B1b", 20.0, 50.0)], [], [], [])
    w_b1b.star_catalog = [
        StarNode(0, 0.0, 1.0, (0.0, 0.0, 0.0), False, True, True, False, True, False),
        StarNode(1, 4.0, 1.0, (4.0, 0.0, 0.0), False, True, True, False, True, False),
    ]
    r_b1b = run_single_world(
        "system_hermit", w_b1b, defense_regime="no_deflect", dt=5.0, horizon=80.0,
        initial_tier=2, initial_n_worlds=4,
    )
    assert r_b1b["alive"] and r_b1b["final_stars_captured"] == 1, (
        "Realistic B1b failed: should destroy 1 outer node and leave cradle intact"
    )

    # (c) L1 detach suspends outer star sync (autonomous standby) without deletion; unguarded SDI >= 100% secedes permanently
    w_det = build_world_seed(707, 400)
    w_det.cataclysms = CataclysmSchedule([], [], [], [])
    w_det.star_catalog = [
        StarNode(0, 0.0, 1.0, (0.0, 0.0, 0.0), False, True, True, False, True, False),
        StarNode(1, 9.5, 1.0, (9.5, 0.0, 0.0), False, True, True, False, True, False),
    ]
    r_det = run_single_world(
        "system_hermit", w_det, defense_regime="l1_armed", dt=2.0, horizon=80.0,
        initial_tier=2, initial_n_worlds=4, initial_lv_persist=2,
    )
    assert r_det["alive"] and r_det["final_stars_captured"] == 2 and r_det["final_stars_synced"] == 1 and r_det["final_stars_seceded"] == 0, (
        f"Detachment failed: captured={r_det['final_stars_captured']}, synced={r_det['final_stars_synced']}, seceded={r_det['final_stars_seceded']}"
    )
    r_sec = run_single_world(
        "system_hermit", w_det, defense_regime="no_deflect", dt=2.0, horizon=40.0,
        initial_tier=2, initial_n_worlds=4, initial_lv_persist=0,
    )
    assert r_sec["final_stars_seceded"] == 1 and r_sec["final_stars_captured"] == 1, (
        f"Secession failed: captured={r_sec['final_stars_captured']}, seceded={r_sec['final_stars_seceded']}"
    )

    # (d) EM dissipation cutoff R_diss & EMCON hollow wave shell propagation
    g4_surv, g4_foc, p4 = survey_and_focus_gain(4, 10.0, 3, 1.6)
    n4 = local_noise_factor(4, 1.6)
    ev_em_near = NeighborEmission(dist_ly=20.0, t_emit=0.0, t_end=100.0, tier=1, stealth_mult=1.0, beacon_flux=0.0)
    ev_em_diss = NeighborEmission(dist_ly=400.0, t_emit=0.0, t_end=100.0, tier=1, stealth_mult=1.0, beacon_flux=0.0)
    assert observe_emission_step(ev_em_near, g4_surv, g4_foc, p4, n4, 0.0, 0.0, 1.0, 3, 1.0, 0.0)[:2] == (True, True), (
        "EM near-field check failed"
    )
    assert observe_emission_step(ev_em_diss, g4_surv, g4_foc, p4, n4, 0.0, 0.0, 1.0, 3, 1.0, 0.0)[:2] == (False, False), (
        "EM dissipation cutoff failed: 400 ly Tier-1 wave must dissipate below F_DISS_EM"
    )
    # Hollow EMCON shell arrives in [50, 150] even after source turns silent at t=100; dark cavity follows in (150, 350]
    w_hol = build_world_seed(808, 60)
    w_hol.cataclysms = CataclysmSchedule([], [], [], [])
    ev_hol_shell = NeighborEmission(dist_ly=50.0, t_emit=0.0, t_end=100.0, tier=2, stealth_mult=1.0, beacon_flux=0.0, s_nu=0.0)
    ev_hol_cavity = NeighborEmission(dist_ly=50.0, t_emit=100.0, t_end=300.0, tier=2, stealth_mult=1e-4, beacon_flux=0.0, s_nu=0.0)
    w_hol.cosmos = [ev_hol_shell, ev_hol_cavity]
    r_hol_pre = run_single_world("obs_rusher", w_hol, defense_regime="l1_armed", dt=5.0, horizon=45.0)
    assert r_hol_pre["t_weak"] is None and r_hol_pre["t_lock"] is None, "EM shell cannot arrive before d/c = 50 yr"
    g2_check, f2_check, p2_check = survey_and_focus_gain(2, 0.01, 1, 1.0)
    n2_check = local_noise_factor(2, 1.0)
    # At t=120 yr (source has been cloaked for 20 yr), the trailing hollow shell [0,100]+50 still crosses 50 ly:
    assert (ev_hol_shell.t_emit + 50.0) <= 120.0 <= (ev_hol_shell.t_end + 50.0)
    assert observe_emission_step(ev_hol_shell, g2_check, f2_check, p2_check, n2_check, 0.0, 0.0, 1.0, 1, 1.0, 0.0)[:2] == (True, True)
    # Once t=160 > 150, observer is inside the expanding silent cavity (only ev_hol_cavity overlaps):
    assert (ev_hol_cavity.t_emit + 50.0) <= 160.0 <= (ev_hol_cavity.t_end + 50.0)
    assert observe_emission_step(ev_hol_cavity, g2_check, f2_check, p2_check, n2_check, 0.0, 0.0, 1.0, 1, 1.0, 0.0)[:2] == (False, False)

    # (e) Neutrino zero-extinction / stealth-piercing (blackbody_mimic EM hidden past ~19 ly, Obs Lv.3+ weak only)
    ev_nu_cloaked_50 = NeighborEmission(
        dist_ly=50.0, t_emit=0.0, t_end=1000.0, tier=2,
        stealth_mult=1e-4, beacon_flux=0.0, s_nu=S_NU_BY_TIER[2], h0_gw=0.0,
    )
    ev_nu_cloaked_80 = NeighborEmission(
        dist_ly=80.0, t_emit=0.0, t_end=1000.0, tier=2,
        stealth_mult=1e-4, beacon_flux=0.0, s_nu=S_NU_BY_TIER[2], h0_gw=0.0,
    )
    g2_surv, g2_foc, p2 = survey_and_focus_gain(2, 5.0, 2, 1.2)
    n2 = local_noise_factor(2, 1.2)
    g_nu2, g_gw2, tri2 = neutrino_and_gw_gains(2, 5.0, 2)
    g_nu3, g_gw3, tri3_2stars = neutrino_and_gw_gains(3, 5.0, 2)
    g_nu4, g_gw4, tri4_2stars = neutrino_and_gw_gains(4, 5.0, 2)
    assert observe_emission_step(ev_nu_cloaked_50, g2_surv, g2_foc, p2, n2, g_nu2, g_gw2, tri2, 2, 1.0, 0.0)[:2] == (False, False), (
        "Obs Lv.2 should not detect blackbody_mimic cloaked Tier 2 at 50 ly"
    )
    assert observe_emission_step(ev_nu_cloaked_50, g2_surv, g2_foc, p2, n2, g_nu3, g_gw3, tri3_2stars, 2, 1.0, 0.0) == (True, False, "nu", None), (
        "Obs Lv.3 neutrino channel must pierce stealth=1e-4 at 50 ly as weak coarse cone only"
    )
    assert observe_emission_step(ev_nu_cloaked_80, g4_surv, g4_foc, p4, n4, g_nu4, g_gw4, tri4_2stars, 2, 1.0, 0.0) == (True, False, "nu", None), (
        "Obs Lv.4 neutrino channel must pierce stealth=1e-4 at 80 ly as weak coarse cone only"
    )

    # (f) Gravitational waves: linear 1/r strain law & N_stars >= 3 multi-star triangulation lock
    ev_gw_3k = NeighborEmission(
        dist_ly=3000.0, t_emit=0.0, t_end=5000.0, tier=3,
        stealth_mult=1e-4, beacon_flux=0.0, s_nu=S_NU_BY_TIER[3], h0_gw=0.080,
    )
    g3_surv, g3_foc, p3 = survey_and_focus_gain(3, 8.0, 3, 1.5)
    n3 = local_noise_factor(3, 1.5)
    strain_1k = ev_gw_3k.h0_gw * (D0 / 1000.0)
    strain_2k = ev_gw_3k.h0_gw * (D0 / 2000.0)
    assert abs(strain_2k - 0.5 * strain_1k) < 1e-12, "GW strain amplitude must decay strictly as 1/r"
    g_nu3_1s, g_gw3_1s, tri3_1s = neutrino_and_gw_gains(3, 0.01, 1)
    g_nu3_2s, g_gw3_2s, tri3_2s = neutrino_and_gw_gains(3, 8.0, 2)
    g_nu3_3s, g_gw3_3s, tri3_3s = neutrino_and_gw_gains(3, 8.0, 3)
    assert observe_emission_step(ev_gw_3k, g3_surv, g3_foc, p3, n3, g_nu3_1s, g_gw3_1s, tri3_1s, 1, 1.0, 0.0) == (True, False, "gw", None), (
        "GW single-star detector should yield weak wide arc only"
    )
    assert observe_emission_step(ev_gw_3k, g3_surv, g3_foc, p3, n3, g_nu3_2s, g_gw3_2s, tri3_2s, 2, 1.0, 0.0) == (True, False, "gw", None), (
        "GW 2-star baseline should yield weak hyperbolic ring only"
    )
    assert observe_emission_step(ev_gw_3k, g3_surv, g3_foc, p3, n3, g_nu3_3s, g_gw3_3s, tri3_3s, 3, 1.0, 0.0) == (True, True, "gw", "gw"), (
        "GW >= 3 star triangulation at Obs Lv.3 should resolve precision lock"
    )

    # R3: Tech ready with no_deflect hits vs l1_armed deflects
    w3_obs_strike = build_world_seed(304, 400)
    w3_obs_strike.cataclysms = CataclysmSchedule([B1Event("b1_early", "B1b", 470.0, 500.0)], [], [], [])
    run_single_world("obs_rusher", w3_obs_strike, defense_regime="no_deflect", dt=5.0, horizon=600.0)
    assert not w3_obs_strike.cataclysms.b1_events[0].deflected, "R3 failed: no_deflect should not auto-deflect"

    # R4: B4 physics (inverse-square, beaming, zero-progenitor=0 bursts, shared event, destroyed node stays dead)
    b_iso = B4BurstEvent("b", (10.0, 0.0, 0.0), 0.0, 10.0, False, (1.0, 0.0, 0.0), 0.95, 3.2, 0.22)
    _, lam_near = b4_lambda_at_node(b_iso, (0.0, 0.0, 0.0))
    _, lam_far = b4_lambda_at_node(b_iso, (-10.0, 0.0, 0.0))
    assert lam_near > 1.9 * lam_far, "R4 inverse-square scaling failed"
    b_jet = B4BurstEvent("j", (10.0, 0.0, 0.0), 0.0, 10.0, True, (1.0, 0.0, 0.0), math.cos(math.radians(15.0)), 3.2, 0.22)
    _, lam_on_jet = b4_lambda_at_node(b_jet, (0.0, 0.0, 0.0))
    _, lam_off_jet = b4_lambda_at_node(b_jet, (10.0, 10.0, 0.0))
    assert lam_on_jet > 3.0 * lam_off_jet, "R4 jet anisotropy failed"
    # Shared burst + permanent node removal
    w4 = build_world_seed(404, 100)
    w4.cataclysms = CataclysmSchedule([], [], [], [
        B4BurstEvent("shared_b4", (5.0, 0.0, 0.0), 0.0, 18.0, False, (1.0, 0.0, 0.0), 1.0, 1.0, 1.0)
    ])
    w4.star_catalog = [
        StarNode(0, 0.0, 1.0, (0.0, 0.0, 0.0), False, True, True, False, True, False),
        StarNode(1, 3.0, 1.0, (3.0, 0.0, 0.0), False, True, True, False, True, False),
    ]
    r4 = run_single_world("balanced", w4, defense_regime="l1_armed", dt=1.0, horizon=20.0)
    assert not r4["alive"], "R4 failed: lethal close B4 should destroy unprotected nodes"

    # R5: Seed invariance (neighbor cosmos identical regardless of observer)
    c1 = generate_cosmos_unbiased(random.Random(555))
    c2 = generate_cosmos_unbiased(random.Random(555))
    assert c1 == c2, "R5 failed: cosmos generation not deterministic per world seed"

    # R8: Energy-integrated heat sink (Q_max = 180*0.994*P_anchor, constant 44.73 yr drain, variable power integral, non-decaying E_heat_overload)
    p_anchor = 1.0
    q_max = 180.0 * 0.994 * p_anchor
    q = 0.0
    for _ in range(180):
        q = min(q_max, q + 0.994 * p_anchor)
    assert abs(q - q_max) < 1e-9, "R8 180 yr fill integral failed"
    t_drain = q / ((5.0 - 1.0) * p_anchor)
    assert abs(t_drain - 44.73) < 1e-9, f"R8 44.73 yr drain failed: {t_drain}"
    # Variable power doubles drain speed when P_gen = 2.0 * P_anchor
    t_drain_2x = q / ((5.0 - 1.0) * (2.0 * p_anchor))
    assert abs(t_drain_2x - 22.365) < 1e-9, "R8 variable-power heat integral failed"
    e_heat = sum(1.5 for _ in range(70))
    assert e_heat >= 100.0, "R8 non-decaying heat overload must surpass 100%"

    # R9: FIFO waiting_points -> automatic resume when points cross threshold without intervention
    w9 = build_world_seed(303, 400)
    w9.cataclysms = CataclysmSchedule([], [], [], [])
    r9 = run_single_world("balanced", w9, defense_regime="l1_armed", dt=5.0, horizon=2000.0)
    assert r9["e_earned"] > 10.0 and r9["k_end"] > 1.1, "R9 queue auto-resume failed"
    print("ACCEPTANCE_CHECKS_PASSED: R1, R2, R3, R4, R5, R8, R9, Directed-Expedition, and Multi-Messenger (EM/nu/GW) verified.")


def summarize_results(res: List[Dict], n_runs: int) -> Dict:
    causes: Dict[str, int] = {}
    for r in res:
        causes[r["cause"]] = causes.get(r["cause"], 0) + 1

    def quantile_of(key: str, q: float) -> Optional[float]:
        vals = sorted(r[key] for r in res if r[key] is not None)
        if not vals:
            return None
        idx = min(len(vals) - 1, max(0, int(round(q * (len(vals) - 1)))))
        return round(vals[idx], 1)

    k340 = [r["k_340yr"] for r in res if r["k_340yr"] is not None]
    blind_dead = [r for r in res if (not r["alive"]) and r["t_lock"] is None]
    cb_hits = sum(1 for r in blind_dead if r["callback_hit"])
    cb_coeval = sum(1 for r in blind_dead if r["callback_coeval"])
    surv_runs = [r for r in res if r["alive"]]
    early_345_lock = sum(1 for r in res if r["t_lock"] is not None and r["t_lock"] <= 345.0)
    early_345_weak = sum(1 for r in res if r["t_weak"] is not None and r["t_weak"] <= 345.0)

    return {
        "survival_8h": round(sum(1 for r in res if r["alive_8h"]) / n_runs, 3),
        "survival_24h": round(sum(1 for r in res if r["alive_24h"]) / n_runs, 3),
        "survival_5000yr": round(len(surv_runs) / n_runs, 3),
        "mean_downtime_8h_yr": round(sum(r["downtime_8h"] for r in res) / n_runs, 1),
        "mean_downtime_24h_yr": round(sum(r["downtime_24h"] for r in res) / n_runs, 1),
        "mean_downtime_3d5_yr": round(sum(r["downtime_3d5"] for r in res) / n_runs, 1),
        "mean_lifespan": round(sum(r["lifespan"] for r in res) / n_runs, 1),
        "mean_k_end": round(sum(r["k_end"] for r in res) / n_runs, 3),
        "mean_k_survivors": round(sum(r["k_end"] for r in surv_runs) / max(1, len(surv_runs)), 3),
        "mean_e_earned_survivors": round(sum(r["e_earned"] for r in surv_runs) / max(1, len(surv_runs)), 1),
        "mean_k_340yr": round(sum(k340) / len(k340), 3) if k340 else None,
        "med_t_crit": quantile_of("t_crit", 0.50),
        "med_t_ref": quantile_of("t_ref", 0.50),
        "med_t_multiplanet": quantile_of("t_multiplanet", 0.50),
        "med_t_multistar": quantile_of("t_multistar", 0.50),
        "weak_detect_rate": round(sum(1 for r in res if r["t_weak"] is not None) / n_runs, 3),
        "lock_detect_rate": round(sum(1 for r in res if r["t_lock"] is not None) / n_runs, 3),
        "weak_nu_detect_rate": round(sum(1 for r in res if r["t_nu_weak"] is not None) / n_runs, 3),
        "weak_gw_detect_rate": round(sum(1 for r in res if r["t_gw_weak"] is not None) / n_runs, 3),
        "lock_gw_detect_rate": round(sum(1 for r in res if r["t_gw_lock"] is not None) / n_runs, 3),
        "early_345yr_weak_rate": round(early_345_weak / n_runs, 4),
        "early_345yr_lock_rate": round(early_345_lock / n_runs, 4),
        "p25_t_lock_yr": quantile_of("t_lock", 0.25),
        "median_t_lock_yr": quantile_of("t_lock", 0.50),
        "p75_t_lock_yr": quantile_of("t_lock", 0.75),
        "median_dist_lock_ly": quantile_of("dist_lock", 0.50),
        "dead_never_saw_rate": round(len(blind_dead) / n_runs, 3),
        "callback_among_blind_dead": round(cb_hits / max(1, len(blind_dead)), 3) if blind_dead else None,
        "callback_coeval_among_blind_dead": round(cb_coeval / max(1, len(blind_dead)), 3) if blind_dead else None,
        "mean_crises": round(sum(r["crises"] for r in res) / n_runs, 2),
        "causes": causes,
    }


def build_curves(res: List[Dict], n_runs: int, t_grid: List[int]) -> Dict:
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

    return {
        "t": t_grid,
        "surv_pct": surv_pct,
        "lock_pct": lock_pct,
        "mean_k": mean_k,
        "mean_sdi": mean_sdi,
        "mean_v_e": mean_v_e,
        "mean_e_cum": mean_e_cum,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify", action="store_true", help="Run R1-R10 deterministic acceptance checks")
    args = parser.parse_args()
    if args.verify:
        verify_acceptance_cases()
        return

    verify_acceptance_cases()
    human_fit = verify_human_productivity_fit()
    strategies = ["balanced", "system_hermit", "expander", "obs_rusher", "planet_hermit"]
    n_runs = 1000
    steps = int(round(SIM_YEARS / DT))
    sample_stride = max(1, int(round(50.0 / DT)))
    t_grid = [int(step * DT) for step in range(0, steps + 1, sample_stride)]

    # Pre-build paired world seeds per strategy so no_deflect / periodic_manual / l1_armed compare identically
    summary = {}
    regime_comparison = {}
    ensemble_curves = {}

    for s_idx, strat in enumerate(strategies):
        worlds = [build_world_seed(30000 * s_idx + i, steps) for i in range(n_runs)]

        res_no_l1 = [run_single_world(strat, w, defense_regime="no_deflect", use_hosted_plan=True) for w in worlds]
        res_manual_no_q = [run_single_world(strat, w, defense_regime="periodic_manual", use_hosted_plan=False, max_queue_slots=0) for w in worlds]
        res_manual_5q = [run_single_world(strat, w, defense_regime="periodic_manual", use_hosted_plan=False, max_queue_slots=5) for w in worlds]
        res_l1 = [run_single_world(strat, w, defense_regime="l1_armed", use_hosted_plan=True) for w in worlds]

        summary[strat] = summarize_results(res_no_l1, n_runs)
        ensemble_curves[strat] = build_curves(res_no_l1, n_runs, t_grid)

        s_manual_no_q = summarize_results(res_manual_no_q, n_runs)
        s_manual_5q = summarize_results(res_manual_5q, n_runs)
        s_l1 = summarize_results(res_l1, n_runs)
        regime_comparison[strat] = {
            "no_deflect": {
                "surv_8h": summary[strat]["survival_8h"],
                "surv_24h": summary[strat]["survival_24h"],
                "surv_5000yr": summary[strat]["survival_5000yr"],
                "downtime_8h_yr": summary[strat]["mean_downtime_8h_yr"],
                "downtime_24h_yr": summary[strat]["mean_downtime_24h_yr"],
                "downtime_3d5_yr": summary[strat]["mean_downtime_3d5_yr"],
            },
            "periodic_manual_no_queue": {
                "surv_8h": s_manual_no_q["survival_8h"],
                "surv_24h": s_manual_no_q["survival_24h"],
                "surv_5000yr": s_manual_no_q["survival_5000yr"],
                "downtime_8h_yr": s_manual_no_q["mean_downtime_8h_yr"],
                "downtime_24h_yr": s_manual_no_q["mean_downtime_24h_yr"],
                "downtime_3d5_yr": s_manual_no_q["mean_downtime_3d5_yr"],
            },
            "periodic_manual_5slot_queue": {
                "surv_8h": s_manual_5q["survival_8h"],
                "surv_24h": s_manual_5q["survival_24h"],
                "surv_5000yr": s_manual_5q["survival_5000yr"],
                "downtime_8h_yr": s_manual_5q["mean_downtime_8h_yr"],
                "downtime_24h_yr": s_manual_5q["mean_downtime_24h_yr"],
                "downtime_3d5_yr": s_manual_5q["mean_downtime_3d5_yr"],
            },
            "l1_armed_with_plan": {
                "surv_8h": s_l1["survival_8h"],
                "surv_24h": s_l1["survival_24h"],
                "surv_5000yr": s_l1["survival_5000yr"],
                "downtime_8h_yr": s_l1["mean_downtime_8h_yr"],
                "downtime_24h_yr": s_l1["mean_downtime_24h_yr"],
                "downtime_3d5_yr": s_l1["mean_downtime_3d5_yr"],
                "causes": s_l1["causes"],
            },
        }

    out_path = OUT_DIR / "sim_results.json"
    out_path.write_text(
        json.dumps(
            {
                "human_curve_fit": human_fit,
                "summary": summary,
                "regime_comparison": regime_comparison,
                "ensemble_curves": ensemble_curves,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(json.dumps({
        "human_curve_fit": human_fit,
        "summary": summary,
        "regime_comparison": regime_comparison,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
