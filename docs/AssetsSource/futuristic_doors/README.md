# Submarine Post-Apocalyptic Futuristic Door Pack

Generated Blender asset pack. Units are meters.

## Files

- Master Blender scene: `submarine_postapo_futuristic_doors_pack.blend`
- Combined GLB: `glb/submarine_postapo_futuristic_doors_pack.glb`
- Preview render: `submarine_postapo_futuristic_doors_preview.png`
- Manifest: `manifest.json`

## Assets

- `01_standard_hatch_1p5x2m`: 1.5m x 2.0m, swing_left_100deg, controls on both sides.
- `02_airlock_door_1p5x2m`: 1.5m x 2.0m, pressure_swing_left_95deg, controls on both sides.
- `03_sliding_door_1p5x2m`: 1.5m x 2.0m, double_slide_x, controls on both sides.
- `04_glass_door_1p5x2m`: 1.5m x 2.0m, glass_swing_left_100deg, controls on both sides.
- `05_glass_sliding_door_1p5x2m`: 1.5m x 2.0m, double_glass_slide_x, controls on both sides.
- `06_large_hangar_door_4x3m`: 4.0m x 3.0m, large_vertical_lift_z, controls on both sides.
- `07_large_glass_hangar_door_4x3m`: 4.0m x 3.0m, large_glass_lift_z, controls on both sides.
- `08_three_part_triangular_door_1p5x2m`: 1.5m x 2.0m, three_curved_propeller_blades_center_rotate_and_slide, controls on both sides.

## Editor Color Slots

Each asset has unique recolorable material slots so the editor can recolor one door without affecting the others.
Root objects store `editor_color_slots_json`; GLB exports include extras when supported by Blender.
Common slots are `slot_01_primary_paint`, `slot_02_secondary_paint`, `slot_03_dark_hardware`, `slot_04_accent`, and, on glass assets, `slot_05_transparent_glass`.

## Wall Insert Metadata

The manifest and root extras expose `wall_cut_width_m` / `wall_cut_height_m`.
Small doors use a 1.5m x 2.0m wall cut; large hangar doors use a 4.0m x 3.0m wall cut.
Static frame, rails, lights, hinges and thresholds stay inside that cut footprint in X/Z.
Electronic control blocks intentionally overhang on the side and should not be used to enlarge the wall opening.

## Animation/Opening Notes

Swing doors use named `PIVOT_*` empties. Horizontal sliding doors use named `SLIDE_*` empties.
Large upward sliding doors use named `LIFT_*` empties.
Frame 1 is the closed pose. Frame 60 is the sample open pose.
Control blocks are static and placed on both front and back sides of each door.
