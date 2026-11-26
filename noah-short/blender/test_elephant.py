"""Blender (Cycles) look test: baby elephant, the ark and the Light.

/home/user/bpyenv/bin/python test_elephant.py OUT.png [samples] [width]
"""
import math
import sys

import bpy
from mathutils import Vector, Quaternion

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/test.png'
SAMPLES = int(sys.argv[2]) if len(sys.argv) > 2 else 96
WIDTH = int(sys.argv[3]) if len(sys.argv) > 3 else 1280

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


# ---------- helpers ----------
def mat(name, color, rough=0.5, sss=0.0, coat=0.0, sheen=0.0, emit=None, strength=0.0, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss
        b.inputs['Subsurface Radius'].default_value = (0.9, 0.45, 0.3)
        b.inputs['Subsurface Scale'].default_value = 0.08
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.03
    if sheen:
        b.inputs['Sheen Weight'].default_value = sheen
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def link(obj, m=None, smooth=True):
    col.objects.link(obj)
    if m:
        obj.data.materials.append(m)
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def sphere(name, r, loc, scale=(1, 1, 1), m=None, rot=(0, 0, 0), segs=48):
    me = bpy.data.meshes.new(name)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=r)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc; o.scale = scale; o.rotation_euler = rot
    return link(o, m)


def rbox(name, size, loc, m, bevel=0.08, rot=(0, 0, 0)):
    import bmesh
    me = bpy.data.meshes.new(name)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc; o.scale = size; o.rotation_euler = rot
    link(o, m, smooth=False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(scale=True)
    md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 5; md.limit_method = 'NONE'
    o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    for p in o.data.polygons:
        p.use_smooth = True
    o.select_set(False)
    return o


def metaball(name, elements, m, res=0.018):
    mb = bpy.data.metaballs.new(name)
    mb.resolution = res; mb.render_resolution = res; mb.threshold = 0.6
    for kind, co, r, size, rot in elements:
        e = mb.elements.new(type=kind)
        e.co = co; e.radius = r; e.stiffness = 2.0
        if size:
            e.size_x, e.size_y, e.size_z = size
        if rot:
            e.rotation = rot
    o = bpy.data.objects.new(name, mb)
    col.objects.link(o)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    bpy.data.objects.remove(o)
    mo = bpy.data.objects.new(name + '_mesh', me)
    link(mo, m)
    sm = mo.modifiers.new('smooth', 'CORRECTIVE_SMOOTH'); sm.iterations = 6; sm.smooth_type = 'LENGTH_WEIGHTED'
    return mo


# ---------- materials ----------
skin = mat('skin', (0.3, 0.4, 0.62), rough=0.5, sss=0.25, sheen=0.05)
pink = mat('pink', (0.95, 0.6, 0.66), rough=0.5, sss=0.4)
blush = mat('blush', (0.98, 0.55, 0.6), rough=0.6, sss=0.3)
nail = mat('nail', (0.97, 0.94, 0.88), rough=0.35)
white = mat('eyewhite', (0.98, 0.98, 0.98), rough=0.2, coat=1.0)
iris = mat('iris', (0.09, 0.05, 0.03), rough=0.25, coat=1.0)
pupil = mat('pupil', (0.01, 0.01, 0.01), rough=0.15, coat=1.0)
mouthm = mat('mouth', (0.25, 0.12, 0.15), rough=0.5)

# ---------- baby elephant (faces +X) ----------
E = []
Q90y = Quaternion((0, 1, 0), math.radians(90))
E.append(('ELLIPSOID', (0, 0, 0.78), 0.82, (1.2, 0.95, 0.9), None))            # body
E.append(('BALL', (0.66, 0, 1.08), 0.66, None, None))                                # head
E.append(('ELLIPSOID', (0.55, 0, 0.9), 0.38, (1.0, 0.9, 0.9), None))                  # neck/jowl blend
for x in (0.34, -0.34):
    for y in (0.24, -0.24):
        E.append(('CAPSULE', (x, y, 0.3), 0.3, (0.14, 1, 1), Q90y))                 # legs (capsule along local X -> vertical)
# trunk: chain curving down then forward
trunk_pts = []
for i in range(16):
    t = i / 15
    x = 0.95 + 0.16 * math.sin(t * 1.7) + 0.18 * t * t
    z = 1.02 - 0.62 * t + 0.25 * t ** 3
    trunk_pts.append((x, z, 0.2 - 0.1 * t))
for x, z, r in trunk_pts:
    E.append(('BALL', (x, 0, z), r, None, None))
E.append(('BALL', (-0.62, 0, 0.98), 0.08, None, None))
ele = metaball('elephant', E, skin)

# ears
for s in (-1, 1):
    sphere('ear', 0.4, (0.42, s * 0.44, 1.12), (0.14, 0.95, 1.05), skin, rot=(0, 0, s * 0.5))
    sphere('ear_in', 0.31, (0.45, s * 0.46, 1.1), (0.08, 0.92, 1.0), pink, rot=(0, 0, s * 0.5))
    # eyes: placed on the head surface, looking forward-out
    d = Vector((0.86, s * 0.4, 0.3)).normalized()
    c = Vector((0.66, 0, 1.08)) + d * 0.33
    look = Vector((1.0, s * 0.15, 0.02)).normalized()
    sphere('eye', 0.125, c, (1, 1, 1), white)
    import bmesh
    lme = bpy.data.meshes.new('lid'); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=0.133)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
    bm.to_mesh(lme); bm.free()
    lid = bpy.data.objects.new('lid', lme); lid.location = c
    lid.rotation_euler = (0, math.radians(62), math.atan2(look.y, look.x))
    link(lid, skin)
    look = Vector((1.0, s * 0.15, 0.02)).normalized()
    ir = sphere('iris', 0.09, c + look * 0.096, (1, 1, 1), iris)
    ir.scale = (0.45, 1, 1); ir.rotation_euler = (0, 0, math.atan2(look.y, look.x))
    pu = sphere('pupil', 0.05, c + look * 0.128, (1, 1, 1), pupil)
    pu.scale = (0.35, 1, 1); pu.rotation_euler = (0, 0, math.atan2(look.y, look.x))
    sphere('glint', 0.02, c + look * 0.126 + Vector((0, 0, 0.035)) + Vector((-look.y, look.x, 0)) * 0.025, (1, 1, 1), mat('glint', (1, 1, 1), emit=(1, 1, 1), strength=6), segs=16)
    sphere('blush', 0.07, Vector((0.62, 0, 1.06)) + Vector((0.6, s * 0.7, -0.2)).normalized() * 0.42, (0.4, 1, 0.7), blush,
           rot=(0, 0, s * 0.85))
    # toenails
    for x in (0.34, -0.34):
        for dy in (-0.07, 0, 0.07):
            sphere('nail', 0.045, (x + 0.2, s * 0.24 + dy, 0.07), (0.6, 1, 0.8), nail, segs=24)
    # tusk nubs
    sphere('tusk', 0.04, (0.92, s * 0.13, 0.86), (1.4, 1, 1), nail, segs=24)
# smile

elephant_parts = [o for o in col.objects]
for o in elephant_parts:
    o.select_set(False)
pivot = bpy.data.objects.new('ElephantRig', None); col.objects.link(pivot)
for o in elephant_parts:
    o.parent = pivot
pivot.rotation_euler = (0, 0, math.radians(15))
pivot.location = (0, 0, 0)

# ---------- set ----------
grass = mat('grass', (0.18, 0.42, 0.07), rough=0.85)
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
g = bpy.context.active_object; g.data.materials.append(grass)
# soft hills
for i, (x, y, r) in enumerate([(-14, 22, 9), (6, 28, 12), (22, 18, 8), (-30, 30, 14)]):
    sphere('hill', 1, (x, y, -r * 0.55), (r * 1.5, r, r), mat(f'hill{i}', (0.36, 0.6, 0.25), rough=0.85))

wood = mat('wood', (0.42, 0.23, 0.11), rough=0.6)
wt = wood.node_tree
wave = wt.nodes.new('ShaderNodeTexWave'); wave.wave_type = 'BANDS'; wave.bands_direction = 'Z'
wave.inputs['Scale'].default_value = 2.2; wave.inputs['Distortion'].default_value = 3
ramp = wt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.33, 0.17, 0.08, 1); ramp.color_ramp.elements[1].color = (0.55, 0.32, 0.16, 1)
wt.links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
wt.links.new(ramp.outputs['Color'], wt.nodes['Principled BSDF'].inputs['Base Color'])
roofm = mat('roof', (0.45, 0.13, 0.07), rough=0.55)
# ark (behind, out of focus)
ax, ay = -1.0, 7.5
rbox('hull', (7.5, 2.6, 2.0), (ax, ay, 1.0), wood, bevel=0.5)
rbox('bow', (1.6, 2.4, 1.2), (ax + 3.9, ay, 2.0), wood, bevel=0.5, rot=(0, math.radians(-35), 0))
rbox('stern', (1.6, 2.4, 1.2), (ax - 3.9, ay, 2.0), wood, bevel=0.5, rot=(0, math.radians(35), 0))
rbox('cabin', (4.2, 2.0, 1.5), (ax - 0.3, ay, 2.7), mat('cabin', (0.62, 0.38, 0.2), rough=0.6), bevel=0.12)
rbox('roofL', (4.6, 1.4, 0.16), (ax - 0.3, ay - 0.55, 3.75), roofm, bevel=0.05, rot=(math.radians(35), 0, 0))
rbox('roofR', (4.6, 1.4, 0.16), (ax - 0.3, ay + 0.55, 3.75), roofm, bevel=0.05, rot=(math.radians(-35), 0, 0))
for i in range(3):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.1, location=(ax - 1.6 + i * 1.3, ay - 1.01, 2.75), rotation=(math.radians(90), 0, 0))
    bpy.context.active_object.data.materials.append(mat(f'win{i}', (0.06, 0.04, 0.03), rough=0.4))

# ---------- the Light (no figure) ----------
lightm = mat('nur', (1, 0.9, 0.7), emit=(1.0, 0.86, 0.6), strength=40)
sphere('nur_core', 0.16, (-1.4, 2.2, 1.6), (1, 1, 1), lightm)
haze = bpy.data.materials.new('haze'); haze.use_nodes = True
hn = haze.node_tree; hn.nodes.remove(hn.nodes['Principled BSDF'])
vol = hn.nodes.new('ShaderNodeVolumePrincipled'); vol.inputs['Color'].default_value = (1, 0.85, 0.6, 1)
vol.inputs['Density'].default_value = 0.5
vol.inputs['Emission Color'].default_value = (1, 0.8, 0.5, 1); vol.inputs['Emission Strength'].default_value = 0.0
grd = hn.nodes.new('ShaderNodeTexGradient'); grd.gradient_type = 'SPHERICAL'
tcd = hn.nodes.new('ShaderNodeTexCoord')
hn.links.new(tcd.outputs['Object'], grd.inputs['Vector'])
mlt = hn.nodes.new('ShaderNodeMath'); mlt.operation = 'POWER'; mlt.inputs[1].default_value = 2.0
hn.links.new(grd.outputs['Fac'], mlt.inputs[0])
m2 = hn.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; m2.inputs[1].default_value = 3.0
hn.links.new(mlt.outputs[0], m2.inputs[0]); hn.links.new(m2.outputs[0], vol.inputs['Density'])
hn.links.new(vol.outputs['Volume'], hn.nodes['Material Output'].inputs['Volume'])
sphere('nur_haze', 1.0, (-1.4, 2.2, 1.6), (1, 1, 1), haze, segs=32)
bpy.ops.object.light_add(type='POINT', location=(-1.4, 2.2, 1.6))
pl = bpy.context.active_object; pl.data.energy = 350; pl.data.color = (1.0, 0.82, 0.55); pl.data.shadow_soft_size = 0.3

# ---------- lighting / world ----------
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), math.radians(-25), math.radians(-140)))
sun = bpy.context.active_object; sun.data.energy = 2.6; sun.data.angle = math.radians(8); sun.data.color = (1.0, 0.93, 0.82)
world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
wn = world.node_tree
bg = wn.nodes['Background']
sky = wn.nodes.new('ShaderNodeTexSky')
try:
    sky.sun_elevation = math.radians(35); sky.sun_rotation = math.radians(200); sky.air_density = 1.2; sky.dust_density = 0.5
except Exception as ex:
    print('sky props', ex)
grad = wn.nodes.new('ShaderNodeTexGradient'); grad.gradient_type = 'LINEAR'
tc = wn.nodes.new('ShaderNodeTexCoord'); mp = wn.nodes.new('ShaderNodeMapping')
mp.inputs['Rotation'].default_value = (0, math.radians(90), 0)
wn.links.new(tc.outputs['Generated'], mp.inputs['Vector']); wn.links.new(mp.outputs['Vector'], grad.inputs['Vector'])
cr = wn.nodes.new('ShaderNodeValToRGB')
cr.color_ramp.elements[0].color = (0.95, 0.82, 0.62, 1); cr.color_ramp.elements[1].color = (0.12, 0.38, 0.85, 1)
wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 0.09

# ---------- camera ----------
bpy.ops.object.camera_add(location=(4.6, -3.6, 1.35))
cam = bpy.context.active_object; scene.camera = cam
cam.data.lens = 50
target = Vector((0.15, 0.6, 0.95))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 2.8
cam.data.dof.focus_distance = (Vector((0.6, 0.0, 1.0)) - cam.location).length

# ---------- render ----------
r = scene.render
r.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
r.resolution_x = WIDTH; r.resolution_y = WIDTH * 9 // 16; r.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = -0.5
try:
    scene.view_settings.look = 'AgX - Punchy'
except TypeError:
    pass
r.filepath = OUT
r.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print('saved', OUT)
