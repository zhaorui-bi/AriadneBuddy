"""Install the official Ariadne mark as the AriadneBuddy brand (build/logo.png).

This copies the original black-on-white portrait so that scripts/make_icons.py
can build the platform application icons. The UI uses the vector trace in
build/logo.svg.

Source of truth: build/logo-official.png.

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
