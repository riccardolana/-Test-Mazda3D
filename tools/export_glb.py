"""Export the CX-5 blend to GLB preserving node names/hierarchy.
Run: Blender --background file.blend --python export_glb.py -- /abs/out.glb
"""
import bpy
import sys

out = sys.argv[sys.argv.index("--") + 1]

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
)
print("EXPORTED:", out)
