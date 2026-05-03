from pathlib import Path

from PIL import Image, ImageDraw


BUILDINGS = [
    ("small_house", (137, 116, 88), (102, 124, 161), (98, 130, 83)),
    ("medium_house", (126, 104, 82), (147, 98, 82), (95, 126, 79)),
    ("town_hall", (108, 90, 77), (148, 71, 64), (90, 118, 77)),
    ("lumber_mill", (110, 92, 69), (126, 88, 71), (89, 116, 79)),
    ("farmhouse", (165, 120, 86), (196, 154, 97), (102, 129, 76)),
    ("barn", (155, 95, 67), (170, 70, 64), (95, 118, 73)),
    ("storage", (121, 102, 79), (103, 89, 76), (89, 116, 78)),
    ("well", (126, 126, 118), (124, 90, 62), (95, 117, 75)),
    ("blacksmith", (86, 87, 92), (125, 85, 64), (88, 111, 72)),
    ("workshop", (123, 101, 71), (152, 119, 77), (90, 112, 70)),
    ("market_stall", (178, 126, 72), (194, 86, 72), (94, 119, 71)),
    ("tavern", (132, 87, 61), (161, 106, 67), (90, 112, 70)),
    ("watchtower", (110, 95, 76), (133, 116, 89), (86, 109, 70)),
    ("shrine", (124, 128, 114), (120, 136, 84), (86, 116, 76)),
    ("herb_hut", (97, 118, 76), (137, 109, 77), (74, 126, 82)),
    ("fisher_hut", (90, 106, 124), (119, 99, 74), (80, 117, 90)),
    ("bakery", (191, 149, 96), (175, 111, 76), (93, 117, 72)),
    ("mason_yard", (124, 125, 129), (111, 101, 89), (88, 109, 72)),
    ("stable", (145, 111, 76), (118, 92, 62), (91, 114, 71)),
    ("large_storage", (109, 97, 77), (132, 116, 90), (89, 110, 72)),
]

BASE_DIRS = [
    Path("public/assets/sprites/buildings"),
    Path("src/assets/sprites/buildings"),
]
PREVIEW_PATH = Path("public/assets/sprites/buildings/buildings-pass-preview.png")
SIZE = 128
OUTLINE = (38, 28, 24, 255)
STONE = (110, 103, 96, 255)
STONE_DARK = (84, 78, 72, 255)
STONE_LIGHT = (143, 136, 128, 255)


def darker(color, amount):
    return tuple(max(0, c - amount) for c in color)


def lighter(color, amount):
    return tuple(min(255, c + amount) for c in color)


def alpha(color, value=255):
    return (color[0], color[1], color[2], value)


def add_shadow(draw, box):
    draw.ellipse(box, fill=(0, 0, 0, 44))


def add_cobbles(draw, x0, y0, x1, y1):
    palette = [(120, 112, 103, 255), (133, 126, 118, 255), (102, 96, 88, 255)]
    step = 8
    for y in range(y0, y1, step):
      for x in range(x0 + ((y // step) % 2) * 4, x1, step):
        tone = palette[(x + y) // step % len(palette)]
        draw.ellipse((x, y, x + 6, y + 4), fill=tone, outline=(74, 66, 61, 180))


def add_window(draw, x, y, w=10, h=18, glow=(198, 205, 215, 255)):
    draw.rectangle((x, y, x + w, y + h), fill=(52, 48, 56, 255), outline=OUTLINE)
    draw.rectangle((x + 2, y + 2, x + w - 2, y + h - 2), fill=glow)
    draw.line((x + w // 2, y + 2, x + w // 2, y + h - 2), fill=OUTLINE)


def add_arch_door(draw, x, y, w, h, frame, fill):
    draw.rectangle((x, y + 10, x + w, y + h), fill=frame, outline=OUTLINE)
    draw.pieslice((x, y, x + w, y + 24), 180, 360, fill=frame, outline=OUTLINE)
    inset = 4
    draw.rectangle((x + inset, y + 12, x + w - inset, y + h - inset), fill=fill, outline=OUTLINE)
    draw.pieslice((x + inset, y + 4, x + w - inset, y + 20), 180, 360, fill=fill, outline=OUTLINE)


def add_roof_tiles(draw, left, top, right, bottom, color):
    tile_dark = darker(color, 22)
    tile_light = lighter(color, 18)
    for row, y in enumerate(range(top, bottom, 7)):
        offset = 0 if row % 2 == 0 else 4
        for x in range(left - 4 + offset, right, 8):
            draw.arc((x, y, x + 8, y + 6), 180, 360, fill=tile_dark)
            draw.line((x + 1, y + 3, x + 7, y + 3), fill=tile_light)


def add_wall_blocks(draw, left, top, right, bottom):
    for y in range(top, bottom, 8):
        offset = 0 if (y // 8) % 2 == 0 else 6
        for x in range(left, right, 12):
            x0 = x + offset // 2
            x1 = min(x0 + 10, right)
            y1 = min(y + 6, bottom)
            if x1 > x0 and y1 > y:
                draw.rectangle((x0, y, x1, y1), fill=STONE, outline=STONE_DARK)


def add_foliage(draw, points, color):
    fill = alpha(color)
    dark = alpha(darker(color, 20))
    for x, y, w, h in points:
        draw.ellipse((x, y, x + w, y + h), fill=fill, outline=dark)


def make_canvas():
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    return image, draw


def render_small_house(wall, roof, accent):
    image, draw = make_canvas()
    add_shadow(draw, (24, 92, 104, 118))
    add_cobbles(draw, 28, 84, 100, 110)
    add_wall_blocks(draw, 34, 52, 94, 92)
    add_arch_door(draw, 52, 58, 24, 32, alpha(lighter(wall, 22)), alpha(darker(wall, 4)))
    add_window(draw, 40, 60, 9, 16)
    add_window(draw, 79, 60, 9, 16)
    draw.polygon([(28, 54), (64, 18), (100, 54), (92, 88), (36, 88)], fill=alpha(roof), outline=OUTLINE)
    add_roof_tiles(draw, 30, 24, 98, 82, roof)
    draw.rectangle((59, 12, 69, 30), fill=alpha(darker(wall, 12)), outline=OUTLINE)
    draw.rectangle((56, 32, 72, 48), fill=alpha(wall), outline=OUTLINE)
    draw.line((64, 12, 64, 48), fill=alpha(lighter(wall, 18)))
    add_foliage(draw, [(31, 82, 10, 9), (87, 82, 11, 8), (46, 90, 12, 7)], accent)
    return image


def render_medium_house(wall, roof, accent):
    image, draw = make_canvas()
    add_shadow(draw, (18, 92, 112, 118))
    add_cobbles(draw, 22, 86, 110, 112)
    add_wall_blocks(draw, 26, 56, 102, 92)
    draw.rectangle((28, 64, 48, 92), fill=alpha(lighter(wall, 12)), outline=OUTLINE)
    draw.rectangle((82, 60, 102, 92), fill=alpha(darker(wall, 8)), outline=OUTLINE)
    add_arch_door(draw, 50, 60, 24, 32, alpha(lighter(wall, 16)), alpha(darker(wall, 6)))
    add_window(draw, 34, 68, 9, 14)
    add_window(draw, 87, 66, 9, 16)
    draw.polygon([(20, 60), (54, 28), (84, 42), (108, 60), (100, 86), (28, 86)], fill=alpha(roof), outline=OUTLINE)
    draw.polygon([(62, 52), (88, 34), (112, 50), (108, 68), (76, 68)], fill=alpha(darker(roof, 8)), outline=OUTLINE)
    add_roof_tiles(draw, 24, 34, 104, 78, roof)
    add_roof_tiles(draw, 70, 38, 110, 64, darker(roof, 8))
    draw.rectangle((77, 18, 87, 42), fill=alpha(darker(wall, 14)), outline=OUTLINE)
    draw.rectangle((78, 78, 108, 90), fill=alpha(darker(accent, 8)), outline=OUTLINE)
    add_foliage(draw, [(24, 88, 14, 10), (93, 89, 14, 9), (70, 90, 10, 7)], accent)
    return image


def render_town_hall(wall, roof, accent):
    image, draw = make_canvas()
    add_shadow(draw, (8, 94, 120, 120))
    add_cobbles(draw, 16, 90, 116, 116)
    add_wall_blocks(draw, 22, 54, 104, 96)
    draw.rectangle((20, 58, 42, 90), fill=alpha(darker(wall, 8)), outline=OUTLINE)
    draw.rectangle((86, 48, 108, 94), fill=alpha(darker(wall, 10)), outline=OUTLINE)
    draw.rectangle((92, 24, 112, 86), fill=alpha(darker(wall, 14)), outline=OUTLINE)
    add_arch_door(draw, 48, 62, 28, 34, alpha(lighter(wall, 16)), alpha(darker(wall, 10)))
    add_window(draw, 28, 66, 8, 14)
    add_window(draw, 88, 58, 8, 18)
    add_window(draw, 98, 38, 8, 20)
    draw.polygon([(14, 58), (54, 22), (82, 34), (112, 54), (104, 86), (20, 86)], fill=alpha(roof), outline=OUTLINE)
    draw.polygon([(44, 58), (72, 34), (102, 42), (88, 78), (54, 78)], fill=alpha(darker(roof, 10)), outline=OUTLINE)
    draw.polygon([(86, 32), (102, 16), (118, 32), (112, 54), (92, 54)], fill=alpha(lighter(roof, 4)), outline=OUTLINE)
    add_roof_tiles(draw, 18, 28, 108, 80, roof)
    add_roof_tiles(draw, 52, 40, 98, 72, darker(roof, 10))
    add_roof_tiles(draw, 90, 20, 116, 48, lighter(roof, 4))
    draw.rectangle((73, 16, 83, 42), fill=alpha(darker(wall, 20)), outline=OUTLINE)
    draw.line((78, 12, 78, 20), fill=alpha(accent))
    draw.line((74, 18, 82, 18), fill=alpha(accent))
    add_foliage(draw, [(18, 92, 15, 10), (98, 90, 15, 11), (82, 92, 11, 8)], accent)
    return image


def render_lumber_mill(wall, roof, accent):
    image, draw = make_canvas()
    add_shadow(draw, (12, 92, 116, 120))
    add_cobbles(draw, 18, 88, 110, 114)
    draw.rectangle((24, 56, 96, 92), fill=alpha(wall), outline=OUTLINE)
    draw.rectangle((84, 48, 108, 92), fill=alpha(darker(wall, 6)), outline=OUTLINE)
    draw.rectangle((30, 64, 88, 92), fill=alpha(lighter(wall, 10)), outline=OUTLINE)
    draw.polygon([(16, 58), (48, 30), (90, 34), (114, 54), (102, 74), (24, 74)], fill=alpha(roof), outline=OUTLINE)
    add_roof_tiles(draw, 20, 34, 110, 70, roof)
    add_arch_door(draw, 58, 60, 22, 30, alpha(lighter(wall, 18)), alpha(darker(wall, 4)))
    add_window(draw, 36, 64, 8, 14)
    draw.rectangle((88, 28, 98, 48), fill=alpha(darker(wall, 18)), outline=OUTLINE)
    for x, y in [(18, 84), (28, 86), (36, 82), (96, 86)]:
        draw.rectangle((x, y, x + 16, y + 8), fill=alpha(accent), outline=OUTLINE)
        draw.line((x + 5, y, x + 5, y + 8), fill=alpha(darker(accent, 20)))
        draw.line((x + 10, y, x + 10, y + 8), fill=alpha(darker(accent, 20)))
    draw.line((96, 56, 118, 76), fill=alpha(darker(accent, 28)), width=3)
    draw.line((100, 56, 118, 74), fill=alpha(lighter(accent, 8)), width=1)
    add_foliage(draw, [(20, 92, 12, 8), (86, 92, 12, 8)], accent)
    return image


def render_storage(wall, roof, accent):
    image, draw = make_canvas()
    add_shadow(draw, (18, 94, 110, 120))
    add_cobbles(draw, 20, 90, 108, 116)
    add_wall_blocks(draw, 26, 54, 100, 94)
    draw.rectangle((34, 62, 92, 94), fill=alpha(lighter(wall, 10)), outline=OUTLINE)
    draw.polygon([(22, 58), (48, 30), (92, 34), (106, 54), (98, 82), (30, 82)], fill=alpha(roof), outline=OUTLINE)
    add_roof_tiles(draw, 26, 34, 102, 76, roof)
    draw.rectangle((74, 24, 86, 44), fill=alpha(darker(wall, 18)), outline=OUTLINE)
    add_arch_door(draw, 48, 62, 28, 32, alpha(lighter(wall, 18)), alpha(darker(wall, 6)))
    draw.rectangle((24, 84, 40, 96), fill=alpha(accent), outline=OUTLINE)
    draw.rectangle((36, 82, 52, 94), fill=alpha(lighter(accent, 10)), outline=OUTLINE)
    draw.rectangle((84, 84, 100, 96), fill=alpha(darker(accent, 6)), outline=OUTLINE)
    draw.line((32, 84, 32, 96), fill=alpha(darker(accent, 20)))
    draw.line((44, 82, 44, 94), fill=alpha(darker(accent, 20)))
    draw.line((92, 84, 92, 96), fill=alpha(darker(accent, 20)))
    add_foliage(draw, [(22, 94, 12, 8), (94, 94, 12, 8)], accent)
    return image


def render_generic(name, wall, roof, accent):
    image, draw = make_canvas()
    add_shadow(draw, (20, 92, 108, 118))
    add_cobbles(draw, 24, 88, 104, 112)
    left = 28
    right = 100
    top = 42
    bottom = 90

    if name in {"watchtower"}:
        left, right, top, bottom = 42, 86, 24, 96
    elif name in {"market_stall", "well", "shrine"}:
        left, right, top, bottom = 34, 94, 50, 94

    if name == "well":
        draw.rectangle((44, 68, 84, 88), fill=STONE, outline=OUTLINE)
        draw.rectangle((40, 50, 44, 80), fill=alpha(wall), outline=OUTLINE)
        draw.rectangle((84, 50, 88, 80), fill=alpha(wall), outline=OUTLINE)
        draw.polygon([(36, 56), (64, 38), (92, 56), (64, 66)], fill=alpha(roof), outline=OUTLINE)
        draw.line((64, 56, 64, 78), fill=alpha(darker(accent, 20)), width=2)
        return image

    draw.rectangle((left, top + 12, right, bottom), fill=alpha(wall), outline=OUTLINE)
    draw.polygon(
        [(left - 8, top + 16), ((left + right) // 2, top), (right + 8, top + 16), (right, top + 28), (left, top + 28)],
        fill=alpha(roof),
        outline=OUTLINE,
    )
    add_roof_tiles(draw, left - 2, top + 4, right + 2, min(bottom - 8, top + 40), roof)
    draw.rectangle((left + 12, bottom - 22, left + 28, bottom), fill=alpha(darker(wall, 10)), outline=OUTLINE)
    add_window(draw, right - 26, top + 24, 10, 16)
    if name in {"watchtower"}:
        draw.line((left + 6, bottom, left, bottom + 16), fill=OUTLINE, width=2)
        draw.line((right - 6, bottom, right + 6, bottom + 16), fill=OUTLINE, width=2)
    return image


CUSTOM_RENDERERS = {
    "small_house": render_small_house,
    "medium_house": render_medium_house,
    "town_hall": render_town_hall,
    "lumber_mill": render_lumber_mill,
    "storage": render_storage,
}


def render_building(name, wall, roof, accent):
    renderer = CUSTOM_RENDERERS.get(name)
    if renderer is not None:
        return renderer(wall, roof, accent)
    return render_generic(name, wall, roof, accent)


def create_preview():
    columns = 5
    rows = 4
    gutter = 8
    preview = Image.new("RGBA", (columns * (SIZE + gutter) + gutter, rows * (SIZE + gutter) + gutter), (34, 54, 30, 255))
    for index, (name, wall, roof, accent) in enumerate(BUILDINGS):
        sprite = render_building(name, wall, roof, accent)
        x = gutter + (index % columns) * (SIZE + gutter)
        y = gutter + (index // columns) * (SIZE + gutter)
        preview.alpha_composite(sprite, (x, y))
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    preview.save(PREVIEW_PATH)


def main():
    for base_dir in BASE_DIRS:
        base_dir.mkdir(parents=True, exist_ok=True)

    for name, wall, roof, accent in BUILDINGS:
        image = render_building(name, wall, roof, accent)
        for base_dir in BASE_DIRS:
            image.save(base_dir / f"{name}.png")

    create_preview()


if __name__ == "__main__":
    main()
