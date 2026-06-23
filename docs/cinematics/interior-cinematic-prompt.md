# Mazda CX-5 Interior Cinematic Prompt

## Source Frame

Use this actual WebGL render as the first-frame image reference:

`public/cinematics/source/interior-leather-cognac-first-frame.jpg`

Runtime copy used by the prototype:

`public/cinematics/interior/leather-cognac/frame_0001.jpg`

## Image-To-Video Prompt

Create an 8-second hyper-realistic cinematic video from the provided first frame.
Preserve the exact Mazda CX-5 interior layout, camera angle, steering wheel
position, dashboard geometry, infotainment screen placement, cognac leather
colour, stitching, centre console, roof console, windscreen framing, and front
seat position. Transform the digital render into a photoreal luxury automotive
interior filmed with a premium cinema camera.

The camera should perform a slow, smooth, physically plausible interior move:
a subtle forward push from the driver's seat toward the steering wheel and
centre display, with gentle parallax across the wheel, dashboard, leather door
trim, centre console, and front passenger side. Keep the movement calm and
controlled, like a high-end car configurator hero shot. Use soft studio
lighting, realistic reflections on leather and plastic, natural ambient
occlusion in seams and footwells, accurate leather grain, believable stitching,
and a clean windscreen view that does not distract from the cabin.

Output should feel like a real Mazda showroom film, not CGI. Maintain the
same composition and interior configuration for the full clip. Do not change
the car model, dashboard shape, screen content layout, steering wheel logo
placement, leather colour, trim colour, or camera direction.

## Negative Prompt

No exterior driving footage, no people, no hands, no camera shake, no warped
steering wheel, no changed dashboard layout, no extra screens, no melted logos,
no unreadable distorted UI icons, no fantasy lighting, no dramatic lens flares,
no dark underexposed cabin, no animated doors, no seat movement, no text
overlays, no new branding, no visible generation artifacts.

## Suggested Output

- Duration: 8 seconds
- Aspect: preserve source-frame composition
- Master quality: 4K if available
- Runtime export after generation: JPEG frames at 7.5-12 fps
- Prototype path: `public/cinematics/interior/leather-cognac/frame_%04d.jpg`
