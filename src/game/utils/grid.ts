export interface GridPoint {
  x: number;
  y: number;
}

export interface MapBounds {
  width: number;
  height: number;
}

export const gridToWorld = (gridX: number, gridY: number, tileSize: number): GridPoint => ({
  x: gridX * tileSize,
  y: gridY * tileSize,
});

export const worldToGrid = (worldX: number, worldY: number, tileSize: number): GridPoint => ({
  x: Math.floor(worldX / tileSize),
  y: Math.floor(worldY / tileSize),
});

export const isWithinMap = (x: number, y: number, bounds: MapBounds): boolean =>
  x >= 0 && y >= 0 && x < bounds.width && y < bounds.height;
