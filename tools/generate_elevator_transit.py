"""Génère les huit cabines modulaires du système d’ascenseur Enclume.

Usage : blender --background --python tools/generate_elevator_transit.py
"""

import json
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "elevator_transit"
GLB_DIR = OUT / "glb"
HEIGHT = 2.2
VARIANTS = [
    ("industrial", 1, 1, "Ascenseur industriel 1 × 1"),
    ("industrial", 1, 2, "Ascenseur industriel 1 × 2"),
    ("industrial", 2, 1, "Ascenseur industriel 2 × 1"),
    ("industrial", 2, 2, "Ascenseur industriel 2 × 2"),
    ("glass", 1, 1, "Ascenseur vitré 1 × 1"),
    ("glass", 1, 2, "Ascenseur vitré 1 × 2"),
    ("glass", 2, 1, "Ascenseur vitré 2 × 1"),
    ("glass", 2, 2, "Ascenseur vitré 2 × 2"),
]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for groups in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for block in list(groups):
            if block.users == 0:
                groups.remove(block)


def collection(name, parent):
    result = bpy.data.collections.new(name)
    parent.children.link(result)
    return result


def link_only(obj, target):
    target.objects.link(obj)
    for source in list(obj.users_collection):
        if source != target:
            source.objects.unlink(obj)


def empty(target, name):
    obj = bpy.data.objects.new(name, None)
    target.objects.link(obj)
    return obj


def material(name, color, metallic, roughness, emission=None, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, alpha)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    alpha_input = bsdf.inputs.get("Alpha")
    if alpha_input:
        alpha_input.default_value = alpha
    if emission:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = (*emission, 1)
        strength = bsdf.inputs.get("Emission Strength")
        if strength:
            strength.default_value = 4.0
    if alpha < 1:
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = "DITHERED"
        elif hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"
        mat.use_screen_refraction = False
    return mat


def materials(asset, style):
    primary = (0.055, 0.13, 0.17) if style == "industrial" else (0.12, 0.22, 0.27)
    secondary = (0.17, 0.29, 0.33) if style == "industrial" else (0.36, 0.55, 0.62)
    return {
        "primary": material(f"{asset}__SLOT_01__Primary_Metal", primary, 0.76, 0.3),
        "secondary": material(f"{asset}__SLOT_02__Secondary_Panels", secondary, 0.62, 0.34),
        "hardware": material(f"{asset}__SLOT_03__Frame_Hardware", (0.012, 0.02, 0.026), 0.9, 0.2),
        "accent": material(f"{asset}__SLOT_04__Safety_Accent", (1.0, 0.25, 0.025), 0.42, 0.32, emission=(0.22, 0.025, 0.002)),
        "glass": material(f"{asset}__SLOT_05__Cabin_Glass", (0.04, 0.5, 0.7), 0.08, 0.12, emission=(0.0, 0.07, 0.12), alpha=0.24),
        "light": material(f"{asset}__FIXED__Ceiling_Light", (0.35, 0.9, 1.0), 0.02, 0.12, emission=(0.16, 0.68, 1.0)),
        "floor": material(f"{asset}__FIXED__Non_Slip_Floor", (0.055, 0.065, 0.07), 0.68, 0.5),
    }


def bevel(obj, amount=0.008, segments=2):
    modifier = obj.modifiers.new("edge_softening", "BEVEL")
    modifier.width = amount
    modifier.segments = segments
    return obj


def box(target, parent, name, location, dimensions, mat, amount=0.008):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = name
    link_only(obj, target)
    obj.parent = parent
    obj.location = location
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return bevel(obj, amount)


def cylinder(target, parent, name, location, radius, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=depth)
    obj = bpy.context.object
    obj.name = name
    link_only(obj, target)
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    return bevel(obj, 0.003, 1)


def build_cabin(target, root, asset, style, width, depth):
    mats = materials(asset, style)
    inset = 0.055
    frame = 0.065 if style == "industrial" else 0.045
    # Plancher technique réellement dimensionné pour la variante, avec plaques distinctes.
    box(target, root, "Floor_Base", (0, 0, 0.045), (width - inset * 2, depth - inset * 2, 0.09), mats["floor"], 0.012)
    plate_count_x = max(1, width * 2)
    plate_count_y = max(1, depth * 2)
    for ix in range(plate_count_x):
        for iy in range(plate_count_y):
            plate_w = (width - 0.16) / plate_count_x
            plate_d = (depth - 0.16) / plate_count_y
            x = -width / 2 + 0.08 + plate_w * (ix + 0.5)
            y = -depth / 2 + 0.08 + plate_d * (iy + 0.5)
            box(target, root, f"Floor_Plate_{ix}_{iy}", (x, y, 0.101), (plate_w - 0.018, plate_d - 0.018, 0.018), mats["secondary"], 0.003)

    # Cadre quatre faces : toutes restent compatibles avec une future porte palière.
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(target, root, f"Corner_Post_{sx}_{sy}", (sx * (width / 2 - frame / 2), sy * (depth / 2 - frame / 2), HEIGHT / 2), (frame, frame, HEIGHT), mats["hardware"], 0.01)
    for z, tag in ((0.11, "Lower"), (HEIGHT - 0.08, "Upper")):
        box(target, root, f"{tag}_Rail_North", (0, -depth / 2 + frame / 2, z), (width, frame, frame), mats["primary"], 0.008)
        box(target, root, f"{tag}_Rail_South", (0, depth / 2 - frame / 2, z), (width, frame, frame), mats["primary"], 0.008)
        box(target, root, f"{tag}_Rail_West", (-width / 2 + frame / 2, 0, z), (frame, depth, frame), mats["primary"], 0.008)
        box(target, root, f"{tag}_Rail_East", (width / 2 - frame / 2, 0, z), (frame, depth, frame), mats["primary"], 0.008)

    # Traverses et mains courantes internes adaptées à chacune des quatre dimensions.
    for side, y in (("North", -depth / 2 + 0.075), ("South", depth / 2 - 0.075)):
        box(target, root, f"Handrail_{side}", (0, y, 1.0), (max(0.5, width - 0.22), 0.045, 0.055), mats["secondary"], 0.012)
    for side, x in (("West", -width / 2 + 0.075), ("East", width / 2 - 0.075)):
        box(target, root, f"Handrail_{side}", (x, 0, 1.0), (0.045, max(0.5, depth - 0.22), 0.055), mats["secondary"], 0.012)

    # Un bandeau de verre par côté donne une lecture immédiate à la version vitrée sans fermer ses portes.
    if style == "glass":
        box(target, root, "Glass_Band_North", (0, -depth / 2 + 0.035, 1.37), (width - 0.16, 0.022, 0.26), mats["glass"], 0.004)
        box(target, root, "Glass_Band_South", (0, depth / 2 - 0.035, 1.37), (width - 0.16, 0.022, 0.26), mats["glass"], 0.004)
        box(target, root, "Glass_Band_West", (-width / 2 + 0.035, 0, 1.37), (0.022, depth - 0.16, 0.26), mats["glass"], 0.004)
        box(target, root, "Glass_Band_East", (width / 2 - 0.035, 0, 1.37), (0.022, depth - 0.16, 0.26), mats["glass"], 0.004)
    else:
        for sx in (-1, 1):
            box(target, root, f"Industrial_Corner_Brace_{sx}", (sx * (width / 2 - 0.09), -depth / 2 + 0.055, 1.56), (0.12, 0.04, 0.42), mats["primary"], 0.01)

    # Plafond nervuré, éclairage froid et pupitre compact sans privilégier une face de porte.
    box(target, root, "Ceiling_Frame", (0, 0, HEIGHT - 0.035), (width - 0.12, depth - 0.12, 0.07), mats["hardware"], 0.01)
    light_count = max(1, width)
    for index in range(light_count):
        x = (index - (light_count - 1) / 2) * 0.56
        box(target, root, f"Ceiling_Light_{index}", (x, 0, HEIGHT - 0.078), (0.34, min(0.42, depth - 0.22), 0.022), mats["light"], 0.008)
    console_x = -width / 2 + 0.13
    console_y = depth / 2 - 0.085
    box(target, root, "Cabin_Control_Housing", (console_x, console_y, 1.25), (0.18, 0.055, 0.62), mats["hardware"], 0.018)
    box(target, root, "Cabin_Control_Screen", (console_x, console_y - 0.032, 1.42), (0.13, 0.018, 0.19), mats["glass"], 0.006)
    for index in range(3):
        cylinder(target, root, f"Cabin_Control_Button_{index}", (console_x, console_y - 0.04, 1.24 - index * 0.11), 0.026, 0.018, mats["accent"])


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
        "filepath": str(path), "export_format": "GLB", "use_selection": True,
        "export_apply": True, "export_materials": "EXPORT", "export_extras": True,
        "export_yup": True,
    }
    bpy.ops.export_scene.gltf(**{key: value for key, value in desired.items() if key in properties})


def editor_slots(asset):
    return [
        {"id": "primary", "code": "SLOT_01", "label": "Métal principal", "default_hex": "#0E222B", "material_names": [f"{asset}__SLOT_01__Primary_Metal"]},
        {"id": "secondary", "code": "SLOT_02", "label": "Panneaux secondaires", "default_hex": "#2B4A54", "material_names": [f"{asset}__SLOT_02__Secondary_Panels"]},
        {"id": "hardware", "code": "SLOT_03", "label": "Cadre et mécanismes", "default_hex": "#030507", "material_names": [f"{asset}__SLOT_03__Frame_Hardware"]},
        {"id": "accent", "code": "SLOT_04", "label": "Signalétique", "default_hex": "#FF4006", "material_names": [f"{asset}__SLOT_04__Safety_Accent"]},
        {"id": "glass", "code": "SLOT_05", "label": "Verre", "default_hex": "#0A80B3", "transparent": True, "material_names": [f"{asset}__SLOT_05__Cabin_Glass"]},
    ]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    GLB_DIR.mkdir(parents=True, exist_ok=True)
    clear_scene()
    pack = collection("Elevator_Transit", bpy.context.scene.collection)
    assets = []
    for index, (style, width, depth, label) in enumerate(VARIANTS):
        asset = f"{index + 1:02d}_{style}_{width}x{depth}"
        target = collection(asset, pack)
        root = empty(target, f"ROOT_{asset}")
        root["connector_type"] = "elevator"
        root["elevator_style"] = style
        root["footprint_width"] = width
        root["footprint_depth"] = depth
        build_cabin(target, root, asset, style, width, depth)
        export_glb(GLB_DIR / f"{asset}.glb", descendants(root))
        root.location = ((index % 4 - 1.5) * 2.7, (index // 4 - 0.5) * 3.4, 0)
        assets.append({
            "name": asset,
            "label": label,
            "catalog_file": f"{asset}.glb",
            "category": "Ascenseurs",
            "connector_type": "elevator",
            "placement_mode": "connector",
            "origin": "floor-center",
            "footprint_width_m": width,
            "footprint_depth_m": depth,
            "height_m": HEIGHT,
            "elevator_style": style,
            "door_face_width_x_m": depth,
            "door_face_width_z_m": width,
            "supported_door_orientations": ["north", "east", "south", "west"],
            "features": ["four-face-modular-doors", "orthogonal-route", "sealed-shaft", "independent-landing-doors"],
            "editor_color_slots": editor_slots(asset),
        })
    manifest = {
        "pack": "elevator_transit",
        "label": "Ascenseurs et transport orthogonal",
        "version": 1,
        "unit": "enclume_world_unit",
        "placement_mode_default": "connector",
        "origin_default": "floor-center",
        "assets": assets,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "README.md").write_text(
        "# Ascenseurs et transport orthogonal\n\n"
        "Huit cabines distinctes : industriel et vitré, chacun en 1×1, 1×2, 2×1 et 2×2. "
        "Les variantes 1×2 et 2×1 sont assemblées séparément : leur largeur de porte dépend de la face choisie. "
        "Les GLB portent le cadre, le plancher détaillé, les mains courantes, l’éclairage et le pupitre ; "
        "les portes et panneaux de gaine restent modulaires côté moteur afin de suivre chaque arrêt.\n",
        encoding="utf-8",
    )
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "elevator_transit_pack.blend"))
    print(f"Generated {len(assets)} elevator models in {OUT}")


if __name__ == "__main__":
    main()
