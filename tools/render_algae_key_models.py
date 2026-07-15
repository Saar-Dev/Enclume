import os

import bpy
from mathutils import Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "futuristic_hydroponics")


def descendants(root):
    result = []
    stack = list(root.children)
    while stack:
        obj = stack.pop()
        result.append(obj)
        stack.extend(obj.children)
    return result


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_model(root_name, filename):
    root = bpy.data.objects[root_name]
    meshes = [obj for obj in descendants(root) if obj.type == "MESH"]
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.hide_render = obj not in meshes
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    min_x, max_x = min(p.x for p in points), max(p.x for p in points)
    min_z, max_z = min(p.z for p in points), max(p.z for p in points)
    cx = (min_x + max_x) / 2.0
    cz = (min_z + max_z) / 2.0

    scene = bpy.context.scene
    scene.render.resolution_x = 2200
    scene.render.resolution_y = 1600
    aspect = scene.render.resolution_x / scene.render.resolution_y
    bpy.ops.object.camera_add(location=(cx - 0.4, -7.5, 6.2))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max((max_x - min_x) / aspect * 1.18, (max_z - min_z) * 2.1)
    point_at(camera, (cx, 0.0, cz * 0.75))
    scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(cx - 2.0, -3.0, 7.0))
    key = bpy.context.object
    key.data.energy = 1800.0
    key.data.size = 7.0
    point_at(key, (cx, 0.0, cz))
    scene.render.filepath = os.path.join(OUTPUT_DIR, filename)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(key, do_unlink=True)


bpy.context.scene.frame_set(1)
render_model("ROOT_22_three_stage_algae_cascade", "algae_cascade_diagnostic.png")
render_model("ROOT_23_uv_algae_propagation_vat", "algae_uv_vat_diagnostic.png")
render_model("ROOT_02_wall_hydroponic_rack", "wall_hydroponic_rack_diagnostic.png")
render_model("ROOT_03_double_sided_central_rack", "hydroponic_rack_roof_diagnostic.png")
render_model("ROOT_15_harvest_maintenance_bench", "harvest_bench_support_diagnostic.png")
