# 3d_v1: Meshy AI bicycle

- Source: `bike-meshy.fbx`, Meshy AI "Neon Bicycle Blueprint" generate stage, downloaded by Dave 2026-09-14
  (original name `Meshy_AI_Neon_Bicycle_Blueprin_0914141937_generate.fbx`, 93.3 MB, sha256 starts 9d3b8c67519f75da).
  Geometry only: 1 mesh, 1,525,991 vertices, 3,052,700 triangles, no materials, no UVs.
- `bike-full.glb`: straight Blender 5.1 export, 220 MB. Kept locally, not in git.
- `bike.glb`: decimated to 120,000 triangles in Blender (Decimate modifier), 5.8 MB. In git.
- The FBX and the full GLB are gitignored because of size; regenerate with the conversion script in the
  session notes if needed.

The hero currently uses `assets/bike.glb` (TRELLIS-2 reconstruction of the approved render). This folder is
the versioned alternative, not wired into the page.
