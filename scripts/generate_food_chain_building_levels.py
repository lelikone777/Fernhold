from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]

SRC_FINAL = ROOT / "src/assets/visual/buildings/final"
SRC_PLACEHOLDERS = ROOT / "src/assets/visual/buildings/placeholders"
PUB_FINAL = ROOT / "public/assets/visual/buildings/final"
PUB_PLACEHOLDERS = ROOT / "public/assets/visual/buildings/placeholders"

OUTPUT_FINAL_DIRS = [SRC_FINAL, PUB_FINAL]
OUTPUT_PLACEHOLDER_DIRS = [SRC_PLACEHOLDERS, PUB_PLACEHOLDERS]

TARGET_FAMILIES = {
    "pasture": {
        "base": "stable.png",
        "tint": (118, 162, 93),
        "names": [f"pasture_level_{i}" for i in range(1, 6)],
    },
    "butcher_shop": {
        "base": "bakery.png",
        "tint": (176, 99, 86),
        "names": [f"butcher_shop_level_{i}" for i in range(1, 6)],
    },
    "dairy": {
        "base": "farmhouse.png",
        "tint": (210, 198, 145),
        "names": [f"dairy_level_{i}" for i in range(1, 6)],
    },
    "creamery": {
        "base": "workshop.png",
        "tint": (216, 185, 112),
        "names": [f"creamery_level_{i}" for i in range(1, 6)],
    },
    "smokehouse": {
        "base": "bakery.png",
        "tint": (110, 82, 69),
        "names": [f"smokehouse_level_{i}" for i in range(1, 6)],
    },
    "kitchen": {
        "base": "tavern_level_1.png",
        "tint": (182, 122, 79),
        "names": [f"kitchen_level_{i}" for i in range(1, 6)],
    },
}


def blend_with_tint(base: Image.Image, tint_rgb: tuple[int, int, int], alpha: float) -> Image.Image:
    tint = Image.new("RGBA", base.size, (*tint_rgb, int(255 * alpha)))
    return Image.alpha_composite(base, tint)


def add_level_details(image: Image.Image, level: int, accent: tuple[int, int, int]) -> Image.Image:
    out = image.copy()
    draw = ImageDraw.Draw(out, "RGBA")
    width, height = out.size

    cx = width // 2
    base_y = int(height * 0.74)
    scale = width / 1254

    badge_w = int(128 * scale)
    badge_h = int(70 * scale)
    badge_x0 = int(width * 0.06)
    badge_y0 = int(height * 0.06)
    badge_x1 = badge_x0 + badge_w
    badge_y1 = badge_y0 + badge_h

    draw.rounded_rectangle(
        (badge_x0, badge_y0, badge_x1, badge_y1),
        radius=int(16 * scale),
        fill=(24, 26, 30, 170),
        outline=(230, 208, 160, 200),
        width=max(1, int(3 * scale)),
    )

    stars = "I" * level
    draw.text((badge_x0 + int(16 * scale), badge_y0 + int(18 * scale)), stars, fill=(245, 226, 171, 240))

    for idx in range(level - 1):
        offset = idx - (level - 2) / 2
        ax = int(cx + offset * 95 * scale)
        ay = int(base_y - 100 * scale - (idx % 2) * 16 * scale)
        aw = int(72 * scale)
        ah = int(44 * scale)
        draw.rounded_rectangle(
            (ax - aw // 2, ay - ah // 2, ax + aw // 2, ay + ah // 2),
            radius=int(10 * scale),
            fill=(*accent, 70),
            outline=(28, 22, 18, 120),
            width=max(1, int(2 * scale)),
        )

    roof_y = int(height * 0.32)
    roof_h = int((8 + level * 3) * scale)
    draw.rectangle(
        (int(width * 0.28), roof_y, int(width * 0.72), roof_y + roof_h),
        fill=(*accent, 95),
    )

    vent_count = min(5, 1 + level // 2)
    for i in range(vent_count):
        vx = int(width * (0.34 + i * 0.08))
        vy = int(height * 0.22) - int(i % 2 * 12 * scale)
        vw = int(22 * scale)
        vh = int(34 * scale)
        draw.rectangle((vx, vy, vx + vw, vy + vh), fill=(46, 40, 38, 170), outline=(14, 12, 10, 180))
        draw.rectangle((vx + int(3 * scale), vy - int(18 * scale), vx + vw - int(3 * scale), vy), fill=(82, 74, 66, 170))

    return out


def make_placeholder(image: Image.Image, family: str, level: int) -> Image.Image:
    resized = image.resize((96, 96), Image.Resampling.LANCZOS)
    muted = ImageEnhance.Color(resized).enhance(0.35)
    muted = ImageEnhance.Brightness(muted).enhance(0.95)
    draw = ImageDraw.Draw(muted, "RGBA")
    draw.rectangle((4, 4, 92, 24), fill=(24, 26, 30, 180))
    label = f"{family[:3].upper()}-{level}"
    draw.text((8, 8), label, fill=(242, 234, 210, 230))
    return muted


def save_to_dirs(image: Image.Image, filename: str, dirs: list[Path]) -> None:
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
        image.save(d / filename)


def main() -> None:
    for family_name, spec in TARGET_FAMILIES.items():
        base_image = Image.open(SRC_FINAL / spec["base"]).convert("RGBA")
        for idx, target_name in enumerate(spec["names"], start=1):
            tinted = blend_with_tint(base_image, spec["tint"], 0.22 + idx * 0.02)
            final_image = add_level_details(tinted, idx, spec["tint"])
            save_to_dirs(final_image, f"{target_name}.png", OUTPUT_FINAL_DIRS)

            placeholder = make_placeholder(final_image, family_name, idx)
            save_to_dirs(placeholder, f"{target_name}.png", OUTPUT_PLACEHOLDER_DIRS)


if __name__ == "__main__":
    main()
