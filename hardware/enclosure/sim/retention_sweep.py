import numpy as np
exec(open(__file__.replace("retention_sweep.py", "retention_mc.py")).read().split("N_WORLDS, N_WEARERS")[0])
rng2 = np.random.default_rng(7)
# 1) preload sweep for the wrap hook, with and without pads
pre = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0, 1.2]
out = {(pads, f): [] for pads in (False, True) for f in pre}
worlds = [world() for _ in range(200)]
for w in worlds:
    p = wearers(3000, w)
    for pads in (False, True):
        for f in pre:
            out[(pads, f)].append(evaluate(("wrap", 3, f, pads, False), w, p)["success"])
print("wrap S/M/L hook: median success by preload")
print("preload N  " + "  ".join(f"{f:>5}" for f in pre))
for pads in (False, True):
    print(("with pads  " if pads else "no pads    ") + "  ".join(f"{np.median(out[(pads,f)]):5.0%}" for f in pre))
# 2) which uncertain constants drive success of the winner (D) and its gap to F and E
keys = [k for k in worlds[0]]
D = np.array(out[(False, 0.5)])
F = np.array(out[(True, 0.5)]); E = np.array(out[(False, 1.0)])
X = {k: np.array([w[k] for w in worlds]) for k in keys}
def top(y, label):
    c = sorted(((abs(np.corrcoef(X[k], y)[0,1]), np.corrcoef(X[k], y)[0,1], k) for k in keys if np.std(X[k])>0), reverse=True)[:5]
    print(f"\n{label}: most influential assumptions (correlation)")
    for a, r, k in c: print(f"   {k:24} {r:+.2f}")
top(D, "Success of D (wrap + light preload)")
top(D - F, "Advantage of D over F (adding silicone pads)")
top(D - E, "Advantage of D over E (medium preload)")
