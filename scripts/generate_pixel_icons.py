from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
import math
import random
import re
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ITEMS_DIR = ROOT / "src" / "assets" / "items"
SPRITES_DIR = ROOT / "src" / "assets" / "sprites"
PUBLIC_ITEMS_DIR = ROOT / "public" / "assets" / "items"
PUBLIC_SPRITES_DIR = ROOT / "public" / "assets" / "sprites"
ITEMS_DIR.mkdir(parents=True, exist_ok=True)
SPRITES_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_ITEMS_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_SPRITES_DIR.mkdir(parents=True, exist_ok=True)

SPRITE_SIZE = 32
GRID_COLS = 10
GRID_ROWS = 10

WHITE = (255, 255, 255, 255)
OUTLINE = (28, 24, 21, 255)
SHADOW = (22, 18, 16, 150)
LABEL = (34, 34, 34, 255)


@dataclass(frozen=True)
class ItemSpec:
    row: int
    col: int
    name: str
    slug: str
    theme: str


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def make_specs() -> list[ItemSpec]:
    names_by_row = [
        [
            "Iron Sword",
            "Steel Saber",
            "Bronze Dagger",
            "Moonblade",
            "Hunter Knife",
            "Flame Blade",
            "Ice Brand",
            "Thunder Edge",
            "Forest Fang",
            "Shadow Kris",
        ],
        [
            "Wooden Buckler",
            "Iron Shield",
            "Kite Shield",
            "Tower Shield",
            "Dragon Shield",
            "Leather Armor",
            "Chainmail",
            "Plate Armor",
            "Knight Cuirass",
            "Scale Armor",
        ],
        [
            "Short Bow",
            "Long Bow",
            "Composite Bow",
            "Crossbow",
            "Heavy Crossbow",
            "Throwing Axe",
            "Javelin",
            "Sling",
            "Boomerang",
            "Hand Cannon",
        ],
        [
            "Oak Staff",
            "Crystal Staff",
            "Fire Wand",
            "Frost Wand",
            "Storm Rod",
            "Sun Scepter",
            "Moon Scepter",
            "Totem Focus",
            "Rune Orb",
            "Arcane Focus",
        ],
        [
            "Health Potion",
            "Mana Potion",
            "Stamina Tonic",
            "Antidote",
            "Elixir",
            "Phoenix Flask",
            "Swift Draught",
            "Iron Skin",
            "Night Vision",
            "Lucky Brew",
        ],
        [
            "Fire Scroll",
            "Ice Scroll",
            "Wind Scroll",
            "Earth Scroll",
            "Light Tome",
            "Shadow Tome",
            "Bestiary",
            "Herbal Codex",
            "Rune Grimoire",
            "Ancient Spellbook",
        ],
        [
            "Gold Ring",
            "Silver Ring",
            "Ruby Ring",
            "Sapphire Ring",
            "Emerald Ring",
            "Sun Amulet",
            "Moon Amulet",
            "Charm Bead",
            "Lucky Talisman",
            "Enchanted Brooch",
        ],
        [
            "Leather Cap",
            "Iron Helm",
            "Steel Helm",
            "Winged Helm",
            "Horned Helm",
            "Wizard Hat",
            "Ranger Hood",
            "Royal Crown",
            "Laurel Crown",
            "Battle Circlet",
        ],
        [
            "Bronze Key",
            "Silver Key",
            "Golden Key",
            "Ancient Relic",
            "Sacred Idol",
            "Dragon Egg",
            "Guild Seal",
            "Treasure Map",
            "Quest Letter",
            "Moon Relic",
        ],
        [
            "Ruby Gem",
            "Sapphire Gem",
            "Emerald Gem",
            "Topaz Gem",
            "Amethyst Gem",
            "Fire Rune",
            "Water Rune",
            "Earth Rune",
            "Air Rune",
            "Mythril Ore",
        ],
    ]
    themes = [
        "swords_blades",
        "shields_armor",
        "ranged_weapons",
        "staves_wands",
        "potions_flasks",
        "scrolls_tomes",
        "rings_amulets",
        "headgear",
        "keys_relics",
        "gems_runes",
    ]

    specs: list[ItemSpec] = []
    for row, names in enumerate(names_by_row):
        for col, name in enumerate(names):
            specs.append(
                ItemSpec(
                    row=row,
                    col=col,
                    name=name,
                    slug=slugify(name),
                    theme=themes[row],
                )
            )
    return specs


def palette_for(theme: str, variant: int) -> dict[str, tuple[int, int, int, int]]:
    seed = hash((theme, variant)) & 0xFFFF
    random.seed(seed)
    metal = random.choice(
        [
            (188, 194, 206, 255),
            (170, 182, 198, 255),
            (202, 184, 142, 255),
            (152, 170, 178, 255),
        ]
    )
    dark_metal = tuple(max(30, c - 55) for c in metal[:3]) + (255,)
    wood = random.choice([(144, 100, 68, 255), (158, 112, 76, 255), (120, 90, 65, 255)])
    leather = random.choice([(126, 80, 54, 255), (104, 72, 48, 255), (138, 98, 70, 255)])
    cloth = random.choice([(74, 112, 166, 255), (100, 80, 146, 255), (76, 134, 98, 255)])
    gem = random.choice(
        [
            (202, 70, 90, 255),
            (78, 128, 210, 255),
            (74, 180, 120, 255),
            (170, 120, 220, 255),
            (220, 178, 76, 255),
        ]
    )
    liquid = random.choice(
        [
            (224, 78, 78, 255),
            (78, 128, 224, 255),
            (108, 210, 136, 255),
            (184, 96, 220, 255),
            (230, 170, 66, 255),
        ]
    )
    return {
        "metal": metal,
        "dark_metal": dark_metal,
        "wood": wood,
        "leather": leather,
        "cloth": cloth,
        "gem": gem,
        "liquid": liquid,
    }


def px(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    draw.point((x, y), fill=color)


def pxf(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: tuple[int, int, int, int]) -> None:
    draw.rectangle((x, y, x + w - 1, y + h - 1), fill=color)


def outline_rect(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    draw.rectangle((x, y, x + w - 1, y + h - 1), outline=OUTLINE)


def dither_rect(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    w: int,
    h: int,
    color: tuple[int, int, int, int],
    step: int = 2,
) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if (xx + yy) % step == 0:
                px(draw, xx, yy, color)


def draw_blade(draw: ImageDraw.ImageDraw, p: dict[str, tuple[int, int, int, int]], v: int) -> None:
    blade_h = 14 + (v % 3)
    base_x = 15
    top_y = 5
    for i in range(blade_h):
        span = 1 + (i // 5)
        y = top_y + i
        pxf(draw, base_x - span, y, span * 2 + 1, 1, p["metal"])
        if i % 2 == 0:
            px(draw, base_x + span, y, p["dark_metal"])
    pxf(draw, 12, 18, 7, 2, p["dark_metal"])
    pxf(draw, 14, 20, 3, 6, p["wood"])
    pxf(draw, 13, 26, 5, 2, p["leather"])
    dither_rect(draw, 12, 21, 7, 6, p["dark_metal"], 3)
    outline_rect(draw, 11, 4, 9, 24)


def draw_shield_armor(draw: ImageDraw.ImageDraw, p: dict[str, tuple[int, int, int, int]], v: int) -> None:
    if v < 5:
        pxf(draw, 9, 7, 14, 16, p["metal"])
        pxf(draw, 11, 9, 10, 12, p["cloth"])
        pxf(draw, 15, 9, 2, 12, p["dark_metal"])
        pxf(draw, 8, 21, 16, 4, p["dark_metal"])
        dither_rect(draw, 9, 7, 14, 16, p["dark_metal"], 4)
        outline_rect(draw, 8, 6, 16, 20)
    else:
        pxf(draw, 8, 8, 16, 14, p["leather"])
        pxf(draw, 10, 10, 12, 10, p["metal"])
        pxf(draw, 12, 6, 8, 3, p["cloth"])
        pxf(draw, 11, 22, 10, 4, p["dark_metal"])
        dither_rect(draw, 10, 10, 12, 10, p["dark_metal"], 3)
        outline_rect(draw, 8, 6, 16, 20)


def draw_ranged(draw: ImageDraw.ImageDraw, p: dict[str, tuple[int, int, int, int]], v: int) -> None:
    if v <= 4:
        for i in range(12):
            px(draw, 8 + i, 8 + i // 2, p["wood"])
            px(draw, 8 + i, 20 - i // 2, p["wood"])
        pxf(draw, 18, 13, 8, 2, p["metal"])
        pxf(draw, 24, 12, 2, 4, p["gem"])
        outline_rect(draw, 6, 7, 20, 15)
    else:
        pxf(draw, 8, 12, 12, 6, p["wood"])
        pxf(draw, 20, 13, 6, 4, p["metal"])
        pxf(draw, 10, 10, 2, 10, p["dark_metal"])
        pxf(draw, 7, 13, 3, 4, p["gem"])
        dither_rect(draw, 8, 12, 12, 6, p["dark_metal"], 3)
        outline_rect(draw, 7, 10, 20, 11)


def draw_focus(draw: ImageDraw.ImageDraw, p: dict[str, tuple[int, int, int, int]], v: int) -> None:
    pxf(draw, 14, 10, 4, 14, p["wood"])
    pxf(draw, 13, 24, 6, 3, p["dark_metal"])
    if v % 2 == 0:
        pxf(draw, 10, 6, 12, 5, p["gem"])
        pxf(draw, 12, 7, 8, 3, p["metal"])
    else:
        pxf(draw, 11, 4, 10, 7, p["cloth"])
        pxf(draw, 14, 5, 4, 5, p["gem"])
    dither_rect(draw, 14, 10, 4, 12, p["dark_metal"], 2)
    outline_rect(draw, 9, 3, 14, 25)


def draw_potion(draw: ImageDraw.ImageDraw, p: dict[str, tuple[int, int, int, int]], v: int) -> None:
    neck_w = 4 if v % 2 == 0 else 6
    neck_x = 16 - (neck_w // 2)
    pxf(draw, neck_x, 6, neck_w, 4, p["metal"])
    pxf(draw, 9, 10, 14, 12, p["liquid"])
    pxf(draw, 11, 12, 10, 8, tuple(min(255, c + 25) for c in p["liquid"][:3]) + (255,))
    pxf(draw, 8, 22, 16, 3, p["dark_metal"])
    pxf(draw, 14, 13, 2, 2, (255, 255, 255, 180))
    dither_rect(draw, 9, 10, 14, 12, p["dark_metal"], 4)
    outline_rect(draw, 8, 5, 16, 21)


def draw_scroll_tome(draw: ImageDraw.ImageDraw, p: dict[str, tuple[int, int, int, int]], v: int) -> None:
    if v <= 3:
        pxf(draw, 7, 9, 18, 12, (234, 220, 172, 255))
        pxf(draw, 7, 8, 2, 14, p["wood"])
        pxf(draw, 23, 8, 2, 14, p["wood"])
        pxf(draw, 10, 12, 12, 1, p["dark_metal"])
        pxf(draw, 10, 15, 9, 1, p["dark_metal"])
        outline_rect(draw, 6, 7, 20, 16)
    else:
        pxf(draw, 8, 7, 16, 18, p["cloth"])
        pxf(draw, 10, 9, 12, 14, (235, 224, 190, 255))
        pxf(draw, 9, 7, 2, 18, p["leather"])
        pxf(draw, 13, 12, 6, 6, p["gem"])
        dither_rect(draw, 10, 9, 12, 14, p["dark_metal"], 4)
        outline_rect(draw, 8, 7, 16, 18)


def draw_trinket(draw: ImageDraw.ImageDraw, p: dict[str, tuple[int, int, int, int]], v: int) -> None:
    if v <= 4:
        pxf(draw, 11, 11, 10, 10, p["metal"])
        pxf(draw, 13, 13, 6, 6, WHITE)
        pxf(draw, 14, 14, 4, 4, p["gem"])
        outline_rect(draw, 10, 10, 12, 12)
    else:
        pxf(draw, 12, 7, 8, 6, p["metal"])
        pxf(draw, 10, 13, 12, 10, p["gem"])
        pxf(draw, 14, 10, 4, 4, p["cloth"])
        dither_rect(draw, 10, 13, 12, 10, p["dark_metal"], 4)
        outline_rect(draw, 9, 6, 14, 18)


def draw_headgear(draw: ImageDraw.ImageDraw, p: dict[str, tuple[int, int, int, int]], v: int) -> None:
    if v <= 4:
        pxf(draw, 8, 11, 16, 10, p["metal"])
        pxf(draw, 10, 9, 12, 4, p["cloth"])
        pxf(draw, 12, 14, 8, 4, p["dark_metal"])
        pxf(draw, 10, 21, 12, 3, p["leather"])
        dither_rect(draw, 8, 11, 16, 10, p["dark_metal"], 3)
        outline_rect(draw, 8, 9, 16, 15)
    else:
        pxf(draw, 9, 8, 14, 12, p["cloth"])
        pxf(draw, 8, 20, 16, 4, p["metal"])
        pxf(draw, 13, 10, 6, 6, p["gem"])
        outline_rect(draw, 8, 8, 16, 16)


def draw_key_relic(draw: ImageDraw.ImageDraw, p: dict[str, tuple[int, int, int, int]], v: int) -> None:
    if v <= 2:
        pxf(draw, 8, 14, 12, 3, p["metal"])
        pxf(draw, 20, 13, 4, 2, p["metal"])
        pxf(draw, 20, 16, 4, 2, p["metal"])
        pxf(draw, 5, 12, 4, 6, p["metal"])
        pxf(draw, 6, 13, 2, 4, WHITE)
        outline_rect(draw, 5, 12, 19, 7)
    elif v <= 6:
        pxf(draw, 10, 8, 12, 14, p["gem"])
        pxf(draw, 14, 5, 4, 4, p["metal"])
        pxf(draw, 13, 22, 6, 4, p["metal"])
        dither_rect(draw, 10, 8, 12, 14, p["dark_metal"], 5)
        outline_rect(draw, 10, 5, 12, 21)
    else:
        pxf(draw, 8, 8, 16, 16, (236, 218, 178, 255))
        pxf(draw, 11, 11, 10, 10, p["dark_metal"])
        pxf(draw, 13, 13, 6, 6, WHITE)
        outline_rect(draw, 8, 8, 16, 16)


def draw_gem_rune(draw: ImageDraw.ImageDraw, p: dict[str, tuple[int, int, int, int]], v: int) -> None:
    if v <= 4:
        pxf(draw, 12, 7, 8, 4, p["gem"])
        pxf(draw, 10, 11, 12, 7, p["gem"])
        pxf(draw, 12, 18, 8, 6, tuple(max(0, c - 35) for c in p["gem"][:3]) + (255,))
        pxf(draw, 14, 10, 2, 2, WHITE)
        outline_rect(draw, 10, 7, 12, 17)
    elif v <= 8:
        pxf(draw, 8, 8, 16, 16, (228, 220, 205, 255))
        pxf(draw, 13, 12, 6, 1, p["dark_metal"])
        pxf(draw, 12, 15, 8, 1, p["dark_metal"])
        pxf(draw, 14, 18, 4, 1, p["dark_metal"])
        dither_rect(draw, 8, 8, 16, 16, p["dark_metal"], 5)
        outline_rect(draw, 8, 8, 16, 16)
    else:
        pxf(draw, 9, 10, 14, 12, p["metal"])
        pxf(draw, 12, 12, 8, 8, p["dark_metal"])
        pxf(draw, 13, 13, 6, 6, p["gem"])
        outline_rect(draw, 9, 10, 14, 12)


def draw_item_icon(spec: ItemSpec) -> Image.Image:
    img = Image.new("RGBA", (SPRITE_SIZE, SPRITE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    palette = palette_for(spec.theme, spec.col + 1)

    if spec.row == 0:
        draw_blade(draw, palette, spec.col)
    elif spec.row == 1:
        draw_shield_armor(draw, palette, spec.col)
    elif spec.row == 2:
        draw_ranged(draw, palette, spec.col)
    elif spec.row == 3:
        draw_focus(draw, palette, spec.col)
    elif spec.row == 4:
        draw_potion(draw, palette, spec.col)
    elif spec.row == 5:
        draw_scroll_tome(draw, palette, spec.col)
    elif spec.row == 6:
        draw_trinket(draw, palette, spec.col)
    elif spec.row == 7:
        draw_headgear(draw, palette, spec.col)
    elif spec.row == 8:
        draw_key_relic(draw, palette, spec.col)
    elif spec.row == 9:
        draw_gem_rune(draw, palette, spec.col)

    return img


def paste_center(target: Image.Image, sprite: Image.Image, x: int, y: int, w: int, h: int) -> None:
    sx = x + (w - sprite.width) // 2
    sy = y + (h - sprite.height) // 2
    target.alpha_composite(sprite, (sx, sy))


def make_item_assets() -> None:
    specs = make_specs()
    sheet = Image.new("RGBA", (SPRITE_SIZE * GRID_COLS, SPRITE_SIZE * GRID_ROWS), (0, 0, 0, 0))

    frames: dict[str, dict[str, dict[str, int]]] = {}
    for i, spec in enumerate(specs):
        sprite = draw_item_icon(spec)
        x = spec.col * SPRITE_SIZE
        y = spec.row * SPRITE_SIZE
        sheet.alpha_composite(sprite, (x, y))
        frames[spec.slug] = {"frame": {"x": x, "y": y, "w": SPRITE_SIZE, "h": SPRITE_SIZE}}

    sheet_paths = [
        ITEMS_DIR / "items-spritesheet.png",
        PUBLIC_ITEMS_DIR / "items-spritesheet.png",
    ]
    for sheet_path in sheet_paths:
        sheet.save(sheet_path)

    atlas = {
        "frames": frames,
        "meta": {
            "app": "Fernhold",
            "version": "1.0.0",
            "image": "items-spritesheet.png",
            "format": "RGBA8888",
            "size": {"w": sheet.width, "h": sheet.height},
            "scale": "1",
        },
    }
    atlas_content = json.dumps(atlas, indent=2)
    (ITEMS_DIR / "items-spritesheet.json").write_text(atlas_content, encoding="utf-8")
    (PUBLIC_ITEMS_DIR / "items-spritesheet.json").write_text(atlas_content, encoding="utf-8")

    tile_w = 100
    tile_h = 84
    icon_box_h = 60
    grid = Image.new("RGBA", (tile_w * GRID_COLS, tile_h * GRID_ROWS), WHITE)
    draw = ImageDraw.Draw(grid)
    font = ImageFont.load_default()

    for spec in specs:
        tx = spec.col * tile_w
        ty = spec.row * tile_h
        draw.rectangle((tx, ty, tx + tile_w - 1, ty + tile_h - 1), outline=(215, 215, 215, 255), width=1)
        sprite = draw_item_icon(spec).resize((48, 48), Image.Resampling.NEAREST)
        paste_center(grid, sprite, tx, ty, tile_w, icon_box_h)

        label = spec.name
        max_w = tile_w - 6
        while draw.textlength(label, font=font) > max_w and len(label) > 3:
            label = label[:-2] + "…"
        tw = int(draw.textlength(label, font=font))
        draw.text((tx + (tile_w - tw) // 2, ty + 64), label, fill=LABEL, font=font)

    grid.save(ITEMS_DIR / "fantasy-items-grid-10x10-labeled.png")
    grid.save(PUBLIC_ITEMS_DIR / "fantasy-items-grid-10x10-labeled.png")

    catalog = [
        {
            "name": spec.name,
            "slug": spec.slug,
            "theme": spec.theme,
            "row": spec.row + 1,
            "column": spec.col + 1,
        }
        for spec in specs
    ]
    catalog_content = json.dumps(catalog, indent=2)
    (ITEMS_DIR / "items-catalog.json").write_text(catalog_content, encoding="utf-8")
    (PUBLIC_ITEMS_DIR / "items-catalog.json").write_text(catalog_content, encoding="utf-8")


def draw_building_icon(seed: int, roof: tuple[int, int, int, int], wall: tuple[int, int, int, int]) -> Image.Image:
    random.seed(seed)
    img = Image.new("RGBA", (SPRITE_SIZE, SPRITE_SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    base_w = 16 + random.randint(0, 2)
    base_h = 12 + random.randint(0, 2)
    x = (SPRITE_SIZE - base_w) // 2
    y = 14
    pxf(d, x, y, base_w, base_h, wall)
    pxf(d, x - 1, y + base_h - 2, base_w + 2, 2, (92, 82, 66, 255))
    roof_h = 7 + random.randint(0, 2)
    for i in range(roof_h):
        rx = x - 3 + i
        rw = base_w + 6 - i * 2
        pxf(d, rx, y - roof_h + i, rw, 1, roof)
    door_x = x + base_w // 2 - 2
    pxf(d, door_x, y + base_h - 6, 4, 6, (68, 52, 40, 255))
    pxf(d, door_x + 1, y + base_h - 4, 1, 1, (220, 192, 120, 255))
    for wx in (x + 3, x + base_w - 6):
        pxf(d, wx, y + 4, 3, 3, (110, 170, 208, 255))
        pxf(d, wx, y + 5, 3, 1, (220, 236, 245, 255))
    dither_rect(d, x, y, base_w, base_h, (80, 68, 52, 255), 4)
    outline_rect(d, x - 3, y - roof_h, base_w + 6, base_h + roof_h + 1)
    return img


def make_building_assets() -> None:
    specs = [
        ("Cottage", "cottage", (164, 82, 68, 255), (192, 164, 126, 255)),
        ("House", "house", (176, 96, 76, 255), (204, 178, 144, 255)),
        ("Longhouse", "longhouse", (142, 76, 54, 255), (184, 154, 116, 255)),
        ("Lumber Mill", "lumber_mill", (118, 72, 56, 255), (160, 136, 102, 255)),
        ("Farm", "farm", (170, 124, 74, 255), (204, 182, 128, 255)),
        ("Barn", "barn", (160, 64, 56, 255), (188, 144, 112, 255)),
        ("Storage", "storage", (126, 90, 68, 255), (174, 152, 118, 255)),
        ("Smithy", "smithy", (96, 96, 106, 255), (156, 150, 142, 255)),
        ("Inn", "inn", (152, 92, 68, 255), (202, 176, 138, 255)),
        ("Watchtower", "watchtower", (116, 80, 60, 255), (170, 146, 114, 255)),
    ]

    cols = 5
    rows = 2
    sheet = Image.new("RGBA", (cols * SPRITE_SIZE, rows * SPRITE_SIZE), (0, 0, 0, 0))
    frames: dict[str, dict[str, dict[str, int]]] = {}

    for idx, (name, slug, roof, wall) in enumerate(specs):
        row = idx // cols
        col = idx % cols
        icon = draw_building_icon(idx + 100, roof, wall)
        x = col * SPRITE_SIZE
        y = row * SPRITE_SIZE
        sheet.alpha_composite(icon, (x, y))
        frames[slug] = {"frame": {"x": x, "y": y, "w": SPRITE_SIZE, "h": SPRITE_SIZE}}

    sheet.save(SPRITES_DIR / "building-icons-spritesheet.png")
    sheet.save(PUBLIC_SPRITES_DIR / "building-icons-spritesheet.png")
    atlas = {
        "frames": frames,
        "meta": {
            "app": "Fernhold",
            "version": "1.0.0",
            "image": "building-icons-spritesheet.png",
            "format": "RGBA8888",
            "size": {"w": sheet.width, "h": sheet.height},
            "scale": "1",
        },
    }
    atlas_content = json.dumps(atlas, indent=2)
    (SPRITES_DIR / "building-icons-spritesheet.json").write_text(atlas_content, encoding="utf-8")
    (PUBLIC_SPRITES_DIR / "building-icons-spritesheet.json").write_text(atlas_content, encoding="utf-8")

    tile_w = 128
    tile_h = 98
    grid = Image.new("RGBA", (tile_w * cols, tile_h * rows), WHITE)
    draw = ImageDraw.Draw(grid)
    font = ImageFont.load_default()

    for idx, (name, _slug, roof, wall) in enumerate(specs):
        row = idx // cols
        col = idx % cols
        tx = col * tile_w
        ty = row * tile_h
        draw.rectangle((tx, ty, tx + tile_w - 1, ty + tile_h - 1), outline=(215, 215, 215, 255), width=1)
        icon = draw_building_icon(idx + 100, roof, wall).resize((52, 52), Image.Resampling.NEAREST)
        paste_center(grid, icon, tx, ty, tile_w, 66)
        tw = int(draw.textlength(name, font=font))
        draw.text((tx + (tile_w - tw) // 2, ty + 74), name, fill=LABEL, font=font)

    grid.save(SPRITES_DIR / "building-icons-grid-labeled.png")
    grid.save(PUBLIC_SPRITES_DIR / "building-icons-grid-labeled.png")

    for idx, (name, slug, roof, wall) in enumerate(specs):
        icon = draw_building_icon(idx + 100, roof, wall).resize((64, 64), Image.Resampling.NEAREST)
        icon.save(SPRITES_DIR / f"building-{slug}.png")
        icon.save(PUBLIC_SPRITES_DIR / f"building-{slug}.png")


def main() -> None:
    make_item_assets()
    make_building_assets()
    print("Generated item and building icon assets.")


if __name__ == "__main__":
    main()
