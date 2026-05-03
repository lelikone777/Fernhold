from pathlib import Path

from PIL import Image, ImageDraw


BUILDINGS = [
    ("small_house", 2, 2, (128, 103, 80)),
    ("medium_house", 3, 2, (133, 109, 88)),
    ("town_hall", 4, 3, (121, 101, 85)),
    ("lumber_mill", 3, 2, (116, 97, 73)),
    ("farmhouse", 3, 2, (142, 113, 84)),
    ("barn", 3, 3, (147, 96, 74)),
    ("storage", 2, 2, (114, 99, 80)),
    ("well", 2, 2, (118, 116, 112)),
    ("blacksmith", 3, 2, (104, 106, 112)),
    ("workshop", 3, 2, (123, 104, 82)),
    ("market_stall", 2, 2, (151, 117, 79)),
    ("tavern", 3, 3, (126, 93, 77)),
    ("watchtower", 2, 3, (116, 102, 87)),
    ("shrine", 2, 2, (123, 122, 112)),
    ("herb_hut", 2, 2, (101, 122, 88)),
    ("fisher_hut", 2, 2, (96, 111, 124)),
    ("bakery", 3, 2, (160, 127, 92)),
    ("mason_yard", 3, 2, (122, 123, 126)),
    ("stable", 3, 2, (136, 108, 83)),
    ("large_storage", 3, 3, (108, 98, 82)),
]

BASE_DIRS = [
    Path("public/assets/sprites/buildings/placeholders"),
    Path("src/assets/sprites/buildings/placeholders"),
]
PREVIEW = Path("public/assets/sprites/buildings/placeholders/building-placeholders-preview.png")
SIZE = 96
OUTLINE = (40, 32, 26, 255)
ROOF = (98, 86, 77, 255)
SLAB = (84, 88, 84, 255)
TEXT = (231, 222, 203, 255)


def darker(color, amount):
    return tuple(max(0, c - amount) for c in color)


def alpha(color):
    return (color[0], color[1], color[2], 255)


def abbreviation(name: str) -> str:
    parts = name.split("_")
    return "".join(part[0].upper() for part in parts[:3])


def draw_placeholder(name, grid_w, grid_h, wall):
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    body_w = 22 + grid_w * 14
    body_h = 20 + grid_h * 10
    left = (SIZE - body_w) // 2
    right = left + body_w
    bottom = 72
    top = bottom - body_h

    slab_top = bottom + 4
    slab_bottom = slab_top + 10
    draw.rounded_rectangle((left - 8, slab_top, right + 8, slab_bottom), radius=4, fill=SLAB)
    draw.rectangle((left, top + 12, right, bottom), fill=alpha(wall), outline=OUTLINE)
    draw.polygon(
        [(left - 6, top + 16), ((left + right) // 2, top), (right + 6, top + 16), (right, top + 24), (left, top + 24)],
        fill=ROOF,
        outline=OUTLINE,
    )

    stripe = darker(wall, 14)
    for x in range(left + 6, right, 10):
        draw.line((x, top + 16, x, bottom), fill=alpha(stripe))
    for y in range(top + 24, bottom, 8):
        draw.line((left, y, right, y), fill=alpha(darker(wall, 10)))

    label = abbreviation(name)
    text_x = left + 8
    text_y = top + 26
    for index, _char in enumerate(label):
        x = text_x + index * 10
        draw.rectangle((x, text_y, x + 6, text_y + 10), fill=(0, 0, 0, 60))
        draw.text((x + 1, text_y - 1), label[index], fill=TEXT)

    return image


def main():
    for base_dir in BASE_DIRS:
        base_dir.mkdir(parents=True, exist_ok=True)

    preview = Image.new("RGBA", (5 * (SIZE + 8) + 8, 4 * (SIZE + 8) + 8), (32, 42, 29, 255))
    for index, (name, grid_w, grid_h, wall) in enumerate(BUILDINGS):
        sprite = draw_placeholder(name, grid_w, grid_h, wall)
        for base_dir in BASE_DIRS:
            sprite.save(base_dir / f"{name}.png")

        x = 8 + (index % 5) * (SIZE + 8)
        y = 8 + (index // 5) * (SIZE + 8)
        preview.alpha_composite(sprite, (x, y))

    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    preview.save(PREVIEW)


if __name__ == "__main__":
    main()
