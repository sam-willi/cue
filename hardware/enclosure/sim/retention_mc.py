"""
Monte Carlo comparison of retention options for the Cue test mule (behind the right ear, flat on the mastoid).

Two layers:
  outer: "worlds" - each draws the uncertain physics/tolerance constants (we don't know them precisely)
  inner: "wearers" - each draws a person (ear fit, hair, glasses, skin friction, pain tolerance, activity)

For every option and wearer we check four things over a mixed day of activity:
  stays_on     - inertial load from head motion never exceeds what the retention can hold
  good_contact - bone-sensor contact force is in a usable band AND doesn't swing too much with motion
  comfortable  - sustained pressure on the mastoid and on the ear root stays tolerable for ~4 h
  glasses_ok   - the hook path coexists with glasses (only matters for glasses wearers)
"Success" = all four. All numbers are engineering estimates, stated inline.
"""
import numpy as np

rng = np.random.default_rng(42)
G = 9.81

OPTIONS = {
    # name: (hook_type, sizes, preload_N_design, silicone_pads, adhesive)
    "A simple hook, 1 size":              ("simple", 1, 0.0, False, False),
    "B simple hook + preload":            ("simple", 1, 0.6, False, False),
    "C wrap hook S/M/L":                  ("wrap",   3, 0.0, False, False),
    "D wrap S/M/L + light preload":       ("wrap",   3, 0.5, False, False),
    "E wrap S/M/L + medium preload":      ("wrap",   3, 1.0, False, False),
    "F wrap + light preload + pads":      ("wrap",   3, 0.5, True,  False),
    "G wrap + medium preload + pads":     ("wrap",   3, 1.0, True,  False),
    "H simple hook + adhesive pad":       ("simple", 1, 0.0, False, True),
}

def world():
    """Uncertain constants, drawn once per world (ranges are deliberately wide)."""
    return dict(
        mass=rng.uniform(0.010, 0.016),              # kg, device with battery
        mu_plastic=rng.uniform(0.25, 0.55),           # skin vs printed plastic
        mu_silicone=rng.uniform(0.6, 1.1),            # skin vs silicone pad
        hair_mu_factor=rng.uniform(0.4, 0.8),         # friction multiplier on hair
        hair_coupling=rng.uniform(0.5, 0.85),         # bone-signal multiplier on hair
        simple_lateral=rng.uniform(0.02, 0.12),       # N lateral restraint of a simple top hook
        wrap_lateral=rng.uniform(0.15, 0.45),         # N lateral restraint of a wrap hook (good fit)
        hook_k=rng.uniform(0.04, 0.10),               # N/mm, how preload changes with fit error
        fit_sd_1size=rng.uniform(2.5, 4.0),           # mm ear-root mismatch, one size
        fit_sd_3size=rng.uniform(0.8, 1.6),           # mm mismatch with S/M/L
        slip_mm=rng.uniform(3.5, 5.0),                # mismatch beyond which a hook rides off
        contact_min=rng.uniform(0.2, 0.4),            # N minimum steady force for bone sensing
        contact_max=rng.uniform(1.5, 2.5),            # N above this it hurts / clamps
        fluct_max=rng.uniform(0.35, 0.6),             # max allowed (motion swing / steady force)
        mastoid_kpa_tol=rng.uniform(2.5, 4.5),        # kPa sustained over ~4 h (median person)
        root_kpa_tol=rng.uniform(8.0, 16.0),          # kPa sustained on ear-root cartilage
        hook_contact_cm2=rng.uniform(0.5, 0.9),       # area the hook bears on the ear root
        body_cm2=rng.uniform(3.5, 5.5),               # head-side contact area without pads
        pad_cm2=rng.uniform(2.0, 3.5),                # with silicone edge pads (smaller, grippier)
        adhesive_hold=rng.uniform(2.0, 6.0),          # N lateral hold of an adhesive pad on bare skin
        adhesive_irritation=rng.uniform(0.05, 0.20),  # chance of discomfort from adhesive over a day
        glasses_conflict_simple=rng.uniform(0.05, 0.20),
        glasses_conflict_wrap=rng.uniform(0.05, 0.25),
    )

def wearers(n, w):
    return dict(
        hair=rng.random(n) < 0.4,                        # contact on hair rather than bare skin
        glasses=rng.random(n) < 0.5,
        fit_z=rng.standard_normal(n),                    # ear-root size vs hook size (scaled per option)
        mu_jitter=rng.lognormal(0, 0.2, n),              # skin dryness, sweat
        tol=rng.lognormal(0, 0.3, n),                    # personal pressure tolerance multiplier
        # peak head acceleration in the hardest activity of their day (fraction of wearers who jog etc.)
        peak_g=np.select([rng.random(n) < 0.15, rng.random(n) < 0.6], [rng.lognormal(np.log(2.2), 0.25, n),
                         rng.lognormal(np.log(1.0), 0.25, n)], rng.lognormal(np.log(0.6), 0.25, n)),
        rms_g=rng.lognormal(np.log(0.25), 0.3, n),      # typical motion while talking/walking
    )

def evaluate(opt, w, p):
    hook, sizes, preload, pads, adhesive = opt
    n = len(p["hair"])
    fit_sd = w["fit_sd_1size"] if sizes == 1 else w["fit_sd_3size"]
    mismatch = p["fit_z"] * fit_sd                         # + = hook too big (loose), - = too tight
    rides_off = mismatch > w["slip_mm"]
    # preload changes with fit: tight ear raises it, loose ear lowers it
    F_pre = np.clip(preload - w["hook_k"] * mismatch, 0, None) if preload > 0 else np.zeros(n)
    # gravity adds a little normal force because the mastoid surface tilts (~15 deg)
    F_normal = F_pre + w["mass"] * G * np.sin(np.radians(15))
    mu = (w["mu_silicone"] if pads else w["mu_plastic"]) * p["mu_jitter"]
    mu = np.where(p["hair"], mu * w["hair_mu_factor"], mu)
    restraint = w["wrap_lateral"] if hook == "wrap" else w["simple_lateral"]
    restraint = restraint * np.clip(1 - np.abs(mismatch) / (2 * w["slip_mm"]), 0, 1)
    hold = mu * F_normal + restraint
    if adhesive:
        hold = hold + np.where(p["hair"], 0.15 * w["adhesive_hold"], w["adhesive_hold"])
        F_normal = F_normal + np.where(p["hair"], 0.1, 0.6)   # adhesive keeps it pressed
    load = w["mass"] * G * p["peak_g"]
    stays_on = (hold >= load) & ~rides_off

    coupling = np.where(p["hair"], w["hair_coupling"], 1.0)
    F_eff = F_normal * coupling
    swing = w["mass"] * G * p["rms_g"]
    good_contact = (F_eff >= w["contact_min"]) & (F_normal <= w["contact_max"]) & (swing / np.maximum(F_eff, 1e-6) <= w["fluct_max"])

    area = (w["pad_cm2"] if pads else w["body_cm2"]) * 1e-4
    mastoid_kpa = F_normal / area / 1000
    root_kpa = (F_pre + w["mass"] * G) / (w["hook_contact_cm2"] * 1e-4) / 1000
    if hook == "wrap":
        root_kpa = root_kpa * 0.6                          # wrap spreads load along more of the ear root
    comfortable = (mastoid_kpa <= w["mastoid_kpa_tol"] * p["tol"]) & (root_kpa <= w["root_kpa_tol"] * p["tol"])
    if adhesive:
        comfortable &= rng.random(n) > w["adhesive_irritation"]

    conflict = w["glasses_conflict_wrap"] if hook == "wrap" else w["glasses_conflict_simple"]
    glasses_ok = ~p["glasses"] | (rng.random(n) > conflict)

    ok = stays_on & good_contact & comfortable & glasses_ok
    return dict(stays_on=stays_on.mean(), good_contact=good_contact.mean(), comfortable=comfortable.mean(),
                glasses_ok=glasses_ok[p["glasses"]].mean() if p["glasses"].any() else 1.0, success=ok.mean())

N_WORLDS, N_WEARERS = 300, 4000
names = list(OPTIONS)
res = {k: {m: [] for m in ("stays_on", "good_contact", "comfortable", "glasses_ok", "success")} for k in names}
wins = {k: 0 for k in names}
for _ in range(N_WORLDS):
    w = world()
    p = wearers(N_WEARERS, w)
    succ = {}
    for k in names:
        r = evaluate(OPTIONS[k], w, p)
        for m, v in r.items():
            res[k][m].append(v)
        succ[k] = r["success"]
    wins[max(succ, key=succ.get)] += 1

print(f"{N_WORLDS} worlds x {N_WEARERS} wearers per option\n")
print(f"{'option':34} {'success':>16} {'stays on':>9} {'contact':>8} {'comfort':>8} {'glasses':>8} {'wins':>6}")
for k in sorted(names, key=lambda k: -np.median(res[k]['success'])):
    s = np.array(res[k]["success"])
    print(f"{k:34} {np.median(s):6.0%} ({np.percentile(s,10):3.0%}-{np.percentile(s,90):3.0%})"
          f" {np.median(res[k]['stays_on']):8.0%} {np.median(res[k]['good_contact']):8.0%}"
          f" {np.median(res[k]['comfortable']):8.0%} {np.median(res[k]['glasses_ok']):8.0%} {wins[k]/N_WORLDS:6.0%}")
