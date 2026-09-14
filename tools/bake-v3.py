# bake_v3.py: project the approved render (assets/hero-bike.jpg) onto the Meshy mesh (3d/v2/bike.glb)
# through the camera found by tools/match-view.html, bake to the mesh's own UV map, export 3d/v3/bike.glb.
import bpy, os, json, math, mathutils, time
SCR = r"C:\Users\davek\AppData\Local\Temp\claude\C--Fable-5-1\dd6687c8-3427-41f7-803e-27424ab99b87\scratchpad"
SRC = r"C:\WEB\chewi-ai\3d\v2\bike.glb"
IMG = r"C:\WEB\chewi-ai\assets\hero-bike.jpg"
OUT = r"C:\WEB\chewi-ai\3d\v3\bike.glb"
VIEW = json.load(open(os.path.join(SCR, "view_v2.json")))["camera"]  # three.js centred frame, Y up
IMG_W, IMG_H, FOV = 1792, 1008, VIEW.get("fov", 34)
TEX = int(os.environ.get("V3_TEX", "2048"))
WIRE = (0.16, 0.36, 0.72)  # fallback colour where the render has no pixel for the surface (dark blueprint blue)
DARK = float(os.environ.get("V3_DARK", "0.10"))  # luminance below this counts as background

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
o = next(ob for ob in bpy.data.objects if ob.type == "MESH")
bpy.context.view_layer.objects.active = o; o.select_set(True)
# centre exactly like match-view (bbox centre), in Blender coords
pts = [o.matrix_world @ v.co for v in o.data.vertices]
mn = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); mx = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
ctr = (mn + mx) / 2
for v in o.data.vertices: v.co -= ctr
o.matrix_world = mathutils.Matrix.Identity(4)
size_b = mx - mn
print("CENTRED size_blender", [round(v, 4) for v in size_b])

def three_to_b(p):  # glTF/three (x, y up, z) -> Blender (x, -z, y)
    return mathutils.Vector((p[0], -p[2], p[1]))
az, el, D = VIEW["az"], VIEW["el"], VIEW["D"]
t3 = VIEW["target"]
p3 = (t3[0] + D * math.cos(el) * math.sin(az), t3[1] + D * math.sin(el), t3[2] + D * math.cos(el) * math.cos(az))
cam_pos, cam_tgt = three_to_b(p3), three_to_b(t3)
cam_data = bpy.data.cameras.new("cam"); cam_data.sensor_fit = "VERTICAL"; cam_data.angle_y = math.radians(FOV)
cam_data.clip_start = 0.01; cam_data.clip_end = 100
cam = bpy.data.objects.new("cam", cam_data); bpy.context.scene.collection.objects.link(cam)
cam.location = cam_pos
d = cam_tgt - cam_pos; cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
sc = bpy.context.scene; sc.camera = cam
sc.render.resolution_x = IMG_W; sc.render.resolution_y = IMG_H; sc.render.resolution_percentage = 100
print("CAMERA pos", [round(v, 4) for v in cam_pos], "target", [round(v, 4) for v in cam_tgt])

# projected UV layer via UV Project modifier
o.data.uv_layers.new(name="proj")
o.data.uv_layers["UVMap"].active = True; o.data.uv_layers["UVMap"].active_render = True
mod = o.modifiers.new("proj", "UV_PROJECT"); mod.uv_layer = "proj"; mod.aspect_x = IMG_W; mod.aspect_y = IMG_H
mod.projector_count = 1; mod.projectors[0].object = cam

# paint the ten action surfaces as a vertex colour layer (RGB = category colour, A = mask), anchors from match-view
KIND_RGB = {"CONTACT": (0x4a, 0xde, 0x80), "GRIP": (0x38, 0xd6, 0xe0), "SUPPORT": (0xa7, 0x8b, 0xfa), "ROTATION": (0xf5, 0xb5, 0x44), "HINGE": (0xf5, 0xb5, 0x44)}
# per-anchor ellipsoid radii in Blender axes (x length, y width, z up); the saddle is long and flat, the grips run along the bar
RADIUS = {"saddle": (0.23, 0.12, 0.10), "grip_l": (0.06, 0.12, 0.06), "grip_r": (0.06, 0.12, 0.06), "headset": (0.055,) * 3, "hub_f": (0.06,) * 3,
          "crank": (0.075,) * 3, "pedal_l": (0.05,) * 3, "pedal_r": (0.05,) * 3, "tire_r": (0.0,) * 3, "tire_f": (0.0,) * 3}
def srgb_to_lin(c): c /= 255.0; return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
anchors = [(a["id"], a["kind"], three_to_b(a["p"])) for a in json.load(open(os.path.join(SCR, "view_v2.json")))["anchors"]]
col = o.data.color_attributes.new(name="patch", type="FLOAT_COLOR", domain="POINT")
painted = {}
for i, v in enumerate(o.data.vertices):
    best = None
    for aid, kind, ap in anchors:
        r = RADIUS[aid]
        if r[0] <= 0: continue
        q = v.co - ap
        d = math.sqrt((q.x / r[0]) ** 2 + (q.y / r[1]) ** 2 + (q.z / r[2]) ** 2)  # 1.0 on the ellipsoid surface
        if d < 1.0 and (best is None or d < best[0]): best = (d, aid, kind)
    if best:
        rgb = KIND_RGB[best[2]]; col.data[i].color = (srgb_to_lin(rgb[0]), srgb_to_lin(rgb[1]), srgb_to_lin(rgb[2]), 1.0)
        painted[best[1]] = painted.get(best[1], 0) + 1
    else:
        col.data[i].color = (0.0, 0.0, 0.0, 0.0)
print("PAINTED", painted)

# material: photo sampled through 'proj', dark/outside pixels replaced by the wire blue, patches on top; emission only
photo = bpy.data.images.load(IMG)
mat = bpy.data.materials.new("bake"); mat.use_nodes = True; nt = mat.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = "proj"
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = photo; tex.extension = "CLIP"; tex.interpolation = "Linear"
bw = nt.nodes.new("ShaderNodeRGBToBW")
gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = DARK
mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.inputs["A"].default_value = (*WIRE, 1.0)
emit = nt.nodes.new("ShaderNodeEmission"); outn = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
nt.links.new(tex.outputs["Color"], bw.inputs["Color"]); nt.links.new(bw.outputs["Val"], gt.inputs[0])
nt.links.new(gt.outputs["Value"], mix.inputs["Factor"]); nt.links.new(tex.outputs["Color"], mix.inputs["B"])
attr = nt.nodes.new("ShaderNodeVertexColor"); attr.layer_name = "patch"
mix2 = nt.nodes.new("ShaderNodeMix"); mix2.data_type = "RGBA"
nt.links.new(mix.outputs["Result"], mix2.inputs["A"]); nt.links.new(attr.outputs["Color"], mix2.inputs["B"]); nt.links.new(attr.outputs["Alpha"], mix2.inputs["Factor"])
nt.links.new(mix2.outputs["Result"], emit.inputs["Color"]); nt.links.new(emit.outputs["Emission"], outn.inputs["Surface"])
# bake target
baked = bpy.data.images.new("v3_bake", TEX, TEX, alpha=False); baked.colorspace_settings.name = "sRGB"
tgt = nt.nodes.new("ShaderNodeTexImage"); tgt.image = baked; nt.nodes.active = tgt
o.data.materials.clear(); o.data.materials.append(mat)

sc.render.engine = "CYCLES"; sc.cycles.samples = 1; sc.cycles.use_denoising = False
sc.cycles.device = "CPU"
sc.render.bake.margin = 6; sc.render.bake.use_clear = True
t0 = time.time()
bpy.ops.object.bake(type="EMIT", use_clear=True, margin=6)
print("BAKED", TEX, "sec", round(time.time() - t0, 1))
baked_path = os.path.join(SCR, "v3_bake.png"); baked.filepath_raw = baked_path; baked.file_format = "PNG"; baked.save()
print("SAVED", baked_path)

# final material for export: baked map as base colour (the hero shader reads material.map)
o.modifiers.remove(mod)
o.data.uv_layers.remove(o.data.uv_layers["proj"])
o.data.color_attributes.remove(o.data.color_attributes["patch"])
mat2 = bpy.data.materials.new("bike_v3"); mat2.use_nodes = True; nt2 = mat2.node_tree
bsdf = nt2.nodes["Principled BSDF"]; bsdf.inputs["Roughness"].default_value = 0.6; bsdf.inputs["Metallic"].default_value = 0.0
ti = nt2.nodes.new("ShaderNodeTexImage"); ti.image = bpy.data.images.load(baked_path)
nt2.links.new(ti.outputs["Color"], bsdf.inputs["Base Color"])
o.data.materials.clear(); o.data.materials.append(mat2)
# normalise: bike length (X) = 1.0, centred, like the hero's TRELLIS mesh frame
s = 1.0 / size_b.x
for v in o.data.vertices: v.co *= s
print("SCALED by", round(s, 5))
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=85,
                          export_apply=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT")
print("EXPORT", OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB")
