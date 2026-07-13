import json
import sys

import bpy
from mathutils import Vector


def world_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return {
        "min_x": min(point.x for point in points),
        "max_x": max(point.x for point in points),
        "min_y": min(point.y for point in points),
        "max_y": max(point.y for point in points),
        "min_z": min(point.z for point in points),
        "max_z": max(point.z for point in points),
    }


def descendants(root):
    result = []
    stack = list(root.children)
    while stack:
        obj = stack.pop()
        result.append(obj)
        stack.extend(obj.children)
    return result


def touches_from_above(upper, lower, tolerance=0.012):
    upper_bounds = world_bounds(upper)
    lower_bounds = world_bounds(lower)
    overlaps_x = upper_bounds["min_x"] < lower_bounds["max_x"] and upper_bounds["max_x"] > lower_bounds["min_x"]
    overlaps_y = upper_bounds["min_y"] < lower_bounds["max_y"] and upper_bounds["max_y"] > lower_bounds["min_y"]
    vertical_gap = upper_bounds["min_z"] - lower_bounds["max_z"]
    return overlaps_x and overlaps_y and abs(vertical_gap) <= tolerance


checks = []

shelf = bpy.data.objects["15_harvest_maintenance_bench_Lower_Support_Shelf"]
for index in range(1, 4):
    item = bpy.data.objects[f"15_harvest_maintenance_bench_Harvest_Bin_{index}"]
    checks.append({"name": f"harvest_bin_{index}_supported", "passed": touches_from_above(item, shelf)})

for asset in ("02_wall_hydroponic_rack", "03_double_sided_central_rack"):
    roof = bpy.data.objects[f"{asset}_Structural_Roof"]
    for side in (-1, 1):
        mount = bpy.data.objects[f"{asset}_Light_3_Mount_{side}"]
        mount_bounds = world_bounds(mount)
        roof_bounds = world_bounds(roof)
        touches_roof = mount_bounds["max_z"] >= roof_bounds["min_z"] - 0.012
        checks.append({"name": f"{asset}_top_light_mount_{side}_supported", "passed": touches_roof})

grow_light_housings = [
    obj for obj in bpy.context.scene.objects
    if obj.type == "MESH" and obj.name.endswith("_Light_Housing") and "_UV_" not in obj.name
]
for light in grow_light_housings:
    prefix = light.name[:-len("_Light_Housing")]
    beam = bpy.data.objects.get(f"{prefix}_Support_Top_Beam")
    posts = [bpy.data.objects.get(f"{prefix}_Support_Post_{side}") for side in (-1, 1)]
    checks.append({
        "name": f"{prefix}_has_complete_self_supporting_frame",
        "passed": beam is not None and all(post is not None for post in posts),
    })
    if beam is not None and all(post is not None for post in posts):
        checks.append({
            "name": f"{prefix}_frame_physically_connected",
            "passed": all(world_bounds(post)["max_z"] >= world_bounds(beam)["min_z"] - 0.012 for post in posts),
        })

uv_asset = "23_uv_algae_propagation_vat"
for row in range(1, 4):
    light = bpy.data.objects[f"{uv_asset}_UV_Light_Housing_{row}"]
    crossbeam = bpy.data.objects[f"{uv_asset}_UV_Roof_Crossbeam_{row}"]
    for side in (-1, 1):
        hanger = bpy.data.objects[f"{uv_asset}_UV_Light_Hanger_{row}_{side}"]
        checks.append({
            "name": f"uv_light_{row}_hanger_{side}_touches_light",
            "passed": world_bounds(hanger)["min_z"] <= world_bounds(light)["max_z"] + 0.012,
        })
        checks.append({
            "name": f"uv_light_{row}_hanger_{side}_touches_roof",
            "passed": world_bounds(hanger)["max_z"] >= world_bounds(crossbeam)["min_z"] - 0.012,
        })

water_nodes = [
    obj for obj in bpy.context.scene.objects
    if obj.type == "MESH" and obj.get("editor_water_role")
]
checks.append({"name": "runtime_water_nodes_present", "passed": len(water_nodes) >= 20, "count": len(water_nodes)})
checks.append({
    "name": "runtime_water_roles_valid",
    "passed": all(obj.get("editor_water_role") in {"surface", "flow", "contained"} for obj in water_nodes),
})

flow_nodes = [obj for obj in water_nodes if obj.get("editor_water_role") == "flow"]
checks.append({"name": "cascade_has_two_vertical_flow_sheets", "passed": len(flow_nodes) == 2, "count": len(flow_nodes)})
checks.append({
    "name": "cascade_flows_are_strictly_vertical",
    "passed": all(
        world_bounds(obj)["max_x"] - world_bounds(obj)["min_x"] <= 0.005
        and world_bounds(obj)["max_z"] - world_bounds(obj)["min_z"] >= 0.20
        for obj in flow_nodes
    ),
})
checks.append({
    "name": "cascade_has_no_primitive_streams",
    "passed": not any("Waterfall" in obj.name and "Stream" in obj.name for obj in bpy.context.scene.objects),
})

cascade_bodies = [
    bpy.data.objects[f"22_three_stage_algae_cascade_Stage_{stage}_Rectangular_Body"]
    for stage in range(1, 4)
]
body_bounds = [world_bounds(body) for body in cascade_bodies]
body_overlaps = [body_bounds[index]["max_x"] - body_bounds[index + 1]["min_x"] for index in range(2)]
checks.append({
    "name": "cascade_lower_vats_interlock_under_upper_vats",
    "passed": all(0.10 <= overlap <= 0.18 for overlap in body_overlaps),
    "overlaps": body_overlaps,
})
checks.append({
    "name": "cascade_receiving_sides_have_no_rim",
    "passed": all(
        bpy.data.objects.get(f"22_three_stage_algae_cascade_Stage_{stage}_Rim_Left") is None
        and not any(obj.name.startswith(f"22_three_stage_algae_cascade_Stage_{stage}_Rim_Left_") for obj in bpy.context.scene.objects)
        for stage in (2, 3)
    ),
})

wall_rack_root = bpy.data.objects["ROOT_02_wall_hydroponic_rack"]
checks.append({
    "name": "wall_rack_declares_wall_back_origin",
    "passed": wall_rack_root.get("placement_mode") == "wall" and wall_rack_root.get("origin") == "wall-back-center",
})
checks.append({
    "name": "wall_rack_has_no_floor_feet",
    "passed": not any("02_wall_hydroponic_rack_Foot_" in obj.name for obj in bpy.context.scene.objects),
})
wall_plates = [obj for obj in bpy.context.scene.objects if "02_wall_hydroponic_rack_Wall_Mounting_Plate_" in obj.name]
checks.append({
    "name": "wall_rack_has_four_flush_mounting_plates",
    "passed": len(wall_plates) == 4 and all(abs(world_bounds(obj)["max_y"]) <= 0.005 for obj in wall_plates),
    "count": len(wall_plates),
})
wall_rack_meshes = [obj for obj in descendants(wall_rack_root) if obj.type == "MESH"]
checks.append({
    "name": "wall_rack_never_crosses_behind_wall_plane",
    "passed": all(world_bounds(obj)["max_y"] <= 0.005 for obj in wall_rack_meshes),
})

forbidden_volume_names = ("Contained_Water", "Water_Volume", "Algae_Liquid")
checks.append({
    "name": "no_overlapping_free_water_volumes",
    "passed": not any(any(token in obj.name for token in forbidden_volume_names) for obj in bpy.context.scene.objects),
})

payload = {
    "passed": all(check["passed"] for check in checks),
    "checks": checks,
}
print(json.dumps(payload, indent=2, ensure_ascii=False))
if not payload["passed"]:
    sys.exit(1)
