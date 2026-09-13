# Realistic Motion Cues alternative

The photographic setting was generated with the built-in image-generation tool.
The final GIF is a simulated concept, not a recorded drive. Real plugin bubbles
and an illustrative phone interface are animated over this setting.
The realistic animation is now the README default. The original illustrated
GIF remains available in the showcase.

The current revision uses a black PC-style laptop, a separately animated wheel,
and a perspective road following the same acceleration and steering trajectory
as the phone. Its additional image prompts are in `REVISION-PROMPTS.md`.

Render from the repository root with
`bash demo/alternatives/realistic-v2/render.sh`.
Check motion synchronization with
`node --test demo/alternatives/realistic-v2/test-vehicle.cjs`.

## Generation prompt

Use case: sketch-to-render.
Asset type: photorealistic background plate for an animated Motion Cues demo.
Input image 1: composition reference, not a photograph. Create a separate realistic alternative, retaining its landscape 16:10 framing and object placement.
Primary request: a believable photograph taken from a car passenger's viewpoint, with a large open laptop on the passenger's denim-clad lap on the right, a smartphone in a secure console mount at lower left, a driver's steering wheel on the far left, and a countryside road visible through the windshield above. The passenger is using the laptop, not the driver.
Style: natural editorial/product photography, realistic textured black leather dashboard, satin metal laptop, detailed keyboard and trackpad, fine denim weave, natural daylight and soft window reflections. Real lens perspective, subtle material imperfections, crisp devices and readable screen areas. Not a cartoon, vector illustration, plastic-looking 3D render, or miniature model.
Composition constraints: closely preserve the reference's relative positions, especially the laptop display rectangle occupying approximately x=38% to 95%, y=32% to 88%; phone display approximately x=18% to 32%, y=58% to 94%; visible road left of laptop approximately x=8% to 37%, y=15% to 42%. Keep laptop and phone displays almost straight-on, fully unobstructed and sharply bounded, so the live desktop and accelerometer readings can be composited into them. A very slight realistic perspective is fine. Keep the top 12.5% a plain very dark navy blank caption band.
Both device displays must be flat uniform very dark navy, without any text, icons, charts, bubbles, reflections, or gradients inside the active display area. Leave physical bezels, speaker slot/camera, and glass edge reflections natural. Keep the sky, hills, road, roadside trees, cabin, laptop keyboard, and phone exterior photographic. The road should initially be straight, without cars, signs, or people. No visible digital speed reading.
Remove ALL existing lettering, UI, bubbles, arrows, connector lines and explanatory graphics from the reference. Add no brands, logos, watermark, extra devices, extra hands, or faces.
Purpose: only the photographic setting; the genuine animated plugin screen, phone's wireless accelerometer signal, and direction captions will be added afterward.
