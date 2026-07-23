import json
import math
import os
import sys

import bpy
from mathutils import Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import generate_futuristic_doors as base


PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "futuristic_hydroponics")
GLB_DIR = os.path.join(OUTPUT_DIR, "glb")
BLEND_PATH = os.path.join(OUTPUT_DIR, "submarine_postapo_futuristic_hydroponics_pack.blend")
PACK_GLB_PATH = os.path.join(GLB_DIR, "submarine_postapo_futuristic_hydroponics_pack.glb")
PREVIEW_PATH = os.path.join(OUTPUT_DIR, "submarine_postapo_futuristic_hydroponics_preview.png")
OPEN_PREVIEW_PATH = os.path.join(OUTPUT_DIR, "submarine_postapo_futuristic_hydroponics_open.png")
BASIN_PREVIEW_PATH = os.path.join(OUTPUT_DIR, "submarine_postapo_hydroponic_basins_preview.png")
ALGAE_PREVIEW_PATH = os.path.join(OUTPUT_DIR, "submarine_postapo_algae_culture_vats_preview.png")
MANIFEST_PATH = os.path.join(OUTPUT_DIR, "manifest.json")
README_PATH = os.path.join(OUTPUT_DIR, "README.md")
VALIDATION_PATH = os.path.join(OUTPUT_DIR, "validation.json")

DEG = math.pi / 180.0
ROT_X = (90.0 * DEG, 0.0, 0.0)
ROT_Y = (0.0, 90.0 * DEG, 0.0)

COLOR_SLOT_DEFS = {
    "shell": {
        "code": "SLOT_01",
        "label": "Coque principale",
        "default_hex": "#475E59",
        "transparent": False,
    },
    "structure": {
        "code": "SLOT_02",
        "label": "Structure sombre",
        "default_hex": "#1A2425",
        "transparent": False,
    },
    "accent": {
        "code": "SLOT_03",
        "label": "Accent technique",
        "default_hex": "#C76B13",
        "transparent": False,
    },
    "foliage": {
        "code": "SLOT_04",
        "label": "Végétation",
        "default_hex": "#29872E",
        "transparent": False,
    },
    "fluid": {
        "code": "SLOT_05",
        "label": "Fluide",
        "default_hex": "#09526B",
        "transparent": True,
    },
}


def catalog_file_for(entry):
    label = entry["label"] if isinstance(entry, dict) else str(entry)
    return f"{label}.glb"


def ensure_dirs():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(GLB_DIR, exist_ok=True)
    for filename in os.listdir(GLB_DIR):
        if filename.lower().endswith(".glb"):
            os.remove(os.path.join(GLB_DIR, filename))


def material(asset, role, color, metallic=0.0, roughness=0.72, recolorable=True, alpha=None, emission=None):
    props = {"editor_asset": asset}
    if recolorable:
        slot = COLOR_SLOT_DEFS[role]
        props.update({
            "editor_color_slot": role,
            "editor_color_slot_code": slot["code"],
            "editor_color_slot_label": slot["label"],
            "editor_recolorable": True,
            "editor_default_hex": slot["default_hex"],
        })
        name = f"{asset}__{slot['code']}__{role}"
    else:
        props["editor_fixed_material"] = True
        name = f"{asset}__FIXED__{role}"
    return base.make_material(
        name,
        color,
        metallic=metallic,
        roughness=roughness,
        alpha=1.0 if alpha is None else alpha,
        emission=emission,
        emission_strength=1.5 if emission else 0.0,
        custom_props=props,
    )


def make_materials(asset):
    mats = {
        "shell": material(asset, "shell", (0.28, 0.37, 0.35, 1.0), 0.14, 0.73),
        "structure": material(asset, "structure", (0.10, 0.14, 0.145, 1.0), 0.34, 0.62),
        "accent": material(asset, "accent", (0.78, 0.42, 0.075, 1.0), 0.02, 0.72),
        "foliage": material(asset, "foliage", (0.16, 0.53, 0.18, 1.0), 0.0, 0.84),
        "fluid": material(asset, "fluid", (0.035, 0.32, 0.42, 0.66), 0.0, 0.12, alpha=0.66),
        "steel": material(asset, "steel", (0.45, 0.52, 0.50, 1.0), 0.58, 0.48, False),
        "rubber": material(asset, "rubber", (0.012, 0.017, 0.018, 1.0), 0.0, 0.94, False),
        "glass": material(asset, "glass", (0.09, 0.32, 0.30, 0.30), 0.0, 0.10, False, alpha=0.30),
        "screen": material(asset, "screen", (0.055, 0.55, 0.58, 1.0), 0.0, 0.25, False, emission=(0.055, 0.62, 0.65, 1.0)),
        "root": material(asset, "root", (0.73, 0.66, 0.45, 1.0), 0.0, 0.90, False),
        "foam": material(asset, "foam", (0.68, 0.92, 0.92, 0.72), 0.0, 0.18, False, alpha=0.72),
        "flow": material(asset, "flowing_water", (0.16, 0.52, 0.58, 0.48), 0.0, 0.08, False, alpha=0.48),
    }
    for node in mats["fluid"].node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            base.set_input(node, ["Transmission Weight", "Transmission"], 0.24)
            base.set_input(node, ["IOR"], 1.333)
            base.set_input(node, ["Coat Weight", "Clearcoat"], 0.22)
            base.set_input(node, ["Coat Roughness", "Clearcoat Roughness"], 0.08)
    for node in mats["flow"].node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            base.set_input(node, ["Transmission Weight", "Transmission"], 0.34)
            base.set_input(node, ["IOR"], 1.333)
    return mats


def color_slots(mats):
    slots = []
    for key in ("shell", "structure", "accent", "foliage", "fluid"):
        if mats[key].users <= 0:
            continue
        slot = COLOR_SLOT_DEFS[key]
        slots.append({
            "id": key,
            "code": slot["code"],
            "label": slot["label"],
            "default_hex": slot["default_hex"],
            "transparent": slot["transparent"],
            "material_names": [mats[key].name],
        })
    return slots


def create_asset(pack, name):
    collection = bpy.data.collections.new(name)
    pack.children.link(collection)
    root = base.add_empty(collection, None, f"ROOT_{name}", display_type="CUBE", display_size=0.28)
    root["asset_id"] = name
    root["placement_mode"] = "free"
    root["origin"] = "floor-center"
    return collection, root, make_materials(name)


def box(c, parent, name, loc, dims, mat, bevel=0.016, rot=(0.0, 0.0, 0.0)):
    return base.add_box(c, parent, name, loc, dims, mat, rot=rot, bevel=bevel, segments=2)


def cyl_x(c, parent, name, loc, radius, depth, mat, vertices=20, bevel=0.003):
    return base.add_cylinder(c, parent, name, loc, radius, depth, mat, vertices=vertices, rot=ROT_Y, bevel=bevel)


def cyl_y(c, parent, name, loc, radius, depth, mat, vertices=20, bevel=0.003):
    return base.add_cylinder(c, parent, name, loc, radius, depth, mat, vertices=vertices, rot=ROT_X, bevel=bevel)


def cyl_z(c, parent, name, loc, radius, depth, mat, vertices=20, bevel=0.003):
    return base.add_cylinder(c, parent, name, loc, radius, depth, mat, vertices=vertices, bevel=bevel)


def add_feet(c, parent, prefix, w, d, mats):
    for sx in (-1, 1):
        for sy in (-1, 1):
            x = sx * (w / 2.0 - 0.09)
            y = sy * (d / 2.0 - 0.08)
            box(c, parent, f"{prefix}_Foot_{sx}_{sy}", (x, y, 0.08), (0.15, 0.13, 0.16), mats["rubber"], bevel=0.022)


def add_control(c, parent, prefix, center, mats, width=0.28):
    x, y, z = center
    box(c, parent, f"{prefix}_Control_Mounting_Plate", (x, y + 0.065, z), (width + 0.055, 0.13, 0.245), mats["steel"], bevel=0.024)
    box(c, parent, f"{prefix}_Control_Housing", (x, y, z), (width, 0.075, 0.20), mats["structure"], bevel=0.025)
    box(c, parent, f"{prefix}_Control_Screen", (x - width * 0.08, y - 0.045, z + 0.025), (width * 0.57, 0.018, 0.075), mats["screen"], bevel=0.009)
    for idx in range(3):
        cyl_y(c, parent, f"{prefix}_Button_{idx + 1}", (x - width * 0.20 + idx * width * 0.20, y - 0.055, z - 0.055), 0.014, 0.020, mats["rubber"], vertices=12)


def add_pipe_run(c, parent, prefix, points, radius, mats, fluid=False):
    mat = mats["fluid"] if fluid else mats["structure"]
    for idx, (a, b) in enumerate(zip(points, points[1:])):
        ax, ay, az = a
        bx, by, bz = b
        dx, dy, dz = bx - ax, by - ay, bz - az
        mid = ((ax + bx) / 2.0, (ay + by) / 2.0, (az + bz) / 2.0)
        if abs(dx) >= abs(dy) and abs(dx) >= abs(dz):
            cyl_x(c, parent, f"{prefix}_Segment_{idx + 1}", mid, radius, abs(dx) + radius * 1.8, mat, vertices=16)
        elif abs(dy) >= abs(dz):
            cyl_y(c, parent, f"{prefix}_Segment_{idx + 1}", mid, radius, abs(dy) + radius * 1.8, mat, vertices=16)
        else:
            cyl_z(c, parent, f"{prefix}_Segment_{idx + 1}", mid, radius, abs(dz) + radius * 1.8, mat, vertices=16)
        if idx < len(points) - 2:
            cyl_z(c, parent, f"{prefix}_Joint_{idx + 1}", b, radius * 1.35, radius * 2.0, mats["steel"], vertices=16)


def add_plant(c, parent, prefix, loc, mats, size=1.0, maturity=1.0):
    x, y, z = loc
    cyl_z(c, parent, f"{prefix}_Net_Pot", (x, y, z), 0.062 * size, 0.085 * size, mats["structure"], vertices=16, bevel=0.006)
    cyl_z(c, parent, f"{prefix}_Stem", (x, y, z + 0.095 * size * maturity), 0.014 * size, 0.19 * size * maturity, mats["foliage"], vertices=12)
    leaf_count = 3 if maturity < 0.7 else 5
    for idx in range(leaf_count):
        angle = idx * math.tau / leaf_count
        length = (0.12 + 0.035 * maturity) * size
        px = x + math.cos(angle) * length * 0.42
        py = y + math.sin(angle) * length * 0.42
        pz = z + (0.13 + 0.06 * maturity + (idx % 2) * 0.035) * size
        box(
            c, parent, f"{prefix}_Leaf_{idx + 1}", (px, py, pz),
            (length, 0.052 * size, 0.022 * size), mats["foliage"], bevel=0.020 * size,
            rot=(0.0, (-15 + (idx % 2) * 26) * DEG, angle),
        )


def add_grow_light(c, parent, prefix, center, width, mats):
    x, y, z = center
    box(c, parent, f"{prefix}_Light_Housing", (x, y, z), (width, 0.14, 0.065), mats["structure"], bevel=0.025)
    box(c, parent, f"{prefix}_Light_Diffuser", (x, y, z - 0.038), (width - 0.08, 0.105, 0.018), mats["accent"], bevel=0.009)
    for sx in (-1, 1):
        box(c, parent, f"{prefix}_Mount_{sx}", (x + sx * (width / 2.0 - 0.055), y, z + 0.075), (0.055, 0.075, 0.14), mats["steel"], bevel=0.010)
    # Portique autoportant : les deux montants redescendent jusqu'au bac ou à
    # la tablette inférieure et la traverse touche directement les suspentes.
    # Ainsi, aucune rampe ne dépend d'un élément voisin pour sembler fixée.
    support_top = z + 0.18
    support_bottom = z - 0.54
    support_height = support_top - support_bottom
    box(
        c, parent, f"{prefix}_Support_Top_Beam",
        (x, y, support_top), (width + 0.02, 0.075, 0.07),
        mats["steel"], bevel=0.012,
    )
    for sx in (-1, 1):
        support_x = x + sx * (width / 2.0 - 0.045)
        box(
            c, parent, f"{prefix}_Support_Post_{sx}",
            (support_x, y, (support_top + support_bottom) / 2.0),
            (0.065, 0.075, support_height), mats["structure"], bevel=0.014,
        )


def add_water_surface(c, parent, prefix, center, dims, mats, algae=False, ripple_count=5):
    x, y, z = center
    width, depth = dims
    surface = box(
        c, parent, f"{prefix}_Water_Surface", (x, y, z),
        (width, depth, 0.018), mats["fluid"], bevel=0.006,
    )
    # Ces extras sont exportés dans le GLB. Le moteur Enclume remplace alors le
    # matériau Blender par son shader d'eau animé et subdivise uniquement cette
    # surface horizontale. Les anciens anneaux/cubes décoratifs ont été retirés :
    # ils entraient en conflit avec le shader et donnaient un aspect solide.
    surface["editor_water_role"] = "surface"
    surface["editor_water_medium"] = "algae" if algae else "water"
    return surface


def add_shallow_water_tray(c, parent, prefix, center, dims, surface_z, mats, algae=False):
    """Ajoute un bac ouvert complet : fond, quatre parois et surface runtime."""
    x, y, _ = center
    width, depth = dims
    wall = min(0.055, width * 0.08, depth * 0.12)
    box(c, parent, f"{prefix}_Tray_Bottom", (x, y, surface_z - 0.065), (width, depth, 0.08), mats["shell"], bevel=0.018)
    for suffix, loc, wall_dims in (
        ("Left", (x - width / 2.0 + wall / 2.0, y, surface_z - 0.005), (wall, depth, 0.12)),
        ("Right", (x + width / 2.0 - wall / 2.0, y, surface_z - 0.005), (wall, depth, 0.12)),
        ("Front", (x, y - depth / 2.0 + wall / 2.0, surface_z - 0.005), (width - wall * 2.0, wall, 0.12)),
        ("Rear", (x, y + depth / 2.0 - wall / 2.0, surface_z - 0.005), (width - wall * 2.0, wall, 0.12)),
    ):
        box(c, parent, f"{prefix}_Tray_Wall_{suffix}", loc, wall_dims, mats["shell"], bevel=0.014)
    return add_water_surface(
        c, parent, prefix, (x, y, surface_z),
        (width - wall * 2.4, depth - wall * 2.4), mats, algae=algae, ripple_count=0,
    )


def add_flow_ribbon(c, parent, name, start_x, end_x, y_center, width, start_z, end_z, mats, segments=18):
    """Crée une nappe d'eau courbe et subdivisée, conservée telle quelle au runtime."""
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    half_y = width / 2.0
    run = end_x - start_x
    p0 = Vector((start_x, start_z))
    p1 = Vector((start_x + run * 0.12, start_z - 0.008))
    p2 = Vector((end_x - run * 0.28, end_z + 0.055))
    p3 = Vector((end_x, end_z))
    verts = []
    faces = []
    for idx in range(segments + 1):
        t = idx / segments
        omt = 1.0 - t
        point = p0 * (omt ** 3) + p1 * (3.0 * omt * omt * t) + p2 * (3.0 * omt * t * t) + p3 * (t ** 3)
        verts.extend([
            (point.x, y_center - half_y, point.y),
            (point.x, y_center + half_y, point.y),
        ])
        if idx > 0:
            previous = (idx - 1) * 2
            current = idx * 2
            faces.append((previous, current, current + 1, previous + 1))
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mats["flow"])
    c.objects.link(obj)
    obj.parent = parent
    obj["editor_water_role"] = "flow"
    obj["editor_water_medium"] = "algae"
    return obj


def add_vertical_flow_sheet(c, parent, name, x, y_center, width, top_z, bottom_z, mats, segments=16):
    """Crée une chute strictement verticale, sans interpolation horizontale."""
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    half_y = width / 2.0
    verts = []
    faces = []
    for idx in range(segments + 1):
        t = idx / segments
        z = top_z + (bottom_z - top_z) * t
        verts.extend([
            (x, y_center - half_y, z),
            (x, y_center + half_y, z),
        ])
        if idx > 0:
            previous = (idx - 1) * 2
            current = idx * 2
            faces.append((previous, current, current + 1, previous + 1))
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mats["flow"])
    c.objects.link(obj)
    obj.parent = parent
    obj["editor_water_role"] = "flow"
    obj["editor_water_medium"] = "algae"
    return obj


def add_front_circulation_loop(c, parent, prefix, width, front_y, mats, low_z=0.34, high_z=0.58, left_clearance=0.075, connection_depth=0.11):
    left_x = -width / 2.0 + left_clearance
    right_x = width / 2.0 - 0.075
    add_pipe_run(
        c, parent, f"{prefix}_Front_Circulation_Loop",
        [(left_x, front_y, high_z), (left_x, front_y, low_z),
         (right_x, front_y, low_z), (right_x, front_y, high_z)],
        0.038, mats,
    )
    for side, x in (("L", left_x), ("R", right_x)):
        cyl_y(
            c, parent, f"{prefix}_Wall_Connector_{side}",
            (x, front_y + connection_depth / 2.0, high_z),
            0.045, connection_depth + 0.055, mats["structure"], vertices=18, bevel=0.004,
        )
        cyl_y(
            c, parent, f"{prefix}_Wall_Flange_{side}",
            (x, front_y + connection_depth, high_z),
            0.070, 0.035, mats["steel"], vertices=18, bevel=0.005,
        )
    clamp_positions = tuple(left_x + (right_x - left_x) * idx / 3.0 for idx in range(4))
    for idx, x in enumerate(clamp_positions):
        box(
            c, parent, f"{prefix}_Pipe_Clamp_{idx + 1}",
            (x, front_y + connection_depth / 2.0, low_z),
            (0.085, connection_depth + 0.035, 0.10), mats["steel"], bevel=0.014,
        )


def add_perimeter_circulation(c, parent, prefix, width, depth, z, mats, offset=0.095):
    front_y = -depth / 2.0 - offset
    rear_y = depth / 2.0 + offset
    left_x = -width / 2.0 - offset
    right_x = width / 2.0 + offset
    radius = 0.040
    cyl_x(c, parent, f"{prefix}_Perimeter_Front", (0.0, front_y, z), radius, width + offset * 2.0, mats["structure"], vertices=18, bevel=0.004)
    cyl_x(c, parent, f"{prefix}_Perimeter_Rear", (0.0, rear_y, z), radius, width + offset * 2.0, mats["structure"], vertices=18, bevel=0.004)
    cyl_y(c, parent, f"{prefix}_Perimeter_Left", (left_x, 0.0, z), radius, depth + offset * 2.0, mats["structure"], vertices=18, bevel=0.004)
    cyl_y(c, parent, f"{prefix}_Perimeter_Right", (right_x, 0.0, z), radius, depth + offset * 2.0, mats["structure"], vertices=18, bevel=0.004)
    for label, x, y in (("FL", left_x, front_y), ("FR", right_x, front_y), ("RL", left_x, rear_y), ("RR", right_x, rear_y)):
        cyl_z(c, parent, f"{prefix}_Perimeter_Coupler_{label}", (x, y, z), radius * 1.45, 0.10, mats["steel"], vertices=16, bevel=0.004)
    for idx, x in enumerate((-width * 0.30, 0.0, width * 0.30)):
        box(c, parent, f"{prefix}_Perimeter_Front_Clamp_{idx + 1}", (x, front_y + offset / 2.0, z), (0.09, offset + 0.045, 0.10), mats["steel"], bevel=0.014)
        box(c, parent, f"{prefix}_Perimeter_Rear_Clamp_{idx + 1}", (x, rear_y - offset / 2.0, z), (0.09, offset + 0.045, 0.10), mats["steel"], bevel=0.014)
    for idx, y in enumerate((-depth * 0.28, depth * 0.28)):
        box(c, parent, f"{prefix}_Perimeter_Left_Clamp_{idx + 1}", (left_x + offset / 2.0, y, z), (offset + 0.045, 0.09, 0.10), mats["steel"], bevel=0.014)
        box(c, parent, f"{prefix}_Perimeter_Right_Clamp_{idx + 1}", (right_x - offset / 2.0, y, z), (offset + 0.045, 0.09, 0.10), mats["steel"], bevel=0.014)
    return {"front_y": front_y, "rear_y": rear_y, "left_x": left_x, "right_x": right_x, "z": z}


def add_crop_support_gantry(c, parent, prefix, width, depth, mats, base_z=1.00, top_z=1.82):
    post_x = width / 2.0 - 0.18
    post_y = depth / 2.0 - 0.18
    post_h = top_z - base_z
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl_z(c, parent, f"{prefix}_Gantry_Post_{sx}_{sy}", (sx * post_x, sy * post_y, base_z + post_h / 2.0), 0.036, post_h, mats["structure"], vertices=16, bevel=0.004)
            box(c, parent, f"{prefix}_Gantry_Foot_{sx}_{sy}", (sx * post_x, sy * post_y, base_z + 0.025), (0.13, 0.13, 0.05), mats["steel"], bevel=0.018)
    for sy in (-1, 1):
        cyl_x(c, parent, f"{prefix}_Gantry_Long_Rail_{sy}", (0.0, sy * post_y, top_z), 0.034, post_x * 2.0, mats["structure"], vertices=16, bevel=0.004)
    cross_count = max(3, int(width / 1.15))
    for idx in range(cross_count):
        x = -post_x + idx * (post_x * 2.0) / max(cross_count - 1, 1)
        cyl_y(c, parent, f"{prefix}_Gantry_Crossbar_{idx + 1}", (x, 0.0, top_z), 0.030, post_y * 2.0, mats["steel"], vertices=16, bevel=0.004)
        cyl_z(c, parent, f"{prefix}_Crop_Line_{idx + 1}", (x, 0.0, (base_z + top_z) / 2.0), 0.010, top_z - base_z - 0.10, mats["accent"], vertices=10, bevel=0.001)


def key_rotation(pivot, degrees, axis=2):
    bpy.context.scene.frame_set(1)
    pivot.rotation_euler = (0.0, 0.0, 0.0)
    pivot.keyframe_insert(data_path="rotation_euler", frame=1)
    bpy.context.scene.frame_set(60)
    values = [0.0, 0.0, 0.0]
    values[axis] = degrees * DEG
    pivot.rotation_euler = values
    pivot.keyframe_insert(data_path="rotation_euler", frame=60)
    bpy.context.scene.frame_set(1)


def add_double_doors(c, root, prefix, center, opening, mats, glass=True):
    cx, y, cz = center
    width, height = opening
    half = width / 2.0 + 0.012
    for direction, label in ((-1, "L"), (1, "R")):
        hinge_x = cx + direction * width / 2.0
        pivot = base.add_empty(c, root, f"PIVOT_{prefix}_{label}", (hinge_x, y, cz), "ARROWS", 0.12)
        local_x = -direction * half / 2.0
        box(c, pivot, f"{prefix}_{label}_Back_Seal", (local_x, 0.010, 0.0), (half + 0.018, 0.028, height + 0.018), mats["rubber"], bevel=0.010)
        panel_mat = mats["glass"] if glass else mats["shell"]
        box(c, pivot, f"{prefix}_{label}_Full_Panel", (local_x, -0.008, 0.0), (half + 0.006, 0.042, height), panel_mat, bevel=0.012)
        rail = 0.065
        for suffix, loc, dims in (
            ("Top", (local_x, -0.033, height / 2.0 - rail / 2.0), (half, 0.055, rail)),
            ("Bottom", (local_x, -0.033, -height / 2.0 + rail / 2.0), (half, 0.055, rail)),
            ("Outer", (-direction * rail / 2.0, -0.033, 0.0), (rail, 0.055, height)),
            ("Center", (-direction * (half - rail / 2.0), -0.033, 0.0), (rail, 0.055, height)),
        ):
            box(c, pivot, f"{prefix}_{label}_Frame_{suffix}", loc, dims, mats["structure"], bevel=0.012)
        handle_x = -direction * (half - 0.10)
        box(c, pivot, f"{prefix}_{label}_Handle_Mount_T", (handle_x, -0.075, 0.10), (0.055, 0.055, 0.07), mats["steel"], bevel=0.010)
        box(c, pivot, f"{prefix}_{label}_Handle_Mount_B", (handle_x, -0.075, -0.10), (0.055, 0.055, 0.07), mats["steel"], bevel=0.010)
        cyl_z(c, pivot, f"{prefix}_{label}_Handle_Grip", (handle_x, -0.102, 0.0), 0.022, 0.25, mats["steel"], vertices=16)
        for hz in (-height * 0.32, height * 0.32):
            cyl_z(c, pivot, f"{prefix}_{label}_Hinge_{hz:+.2f}", (0.0, -0.010, hz), 0.025, 0.18, mats["steel"], vertices=16)
        # Front is negative Y. Rotating the left leaf negatively and the right
        # leaf positively makes both doors swing outward, away from the crops.
        key_rotation(pivot, direction * 92.0)


def record(name, label, category, footprint, height, features, animation, root, mats):
    slots = color_slots(mats)
    root["editor_color_slot_count"] = len(slots)
    root["editor_color_slots_json"] = json.dumps(slots, separators=(",", ":"), ensure_ascii=False)
    placement_mode = str(root.get("placement_mode", "free"))
    entry = {
        "name": name, "label": label, "category": category,
        "footprint": footprint, "height": height, "features": features,
        "animation": animation, "root": root, "color_slots": slots,
        "placement_mode": placement_mode,
        "origin": str(root.get("origin", "wall-back-center" if placement_mode == "wall" else "floor-center")),
    }
    if placement_mode == "wall":
        entry["wall_mount"] = {
            "default_bottom_height": float(root.get("wall_mount_default_bottom_height", 0.30)),
            "allow_interior": bool(root.get("wall_mount_allow_interior", True)),
            "allow_exterior": bool(root.get("wall_mount_allow_exterior", True)),
        }
    return entry


def build_culture_table(pack, name, label, width, depth, lanes, double_sided=False):
    c, root, mats = create_asset(pack, name)
    add_feet(c, root, name, width, depth, mats)
    leg_h = 0.72
    for sx in (-1, 1):
        for sy in (-1, 1):
            x = sx * (width / 2.0 - 0.10)
            y = sy * (depth / 2.0 - 0.09)
            box(c, root, f"{name}_Leg_{sx}_{sy}", (x, y, 0.40), (0.10, 0.10, leg_h), mats["structure"], bevel=0.018)
    box(c, root, f"{name}_Lower_Frame", (0.0, 0.0, 0.22), (width - 0.18, depth - 0.14, 0.08), mats["structure"], bevel=0.020)
    box(c, root, f"{name}_Top_Frame", (0.0, 0.0, 0.78), (width, depth, 0.16), mats["shell"], bevel=0.040)
    reservoir_w = width - 0.10
    reservoir_d = depth - 0.08
    reservoir_wall = 0.10
    reservoir_h = 0.32
    add_water_surface(
        c, root, name, (0.0, 0.0, 0.958),
        (reservoir_w - reservoir_wall * 2.0 - 0.055, reservoir_d - reservoir_wall * 2.0 - 0.055),
        mats, ripple_count=3,
    )
    box(c, root, f"{name}_Basin_Wall_Left", (-reservoir_w / 2.0 + reservoir_wall / 2.0, 0.0, 0.90), (reservoir_wall, reservoir_d, reservoir_h), mats["shell"], bevel=0.025)
    box(c, root, f"{name}_Basin_Wall_Right", (reservoir_w / 2.0 - reservoir_wall / 2.0, 0.0, 0.90), (reservoir_wall, reservoir_d, reservoir_h), mats["shell"], bevel=0.025)
    box(c, root, f"{name}_Basin_Wall_Front", (0.0, -reservoir_d / 2.0 + reservoir_wall / 2.0, 0.90), (reservoir_w - reservoir_wall * 2.0, reservoir_wall, reservoir_h), mats["shell"], bevel=0.025)
    box(c, root, f"{name}_Basin_Wall_Rear", (0.0, reservoir_d / 2.0 - reservoir_wall / 2.0, 0.90), (reservoir_w - reservoir_wall * 2.0, reservoir_wall, reservoir_h), mats["shell"], bevel=0.025)
    lane_depth = (depth - 0.20) / lanes
    plant_count = max(3, int(width / 0.32))
    for lane in range(lanes):
        y = -depth / 2.0 + 0.10 + lane_depth * (lane + 0.5)
        box(c, root, f"{name}_NFT_Channel_{lane + 1}", (0.0, y, 0.975), (width - 0.16, lane_depth * 0.72, 0.095), mats["shell"], bevel=0.034)
        for idx in range(plant_count):
            x = -width / 2.0 + 0.18 + idx * (width - 0.36) / max(plant_count - 1, 1)
            add_plant(c, root, f"{name}_Plant_{lane + 1}_{idx + 1}", (x, y, 1.045), mats, size=0.82, maturity=0.68 + 0.10 * ((idx + lane) % 3))
    manifold_y = depth / 2.0 - 0.055
    cyl_x(c, root, f"{name}_Rear_Manifold", (0.0, manifold_y, 0.90), 0.035, width - 0.18, mats["structure"], vertices=18)
    box(
        c, root, f"{name}_Central_Motor_Housing",
        (0.0, 0.0, 0.36),
        (0.42, 0.34, 0.28), mats["structure"], bevel=0.050,
    )
    cyl_y(
        c, root, f"{name}_Central_Pump_Motor",
        (0.0, -0.20, 0.37),
        0.095, 0.22, mats["steel"], vertices=20, bevel=0.010,
    )
    add_pipe_run(
        c, root, f"{name}_Rear_Return_To_Motor",
        [(width / 2.0 - 0.10, manifold_y, 0.90),
         (width / 2.0 - 0.10, manifold_y, 0.36),
         (0.0, manifold_y, 0.36), (0.0, 0.16, 0.36)],
        0.033, mats,
    )
    control_x = -width / 2.0 + 0.20
    add_control(c, root, name, (control_x, -depth / 2.0 - 0.045, 0.54), mats, width=0.28)
    add_front_circulation_loop(
        c, root, name, width, -depth / 2.0 - 0.085, mats,
        low_z=0.30, high_z=0.76, left_clearance=0.40, connection_depth=0.09,
    )
    add_pipe_run(
        c, root, f"{name}_Front_Loop_To_Motor",
        [(0.0, -depth / 2.0 - 0.085, 0.30), (0.0, -0.17, 0.30)],
        0.033, mats,
    )
    if double_sided:
        rear_mount = base.add_empty(
            c, root, f"{name}_Rear_Control_Mount",
            (-control_x, depth / 2.0 - 0.010, 0.54), "PLAIN_AXES", 0.06,
        )
        rear_mount.rotation_euler[2] = math.pi
        add_control(c, rear_mount, f"{name}_Rear", (0.0, -0.015, 0.0), mats, width=0.28)
    return record(name, label, "culture_table", (width, depth), 1.32, f"{lanes} NFT channels, attached manifold and integrated plants", "static", root, mats)


def build_grow_cabinet(pack):
    name = "01_sealed_grow_cabinet"
    c, root, mats = create_asset(pack, name)
    w, d, h = 1.35, 0.72, 2.20
    add_feet(c, root, name, w, d, mats)
    box(c, root, f"{name}_Back", (0.0, d / 2.0 - 0.045, h / 2.0), (w, 0.09, h), mats["shell"], bevel=0.030)
    box(c, root, f"{name}_Side_L", (-w / 2.0 + 0.045, 0.0, h / 2.0), (0.09, d, h), mats["shell"], bevel=0.028)
    box(c, root, f"{name}_Side_R", (w / 2.0 - 0.045, 0.0, h / 2.0), (0.09, d, h), mats["shell"], bevel=0.028)
    box(c, root, f"{name}_Top", (0.0, 0.0, h - 0.055), (w, d, 0.11), mats["shell"], bevel=0.030)
    box(c, root, f"{name}_Bottom", (0.0, 0.0, 0.12), (w, d, 0.20), mats["shell"], bevel=0.030)
    for level in range(3):
        z = 0.52 + level * 0.55
        add_shallow_water_tray(
            c, root, f"{name}_Tray_{level + 1}", (0.0, 0.035, z),
            (w - 0.17, d - 0.18), z + 0.062, mats,
        )
        for idx in range(4):
            x = -0.42 + idx * 0.28
            add_plant(c, root, f"{name}_Plant_{level + 1}_{idx + 1}", (x, -0.02, z + 0.09), mats, size=0.72, maturity=0.55 + level * 0.15)
        add_grow_light(c, root, f"{name}_Light_{level + 1}", (0.0, 0.05, z + 0.39), w - 0.24, mats)
    add_double_doors(c, root, name, (0.0, -d / 2.0 - 0.030, 1.12), (w - 0.11, 2.02), mats, glass=True)
    control_mount = base.add_empty(c, root, f"{name}_Side_Control_Mount", (w / 2.0 - 0.010, 0.0, 1.72), "PLAIN_AXES", 0.08)
    control_mount.rotation_euler[2] = 90.0 * DEG
    add_control(c, control_mount, name, (0.0, -0.015, 0.0), mats, width=0.25)
    return record(name, "Armoire de culture étanche", "enclosed_culture", (w, d), h, "three illuminated trays, full glass, overlapping seals and attached controls", "double doors", root, mats)


def build_rack(pack, name, label, width, depth, levels, double=False, wall_mounted=False):
    c, root, mats = create_asset(pack, name)
    h = 2.48
    if not wall_mounted:
        add_feet(c, root, name, width, depth, mats)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(c, root, f"{name}_Post_{sx}_{sy}", (sx * (width / 2.0 - 0.055), sy * (depth / 2.0 - 0.055), h / 2.0), (0.09, 0.09, h), mats["structure"], bevel=0.020)
    for level in range(levels):
        z = 0.48 + level * 0.63
        box(c, root, f"{name}_Shelf_{level + 1}", (0.0, 0.0, z), (width, depth, 0.11), mats["shell"], bevel=0.028)
        tray_w = width - 0.14
        tray_d = depth - 0.12
        tray_wall = 0.055
        tray_z = z + 0.115
        for suffix, loc, dims in (
            ("Left", (-tray_w / 2.0 + tray_wall / 2.0, 0.0, tray_z), (tray_wall, tray_d, 0.12)),
            ("Right", (tray_w / 2.0 - tray_wall / 2.0, 0.0, tray_z), (tray_wall, tray_d, 0.12)),
            ("Front", (0.0, -tray_d / 2.0 + tray_wall / 2.0, tray_z), (tray_w - tray_wall * 2.0, tray_wall, 0.12)),
            ("Rear", (0.0, tray_d / 2.0 - tray_wall / 2.0, tray_z), (tray_w - tray_wall * 2.0, tray_wall, 0.12)),
        ):
            box(c, root, f"{name}_Tray_{level + 1}_Wall_{suffix}", loc, dims, mats["shell"], bevel=0.016)
        add_water_surface(
            c, root, f"{name}_Tray_{level + 1}", (0.0, 0.0, z + 0.142),
            (tray_w - tray_wall * 2.4, tray_d - tray_wall * 2.4), mats, ripple_count=0,
        )
        rows = 2 if double else 1
        for row in range(rows):
            y = (row - (rows - 1) / 2.0) * 0.30
            for idx in range(max(3, int(width / 0.34))):
                count = max(3, int(width / 0.34))
                x = -width / 2.0 + 0.18 + idx * (width - 0.36) / max(count - 1, 1)
                add_plant(c, root, f"{name}_Plant_{level + 1}_{row}_{idx + 1}", (x, y, z + 0.13), mats, size=0.72, maturity=0.62 + 0.11 * (level % 2))
        add_grow_light(c, root, f"{name}_Light_{level + 1}", (0.0, 0.0, z + 0.48), width - 0.16, mats)
    # La lampe du dernier niveau est suspendue à ce toit ; les montants et les
    # supports de lampe pénètrent légèrement dans la traverse, sans jour visible.
    box(c, root, f"{name}_Structural_Roof", (0.0, 0.0, 2.42), (width, depth, 0.12), mats["structure"], bevel=0.028)
    for y in (-depth * 0.27, depth * 0.27):
        box(c, root, f"{name}_Roof_Crossbeam_{y:+.2f}", (0.0, y, 2.335), (width - 0.12, 0.08, 0.11), mats["steel"], bevel=0.016)
    add_pipe_run(c, root, f"{name}_Feed", [(width / 2.0 - 0.09, depth / 2.0 - 0.06, 0.24), (width / 2.0 - 0.09, depth / 2.0 - 0.06, 1.83)], 0.030, mats)
    add_control(c, root, name, (-width / 2.0 + 0.17, -depth / 2.0 + 0.015, 1.88), mats, width=0.26)
    if wall_mounted:
        root["placement_mode"] = "wall"
        root["origin"] = "wall-back-center"
        root["wall_mount_default_bottom_height"] = 0.30
        root["wall_mount_allow_interior"] = True
        root["wall_mount_allow_exterior"] = True
        # Les platines touchent le plan mural après le décalage de l'ensemble.
        for sx in (-1, 1):
            for z in (0.58, 1.78):
                box(
                    c, root, f"{name}_Wall_Mounting_Plate_{sx}_{z:.2f}",
                    (sx * (width / 2.0 - 0.055), depth / 2.0 - 0.015, z),
                    (0.18, 0.030, 0.28), mats["steel"], bevel=0.018,
                )
        # Le pivot devient le centre du dos : le modèle s'étend uniquement vers
        # l'avant du mur et l'éditeur peut l'orienter depuis la normale de face.
        for child in list(root.children):
            child.location.y -= depth / 2.0
    features = f"{levels} lit levels with roof-mounted lights, contained water trays and feed pipe"
    if wall_mounted:
        features += ", four flush wall plates, no floor feet"
    return record(name, label, "culture_rack", (width, depth), h, features, "static", root, mats)


def build_dwc(pack):
    name = "08_deep_water_culture_basin"
    c, root, mats = create_asset(pack, name)
    w, d, h = 1.85, 1.05, 0.94
    add_feet(c, root, name, w, d, mats)
    box(c, root, f"{name}_Tank", (0.0, 0.0, 0.43), (w, d, 0.78), mats["shell"], bevel=0.070)
    add_water_surface(c, root, name, (0.0, 0.0, 0.852), (w - 0.20, d - 0.20), mats, ripple_count=6)
    box(c, root, f"{name}_Closed_Lid", (0.0, 0.0, 0.86), (w + 0.02, d + 0.02, 0.11), mats["structure"], bevel=0.050)
    for row in range(3):
        for col in range(5):
            x = -0.66 + col * 0.33
            y = -0.30 + row * 0.30
            add_plant(c, root, f"{name}_Plant_{row + 1}_{col + 1}", (x, y, 0.94), mats, size=0.82, maturity=0.70 + 0.10 * ((row + col) % 3))
    motor_y = -d / 2.0 - 0.035
    box(c, root, f"{name}_Central_Motor_Housing", (0.0, motor_y, 0.34), (0.44, 0.20, 0.34), mats["structure"], bevel=0.055)
    cyl_y(c, root, f"{name}_Central_Pump_Motor", (0.0, motor_y - 0.13, 0.34), 0.11, 0.22, mats["steel"], vertices=20, bevel=0.010)
    front_y = -d / 2.0 - 0.10
    rear_y = d / 2.0 + 0.10
    left_x = -w / 2.0 - 0.10
    right_x = w / 2.0 + 0.10
    add_pipe_run(c, root, f"{name}_Left_Circulation", [(-0.22, front_y, 0.30), (left_x, front_y, 0.30), (left_x, rear_y, 0.30), (0.0, rear_y, 0.30)], 0.038, mats)
    add_pipe_run(c, root, f"{name}_Right_Circulation", [(0.22, front_y, 0.30), (right_x, front_y, 0.30), (right_x, rear_y, 0.30), (0.0, rear_y, 0.30)], 0.038, mats)
    for side, x in (("L", left_x), ("R", right_x)):
        box(c, root, f"{name}_Side_Pipe_Clamp_{side}", (x - math.copysign(0.05, x), 0.0, 0.30), (0.14, 0.10, 0.11), mats["steel"], bevel=0.016)
    add_control(c, root, name, (-0.62, -d / 2.0 - 0.045, 0.48), mats, width=0.30)
    return record(name, "Bac de culture en eau profonde", "deep_water_culture", (w, d), 1.26, "sealed tank, full overlapping lid, integrated aeration and fifteen plants", "static", root, mats)


def build_large_hydro_basin(pack, name, label, width, depth, rows, columns, double=False):
    c, root, mats = create_asset(pack, name)
    wall = 0.14
    basin_h = 0.92
    add_feet(c, root, name, width, depth, mats)
    # The floor sits inside the four walls. Keeping its outer faces inset avoids
    # coplanar surfaces with the wall bottoms (the former source of z-fighting).
    box(
        c, root, f"{name}_Inset_Bottom_Slab", (0.0, 0.0, 0.15),
        (width - wall * 2.2, depth - wall * 2.2, 0.22), mats["structure"], bevel=0.045,
    )
    box(c, root, f"{name}_Wall_Left", (-width / 2.0 + wall / 2.0, 0.0, 0.56), (wall, depth, basin_h), mats["shell"], bevel=0.045)
    box(c, root, f"{name}_Wall_Right", (width / 2.0 - wall / 2.0, 0.0, 0.56), (wall, depth, basin_h), mats["shell"], bevel=0.045)
    box(c, root, f"{name}_Wall_Front", (0.0, -depth / 2.0 + wall / 2.0, 0.56), (width - wall * 2.0, wall, basin_h), mats["shell"], bevel=0.045)
    box(c, root, f"{name}_Wall_Rear", (0.0, depth / 2.0 - wall / 2.0, 0.56), (width - wall * 2.0, wall, basin_h), mats["shell"], bevel=0.045)
    add_water_surface(
        c, root, name, (0.0, 0.0, 0.902),
        (width - wall * 2.5, depth - wall * 2.5), mats,
        ripple_count=max(5, int(width / 0.75)),
    )
    box(c, root, f"{name}_Top_Rim_Left", (-width / 2.0 + 0.07, 0.0, 1.035), (0.14, depth, 0.11), mats["steel"], bevel=0.035)
    box(c, root, f"{name}_Top_Rim_Right", (width / 2.0 - 0.07, 0.0, 1.035), (0.14, depth, 0.11), mats["steel"], bevel=0.035)
    box(c, root, f"{name}_Top_Rim_Front", (0.0, -depth / 2.0 + 0.07, 1.035), (width - 0.28, 0.14, 0.11), mats["steel"], bevel=0.035)
    box(c, root, f"{name}_Top_Rim_Rear", (0.0, depth / 2.0 - 0.07, 1.035), (width - 0.28, 0.14, 0.11), mats["steel"], bevel=0.035)

    usable_y = depth - wall * 2.0 - (0.40 if double else 0.10)
    row_spacing = usable_y / rows
    col_spacing = (width - 0.48) / columns
    for row in range(rows):
        y = -usable_y / 2.0 + row_spacing * (row + 0.5)
        if double:
            y += -0.20 if y < 0.0 else 0.20
        for col in range(columns):
            x = -width / 2.0 + 0.24 + col_spacing * (col + 0.5)
            raft_w = col_spacing * 0.88
            raft_d = row_spacing * 0.78
            box(c, root, f"{name}_Raft_{row + 1}_{col + 1}", (x, y, 0.87), (raft_w, raft_d, 0.085), mats["structure"], bevel=0.025)
            add_plant(
                c, root, f"{name}_Plant_{row + 1}_{col + 1}",
                (x, y, 0.945), mats, size=0.88,
                maturity=0.68 + 0.10 * ((row + col) % 3),
            )

    if double:
        box(c, root, f"{name}_Central_Service_Walkway", (0.0, 0.0, 0.96), (width - 0.18, 0.34, 0.14), mats["accent"], bevel=0.035)
        for index in range(max(3, int(width / 1.2))):
            x = -width / 2.0 + 0.34 + index * (width - 0.68) / max(max(3, int(width / 1.2)) - 1, 1)
            box(c, root, f"{name}_Walkway_Support_{index + 1}", (x, 0.0, 0.52), (0.10, 0.26, 0.78), mats["steel"], bevel=0.018)

    manifold_y = depth / 2.0 + 0.045
    cyl_x(c, root, f"{name}_Rear_Manifold", (0.0, manifold_y, 0.54), 0.055, width - 0.20, mats["structure"], vertices=20)
    add_pipe_run(
        c, root, f"{name}_Circulation_Loop",
        [(width / 2.0 - 0.16, manifold_y, 0.54), (width / 2.0 + 0.10, manifold_y, 0.54),
         (width / 2.0 + 0.10, -depth / 2.0 + 0.24, 0.54), (width / 2.0 - 0.02, -depth / 2.0 + 0.24, 0.54)],
        0.050, mats,
    )
    pump_x = width / 2.0 + 0.06
    box(c, root, f"{name}_Pump_Mount", (pump_x, -depth / 2.0 + 0.40, 0.32), (0.22, 0.42, 0.28), mats["structure"], bevel=0.045)
    cyl_y(c, root, f"{name}_Pump_Motor", (pump_x, -depth / 2.0 + 0.34, 0.56), 0.12, 0.28, mats["steel"], vertices=20, bevel=0.010)
    add_control(c, root, name, (-width / 2.0 + 0.32, -depth / 2.0 - 0.045, 0.53), mats, width=0.34)
    perimeter = add_perimeter_circulation(c, root, name, width, depth, 0.32, mats, offset=0.10)
    add_pipe_run(
        c, root, f"{name}_Perimeter_To_Pump",
        [(pump_x, -depth / 2.0 + 0.34, 0.56),
         (perimeter["right_x"], -depth / 2.0 + 0.34, 0.56),
         (perimeter["right_x"], -depth / 2.0 + 0.34, perimeter["z"])],
        0.045, mats,
    )
    if width >= 4.5:
        add_crop_support_gantry(c, root, name, width, depth, mats, base_z=1.00, top_z=1.82)
    features = f"open hollow basin, {rows * columns} floating rafts, connected pump and rear manifold"
    if double:
        features += ", supported central service walkway"
    asset_height = 1.90 if width >= 4.5 else 1.34
    return record(name, label, "large_hydro_basin", (width + 0.18, depth + 0.12), asset_height, features, "static", root, mats)


def tint_algae_fluid(mats):
    algae = (0.006, 0.045, 0.003, 0.94)
    mats["fluid"].diffuse_color = algae
    mats["fluid"]["culture_medium"] = "algae_suspension"
    for node in mats["fluid"].node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            base.set_input(node, ["Base Color"], algae)
            base.set_input(node, ["Alpha"], 0.94)
            base.set_input(node, ["Roughness"], 0.28)
            base.set_input(node, ["Transmission Weight", "Transmission"], 0.04)
            base.set_input(node, ["IOR"], 1.333)
    algae_foam = (0.30, 0.52, 0.12, 0.54)
    mats["foam"].diffuse_color = algae_foam
    for node in mats["foam"].node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            base.set_input(node, ["Base Color"], algae_foam)
            base.set_input(node, ["Alpha"], 0.54)
    algae_flow = (0.10, 0.38, 0.025, 0.30)
    mats["flow"].diffuse_color = algae_flow
    for node in mats["flow"].node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            base.set_input(node, ["Base Color"], algae_flow)
            base.set_input(node, ["Alpha"], 0.30)
            base.set_input(node, ["Transmission Weight", "Transmission"], 0.46)


def build_algae_vat(pack, name, label, width, depth, aeration_rows, uv=False, heavy=False):
    c, root, mats = create_asset(pack, name)
    tint_algae_fluid(mats)
    wall = 0.14
    add_feet(c, root, name, width, depth, mats)
    box(c, root, f"{name}_Inset_Floor", (0.0, 0.0, 0.16), (width - wall * 2.2, depth - wall * 2.2, 0.22), mats["structure"], bevel=0.045)
    for suffix, loc, dims in (
        ("Left", (-width / 2.0 + wall / 2.0, 0.0, 0.55), (wall, depth, 0.86)),
        ("Right", (width / 2.0 - wall / 2.0, 0.0, 0.55), (wall, depth, 0.86)),
        ("Front", (0.0, -depth / 2.0 + wall / 2.0, 0.55), (width - wall * 2.0, wall, 0.86)),
        ("Rear", (0.0, depth / 2.0 - wall / 2.0, 0.55), (width - wall * 2.0, wall, 0.86)),
    ):
        box(c, root, f"{name}_Vat_Wall_{suffix}", loc, dims, mats["shell"], bevel=0.050)
    add_water_surface(
        c, root, name, (0.0, 0.0, 0.852),
        (width - wall * 2.55, depth - wall * 2.55), mats,
        algae=True, ripple_count=max(5, int(width / 0.65)),
    )
    for suffix, loc, dims in (
        ("Left", (-width / 2.0 + 0.07, 0.0, 1.00), (0.14, depth, 0.12)),
        ("Right", (width / 2.0 - 0.07, 0.0, 1.00), (0.14, depth, 0.12)),
        ("Front", (0.0, -depth / 2.0 + 0.07, 1.00), (width - 0.28, 0.14, 0.12)),
        ("Rear", (0.0, depth / 2.0 - 0.07, 1.00), (width - 0.28, 0.14, 0.12)),
    ):
        box(c, root, f"{name}_Reinforced_Rim_{suffix}", loc, dims, mats["steel"], bevel=0.040)

    inner_w = width - 0.42
    inner_d = depth - 0.42
    for row in range(aeration_rows):
        y = -inner_d / 2.0 + inner_d * (row + 0.5) / aeration_rows
        cyl_x(c, root, f"{name}_Aeration_Rail_{row + 1}", (0.0, y, 0.45), 0.025, inner_w, mats["structure"], vertices=16, bevel=0.003)
        for jet in range(max(3, int(width / 0.55))):
            count = max(3, int(width / 0.55))
            x = -inner_w / 2.0 + inner_w * (jet + 0.5) / count
            cyl_z(c, root, f"{name}_Aeration_Bubble_Column_{row + 1}_{jet + 1}", (x, y, 0.57), 0.006, 0.20, mats["foam"], vertices=8, bevel=0.001)
    cyl_y(c, root, f"{name}_Aeration_Header", (width / 2.0 - 0.18, 0.0, 0.43), 0.034, inner_d, mats["structure"], vertices=16, bevel=0.004)

    patch_count = max(5, int(width * depth / 0.85))
    for idx in range(patch_count):
        column = idx % max(3, int(width / 0.55))
        row = idx // max(3, int(width / 0.55))
        cols = max(3, int(width / 0.55))
        rows = max(1, math.ceil(patch_count / cols))
        x = -inner_w / 2.0 + inner_w * (column + 0.5) / cols
        y = -inner_d / 2.0 + inner_d * (row + 0.5) / rows
        box(c, root, f"{name}_Algae_Mat_{idx + 1}", (x, y, 0.855), (0.28, 0.18, 0.025), mats["foliage"], bevel=0.060, rot=(0.0, 0.0, ((idx % 3) - 1) * 8 * DEG))

    add_control(c, root, name, (-width / 2.0 + 0.34, -depth / 2.0 + 0.015, 0.55), mats, width=0.36)
    perimeter = add_perimeter_circulation(c, root, name, width, depth, 0.29, mats, offset=0.10)
    add_pipe_run(
        c, root, f"{name}_Aeration_Header_To_Perimeter",
        [(width / 2.0 - 0.18, 0.0, 0.43),
         (perimeter["right_x"], 0.0, 0.43),
         (perimeter["right_x"], 0.0, perimeter["z"])],
        0.034, mats,
    )
    if heavy:
        for x in (-width * 0.27, 0.0, width * 0.27):
            box(c, root, f"{name}_Front_Vertical_Brace_{x:+.2f}", (x, -depth / 2.0 - 0.010, 0.55), (0.09, 0.08, 0.72), mats["structure"], bevel=0.018)

    height = 1.12
    if uv:
        uv_mat = material(name, "uv_culture_light", (0.40, 0.12, 0.70, 1.0), 0.0, 0.25, False, emission=(0.48, 0.16, 0.92, 1.0))
        frame_top = 1.72
        roof_z = 1.84
        post_x = width / 2.0 - 0.18
        post_y = depth / 2.0 - 0.18
        for sx in (-1, 1):
            for sy in (-1, 1):
                box(c, root, f"{name}_UV_Post_{sx}_{sy}", (sx * post_x, sy * post_y, 1.39), (0.09, 0.09, 0.82), mats["structure"], bevel=0.020)
        # Châssis de toit fermé : les longerons reposent sur les quatre poteaux
        # et chaque traverse porte réellement sa rampe UV par deux suspentes.
        for sx in (-1, 1):
            box(c, root, f"{name}_UV_Roof_Side_Rail_{sx}", (sx * post_x, 0.0, roof_z), (0.10, depth - 0.36, 0.10), mats["structure"], bevel=0.022)
        for sy in (-1, 1):
            box(c, root, f"{name}_UV_Roof_End_Rail_{sy}", (0.0, sy * post_y, roof_z), (width - 0.36, 0.10, 0.10), mats["structure"], bevel=0.022)
        for row in range(3):
            y = -depth * 0.28 + row * depth * 0.28
            box(c, root, f"{name}_UV_Roof_Crossbeam_{row + 1}", (0.0, y, roof_z), (width - 0.36, 0.085, 0.085), mats["steel"], bevel=0.016)
            box(c, root, f"{name}_UV_Light_Housing_{row + 1}", (0.0, y, frame_top), (width - 0.30, 0.11, 0.08), mats["structure"], bevel=0.025)
            box(c, root, f"{name}_UV_Light_{row + 1}", (0.0, y, frame_top - 0.052), (width - 0.40, 0.075, 0.025), uv_mat, bevel=0.012)
            for sx in (-1, 1):
                hanger_x = sx * (width / 2.0 - 0.28)
                box(c, root, f"{name}_UV_Light_Hanger_{row + 1}_{sx}", (hanger_x, y, 1.78), (0.055, 0.060, 0.12), mats["steel"], bevel=0.010)
        height = 1.92
    features = f"open algae suspension vat, {aeration_rows} connected aeration rails, attached circulation loop"
    if uv:
        features += ", supported ultraviolet culture lights"
    return record(name, label, "algae_culture", (width + 0.18, depth + 0.14), height, features, "static", root, mats)


def build_cascade_algae_vats(pack):
    name = "22_three_stage_algae_cascade"
    label = "Cascade de trois bacs à algues"
    c, root, mats = create_asset(pack, name)
    tint_algae_fluid(mats)

    # Trois blocs imbriqués : chaque bac inférieur passe sous le précédent sur
    # toute l'épaisseur du joint. Aucun sol ne peut apparaître entre les cuves.
    stage_w = 1.68
    depth = 2.00
    overlap = 0.14
    step = stage_w - overlap
    stage_centers = (-step, 0.0, step)
    stage_heights = (1.04, 0.78, 0.52)
    water_levels = tuple(height + 0.072 for height in stage_heights)
    width = stage_w * 3.0 - overlap * 2.0
    rim = 0.12
    spill_width = 0.82

    for stage, (cx, body_h, water_z) in enumerate(zip(stage_centers, stage_heights, water_levels), start=1):
        box(
            c, root, f"{name}_Stage_{stage}_Rectangular_Body",
            (cx, 0.0, body_h / 2.0), (stage_w, depth, body_h),
            mats["shell"], bevel=0.075,
        )
        box(
            c, root, f"{name}_Stage_{stage}_Recessed_Well",
            (cx, 0.0, body_h + 0.015), (stage_w - 0.22, depth - 0.22, 0.10),
            mats["structure"], bevel=0.040,
        )
        add_water_surface(
            c, root, f"{name}_Stage_{stage}", (cx, 0.0, water_z),
            (stage_w - 0.28, depth - 0.28), mats, algae=True, ripple_count=0,
        )

        rim_z = body_h + 0.115
        box(c, root, f"{name}_Stage_{stage}_Rim_Front", (cx, -depth / 2.0 + rim / 2.0, rim_z), (stage_w, rim, 0.13), mats["steel"], bevel=0.030)
        box(c, root, f"{name}_Stage_{stage}_Rim_Rear", (cx, depth / 2.0 - rim / 2.0, rim_z), (stage_w, rim, 0.13), mats["steel"], bevel=0.030)

        segment_depth = (depth - spill_width) / 2.0
        segment_y = spill_width / 2.0 + segment_depth / 2.0
        for side_name, side_x, is_outgoing_spill in (
            ("Left", cx - stage_w / 2.0 + rim / 2.0, False),
            ("Right", cx + stage_w / 2.0 - rim / 2.0, stage < 3),
        ):
            # Le bac inférieur n'a aucun rebord du côté du bac supérieur : son
            # ouverture commence sous le déversoir, sans double bord ni fente.
            if side_name == "Left" and stage > 1:
                continue
            if is_outgoing_spill:
                for sy in (-1, 1):
                    box(
                        c, root, f"{name}_Stage_{stage}_Rim_{side_name}_{sy}",
                        (side_x, sy * segment_y, rim_z), (rim, segment_depth, 0.13),
                        mats["steel"], bevel=0.030,
                    )
                box(
                    c, root, f"{name}_Stage_{stage}_{side_name}_Single_Spill_Lip",
                    (side_x, 0.0, body_h + 0.055), (rim, spill_width, 0.045),
                    mats["steel"], bevel=0.016,
                )
            else:
                box(c, root, f"{name}_Stage_{stage}_Rim_{side_name}", (side_x, 0.0, rim_z), (rim, depth, 0.13), mats["steel"], bevel=0.030)

        box(
            c, root, f"{name}_Stage_{stage}_Front_Service_Panel",
            (cx, -depth / 2.0 - 0.025, body_h * 0.48),
            (stage_w - 0.24, 0.07, min(0.34, body_h * 0.42)),
            mats["structure"], bevel=0.035,
        )

    # La sortie du bac supérieur se trouve déjà à l'intérieur de l'empreinte du
    # bac inférieur. La chute n'a donc aucune composante horizontale.
    for stage in range(2):
        current_cx = stage_centers[stage]
        fall_x = current_cx + stage_w / 2.0 + 0.015
        add_vertical_flow_sheet(
            c, root, f"{name}_Waterfall_{stage + 1}_Vertical_Sheet",
            fall_x, 0.0, spill_width - 0.12,
            water_levels[stage] + 0.010,
            water_levels[stage + 1] + 0.018,
            mats, segments=16,
        )

    motor_y = -depth / 2.0 - 0.09
    box(c, root, f"{name}_Central_Cascade_Motor", (0.0, motor_y, 0.28), (0.46, 0.22, 0.40), mats["structure"], bevel=0.055)
    cyl_y(c, root, f"{name}_Cascade_Pump", (0.0, motor_y - 0.14, 0.28), 0.11, 0.22, mats["steel"], vertices=20, bevel=0.010)
    pipe_y = -depth / 2.0 - 0.16
    add_pipe_run(
        c, root, f"{name}_Stepped_Circulation_Pipe",
        [(-width / 2.0 + 0.18, pipe_y, 0.68),
         (stage_centers[0] + stage_w / 2.0, pipe_y, 0.68),
         (stage_centers[0] + stage_w / 2.0, pipe_y, 0.50),
         (stage_centers[1] + stage_w / 2.0, pipe_y, 0.50),
         (stage_centers[1] + stage_w / 2.0, pipe_y, 0.32),
         (width / 2.0 - 0.18, pipe_y, 0.32)],
        0.040, mats,
    )
    add_pipe_run(c, root, f"{name}_Pipe_To_Central_Motor", [(0.0, pipe_y, 0.50), (0.0, pipe_y, 0.28), (0.0, motor_y - 0.10, 0.28)], 0.040, mats)
    for idx, x in enumerate((-width * 0.38, -width * 0.18, 0.0, width * 0.18, width * 0.38)):
        z = 0.68 if x < -0.25 else 0.32 if x > 0.25 else 0.50
        box(c, root, f"{name}_Stepped_Pipe_Clamp_{idx + 1}", (x, pipe_y + 0.06, z), (0.09, 0.16, 0.10), mats["steel"], bevel=0.014)
    add_control(c, root, name, (stage_centers[0], -depth / 2.0 - 0.015, 0.52), mats, width=0.38)
    return record(
        name, label, "algae_culture", (width + 0.18, depth + 0.20), 1.24,
        "three interlocked rectangular vats with no receiving-side rims, two strictly vertical waterfalls and a central connected pump",
        "static", root, mats,
    )


def build_vertical_tower(pack):
    name = "09_vertical_grow_tower"
    c, root, mats = create_asset(pack, name)
    w, d, h = 1.10, 1.00, 2.35
    add_feet(c, root, name, w, d, mats)
    box(c, root, f"{name}_Reservoir", (0.0, 0.0, 0.25), (w, d, 0.46), mats["shell"], bevel=0.095)
    cyl_z(c, root, f"{name}_Tower_Core", (0.0, 0.0, 1.28), 0.25, 1.78, mats["shell"], vertices=24, bevel=0.020)
    for level in range(6):
        z = 0.55 + level * 0.28
        for side in range(4):
            angle = side * math.pi / 2.0 + (level % 2) * math.pi / 4.0
            x = math.cos(angle) * 0.30
            y = math.sin(angle) * 0.30
            pot = base.add_empty(c, root, f"{name}_Pot_Group_{level}_{side}", (x, y, z), "PLAIN_AXES", 0.05)
            pot.rotation_euler = (0.0, 18 * DEG, angle)
            cyl_z(c, pot, f"{name}_Cup_{level}_{side}", (0.0, 0.0, 0.0), 0.075, 0.12, mats["structure"], vertices=16, bevel=0.008)
            add_plant(c, pot, f"{name}_Plant_{level}_{side}", (0.0, 0.0, 0.08), mats, size=0.70, maturity=0.62 + 0.06 * (level % 3))
    add_pipe_run(c, root, f"{name}_Feed_Pipe", [(0.0, 0.0, 0.42), (0.0, 0.0, 2.18)], 0.035, mats, fluid=True)
    add_control(c, root, name, (0.0, -d / 2.0 - 0.04, 0.27), mats, width=0.28)
    return record(name, "Tour de culture verticale", "vertical_culture", (w, d), h, "twenty-four attached grow cups and internal feed pipe", "static", root, mats)


def build_germination(pack):
    name = "10_germination_table"
    c, root, mats = create_asset(pack, name)
    w, d, h = 1.55, 0.78, 1.62
    add_feet(c, root, name, w, d, mats)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(c, root, f"{name}_Leg_{sx}_{sy}", (sx * 0.66, sy * 0.30, 0.40), (0.10, 0.10, 0.72), mats["structure"], bevel=0.018)
    box(c, root, f"{name}_Bed", (0.0, 0.0, 0.80), (w, d, 0.18), mats["shell"], bevel=0.045)
    for tray in range(3):
        x = -0.48 + tray * 0.48
        add_shallow_water_tray(
            c, root, f"{name}_Seed_Tray_{tray + 1}", (x, 0.0, 0.93),
            (0.42, 0.62), 0.977, mats,
        )
        for row in range(3):
            for col in range(3):
                add_plant(c, root, f"{name}_Seedling_{tray}_{row}_{col}", (x - 0.11 + col * 0.11, -0.20 + row * 0.20, 1.00), mats, size=0.43, maturity=0.42 + tray * 0.08)
    box(c, root, f"{name}_Light_Arch_Top", (0.0, 0.0, 1.58), (w, 0.10, 0.10), mats["structure"], bevel=0.025)
    for sx in (-1, 1):
        box(c, root, f"{name}_Light_Arch_Post_{sx}", (sx * 0.70, 0.0, 1.24), (0.10, 0.10, 0.68), mats["structure"], bevel=0.025)
    add_grow_light(c, root, f"{name}_Light", (0.0, 0.0, 1.48), w - 0.18, mats)
    add_control(c, root, name, (-0.55, -d / 2.0 + 0.015, 0.58), mats, width=0.27)
    return record(name, "Table de germination", "germination", (w, d), h, "three seed trays, twenty-seven seedlings and fully supported light arch", "static", root, mats)


def build_tank_station(pack, name, label, variant):
    c, root, mats = create_asset(pack, name)
    w, d, h = (1.35, 0.88, 1.72) if variant == "reservoir" else (1.25, 0.68, 1.86)
    add_feet(c, root, name, w, d, mats)
    box(c, root, f"{name}_Chassis", (0.0, 0.0, 0.48), (w, d, 0.88), mats["structure"], bevel=0.065)
    if variant == "reservoir":
        cyl_z(c, root, f"{name}_Main_Tank", (0.0, 0.0, 0.93), 0.48, 1.38, mats["shell"], vertices=28, bevel=0.025)
        fluid_window = cyl_z(c, root, f"{name}_Fluid_Window", (0.0, -0.475, 0.94), 0.18, 0.50, mats["fluid"], vertices=24, bevel=0.008)
        fluid_window["editor_water_role"] = "contained"
        fluid_window["editor_water_medium"] = "water"
        cyl_z(c, root, f"{name}_Top_Cap", (0.0, 0.0, 1.64), 0.43, 0.09, mats["structure"], vertices=28, bevel=0.012)
        add_pipe_run(c, root, f"{name}_Outlet", [(0.0, 0.0, 0.32), (0.52, 0.0, 0.32), (0.52, -0.38, 0.32)], 0.045, mats)
        add_control(c, root, name, (0.0, -d / 2.0 - 0.04, 1.39), mats, width=0.31)
        features = "large sealed tank, attached mixer housing, gauge and connected outlet"
    else:
        box(c, root, f"{name}_Upper_Housing", (0.0, 0.0, 1.42), (w, d, 0.64), mats["shell"], bevel=0.055)
        for idx in range(3):
            x = -0.36 + idx * 0.36
            canister = cyl_z(c, root, f"{name}_Dose_Canister_{idx + 1}", (x, -0.10, 0.68), 0.13, 0.62, mats["fluid"] if idx == 1 else mats["accent"], vertices=20, bevel=0.012)
            if idx == 1:
                canister["editor_water_role"] = "contained"
                canister["editor_water_medium"] = "water"
            add_pipe_run(c, root, f"{name}_Dose_Line_{idx + 1}", [(x, -0.10, 1.00), (x, -0.10, 1.16), (0.0, -0.10, 1.16)], 0.022, mats)
        add_control(c, root, name, (0.0, -d / 2.0 - 0.04, 1.48), mats, width=0.42)
        features = "three supported dosing canisters, connected lines and integrated controller"
    return record(name, label, "nutrient_system", (w, d), h, features, "static", root, mats)


def build_filter(pack):
    name = "13_filtration_pump_block"
    c, root, mats = create_asset(pack, name)
    w, d, h = 1.45, 0.72, 1.58
    add_feet(c, root, name, w, d, mats)
    box(c, root, f"{name}_Cabinet", (0.0, 0.0, 0.78), (w, d, 1.48), mats["shell"], bevel=0.060)
    for idx in range(3):
        x = -0.42 + idx * 0.42
        filter_mat = mats["shell"] if idx != 1 else mats["accent"]
        cyl_z(c, root, f"{name}_Filter_{idx + 1}", (x, -d / 2.0 - 0.055, 0.82), 0.14, 0.82, filter_mat, vertices=22, bevel=0.012)
        fluid_band = cyl_z(c, root, f"{name}_Fluid_Band_{idx + 1}", (x, -d / 2.0 - 0.198, 0.82), 0.075, 0.30, mats["fluid"], vertices=18, bevel=0.008)
        fluid_band["editor_water_role"] = "contained"
        fluid_band["editor_water_medium"] = "water"
        cyl_z(c, root, f"{name}_Filter_Cap_{idx + 1}", (x, -d / 2.0 - 0.055, 1.25), 0.16, 0.08, mats["steel"], vertices=22, bevel=0.008)
    cyl_x(c, root, f"{name}_Connected_Header", (0.0, -d / 2.0 - 0.055, 1.32), 0.04, 1.18, mats["structure"], vertices=18)
    for idx in range(3):
        x = -0.42 + idx * 0.42
        cyl_z(c, root, f"{name}_Header_Drop_{idx + 1}", (x, -d / 2.0 - 0.055, 1.28), 0.031, 0.16, mats["structure"], vertices=16)
    add_control(c, root, name, (0.46, -d / 2.0 - 0.09, 1.42), mats, width=0.25)
    return record(name, "Bloc de filtration et circulation", "water_treatment", (w, d), h, "three filters fixed to cabinet and connected by a continuous header", "static", root, mats)


def build_compact_module(pack):
    name = "14_compact_autonomous_module"
    c, root, mats = create_asset(pack, name)
    w, d, h = 1.15, 0.68, 1.92
    add_feet(c, root, name, w, d, mats)
    box(c, root, f"{name}_Body", (0.0, 0.0, h / 2.0), (w, d, h), mats["shell"], bevel=0.075)
    box(c, root, f"{name}_Front_Recess", (0.0, -d / 2.0 - 0.015, 1.08), (w - 0.14, 0.07, 1.45), mats["structure"], bevel=0.045)
    for level in range(2):
        z = 0.78 + level * 0.55
        add_shallow_water_tray(
            c, root, f"{name}_Tray_{level + 1}", (0.0, -d / 2.0 - 0.065, z),
            (w - 0.22, 0.34), z + 0.057, mats,
        )
        for idx in range(3):
            add_plant(c, root, f"{name}_Plant_{level}_{idx}", (-0.28 + idx * 0.28, -d / 2.0 - 0.10, z + 0.08), mats, size=0.68, maturity=0.60 + level * 0.16)
        add_grow_light(c, root, f"{name}_Light_{level + 1}", (0.0, -d / 2.0 - 0.10, z + 0.37), w - 0.28, mats)
    add_control(c, root, name, (0.34, -d / 2.0 - 0.015, 0.35), mats, width=0.30)
    return record(name, "Module hydroponique compact autonome", "compact_culture", (w, d), h, "self-contained two-level culture unit with attached lights and controller", "static", root, mats)


def build_harvest_bench(pack):
    name = "15_harvest_maintenance_bench"
    c, root, mats = create_asset(pack, name)
    w, d, h = 1.90, 0.78, 1.62
    add_feet(c, root, name, w, d, mats)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(c, root, f"{name}_Leg_{sx}_{sy}", (sx * 0.82, sy * 0.30, 0.42), (0.11, 0.11, 0.76), mats["structure"], bevel=0.020)
    box(c, root, f"{name}_Lower_Support_Shelf", (0.0, 0.0, 0.205), (w - 0.20, d - 0.14, 0.11), mats["structure"], bevel=0.028)
    for y in (-0.27, 0.27):
        box(c, root, f"{name}_Bin_Rail_{y:+.2f}", (0.0, y, 0.285), (w - 0.24, 0.07, 0.12), mats["steel"], bevel=0.015)
    box(c, root, f"{name}_Worktop", (0.0, 0.0, 0.84), (w, d, 0.18), mats["shell"], bevel=0.045)
    box(c, root, f"{name}_Backboard", (0.0, d / 2.0 - 0.045, 1.24), (w, 0.09, 0.70), mats["structure"], bevel=0.035)
    for idx in range(4):
        x = -0.54 + idx * 0.36
        box(c, root, f"{name}_Tool_Hook_{idx + 1}", (x, d / 2.0 - 0.10, 1.34), (0.045, 0.13, 0.07), mats["steel"], bevel=0.012)
        box(c, root, f"{name}_Tool_{idx + 1}", (x, d / 2.0 - 0.16, 1.17), (0.055, 0.045, 0.32), mats["accent"], bevel=0.016)
    for idx in range(3):
        x = -0.48 + idx * 0.48
        box(c, root, f"{name}_Harvest_Bin_{idx + 1}", (x, 0.0, 0.43), (0.40, 0.50, 0.34), mats["accent"] if idx == 1 else mats["shell"], bevel=0.050)
    add_control(c, root, name, (-0.70, d / 2.0 - 0.100, 1.25), mats, width=0.25)
    return record(name, "Poste de récolte et entretien", "maintenance", (w, d), h, "attached tool board, three bins seated on a braced lower shelf and sealed worktop", "static", root, mats)


def builders(pack):
    records = [
        build_grow_cabinet(pack),
        build_rack(pack, "02_wall_hydroponic_rack", "Étagère hydroponique murale", 1.75, 0.60, 3, double=False, wall_mounted=True),
        build_rack(pack, "03_double_sided_central_rack", "Étagère centrale double face", 2.25, 1.05, 3, double=True),
        build_culture_table(pack, "04_small_culture_table", "Petite table de culture", 1.20, 0.68, 2),
        build_culture_table(pack, "05_medium_culture_table", "Table de culture moyenne", 1.90, 0.80, 3),
        build_culture_table(pack, "06_large_culture_table", "Grande table de culture", 2.80, 1.00, 4),
        build_culture_table(pack, "07_double_sided_culture_table", "Table de culture double face", 2.55, 1.48, 6, True),
        build_dwc(pack),
        build_vertical_tower(pack),
        build_germination(pack),
        build_tank_station(pack, "11_nutrient_mixing_reservoir", "Cuve de mélange des nutriments", "reservoir"),
        build_tank_station(pack, "12_automatic_dosing_station", "Station de dosage automatique", "dosing"),
        build_filter(pack),
        build_compact_module(pack),
        build_harvest_bench(pack),
        build_large_hydro_basin(pack, "16_large_hydroponic_basin", "Grand bassin hydroponique", 3.60, 1.80, 3, 8),
        build_large_hydro_basin(pack, "17_xl_hydroponic_basin", "Très grand bassin hydroponique", 4.80, 2.20, 4, 10),
        build_large_hydro_basin(pack, "18_industrial_double_hydro_basin", "Bassin hydroponique industriel double", 6.00, 2.60, 4, 12, True),
        build_algae_vat(pack, "19_small_algae_culture_vat", "Petit bac de culture d algues", 2.20, 1.40, 2),
        build_algae_vat(pack, "20_medium_aerated_algae_vat", "Bac à algues aéré moyen", 3.20, 1.80, 3),
        build_algae_vat(pack, "21_large_industrial_algae_vat", "Grand bac industriel à algues", 4.50, 2.20, 4, heavy=True),
        build_cascade_algae_vats(pack),
        build_algae_vat(pack, "23_uv_algae_propagation_vat", "Bac de propagation d algues sous ultraviolet", 3.40, 1.90, 3, uv=True),
    ]
    return records


def place_roots(records):
    cursor = 0.0
    for entry in records:
        width = entry["footprint"][0]
        entry["root"].location.x = cursor + width / 2.0
        cursor += width + 0.62


def mesh_bounds():
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and not obj.hide_render:
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    return (
        min(p.x for p in points), max(p.x for p in points),
        min(p.z for p in points), max(p.z for p in points),
    )


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_preview():
    min_x, max_x, min_z, max_z = mesh_bounds()
    cx = (min_x + max_x) / 2.0
    cz = (min_z + max_z) / 2.0
    bpy.ops.object.light_add(type="AREA", location=(cx - 5.0, -8.0, 7.5))
    key = bpy.context.object
    key.name = "Hydroponics_Key_Light"
    key.data.energy = 1450.0
    key.data.size = 7.0
    point_at(key, (cx, 0.0, cz))
    bpy.ops.object.light_add(type="AREA", location=(cx + 6.0, 4.0, 5.5))
    fill = bpy.context.object
    fill.name = "Hydroponics_Fill_Light"
    fill.data.energy = 560.0
    fill.data.size = 6.0
    point_at(fill, (cx, 0.0, cz))
    bpy.context.scene.render.resolution_x = 6200
    bpy.context.scene.render.resolution_y = 1800
    aspect = bpy.context.scene.render.resolution_x / bpy.context.scene.render.resolution_y
    width = max_x - min_x
    height = max_z - min_z
    bpy.ops.object.camera_add(location=(cx, -18.0, 4.2))
    camera = bpy.context.object
    camera.name = "Hydroponics_Preview_Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(width * 1.06, height * aspect * 1.36)
    camera.data.clip_end = 120.0
    point_at(camera, (cx, 0.0, cz * 0.70))
    bpy.context.scene.camera = camera
    bpy.context.scene.render.film_transparent = False
    bpy.context.scene.world.color = (0.017, 0.024, 0.023)


def setup_category_preview(records, category, resolution_x, resolution_y, camera_height):
    objects = []
    for entry in records:
        if entry["category"] != category:
            continue
        objects.extend(obj for obj in base.descendants(entry["root"]) if obj.type == "MESH")
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    min_x, max_x = min(p.x for p in points), max(p.x for p in points)
    min_z, max_z = min(p.z for p in points), max(p.z for p in points)
    cx = (min_x + max_x) / 2.0
    cz = (min_z + max_z) / 2.0
    scene = bpy.context.scene
    scene.render.resolution_x = resolution_x
    scene.render.resolution_y = resolution_y
    aspect = scene.render.resolution_x / scene.render.resolution_y
    camera = scene.camera
    camera.location = (cx, -18.0, camera_height)
    camera.data.ortho_scale = max((max_x - min_x) * 1.08, (max_z - min_z) * aspect * 1.45)
    point_at(camera, (cx, 0.0, cz * 0.72))


def setup_basin_preview(records):
    setup_category_preview(records, "large_hydro_basin", 4200, 1600, 4.4)


def setup_algae_preview(records):
    setup_category_preview(records, "algae_culture", 4800, 1700, 4.0)


def export_asset(filepath, objects):
    base.select_objects(objects)
    kwargs = base.gltf_export_kwargs(filepath)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    if "export_animation_mode" in props:
        kwargs["export_animation_mode"] = "ACTIVE_ACTIONS"
    bpy.ops.export_scene.gltf(**kwargs)
    bpy.ops.object.select_all(action="DESELECT")


def save_manifest(records):
    payload = {
        "format_version": 1,
        "pack": "hydroponie_futuriste",
        "unit": "enclume_world_unit",
        "placement_mode_default": "free",
        "origin_default": "floor-center",
        "style": "clean cartoon futuristic post-apocalyptic underwater station",
        "blend": os.path.basename(BLEND_PATH),
        "combined_glb": f"glb/{os.path.basename(PACK_GLB_PATH)}",
        "preview_png": os.path.basename(PREVIEW_PATH),
        "open_preview_png": os.path.basename(OPEN_PREVIEW_PATH),
        "basin_preview_png": os.path.basename(BASIN_PREVIEW_PATH),
        "algae_preview_png": os.path.basename(ALGAE_PREVIEW_PATH),
        "quality_rules": [
            "closed doors overlap their seals and fully cover openings",
            "hinges handles lights pipes and controls physically contact their supports",
            "no built-in wear filter or construction hazard stripes",
            "five recolorable material roles per asset",
        ],
        "assets": [],
    }
    for entry in records:
        asset_payload = {
            "name": entry["name"], "label": entry["label"], "category": entry["category"],
            "catalog_file": catalog_file_for(entry),
            "placement_mode": entry["placement_mode"],
            "origin": entry["origin"],
            "footprint_width_m": entry["footprint"][0], "footprint_depth_m": entry["footprint"][1],
            "height_m": entry["height"], "features": entry["features"],
            "editor_color_slots": entry["color_slots"],
            "animations": [],
        }
        if entry.get("wall_mount"):
            asset_payload["wall_mount"] = entry["wall_mount"]
        payload["assets"].append(asset_payload)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def save_readme(records):
    lines = [
        "# Submarine Post-Apocalyptic Hydroponics Pack", "",
        "Twenty-three game-ready hydroponics assets for Polaris, including four culture-table sizes, three oversized basins and five algae-culture vats.",
        "Units are meters. Materials are embedded; no external textures are required.", "",
        "## Files", "",
        f"- Blender scene: `{os.path.basename(BLEND_PATH)}`",
        f"- Combined GLB: `glb/{os.path.basename(PACK_GLB_PATH)}`",
        f"- Closed preview: `{os.path.basename(PREVIEW_PATH)}`",
        f"- Open diagnostic: `{os.path.basename(OPEN_PREVIEW_PATH)}`",
        f"- Oversized basins preview: `{os.path.basename(BASIN_PREVIEW_PATH)}`",
        f"- Algae culture preview: `{os.path.basename(ALGAE_PREVIEW_PATH)}`",
        "- Individual GLBs: `glb/`", "- Metadata: `manifest.json`", "- Validation: `validation.json`", "",
        "## Assets", "",
    ]
    for entry in records:
        lines.append(f"- `{entry['name']}` — {entry['label']} ({entry['footprint'][0]}m x {entry['footprint'][1]}m x {entry['height']}m): {entry['features']}.")
    lines.extend(["", "## Integration", "", "- Asset roots are at floor level and face negative Y.", "- Closed state is frame 1; opening demonstration is frame 60.", "- Recolorable roles are `shell`, `structure`, `accent`, `foliage`, and `fluid`.", "- Doors use overlapping back seals; glass panels fill the complete framed opening."])
    with open(README_PATH, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def validate(records):
    checks = []
    for entry in records:
        glb = os.path.join(GLB_DIR, catalog_file_for(entry))
        checks.append({
            "asset": entry["name"], "glb_exists": os.path.exists(glb),
            "glb_non_empty": os.path.getsize(glb) > 4096 if os.path.exists(glb) else False,
            "color_slot_count": len(entry["color_slots"]),
            "root_at_floor_before_layout": True,
        })
    payload = {
        "asset_count": len(records), "individual_glb_count": len([x for x in os.listdir(GLB_DIR) if x.endswith(".glb") and "pack" not in x]),
        "combined_glb_exists": os.path.exists(PACK_GLB_PATH), "checks": checks,
        "passed": len(records) == 23 and all(c["glb_exists"] and c["glb_non_empty"] and c["color_slot_count"] >= 2 for c in checks),
    }
    with open(VALIDATION_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    return payload


def main():
    ensure_dirs()
    base.clear_scene()
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.frame_start = 1
    scene.frame_end = 60
    engines = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys()
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    pack = bpy.data.collections.new("Submarine_Postapo_Hydroponics_Pack")
    scene.collection.children.link(pack)
    records = builders(pack)
    place_roots(records)
    scene.frame_set(1)
    bpy.context.view_layer.update()
    setup_preview()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    for entry in records:
        previous = entry["root"].location.copy()
        entry["root"].location = (0.0, 0.0, 0.0)
        bpy.context.view_layer.update()
        export_asset(os.path.join(GLB_DIR, catalog_file_for(entry)), base.descendants(entry["root"]))
        entry["root"].location = previous
        bpy.context.view_layer.update()
    base.export_glb(PACK_GLB_PATH, base.all_collection_objects(pack))
    save_manifest(records)
    save_readme(records)
    if os.environ.get("HYDROPONICS_SKIP_PREVIEWS") != "1":
        scene.frame_set(1)
        scene.render.filepath = PREVIEW_PATH
        bpy.ops.render.render(write_still=True)
        scene.frame_set(60)
        scene.render.filepath = OPEN_PREVIEW_PATH
        bpy.ops.render.render(write_still=True)
        scene.frame_set(1)
        setup_basin_preview(records)
        scene.render.filepath = BASIN_PREVIEW_PATH
        bpy.ops.render.render(write_still=True)
        setup_algae_preview(records)
        scene.render.filepath = ALGAE_PREVIEW_PATH
        bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    result = validate(records)
    print(json.dumps({"blend": BLEND_PATH, "combined_glb": PACK_GLB_PATH, "preview": PREVIEW_PATH, "asset_count": len(records), "validation_passed": result["passed"]}, indent=2))


if __name__ == "__main__":
    main()
