# 3d_v2: Meshy AI bicycle, textured stage

- Source: `bike-meshy-textured.fbx`, Meshy AI "Neon Bicycle Blueprint" texture stage, downloaded by Dave 2026-09-14
  (original zip `Meshy_AI_Neon_Bicycle_Blueprin_0914143759_texture_fbx.zip`, 241.5 MB). Same geometry as 3d_v1
  (1,525,991 vertices, 3,052,700 triangles) plus one UV map and PBR maps: base color 8192^2, normal / metallic /
  roughness 4096^2 (`bike-meshy-*.png`). FBX and PNGs are gitignored because of size.
- `bike.glb`: Blender 5.1 headless, Decimate (collapse, triangulate) to 120,000 triangles / 59,641 vertices, base color
  and normal maps resized to 2048^2 and stored as JPEG q82, metallic and roughness dropped. 4.8 MB. In git.
- Look: photoreal grey/black bike. Not neon; the hero shader needs a tint if this base color is used.
- Not wired into the page. Inspect with `tools/glb-preview.html?glb=../3d/v2/bike.glb&mode=tex|holo`.
