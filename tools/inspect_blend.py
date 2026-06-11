"""Print object hierarchy, mesh stats and materials of a .blend file.
Run: Blender --background file.blend --python inspect_blend.py
"""
import bpy

def fmt(obj, depth=0):
    pad = "  " * depth
    info = f"{pad}- {obj.name} [{obj.type}]"
    if obj.type == "MESH":
        me = obj.data
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        mats = [m.name if m else "None" for m in me.materials]
        info += f" verts={len(me.vertices)} tris~{tris} mats={mats}"
    print(info)
    for child in sorted(obj.children, key=lambda o: o.name):
        fmt(child, depth + 1)

print("=" * 80)
print("SCENE:", bpy.context.scene.name)
print("COLLECTIONS:")
for coll in bpy.data.collections:
    print(f"  * {coll.name}: {len(coll.objects)} objects")
print("-" * 80)
print("HIERARCHY (root objects):")
roots = [o for o in bpy.data.objects if o.parent is None]
for obj in sorted(roots, key=lambda o: o.name):
    fmt(obj)
print("-" * 80)
total_tris = 0
for obj in bpy.data.objects:
    if obj.type == "MESH":
        total_tris += sum(len(p.vertices) - 2 for p in obj.data.polygons)
print(f"TOTAL OBJECTS: {len(bpy.data.objects)}  TOTAL TRIS: {total_tris}")
print("MATERIALS:")
for m in bpy.data.materials:
    print(f"  * {m.name}")
print("=" * 80)
