# 3d_v3: Meshy geometry wearing the approved render

- Geometry: `3d/v2/bike.glb` (Meshy "Neon Bicycle Blueprint", decimated to 120,000 triangles), rescaled so the bike
  length (X) is 1.0 and centred on its bounding box, the same frame the hero uses for the TRELLIS mesh.
- Texture (`bike.glb`'s only map, 2048^2 JPEG, baked into the Meshy UV map):
  1. `tools/match-view.html?glb=../3d/v2/bike.glb` found the camera that reproduces `assets/hero-bike.jpg`'s view of
     this mesh (az -2.5416, el 0.23, D 2.456, target [-0.1651, -0.0389, 0.1019], fov 34; silhouette IoU 0.285, low
     because the Meshy bike has different wheel sizes and bar shape from the render) and raycast the render's ten
     anchor pixels onto the mesh.
  2. Blender 5.1 headless (`tools/bake-v3.py`, run with `blender -b --python tools/bake-v3.py`; it reads the match-view JSON from the path in its header): the render is projected through that camera onto the mesh
     (UV Project modifier), render pixels darker than 0.10 luminance or outside the frame fall back to a blueprint
     blue (0.16, 0.36, 0.72 linear), and the ten action surfaces are painted on top as ellipsoids around the matched
     anchors in the category colours from `js/colors.js` (tyre contacts are floor glows in the hero, not painted).
     Cycles bakes the emission to the UV map.
- Preview: `tools/glb-preview.html?glb=../3d/v3/bike.glb&mode=texholo&az=-2.5416&el=0.23` shows it through the hero's
  textured-hologram shader in the render's pose; `mode=tex` shows the bare map.
- Not wired into the page. To use it as the hero: point `js/hero-mesh.js` at this GLB and re-run match-view against it
  for the VIEW / ANCHORS constants (this file's frame is length 1.0, so the v2 numbers above do not apply directly).
- `view_v2.json`: the match-view output (camera + ten anchors, three.js centred frame of `3d/v2/bike.glb`) the bake reads.
