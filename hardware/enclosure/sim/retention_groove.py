"""
Retention Monte Carlo for the slim hearing-aid-style Cue body (sits in the groove at the top-back of the ear,
nothing in the ear canal). Same two-layer method as retention_mc.py: 300 worlds x 4000 wearers.
All constants are engineering estimates; use the result to rank options, not to predict real numbers.
"""
import numpy as np
rng = np.random.default_rng(11)
G = 9.81

# name: (wire path, concha lock, designed squeeze N)
OPTIONS = {
    "A thin wire over the ear only":            ("over", False, 0.0),
    "B wire + concha lock":                      ("over", True, 0.0),
    "C wrap wire, light squeeze":                ("wrap", False, 0.3),
    "D wrap wire, light squeeze + concha lock":  ("wrap", True, 0.3),
    "E wrap wire, firmer squeeze":               ("wrap", False, 0.6),
    "F wrap wire, firmer squeeze + concha lock": ("wrap", True, 0.6),
}

def world():
    return dict(
        mass=rng.uniform(0.004, 0.0065),              # kg, slim body with a small cell
        mu=rng.uniform(0.25, 0.55), hair_mu=rng.uniform(0.4, 0.8), hair_coupling=rng.uniform(0.5, 0.85),
        pinna_press=rng.uniform(0.05, 0.25),           # N the ear itself presses the body onto the head (median)
        pinna_block=rng.uniform(0.10, 0.35),           # N lateral restraint from sitting in the groove
        over_lateral=rng.uniform(0.02, 0.10),          # N a simple over-the-ear wire adds
        wrap_lateral=rng.uniform(0.12, 0.35),          # N a wrap wire adds (good fit)
        lock_hold=rng.uniform(0.25, 0.7),              # N a concha lock adds (anchors in the ear bowl)
        lock_fit=rng.uniform(0.75, 0.95),              # share of ears a stock concha lock seats well in
        lock_irritation=rng.uniform(0.04, 0.15),       # chance the lock bothers the wearer over hours
        hook_k=rng.uniform(0.03, 0.08), fit_sd=rng.uniform(0.8, 1.6), slip_mm=rng.uniform(3.5, 5.0),
        contact_min=rng.uniform(0.12, 0.30),           # N steady force the bone sensor needs (lighter body, smaller face)
        contact_max=rng.uniform(1.0, 1.8), fluct_max=rng.uniform(0.35, 0.6),
        skull_kpa_tol=rng.uniform(2.5, 4.5), root_kpa_tol=rng.uniform(8.0, 16.0),
        face_cm2=rng.uniform(1.4, 2.2),                # flat head-side face of the slim body
        wire_contact_cm2=rng.uniform(0.3, 0.6),        # thin wire bears on less ear-root area than a fat hook
        glasses_conflict=rng.uniform(0.05, 0.20),      # body + wire share the groove with glasses arms
    )

def wearers(n):
    return dict(hair=rng.random(n) < 0.3, glasses=rng.random(n) < 0.5, fit_z=rng.standard_normal(n),
                mu_j=rng.lognormal(0, 0.2, n), tol=rng.lognormal(0, 0.3, n), ear=rng.lognormal(0, 0.35, n),
                peak_g=np.select([rng.random(n) < 0.15, rng.random(n) < 0.6],
                                 [rng.lognormal(np.log(2.2), 0.25, n), rng.lognormal(np.log(1.0), 0.25, n)],
                                 rng.lognormal(np.log(0.6), 0.25, n)),
                rms_g=rng.lognormal(np.log(0.25), 0.3, n), lock_u=rng.random(n), irr_u=rng.random(n), gl_u=rng.random(n))

def evaluate(opt, w, p):
    path, lock, squeeze = opt
    n = len(p["hair"])
    mismatch = p["fit_z"] * w["fit_sd"]
    rides_off = mismatch > w["slip_mm"]
    F_pre = np.clip(squeeze - w["hook_k"] * mismatch, 0, None) if squeeze > 0 else np.zeros(n)
    F_n = F_pre + w["pinna_press"] * p["ear"]
    mu = w["mu"] * p["mu_j"] * np.where(p["hair"], w["hair_mu"], 1.0)
    restraint = w["pinna_block"] * p["ear"] + (w["wrap_lateral"] if path == "wrap" else w["over_lateral"]) \
        * np.clip(1 - np.abs(mismatch) / (2 * w["slip_mm"]), 0, 1)
    lock_ok = lock & (p["lock_u"] < w["lock_fit"])
    restraint = restraint + np.where(lock_ok, w["lock_hold"], 0.0)
    stays = (mu * F_n + restraint >= w["mass"] * G * p["peak_g"]) & ~(rides_off & ~lock_ok)
    F_eff = F_n * np.where(p["hair"], w["hair_coupling"], 1.0)
    contact = (F_eff >= w["contact_min"]) & (F_n <= w["contact_max"]) & \
              (w["mass"] * G * p["rms_g"] / np.maximum(F_eff, 1e-6) <= w["fluct_max"])
    skull_kpa = F_n / (w["face_cm2"] * 1e-4) / 1000
    root_kpa = (F_pre + w["mass"] * G) / (w["wire_contact_cm2"] * 1e-4) / 1000 * (0.6 if path == "wrap" else 1.0)
    comfy = (skull_kpa <= w["skull_kpa_tol"] * p["tol"]) & (root_kpa <= w["root_kpa_tol"] * p["tol"])
    if lock:
        comfy &= p["irr_u"] > w["lock_irritation"]
    glasses = ~p["glasses"] | (p["gl_u"] > w["glasses_conflict"])
    ok = stays & contact & comfy & glasses
    return dict(stays=stays.mean(), contact=contact.mean(), comfy=comfy.mean(), glasses=glasses[p["glasses"]].mean(), ok=ok.mean())

names = list(OPTIONS); res = {k: {m: [] for m in ("stays", "contact", "comfy", "glasses", "ok")} for k in names}; wins = dict.fromkeys(names, 0)
for _ in range(300):
    w = world(); p = wearers(4000); s = {}
    for k in names:
        r = evaluate(OPTIONS[k], w, p)
        for m, v in r.items(): res[k][m].append(v)
        s[k] = r["ok"]
    wins[max(s, key=s.get)] += 1
print(f"{'option':44} {'success':>16} {'stays on':>9} {'contact':>8} {'comfort':>8} {'glasses':>8} {'wins':>6}")
for k in sorted(names, key=lambda k: -np.median(res[k]['ok'])):
    o = np.array(res[k]["ok"])
    print(f"{k:44} {np.median(o):6.0%} ({np.percentile(o,10):3.0%}-{np.percentile(o,90):3.0%}) {np.median(res[k]['stays']):8.0%}"
          f" {np.median(res[k]['contact']):8.0%} {np.median(res[k]['comfy']):8.0%} {np.median(res[k]['glasses']):8.0%} {wins[k]/300:6.0%}")
# squeeze sweep for the wrap wire, with and without the lock
print("\nwrap wire: median success by squeeze")
sq = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8]
out = {(l, f): [] for l in (False, True) for f in sq}
for _ in range(200):
    w = world(); p = wearers(3000)
    for l in (False, True):
        for f in sq: out[(l, f)].append(evaluate(("wrap", l, f), w, p)["ok"])
print("squeeze N   " + "  ".join(f"{f:>5}" for f in sq))
for l in (False, True):
    print(("with lock   " if l else "no lock     ") + "  ".join(f"{np.median(out[(l,f)]):5.0%}" for f in sq))
