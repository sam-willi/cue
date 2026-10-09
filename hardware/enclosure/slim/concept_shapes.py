"""
Cue behind-the-ear body: organic concept forms, sculpted procedurally and rendered in Blender.

    Blender --background --python cue_concepts.py -- <variant> <out.png> [view]

The body is a smooth sweep: a curved spine (side view), with a soft cross-section that is fuller on the
outside and flatter against the head, tapering into rounded ends. Units are millimetres.
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
VARIANT, OUT = argv[0], argv[1]
VIEW = argv[2] if len(argv) > 2 else "hero"

VARIANTS = {
    # length along spine, arc angle (deg), profiles as (t, value) control points; t=0 hook end, t=1 USB end
    "crescent": dict(length=40, arc=62, s_bend=0.10, sq=2.25, flat=0.52,
                     breadth=[(0, 7.0), (0.25, 10.5), (0.6, 12.5), (0.85, 12.0), (1, 10.5)],
                     thick=[(0, 6.0), (0.3, 8.6), (0.65, 9.6), (1, 8.8)], cap0=0.20, cap1=0.10),
    "pebble": dict(length=38, arc=40, s_bend=0.05, sq=2.05, flat=0.45,
                   breadth=[(0, 8.5), (0.3, 12.0), (0.6, 13.5), (0.85, 12.8), (1, 11.0)],
                   thick=[(0, 6.5), (0.35, 9.0), (0.65, 9.8), (1, 8.6)], cap0=0.24, cap1=0.14),
    "leaf": dict(length=42, arc=74, s_bend=0.16, sq=1.85, flat=0.50,
                 breadth=[(0, 5.5), (0.22, 9.0), (0.55, 12.0), (0.82, 11.5), (1, 9.5)],
                 thick=[(0, 5.0), (0.3, 7.8), (0.62, 9.2), (1, 8.2)], cap0=0.24, cap1=0.10),
    # hearing-aid style: slim between two broad sides, head side truly flat, top flows into the hook
    "aid": dict(length=40, arc=58, s_bend=0.12, sq=2.6, flat=0.42, aid=True,
                breadth=[(0, 4.6), (0.12, 7.2), (0.35, 11.2), (0.62, 13.2), (0.85, 12.6), (1, 11.0)],
                thick=[(0, 4.6), (0.15, 6.4), (0.4, 8.2), (0.7, 8.8), (1, 8.2)], cap0=0.0, cap1=0.13),
    # receiver-in-canal style, after the reference photo: compact, rides over the top of the ear, thin wire
    "ric": dict(length=33, arc=0, s_bend=0, sq=3.0, flat=0.80, aid=True, ric=True, top_bend=100, bend_pow=2.3,
                breadth=[(0, 3.0), (0.30, 7.4), (0.62, 9.0), (0.86, 8.8), (1, 7.6)],
                thick=[(0, 3.0), (0.36, 6.9), (0.72, 7.4), (1, 6.8)], cap0=0.0, cap1=0.16),
}
P = VARIANTS[VARIANT]
AID = P.get("aid", False)
RIC = P.get("ric", False)
_SP = []
if RIC:
    # spine by integration: straight down behind the ear at the bottom, bending forward over the ear at the top
    n = 400
    pos = Vector((0.0, 0.0, 0.0))
    pts = [pos.copy()]
    for i in range(n):
        t = 1 - (i + 0.5) / n                       # from the bottom (t=1) up to the top (t=0)
        th = math.radians(P["top_bend"]) * (1 - t) ** P["bend_pow"]
        pos = pos + Vector((math.sin(th), 0.0, math.cos(th))) * (P["length"] / n)
        pts.append(pos.copy())
    _SP = pts[::-1]                                  # index 0 = top
    mid = _SP[len(_SP) // 2].copy()
    _SP = [q - mid for q in _SP]


def smoothstep(u):
    return u * u * (3 - 2 * u)


def interp(points, t):
    for (t0, v0), (t1, v1) in zip(points, points[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * smoothstep((t - t0) / (t1 - t0))
    return points[-1][1]


def spine(t):
    """Point on the spine in the XZ plane: hook end at the top, body curving forward (+X) as it goes down."""
    if RIC:
        f = max(0.0, min(1.0, t)) * (len(_SP) - 1)
        i = min(int(f), len(_SP) - 2)
        return _SP[i].lerp(_SP[i + 1], f - i)
    ang = math.radians(P["arc"])
    R = P["length"] / ang
    a = ang * (t - 0.5)
    bend = P["s_bend"] * P["length"] * math.sin(math.pi * t) * (t - 0.5)
    return Vector((R * (1 - math.cos(a)) + bend, 0.0, -R * math.sin(a)))


def cap(t):
    """Ellipsoidal rounding of both ends."""
    s = 1.0
    if P["cap0"] > 0 and t < P["cap0"]:
        u = 1 - t / P["cap0"]
        s *= math.sqrt(max(0.0, 1 - u * u * 0.93))
    if t > 1 - P["cap1"]:
        u = (t - (1 - P["cap1"])) / P["cap1"]
        s *= math.sqrt(max(0.0, 1 - u * u * 0.80))
    return s


def build_body():
    N, M = 96, 64
    verts, faces = [], []
    for i in range(N + 1):
        t = i / N
        c = spine(t)
        tan = (spine(min(1, t + 1e-3)) - spine(max(0, t - 1e-3))).normalized()
        out = Vector((0, 1, 0))                    # +Y = away from the head
        side = tan.cross(out).normalized()         # front-to-back direction
        b, h = interp(P["breadth"], t) * cap(t) / 2, interp(P["thick"], t) * cap(t) / 2
        for j in range(M):
            th = 2 * math.pi * j / M
            cx, sy = math.cos(th), math.sin(th)
            if AID:
                k = smoothstep(min(1.0, t / (0.38 if RIC else 0.22)))   # round at the hook, flat-sided below it
                e_out, e_in = 2.0 + (1.3 if RIC else 0.6) * k, 2.0 + 7.0 * k  # head side: flat face, soft edges
                e = e_in if sy < 0 else e_out
                x = b * math.copysign(abs(cx) ** (2 / e), cx)
                y = h * math.copysign(abs(sy) ** (2 / e), sy)
                if sy < 0:
                    y *= 1.0 + (P["flat"] - 1.0) * k
            else:
                x = b * math.copysign(abs(cx) ** (2 / P["sq"]), cx)
                y = h * math.copysign(abs(sy) ** (2 / P["sq"]), sy)
                if y < 0:
                    y *= P["flat"]                 # flatter against the head
            verts.append(c + side * x + out * y)
    for i in range(N):
        for j in range(M):
            a, b_ = i * M + j, i * M + (j + 1) % M
            faces.append((a, b_, b_ + M, a + M))
    top, bot = len(verts), len(verts) + 1
    verts += [spine(0), spine(1)]
    for j in range(M):
        faces.append((top, (j + 1) % M, j))
        faces.append((bot, N * M + j, N * M + (j + 1) % M))
    me = bpy.data.meshes.new("body")
    me.from_pydata([tuple(v) for v in verts], [], faces)
    ob = bpy.data.objects.new("body", me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    ob.modifiers.new("sub", "SUBSURF").levels = 1
    ob.modifiers["sub"].render_levels = 2
    return ob


def build_hook():
    """Thin frosted hook: leaves the top end, arches over the ear and comes partway down the front."""
    top = spine(0.0 if AID else 0.02)
    tan = (spine(0.0) - spine(0.08)).normalized()
    if RIC:   # thin clear wire: leaves the front of the top and runs down the front of the ear
        pts = [top, top + tan * 2.5, top + tan * 5 + Vector((0.6, -0.3, -1.8)), top + Vector((7.5, -0.8, -7)),
               top + Vector((8.6, -1.0, -15)), top + Vector((7.8, -1.0, -23)), top + Vector((6.0, -0.6, -29))]
    else:
        pts = [top, top + tan * 5 + Vector((1.5, -0.6, 0)), top + tan * 9 + Vector((7, -1.2, 0)),
               top + tan * 8 + Vector((13.5, -1.4, 0)), top + tan * 2 + Vector((17.5, -1.2, 0)),
               top + tan * -6 + Vector((18.5, -0.8, 0))]
    cu = bpy.data.curves.new("hook", "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for p, v in zip(sp.points, pts):
        p.co = (v.x, v.y, v.z, 1)
    sp.use_endpoint_u = True
    sp.order_u = 4
    cu.bevel_depth, cu.bevel_resolution, cu.resolution_u = (0.8 if RIC else 2.3 if AID else 1.25), 10, 32
    if AID and not RIC:
        for i, p in enumerate(sp.points):
            p.radius = 1.0 - 0.52 * (i / (len(sp.points) - 1))   # thick at the body, slim at the tip
    cu.use_fill_caps = True
    ob = bpy.data.objects.new("hook", cu)
    bpy.context.collection.objects.link(ob)
    return ob


def material(name, color, metallic, rough, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if transmission:
        b.inputs["Transmission Weight"].default_value = transmission
    return m


bpy.ops.wm.read_factory_settings(use_empty=True)
body, hook = build_body(), build_hook()
body.data.materials.append(material("satin", (0.58, 0.56, 0.53), 0.35, 0.45) if RIC
                           else material("satin grey", (0.60, 0.61, 0.63), 0.85, 0.36))
hook.data.materials.append(material("frosted", (0.88, 0.90, 0.93), 0.0, 0.42, 0.75))

# small flush power button on the outer face and a USB-C slot hint at the bottom end
if RIC:
    pass   # shape study only: no button (the reference's rocker is not being copied)
elif False:
    # long slim rocker on the back edge, as in the reference
    tb = 0.36
    c0 = spine(tb)
    tn = (spine(tb + 0.01) - spine(tb - 0.01)).normalized()
    back = -tn.cross(Vector((0, 1, 0))).normalized()
    loc = c0 + back * (interp(P["breadth"], tb) / 2 - 0.25)
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    rk = bpy.context.object
    rk.scale = (1.3, 3.0, 7.0)
    rk.rotation_euler = tn.to_track_quat("Z", "Y").to_euler()
    bev = rk.modifiers.new("bev", "BEVEL")
    bev.width, bev.segments = 0.55, 6
    rk.data.materials.append(material("rocker", (0.62, 0.60, 0.57), 0.3, 0.33))
    bpy.ops.object.shade_smooth()
else:
    btn_c = spine(0.62) + Vector((0, interp(P["thick"], 0.62) / 2 * 0.98, 0))
    bpy.ops.mesh.primitive_cylinder_add(radius=1.9, depth=0.5, location=btn_c, rotation=(math.radians(90), 0, 0))
    bpy.context.object.data.materials.append(material("button", (0.50, 0.51, 0.53), 0.85, 0.25))
    bpy.ops.object.shade_smooth()

scene = bpy.context.scene
world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.035, 0.036, 0.04, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6


def light(loc, energy, size, color=(1, 1, 1)):
    d = bpy.data.lights.new("l", "AREA")
    d.energy, d.size, d.color = energy, size, color
    o = bpy.data.objects.new("l", d)
    o.location = loc
    bpy.context.collection.objects.link(o)
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


EXP = 0.42 if RIC else 1.0
light((60, 90, 70), 260000 * EXP, 70)
light((-90, 60, -10), 90000 * EXP, 90, (0.85, 0.9, 1.0))
light((20, -70, 60), 50000 * EXP, 60)
light((40, 30, -90), 40000 * EXP, 80)

cam_d = bpy.data.cameras.new("cam")
cam_d.lens = 85
cam = bpy.data.objects.new("cam", cam_d)
bpy.context.collection.objects.link(cam)
scene.camera = cam
target = Vector((5.0, 0.0, -4.0)) if RIC else Vector((7.0, 0.0, 3.0))
cam.location = {"hero": Vector((75, 150, 45)), "side": Vector((8, 190, 3)), "back": Vector((-150, 70, 20)),
                "head": Vector((60, -160, 40)), "edge": Vector((-185, 12, 3)),
                "worn": Vector((-70, 170, 25))}[VIEW]
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()

scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1100, 1100
scene.render.filepath = OUT
scene.view_settings.view_transform = "Standard"
bpy.ops.render.render(write_still=True)
