"""Génère le catalogue de trappes 3D des accès verticaux Enclume.

Usage : blender --background --python tools/generate_vertical_access_hatches.py
"""

import json
import math
import os
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "vertical_access_hatches"
GLB_DIR = OUT / "glb"
DEG = math.pi / 180.0
OPEN_FRAME = 60

ASSETS = [
    ("01_square_hinged_armored", "Trappe carrée blindée battante", "rectangle", "hinged", False),
    ("02_round_hinged_armored", "Trappe ronde blindée battante", "circle", "hinged", False),
    ("03_square_hinged_service_hatch", "Trappe carrée battante avec écoutille", "rectangle", "hinged", True),
    ("04_round_hinged_service_hatch", "Trappe ronde battante avec écoutille", "circle", "hinged", True),
    ("05_square_sliding_bipartite", "Trappe carrée coulissante bipartite", "rectangle", "sliding-bipartite", False),
    ("06_round_sliding_bipartite", "Trappe ronde coulissante bipartite", "circle", "sliding-bipartite", False),
    ("07_square_sliding_tripartite", "Trappe carrée coulissante tripartite", "rectangle", "sliding-tripartite", False),
    ("08_round_sliding_tripartite", "Trappe ronde coulissante tripartite", "circle", "sliding-tripartite", False),
]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def collection(name, parent):
    value = bpy.data.collections.new(name)
    parent.children.link(value)
    return value


def link_only(obj, target):
    if obj.name not in target.objects:
        target.objects.link(obj)
    for source in list(obj.users_collection):
        if source != target:
            source.objects.unlink(obj)


def empty(target, name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    target.objects.link(obj)
    obj.location = location
    obj.parent = parent
    return obj


def material(name, color, metallic=0.0, roughness=0.5, emission=None, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, alpha)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if emission:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = (*emission, 1.0)
        strength = bsdf.inputs.get("Emission Strength")
        if strength:
            strength.default_value = 5.0
    if alpha < 1:
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = "DITHERED"
        elif hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"
    return mat


def make_materials(asset_name):
    return {
        "primary": material(f"{asset_name}__SLOT_01__Primary_Painted_Metal", (0.07, 0.25, 0.31), 0.72, 0.27),
        "secondary": material(f"{asset_name}__SLOT_02__Secondary_Panels", (0.15, 0.42, 0.49), 0.64, 0.3),
        "hardware": material(f"{asset_name}__SLOT_03__Dark_Frame_Hardware", (0.018, 0.027, 0.034), 0.88, 0.2),
        "accent": material(f"{asset_name}__SLOT_04__Safety_Accent", (1.0, 0.35, 0.035), 0.48, 0.3, emission=(0.25, 0.035, 0.002)),
        "glass": material(f"{asset_name}__SLOT_05__Service_Glass", (0.02, 0.55, 0.72), 0.12, 0.1, emission=(0.0, 0.12, 0.2), alpha=0.36),
    }


def bevel(obj, amount=0.01, segments=2):
    if amount <= 0:
        return obj
    modifier = obj.modifiers.new("edge_softening", "BEVEL")
    modifier.width = amount
    modifier.segments = segments
    return obj


def box(target, parent, name, location, dimensions, mat, amount=0.008, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    link_only(obj, target)
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = rotation
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return bevel(obj, amount)


def cylinder(target, parent, name, location, radius, depth, mat, vertices=48, amount=0.006):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    link_only(obj, target)
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    return bevel(obj, amount)


def torus(target, parent, name, location, major, minor, mat):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=64,
        minor_segments=10,
        location=(0, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    link_only(obj, target)
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    return obj


def polygon_prism(target, parent, name, points, height, z, mat, amount=0.004):
    count = len(points)
    vertices = [(x, y, z - height / 2) for x, y in points] + [(x, y, z + height / 2) for x, y in points]
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    obj.parent = parent
    return bevel(obj, amount)


def sector_points(shape, start, end, samples=18, inset=0.455):
    points = [(0.0, 0.0)]
    for index in range(samples + 1):
        angle = start + (end - start) * index / samples
        if shape == "circle":
            radius = inset
        else:
            radius = inset / max(abs(math.cos(angle)), abs(math.sin(angle)), 1e-6)
        points.append((math.cos(angle) * radius, math.sin(angle) * radius))
    return points


def parent_detail(obj, parent):
    obj.parent = parent
    return obj


def add_edge_controls(target, root, mats):
    for face_name, z in (("Top", 0.20), ("Bottom", -0.02)):
        box(
            target, root, f"Control_{face_name}_Housing",
            (0.34, 0.515, z), (0.28, 0.08, 0.16), mats["hardware"], 0.018,
        )
        box(
            target, root, f"Control_{face_name}_Face",
            (0.34, 0.468, z), (0.22, 0.018, 0.115), mats["secondary"], 0.008,
        )
        for index, color in enumerate(("accent", "glass", "accent")):
            box(
                target, root, f"Control_{face_name}_Status_{index}",
                (0.285 + index * 0.055, 0.456, z), (0.026, 0.012, 0.026), mats[color], 0.003,
            )


def add_frame(target, root, shape, mats, mechanism, service_hatch):
    if shape == "circle":
        torus(target, root, "Outer_Reinforced_Rim", (0, 0, 0.065), 0.515, 0.055, mats["hardware"])
        torus(target, root, "Inner_Pressure_Seal_Top", (0, 0, 0.105), 0.462, 0.018, mats["accent"])
        torus(target, root, "Inner_Pressure_Seal_Bottom", (0, 0, 0.025), 0.462, 0.018, mats["accent"])
        for index in range(16):
            angle = index * math.tau / 16
            for face_name, z in (("Top", 0.132), ("Bottom", -0.002)):
                cylinder(
                    target, root, f"Frame_Bolt_{face_name}_{index:02d}",
                    (math.cos(angle) * 0.515, math.sin(angle) * 0.515, z),
                    0.018, 0.025, mats["hardware"], vertices=12, amount=0.002,
                )
    else:
        outside = 1.12
        bar = 0.095
        box(target, root, "Frame_North", (0, -outside / 2, 0.07), (outside, bar, 0.14), mats["hardware"], 0.02)
        box(target, root, "Frame_South", (0, outside / 2, 0.07), (outside, bar, 0.14), mats["hardware"], 0.02)
        box(target, root, "Frame_West", (-outside / 2, 0, 0.07), (bar, outside - bar * 2, 0.14), mats["hardware"], 0.02)
        box(target, root, "Frame_East", (outside / 2, 0, 0.07), (bar, outside - bar * 2, 0.14), mats["hardware"], 0.02)
        for index, (x, y) in enumerate(((-0.51, -0.51), (0.51, -0.51), (-0.51, 0.51), (0.51, 0.51))):
            for face_name, z in (("Top", 0.153), ("Bottom", -0.013)):
                cylinder(
                    target, root, f"Frame_Bolt_{face_name}_{index}",
                    (x, y, z), 0.022, 0.028, mats["accent"], vertices=12, amount=0.002,
                )
    if not service_hatch:
        add_edge_controls(target, root, mats)


def add_panel_details(target, parent, shape, mats, prefix, underside=False):
    face_name = "Bottom" if underside else "Top"
    detail_z = 0.032 if underside else 0.148
    if shape == "circle":
        torus(target, parent, f"{prefix}_{face_name}_Panel_Reinforcement", (0, 0, detail_z), 0.31, 0.018, mats["secondary"])
        for index in range(8):
            angle = index * math.tau / 8
            box(
                target, parent, f"{prefix}_{face_name}_Radial_Rib_{index}",
                (math.cos(angle) * 0.23, math.sin(angle) * 0.23, detail_z),
                (0.27, 0.026, 0.025), mats["secondary"], 0.004, rotation=(0, 0, angle),
            )
    else:
        for index, offset in enumerate((-0.28, 0, 0.28)):
            box(target, parent, f"{prefix}_{face_name}_Longitudinal_Rib_{index}", (offset, 0, detail_z), (0.035, 0.78, 0.03), mats["secondary"], 0.005)
        for index, offset in enumerate((-0.27, 0.27)):
            box(target, parent, f"{prefix}_{face_name}_Cross_Rib_{index}", (0, offset, detail_z), (0.82, 0.035, 0.032), mats["secondary"], 0.005)


def add_service_hatch(target, parent, mats):
    for face_name, values in (
        ("Top", (0.158, 0.19, 0.194, 0.217, 0.218)),
        ("Bottom", (0.022, -0.01, -0.014, -0.037, -0.038)),
    ):
        leaf_z, rim_z, glass_z, wheel_z, hub_z = values
        cylinder(target, parent, f"Service_Hatch_{face_name}_Leaf", (0.02, 0.06, leaf_z), 0.205, 0.055, mats["secondary"], vertices=48, amount=0.008)
        torus(target, parent, f"Service_Hatch_{face_name}_Rim", (0.02, 0.06, rim_z), 0.205, 0.025, mats["hardware"])
        cylinder(target, parent, f"Service_Hatch_{face_name}_Glass", (0.02, 0.06, glass_z), 0.095, 0.018, mats["glass"], vertices=48, amount=0.003)
        torus(target, parent, f"Service_Hatch_{face_name}_Wheel", (0.02, 0.06, wheel_z), 0.13, 0.014, mats["accent"])
        cylinder(target, parent, f"Service_Hatch_{face_name}_Wheel_Hub", (0.02, 0.06, hub_z), 0.035, 0.024, mats["hardware"], vertices=24, amount=0.003)
        for index in range(6):
            angle = index * math.tau / 6
            box(
                target, parent, f"Service_Hatch_{face_name}_Wheel_Spoke_{index}",
                (0.02 + math.cos(angle) * 0.065, 0.06 + math.sin(angle) * 0.065, wheel_z + 0.002),
                (0.13, 0.012, 0.012), mats["accent"], 0.002, rotation=(0, 0, angle),
            )


def interpolation(obj):
    action = obj.animation_data.action if obj.animation_data else None
    if not action:
        return
    for curve in action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"


def animate_rotation(obj, asset_name, degrees):
    bpy.context.scene.frame_set(1)
    obj.rotation_euler = (0, 0, 0)
    obj.keyframe_insert(data_path="rotation_euler", frame=1)
    bpy.context.scene.frame_set(OPEN_FRAME)
    obj.rotation_euler.x = degrees * DEG
    obj.keyframe_insert(data_path="rotation_euler", frame=OPEN_FRAME)
    if obj.animation_data and obj.animation_data.action:
        obj.animation_data.action.name = f"open_{asset_name}_hinge"
    interpolation(obj)
    bpy.context.scene.frame_set(1)


def animate_slide(obj, asset_name, index, delta):
    start = obj.location.copy()
    bpy.context.scene.frame_set(1)
    obj.location = start
    obj.keyframe_insert(data_path="location", frame=1)
    bpy.context.scene.frame_set(OPEN_FRAME)
    obj.location = (start.x + delta[0], start.y + delta[1], start.z - 0.035)
    obj.keyframe_insert(data_path="location", frame=OPEN_FRAME)
    if obj.animation_data and obj.animation_data.action:
        obj.animation_data.action.name = f"open_{asset_name}_panel_{index + 1}"
    interpolation(obj)
    bpy.context.scene.frame_set(1)
    obj.location = start


def build_hinged(target, root, asset_name, shape, mats, service_hatch):
    hinge_y = -0.47
    pivot = empty(target, "Hinge_Pivot_Open_105deg", root, (0, hinge_y, 0))
    leaf_root = empty(target, "Moving_Leaf_Details", pivot, (0, -hinge_y, 0))
    if shape == "circle":
        panel = cylinder(target, leaf_root, "Moving_Round_Armored_Leaf", (0, 0, 0.09), 0.455, 0.09, mats["primary"], vertices=64, amount=0.012)
    else:
        panel = box(target, leaf_root, "Moving_Square_Armored_Leaf", (0, 0, 0.09), (0.91, 0.91, 0.09), mats["primary"], 0.025)
    add_panel_details(target, leaf_root, shape, mats, "Moving")
    add_panel_details(target, leaf_root, shape, mats, "Moving", underside=True)
    if service_hatch:
        add_service_hatch(target, leaf_root, mats)
    for index, x in enumerate((-0.28, 0, 0.28)):
        cylinder(target, root, f"External_Hinge_Barrel_{index}", (x, hinge_y - 0.035, 0.11), 0.035, 0.2, mats["hardware"], vertices=20, amount=0.004)
        bpy.context.object.rotation_euler.y = math.pi / 2
    animate_rotation(pivot, asset_name, 105)
    return [panel]


def build_bipartite(target, root, asset_name, shape, mats):
    sliders = []
    if shape == "circle":
        definitions = [(-math.pi / 2, math.pi / 2, 1), (math.pi / 2, math.pi * 3 / 2, -1)]
        for index, (start, end, direction) in enumerate(definitions):
            slider = empty(target, f"Sliding_Panel_{index + 1}", root)
            polygon_prism(target, slider, f"Round_Half_{index + 1}", sector_points(shape, start, end, 28), 0.09, 0.09, mats["primary"], 0.007)
            for rib in range(3):
                y = (rib - 1) * 0.18
                for face_name, z in (("Top", 0.145), ("Bottom", 0.035)):
                    box(target, slider, f"Round_Half_{index + 1}_{face_name}_Rib_{rib}", (direction * 0.23, y, z), (0.32, 0.022, 0.024), mats["secondary"], 0.004)
            animate_slide(slider, asset_name, index, (direction * 0.64, 0))
            sliders.append(slider)
    else:
        for index, direction in enumerate((-1, 1)):
            slider = empty(target, f"Sliding_Panel_{index + 1}", root)
            x = direction * 0.2275
            box(target, slider, f"Square_Half_{index + 1}", (x, 0, 0.09), (0.455, 0.91, 0.09), mats["primary"], 0.018)
            for rib, y in enumerate((-0.27, 0, 0.27)):
                for face_name, z in (("Top", 0.145), ("Bottom", 0.035)):
                    box(target, slider, f"Square_Half_{index + 1}_{face_name}_Rib_{rib}", (x, y, z), (0.37, 0.025, 0.025), mats["secondary"], 0.004)
            animate_slide(slider, asset_name, index, (direction * 0.66, 0))
            sliders.append(slider)
    box(target, root, "Sliding_Track_Left", (-0.52, 0, 0.02), (0.09, 1.1, 0.06), mats["hardware"], 0.012)
    box(target, root, "Sliding_Track_Right", (0.52, 0, 0.02), (0.09, 1.1, 0.06), mats["hardware"], 0.012)
    box(target, root, "Sliding_Track_Left_Top", (-0.52, 0, 0.16), (0.09, 1.1, 0.06), mats["hardware"], 0.012)
    box(target, root, "Sliding_Track_Right_Top", (0.52, 0, 0.16), (0.09, 1.1, 0.06), mats["hardware"], 0.012)
    return sliders


def build_tripartite(target, root, asset_name, shape, mats):
    sliders = []
    for index in range(3):
        start = -math.pi / 2 + index * math.tau / 3
        end = start + math.tau / 3
        middle = (start + end) / 2
        slider = empty(target, f"Radial_Sliding_Panel_{index + 1}", root)
        polygon_prism(
            target, slider, f"Tripartite_{shape}_Panel_{index + 1}",
            sector_points(shape, start, end, 22), 0.09, 0.09, mats["primary"], 0.007,
        )
        for face_name, z in (("Top", 0.145), ("Bottom", 0.035)):
            box(
                target, slider, f"Tripartite_{face_name}_Accent_Rib_{index + 1}",
                (math.cos(middle) * 0.22, math.sin(middle) * 0.22, z),
                (0.34, 0.026, 0.026), mats["accent"], 0.004, rotation=(0, 0, middle),
            )
        animate_slide(slider, asset_name, index, (math.cos(middle) * 0.67, math.sin(middle) * 0.67))
        sliders.append(slider)
    cylinder(target, root, "Tripartite_Central_Lock", (0, 0, 0.15), 0.065, 0.045, mats["hardware"], vertices=24, amount=0.006)
    cylinder(target, root, "Tripartite_Central_Lock_Bottom", (0, 0, 0.03), 0.065, 0.045, mats["hardware"], vertices=24, amount=0.006)
    return sliders


def descendants(root):
    result = [root]
    stack = list(root.children)
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(current.children)
    return result


def export_glb(path, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    properties = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    desired = {
        "filepath": str(path),
        "export_format": "GLB",
        "use_selection": True,
        "export_apply": True,
        "export_animations": True,
        "export_materials": "EXPORT",
        "export_extras": True,
        "export_yup": True,
    }
    bpy.ops.export_scene.gltf(**{key: value for key, value in desired.items() if key in properties})
    bpy.ops.object.select_all(action="DESELECT")


def editor_slots(asset_name):
    return [
        {"id": "primary", "code": "SLOT_01", "label": "Métal principal", "default_hex": "#12404F", "material_names": [f"{asset_name}__SLOT_01__Primary_Painted_Metal"]},
        {"id": "secondary", "code": "SLOT_02", "label": "Panneaux secondaires", "default_hex": "#276B7D", "material_names": [f"{asset_name}__SLOT_02__Secondary_Panels"]},
        {"id": "hardware", "code": "SLOT_03", "label": "Cadre et mécanismes", "default_hex": "#050709", "material_names": [f"{asset_name}__SLOT_03__Dark_Frame_Hardware"]},
        {"id": "accent", "code": "SLOT_04", "label": "Signalétique", "default_hex": "#FF5909", "material_names": [f"{asset_name}__SLOT_04__Safety_Accent"]},
        {"id": "glass", "code": "SLOT_05", "label": "Verre d’écoutille", "default_hex": "#058CB8", "transparent": True, "material_names": [f"{asset_name}__SLOT_05__Service_Glass"]},
    ]


def configure_preview(records, pack_collection):
    for index, record in enumerate(records):
        row, column = divmod(index, 4)
        record["root"].location = ((column - 1.5) * 1.55, (0.5 - row) * 1.65, 0.02)
    floor_mat = material("Preview_Floor", (0.022, 0.03, 0.04), 0.15, 0.58)
    box(pack_collection, None, "Preview_Floor", (0, 0, -0.09), (7.0, 4.2, 0.14), floor_mat, 0.02)
    bpy.ops.object.light_add(type="AREA", location=(1.5, -3.5, 6.5))
    key = bpy.context.object
    key.name = "Preview_Key_Light"
    key.data.energy = 1450
    key.data.shape = "DISK"
    key.data.size = 5
    key.rotation_euler = (18 * DEG, 0, 23 * DEG)
    bpy.ops.object.light_add(type="AREA", location=(-4, 2, 3.5))
    fill = bpy.context.object
    fill.data.energy = 800
    fill.data.color = (0.1, 0.35, 0.65)
    fill.data.size = 4
    bpy.ops.object.camera_add(location=(6.8, -8.8, 8.6))
    camera = bpy.context.object
    direction = mathutils.Vector((0, 0, 0.2)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 55
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 820
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.008, 0.012, 0.02)
    for frame, filename in ((1, "vertical_access_hatches_closed.png"), (OPEN_FRAME, "vertical_access_hatches_open.png")):
        scene.frame_set(frame)
        scene.render.filepath = str(OUT / filename)
        bpy.ops.render.render(write_still=True)
    scene.frame_set(1)


def main():
    global mathutils
    import mathutils

    OUT.mkdir(parents=True, exist_ok=True)
    GLB_DIR.mkdir(parents=True, exist_ok=True)
    clear_scene()
    scene_collection = bpy.context.scene.collection
    pack_collection = collection("Vertical_Access_Hatches", scene_collection)
    records = []
    manifest_assets = []

    for asset_name, label, shape, mechanism, has_service_hatch in ASSETS:
        target = collection(asset_name, pack_collection)
        root = empty(target, f"ROOT_{asset_name}", location=(0, 0, -0.09))
        root["connector_type"] = "hatch"
        root["origin"] = "hatch-center"
        root["opening_shape"] = shape
        root["opening_mechanism"] = mechanism
        root["service_hatch"] = has_service_hatch
        mats = make_materials(asset_name)
        add_frame(target, root, shape, mats, mechanism, has_service_hatch)
        if mechanism == "hinged":
            build_hinged(target, root, asset_name, shape, mats, has_service_hatch)
        elif mechanism == "sliding-bipartite":
            build_bipartite(target, root, asset_name, shape, mats)
        else:
            build_tripartite(target, root, asset_name, shape, mats)
        export_glb(GLB_DIR / f"{asset_name}.glb", descendants(root))
        records.append({"root": root, "name": asset_name})
        manifest_assets.append({
            "name": asset_name,
            "label": label,
            "catalog_file": f"{asset_name}.glb",
            "connector_type": "hatch",
            "placement_mode": "connector",
            "origin": "hatch-center",
            "footprint_width_m": 1.0,
            "footprint_depth_m": 1.0,
            "height_m": 0.38,
            "opening_shape": shape,
            "opening_mechanism": mechanism,
            "features": ["service-hatch", "dual-sided-operation"] if has_service_hatch else ["dual-sided-edge-controls"],
            "openable": True,
            "allowed_states": ["closed", "open", "locked"],
            "editor_color_slots": editor_slots(asset_name),
        })

    manifest = {
        "pack": "vertical_access_hatches",
        "label": "Trappes d’accès vertical",
        "version": 1,
        "placement_mode_default": "connector",
        "origin_default": "hatch-center",
        "assets": manifest_assets,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "README.md").write_text(
        "# Trappes d’accès vertical\n\n"
        "Catalogue moteur de huit trappes animées : chaque mécanisme existe en version carrée et ronde. "
        "Les modèles 03 et 04 possèdent une écoutille de service intégrée sans boîtier séparé. "
        "Toutes les feuilles sont détaillées dessus et dessous ; les autres modèles portent des commandes "
        "verticales intégrées à la rive, accessibles depuis les deux niveaux.\n\n"
        "Le footprint de 1 × 1 décrit exclusivement la trémie canonique ; aucun boîtier mural ne dépasse.\n",
        encoding="utf-8",
    )
    configure_preview(records, pack_collection)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "vertical_access_hatches_pack.blend"))
    print(f"Generated {len(manifest_assets)} vertical access hatch models in {OUT}")


if __name__ == "__main__":
    main()
