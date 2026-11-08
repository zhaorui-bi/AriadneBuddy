"""Install the official Ariadne mark as the AriadneBuddy brand (build/logo.png).

The canonical mark is the left portion of the official Ariadne logo (the
goddess line drawing — jeweled crown, crescent-and-stars halo, swirling hair —
black line art on a white canvas). This script copies it into place so that
scripts/make_icons.py can remove the white canvas and compose the parchment
application tiles (black-figure pottery register) from the transparent mark.

Source of truth: build/logo-official.png. To change the brand, replace that
file — never edit the generated artifacts.

Run: python3 scripts/make_ariadne_logo.py
"""

import os
import sys

from PIL import Image

HERE = os.path.dirname(__file__)
BUILD = os.path.join(HERE, '..', 'build')
SOURCE = os.path.join(BUILD, 'logo-official.png')
TARGET = os.path.join(BUILD, 'logo.png')


def main() -> None:
    if not os.path.isfile(SOURCE):
        sys.exit(
            'official mark missing: place the Ariadne logo at '
            f'{os.path.abspath(SOURCE)} (black line art on a white canvas)'
        )
    image = Image.open(SOURCE).convert('RGB')
    os.makedirs(BUILD, exist_ok=True)
    image.save(TARGET)
    print('AriadneBuddy logo installed from', os.path.abspath(SOURCE))


if __name__ == '__main__':
    main()
