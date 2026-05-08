export interface DevPaintSnapshot {
  enabled: boolean;
  selectedFoliageId: string | null;
  selectedRoadId: string | null;
}

export class DevPaintStateController {
  private enabled = false;
  private selectedFoliageId: string | null = null;
  private selectedRoadId: string | null = null;

  public getSnapshot(): DevPaintSnapshot {
    return {
      enabled: this.enabled,
      selectedFoliageId: this.selectedFoliageId,
      selectedRoadId: this.selectedRoadId,
    };
  }

  public setEnabled(enabled: boolean, defaultFoliageId: string | null): void {
    this.enabled = enabled;
    if (enabled && this.selectedFoliageId === null && this.selectedRoadId === null) {
      this.selectedFoliageId = defaultFoliageId;
    }
    if (!enabled) {
      this.selectedFoliageId = null;
      this.selectedRoadId = null;
    }
  }

  public selectFoliage(foliageId: string): void {
    this.enabled = true;
    this.selectedFoliageId = foliageId;
    this.selectedRoadId = null;
  }

  public selectRoad(roadId: string): void {
    this.enabled = true;
    this.selectedFoliageId = null;
    this.selectedRoadId = roadId;
  }

  public selectErase(): void {
    this.enabled = true;
    this.selectedFoliageId = null;
    this.selectedRoadId = null;
  }

  public disable(): void {
    this.enabled = false;
    this.selectedFoliageId = null;
    this.selectedRoadId = null;
  }

  public isRoadPaintModeActive(): boolean {
    return this.enabled && this.selectedRoadId !== null;
  }
}
