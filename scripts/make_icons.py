#!/usr/bin/env python3
"""Génère icon-192.png et icon-512.png pour la PWA, en pur stdlib (zlib + struct).

Sprite : héros pixel art 16x16 (même grille que js/sprites.js drawHero) sur
un fond violet PixelQuest. Aucune dépendance externe.
"""
import os, struct, zlib

OUT = os.path.join(os.path.dirname(__file__), '..', 'preview')

PALETTE = {
    '.': None,
    'K': (0, 0, 0, 255),
    'S': (0xf4, 0xc7, 0x9a, 255),     # peau
    'H': (0x8b, 0x45, 0x13, 255),     # cheveux
    'C': (0x3b, 0x6c, 0xb0, 255),     # cape
    'B': (0x1e, 0x1e, 0x1e, 255),     # bottes
    'E': (0x0f, 0x0f, 0x0f, 255),     # yeux
}
GRID = [
    '....KKKKKK......',
    '...KHHHHHHK.....',
    '..KHHHHHHHHK....',
    '..KHSSSSSHHK....',
    '..KSSSSSSSSK....',
    '..KSEKSSEKSK....',
    '..KSSSSSSSSK....',
    '..KSSKSSKSSK....',
    '..KKSSKKSSKK....',
    '...KCCCCCCCK....',
    '..KCCCCCCCCCK...',
    '..KCCCSSSCCCK...',
    '..KCCCCCCCCCK...',
    '...KCCCKCCCK....',
    '...KBBBKBBBK....',
    '...KBBKKBBKK....',
]

# Fond : dégradé violet -> bleu nuit, comme le thème
BG_TOP    = (0x26, 0x18, 0x47)
BG_BOTTOM = (0x0e, 0x08, 0x20)


def build_pixels(size: int):
    """Retourne bytes RGBA size*size pour PNG."""
    buf = bytearray()
    sprite_size = 16
    scale = size // sprite_size  # 12 pour 192, 32 pour 512
    pad = (size - sprite_size * scale) // 2  # 0 dans nos cas
    for y in range(size):
        # rangée par rangée
        # fond dégradé
        t = y / max(1, size - 1)
        bg = (
            int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t),
            int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t),
            int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t),
            255,
        )
        for x in range(size):
            # léger fond avec étoiles déterministes
            star = ((x * 73 + y * 131) % 997 == 0)
            if star:
                pixel = (255, 224, 74, 255)  # accent jaune
            else:
                pixel = bg
            sx = (x - pad) // scale
            sy = (y - pad) // scale
            if 0 <= sx < sprite_size and 0 <= sy < sprite_size:
                ch = GRID[sy][sx]
                col = PALETTE.get(ch)
                if col is not None:
                    pixel = col
            buf.extend(pixel)
        # NB: PNG attend un filtre par scanline, on l'ajoute ci-dessous
    return bytes(buf)


def encode_png(width: int, height: int, pixels: bytes) -> bytes:
    """Encode RGBA pixels en PNG (filter type 0 par scanline)."""
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter: None
        raw.extend(pixels[y * stride:(y + 1) * stride])
    compressor = zlib.compressobj(9)
    idat = compressor.compress(bytes(raw)) + compressor.flush()

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    return header + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')


def main():
    for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
        pixels = build_pixels(size)
        png = encode_png(size, size, pixels)
        out = os.path.join(OUT, name)
        with open(out, 'wb') as f:
            f.write(png)
        print('wrote', out, len(png), 'bytes')


if __name__ == '__main__':
    main()
