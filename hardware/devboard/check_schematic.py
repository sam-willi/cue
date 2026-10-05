"""Check that the schematic's exported netlist matches devboard_circuit.py pad for pad.

    kicad-cli sch export netlist --format kicadsexpr -o sch.net cue_devboard.kicad_sch
    python3 check_schematic.py sch.net
"""
import re
import sys

import devboard_circuit as C


def parse(path):
    text = open(path).read()
    nets = {}
    for m in re.finditer(r'\(net \(code "?\d+"?\) \(name "([^"]*)"\)(.*?)\)\s*(?=\(net |\)\s*\)\s*$)', text, re.S):
        name = m.group(1).lstrip("/")
        nodes = set(re.findall(r'\(node \(ref "([^"]+)"\) \(pin "([^"]+)"\)', m.group(2)))
        nets[name] = nodes
    comps = set(re.findall(r'\(comp \(ref "([^"]+)"\)', text))
    return nets, comps


def main(path):
    nets, comps = parse(path)
    want = {n: set(v) for n, v in C.nets().items()}
    problems = []
    missing = set(C.PARTS) - comps
    extra = comps - set(C.PARTS)
    if missing:
        problems.append(f"parts missing from schematic: {sorted(missing)}")
    if extra:
        problems.append(f"extra parts in schematic: {sorted(extra)}")
    got = {n: v for n, v in nets.items() if not n.startswith("unconnected-") and not n.startswith("Net-(")}
    stray = {n: v for n, v in nets.items() if n.startswith("Net-(") or n.startswith("unconnected-")}
    for n, v in stray.items():
        bad = [(r, pad) for r, pad in v if not (n.startswith("unconnected-") and r in C.PARTS
                                               and pad in C.PARTS[r]["nc"])]
        if bad:
            problems.append(f"unlabelled/unconnected net {n}: {sorted(v)}")
    for n in sorted(set(want) | set(got)):
        if want.get(n, set()) != got.get(n, set()):
            problems.append(f"net {n}: circuit {sorted(want.get(n, set()))} vs schematic {sorted(got.get(n, set()))}")
    print(f"schematic: {len(comps)} parts, {len(got)} nets | circuit: {len(C.PARTS)} parts, {len(want)} nets")
    print("PROBLEMS:", len(problems))
    for p in problems:
        print("  !!", p)
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "sch.net"))
