"""Remove white canvas from icon.png; keep gradient squircle + white book."""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "icons" / "icon.png"
OUT = ROOT / "icons" / "icon-transparent.png"
WHITE = 238


def remove_white_background(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()

    is_white = [
        [all(c >= WHITE for c in pixels[x, y][:3]) for x in range(w)]
        for y in range(h)
    ]
    bg = [[False] * w for _ in range(h)]
    queue = deque()

    def seed(y: int, x: int) -> None:
        if is_white[y][x] and not bg[y][x]:
            bg[y][x] = True
            queue.append((y, x))

    for x in range(w):
        seed(0, x)
        seed(h - 1, x)
    for y in range(h):
        seed(y, 0)
        seed(y, w - 1)

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and is_white[ny][nx] and not bg[ny][nx]:
                bg[ny][nx] = True
                queue.append((ny, nx))

    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                pixels[x, y] = (255, 255, 255, 0)

    return rgba


def crop_to_content(img: Image.Image, pad: int = 0) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(img.width, right + pad)
    bottom = min(img.height, bottom + pad)
    return img.crop((left, top, right, bottom))


def to_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    side = max(w, h)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return square


def save_sizes(square: Image.Image) -> None:
    icons_dir = ROOT / "icons"
    square.save(OUT, optimize=True)
    square.resize((512, 512), Image.Resampling.LANCZOS).save(
        icons_dir / "icon-512.png", optimize=True
    )
    square.resize((192, 192), Image.Resampling.LANCZOS).save(
        icons_dir / "icon-192.png", optimize=True
    )
    print(f"Saved {OUT} ({square.size[0]}x{square.size[1]})")
    print("Saved icon-512.png, icon-192.png")


def main() -> None:
    src = Image.open(SRC)
    transparent = remove_white_background(src)
    cropped = crop_to_content(transparent, pad=2)
    square = to_square(cropped)
    save_sizes(square)


if __name__ == "__main__":
    main()
