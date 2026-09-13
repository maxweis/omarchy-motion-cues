# Synchronized realistic revision

Built-in image generation was used for the photographic cabin edit and the
separate steering-wheel asset. Animation is simulated, not recorded driving.

## Cabin edit

Use case: precise-object-edit.
Image 1 is the edit target: preserve its photorealistic passenger-seat composition, dimensions and camera exactly.
Make only these changes:
1. Replace the silver MacBook-like laptop with a distinctly non-Apple matte charcoal-black business laptop. Angular black chassis, separate squared hinge design, slightly textured polymer palm rest, physical left/right trackpad buttons, small red pointing stick between G H B keys, conventional black PC keyboard. No Apple styling, no silver aluminum and no brand logos. Preserve the laptop screen's exact location, size, corners and flat uniform dark-navy active screen. Keep the phone, denim lap, center console, cabin trim, lighting and blank top caption band exactly unchanged.
2. Remove the entire steering wheel from the far left foreground. Reconstruct the dark dashboard and instrument panel naturally behind it, with a small neutral steering column boss low on the far left. No steering wheel rim or spokes remain. This is a background plate for a separately animated wheel that will be placed back there.
Preserve the windshield view and its road, sky, trees and mountains unchanged. Keep the phone screen blank, flat dark navy. No UI, annotations, bubbles, captions, hands, people, branding or watermarks. Photorealistic material detail and existing daylight, not a 3D-rendered illustration.

## Steering wheel

Use case: product-mockup.
Asset type: isolated photorealistic steering wheel layer for an animated car interior.
Primary request: one complete circular black leather car steering wheel with a compact dark padded center hub and three distinct brushed dark-metal spokes at nine, three, and six o'clock. Round rim, no flat bottom. A tiny neutral gray alignment stitch at twelve o'clock. Fine natural black leather grain and realistic seam stitching. No branding, no logo, no lettering.
Composition: dead straight-on orthographic front view, centered on a square image, wheel outer edge fills 92% of the square with equal transparent margin all around. Complete uncropped circle. The plane of the wheel is parallel to the camera; not a tilted or oblique ellipse. Natural soft daylight from upper right, restrained highlights, understated realistic everyday car component. Not a vector icon or cartoon.
Background: genuinely transparent alpha around the entire silhouette AND inside all openings between the spokes and rim. No dashboard, no car, no column, no shadow outside the wheel, no hands, no checkerboard baked into pixels. This will be perspective-mapped and rotated as a sprite in a photographic passenger cabin.

## Moving ground texture

Use case: photorealistic-natural.
Asset type: seamless top-down ground texture for a photographic driving animation.
An exactly overhead orthographic photograph of a perfectly straight rural asphalt road running vertically through the exact center of a square image. The complete image covers 35 metres by 35 metres. The road is 7 metres wide, occupying exactly the central 20 percent of the image width, from x=40% to x=60%. The asphalt is neutral mid-gray with subtle realistic aggregate and irregular natural wear, no potholes. Narrow pale gravel shoulders flank the road. The other 80 percent is flat countryside meadow with finely detailed uneven yellow-green grasses, matching a naturally sunny rural roadside.
NO painted road markings at all: no dashed line, no edge lines, no symbols. No trees, fences, vehicles, signs, buildings, people, shadows of objects, perspective, hills or sky. Road perfectly vertical and parallel, not curved.
Seamlessly tileable from top edge to bottom edge and left edge to right edge. Even natural midday light with detailed photographic surfaces, not flat color, not an illustration or stylized videogame texture. This will be perspective-projected, bent and scrolled by code, with road markings added separately.

## Windshield panorama

Use case: photorealistic-natural.
Asset type: wide photographic background panorama for the moving view through a car windshield.
Primary request: a natural countryside panorama matching soft bright midday sun, with low distant rolling forested hills, a layer of mature green trees and a level dry yellow-green meadow in front. Horizon perfectly level. Wide landscape 3:1 framing. Upper 48 percent is pale blue sky with faint soft clouds, middle 40 percent distant low forested hills and trees, lower 12 percent a flat muted sage-green and straw meadow that reaches the bottom edge. Natural fine realistic detail, slight distance haze, subdued greens and straw, no oversaturated lime or yellow.
The distant hills are low, not dramatic peaks. No objects close to the camera. Sunlight from upper right but NO visible sun flare. No car interior, windshield, steering wheel, laptop, people, buildings, water, road or lane lines anywhere. No foreground tree trunks, no signs, fences or poles. This is ONLY distant landscape and sky to pan behind a stationary car interior; moving road and foreground meadow will be rendered separately. No text, logos, artificial graphics or watermarks. Photographic, not a painting or 3D model.
