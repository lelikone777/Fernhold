import { BUILDING_DEFINITIONS } from '../data/buildings';
import type {
  BuildingDefinition,
  BuildingType,
  PlacementResult,
  PlacedBuilding,
  RemovalResult,
} from '../types/game';
import type { MapBounds } from '../utils/grid';
import { isWithinMap } from '../utils/grid';
import { nextBuildingId } from '../utils/ids';

export class BuildingSystem {
  private readonly occupiedTiles = new Set<string>();
  private buildings: PlacedBuilding[] = [];

  public getDefinition(type: BuildingType): BuildingDefinition {
    return BUILDING_DEFINITIONS[type];
  }

  public getBuildings(): PlacedBuilding[] {
    return [...this.buildings];
  }

  public load(buildings: PlacedBuilding[]): void {
    this.clear();
    for (const building of buildings) {
      this.buildings.push(building);
      const definition = this.getDefinition(building.type);
      this.markArea(building.x, building.y, definition.size.w, definition.size.h, true);
    }
  }

  public clear(): void {
    this.buildings = [];
    this.occupiedTiles.clear();
  }

  public canPlace(type: BuildingType, x: number, y: number, mapBounds: MapBounds): PlacementResult {
    const definition = this.getDefinition(type);

    for (let dx = 0; dx < definition.size.w; dx += 1) {
      for (let dy = 0; dy < definition.size.h; dy += 1) {
        const tileX = x + dx;
        const tileY = y + dy;
        if (!isWithinMap(tileX, tileY, mapBounds)) {
          return { ok: false, error: 'cannot_build_here' };
        }
        if (this.occupiedTiles.has(this.toKey(tileX, tileY))) {
          return { ok: false, error: 'tile_occupied' };
        }
      }
    }

    return { ok: true };
  }

  public place(type: BuildingType, x: number, y: number, mapBounds: MapBounds): PlacementResult {
    const placement = this.canPlace(type, x, y, mapBounds);
    if (!placement.ok) {
      return placement;
    }

    const placed: PlacedBuilding = {
      id: nextBuildingId(type),
      type,
      x,
      y,
    };

    const definition = this.getDefinition(type);
    this.markArea(x, y, definition.size.w, definition.size.h, true);
    this.buildings.push(placed);

    return { ok: true, building: placed };
  }

  public getBuildingAt(x: number, y: number): PlacedBuilding | null {
    for (const building of this.buildings) {
      const definition = this.getDefinition(building.type);
      const withinX = x >= building.x && x < building.x + definition.size.w;
      const withinY = y >= building.y && y < building.y + definition.size.h;
      if (withinX && withinY) {
        return building;
      }
    }
    return null;
  }

  public removeAt(x: number, y: number): RemovalResult {
    const building = this.getBuildingAt(x, y);
    if (!building) {
      return { ok: false };
    }

    const definition = this.getDefinition(building.type);
    this.markArea(building.x, building.y, definition.size.w, definition.size.h, false);
    this.buildings = this.buildings.filter((entry) => entry.id !== building.id);
    return { ok: true, building };
  }

  private markArea(x: number, y: number, width: number, height: number, occupied: boolean): void {
    for (let dx = 0; dx < width; dx += 1) {
      for (let dy = 0; dy < height; dy += 1) {
        const key = this.toKey(x + dx, y + dy);
        if (occupied) {
          this.occupiedTiles.add(key);
        } else {
          this.occupiedTiles.delete(key);
        }
      }
    }
  }

  private toKey(x: number, y: number): string {
    return `${x}:${y}`;
  }
}
