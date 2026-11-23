"""Rebuild every AriadneBuddy icon from the canonical brand logo.

This script places the portrait in ``build/logo.png`` on a marble plaque: the
warm parchment tile of the AriadneBuddy appearance layer, carrying an engraved
double hairline rule. The UI uses the vector trace in ``build/logo.svg``.

Outputs:
  build/icon.png        1024x1024 app icon
  build/icon.ico        multi-size Windows icon
  build/icon.iconset/   macOS iconset (iconutil -c icns -> build/icon.icns)

Run:  python3 scripts/make_icons.py && iconutil -c icns build/icon.iconset -o build/icon.icns
"""

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
RADIUS = 225
LOGO_SCALE = 0.72  # symbol diameter as a fraction of the icon size
# Marble plaque: the parchment tile of theme/appearance.css, light to shadow.
MARBLE_TOP = (247, 244, 237)
MARBLE_BOTTOM = (228, 222, 210)
# Engraved double rule: outer hairline reads, inner hairline echoes it.
RULE_OUTER = (36, 36, 36, 96)
RULE_INNER = (36, 36, 36, 54)
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', 'build')
LOGO = os.path.join(OUT, 'logo.png')


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new('L', (size * 4, size * 4), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size * 4, size * 4], radius=radius * 4, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def remove_white(img: Image.Image, cutoff: int = 4) -> Image.Image:
    """Convert black-on-white pixels to black ink with antialiased edges."""
    alpha = img.convert('L').point(lambda value: 255 - value if value < 255 - cutoff else 0)
    mark = Image.new('RGBA', img.size)
    mark.putalpha(alpha)
    return mark


def tight_bbox(img: Image.Image) -> Image.Image:
    bbox = img.getchannel('A').point(lambda px: 255 if px > 12 else 0).getbbox()
    return img.crop(bbox) if bbox else img


def resized_to_fit(img: Image.Image, target: int) -> Image.Image:
    ratio = min(target / img.width, target / img.height)
    width = max(1, round(img.width * ratio))
    height = max(1, round(img.height * ratio))
    resized = img.resize((width, height), Image.LANCZOS)
    if ratio > 1.0:
        radius = min(1.6, max(0.6, ratio * 0.28))
        resized = resized.filter(ImageFilter.UnsharpMask(radius=radius, percent=125, threshold=2))
    return resized


def marble_canvas(size: int) -> Image.Image:
    """Create a warm marble tile with a soft raking highlight."""
    yy, xx = np.mgrid[0:size, 0:size]
    nx = xx / max(1, size - 1)
    ny = yy / max(1, size - 1)
    channels = []
    for index in range(3):
        top = MARBLE_TOP[index]
        bottom = MARBLE_BOTTOM[index]
        channels.append(top * (1.0 - ny) + bottom * ny)
    # A single soft highlight, as if light rakes across the slab from above.
    center = np.exp(-(((nx - 0.5) / 0.62) ** 2 + ((ny - 0.38) / 0.66) ** 2)) * 0.10
    rgb = np.stack(
        [channel * (1.0 - center) + 255.0 * center for channel in channels], axis=-1
    )
    return Image.fromarray(rgb.astype(np.uint8)).convert('RGBA')


def fit_on_canvas(logo: Image.Image, size: int, scale: float) -> Image.Image:
    canvas = marble_canvas(size)
    target = int(size * scale)
    logo = resized_to_fit(logo, target)
    x = (size - logo.width) // 2
    y = (size - logo.height) // 2

    canvas.alpha_composite(logo, (x, y))

    draw = ImageDraw.Draw(canvas)
    inset = max(2, round(size * 0.027))
    radius = round(size * 0.195)
    # Outer hairline, then the inner hairline that makes it a double rule.
    draw.rounded_rectangle(
        [inset, inset, size - inset - 1, size - inset - 1],
        radius=radius,
        outline=RULE_OUTER,
        width=max(2, round(size / 512)),
    )
    rule_gap = max(3, round(size * 0.011))
    inner = inset + rule_gap
    draw.rounded_rectangle(
        [inner, inner, size - inner - 1, size - inner - 1],
        radius=max(1, radius - rule_gap),
        outline=RULE_INNER,
        width=max(1, round(size / 1024)),
    )
    return canvas


def main() -> None:
    with Image.open(LOGO) as artwork:
        source = tight_bbox(remove_white(artwork))
    icon_rgba = fit_on_canvas(source, SIZE, LOGO_SCALE)
    final = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    final.paste(icon_rgba, (0, 0), rounded_mask(SIZE, RADIUS))

    final.save(os.path.join(OUT, 'icon.png'))
    final.save(
        os.path.join(OUT, 'icon.ico'),
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
    )

    iconset = os.path.join(OUT, 'icon.iconset')
    os.makedirs(iconset, exist_ok=True)
    for s in (16, 32, 128, 256, 512):
        final.resize((s, s), Image.LANCZOS).save(os.path.join(iconset, f'icon_{s}x{s}.png'))
        final.resize((s * 2, s * 2), Image.LANCZOS).save(os.path.join(iconset, f'icon_{s}x{s}@2x.png'))
    print('icons rebuilt from', LOGO, '(marble plaque with an engraved double rule)')


if __name__ == '__main__':
    main()
