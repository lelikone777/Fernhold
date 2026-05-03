from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
import shutil
import zipfile


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = ROOT / "assets_source" / "elv"
TARGET_DIRS = [
    ROOT / "public" / "assets" / "sprites" / "elv",
    ROOT / "src" / "assets" / "sprites" / "elv",
]

TARGET_NAMES = {
    "house": "building-house.png",
    "lumber_mill": "building-lumber_mill.png",
    "farm": "building-farm.png",
    "storage": "building-storage.png",
}


def parse_args():
    parser = ArgumentParser(description="Import ELV building icons into Fernhold.")
    parser.add_argument("--zip", type=Path, help="Path to ELV zip archive.", default=None)
    parser.add_argument("--source", type=Path, help="Folder with prepared PNG files.", default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--house", type=Path, help="Explicit path to house icon PNG.", default=None)
    parser.add_argument("--lumber-mill", type=Path, help="Explicit path to lumber mill icon PNG.", default=None)
    parser.add_argument("--farm", type=Path, help="Explicit path to farm icon PNG.", default=None)
    parser.add_argument("--storage", type=Path, help="Explicit path to storage icon PNG.", default=None)
    return parser.parse_args()


def collect_from_zip(zip_path: Path, dest: Path) -> Path:
    extract_dir = dest / "_extracted"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as archive:
        archive.extractall(extract_dir)
    return extract_dir


def ensure_targets() -> None:
    for target in TARGET_DIRS:
        target.mkdir(parents=True, exist_ok=True)


def find_file(source_root: Path, keywords: list[str]) -> Path | None:
    candidates = sorted(source_root.rglob("*.png"))
    normalized = [(path, path.as_posix().lower()) for path in candidates]
    for keyword in keywords:
        for path, text in normalized:
            if keyword in text:
                return path
    return None


def copy_to_targets(src: Path, target_name: str) -> None:
    for target_dir in TARGET_DIRS:
        shutil.copyfile(src, target_dir / target_name)


def main() -> None:
    args = parse_args()
    ensure_targets()

    source_root = args.source
    if args.zip:
        source_root = collect_from_zip(args.zip, source_root)

    explicit = {
        "house": args.house,
        "lumber_mill": args.lumber_mill,
        "farm": args.farm,
        "storage": args.storage,
    }

    search_keywords = {
        "house": ["house", "cottage", "home"],
        "lumber_mill": ["lumber", "mill", "sawmill"],
        "farm": ["farm", "barn", "field"],
        "storage": ["storage", "warehouse", "shed", "storehouse"],
    }

    resolved: dict[str, Path] = {}
    for key in TARGET_NAMES:
        if explicit[key]:
            resolved[key] = explicit[key].resolve()
            continue
        found = find_file(source_root, search_keywords[key])
        if found:
            resolved[key] = found.resolve()

    missing = [key for key in TARGET_NAMES if key not in resolved]
    if missing:
        print("Missing icons:", ", ".join(missing))
        print("Use explicit flags: --house --lumber-mill --farm --storage")
        raise SystemExit(1)

    for key, target_name in TARGET_NAMES.items():
        copy_to_targets(resolved[key], target_name)
        print(f"{key}: {resolved[key]} -> {target_name}")

    print("ELV building icons imported successfully.")


if __name__ == "__main__":
    main()
