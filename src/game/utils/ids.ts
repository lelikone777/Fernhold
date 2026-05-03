let buildingCounter = 0;

export const nextBuildingId = (type: string): string => {
  buildingCounter += 1;
  return `${type}_${String(buildingCounter).padStart(3, '0')}`;
};

export const resetIdCounters = (): void => {
  buildingCounter = 0;
};

export const setBuildingCounter = (value: number): void => {
  buildingCounter = Math.max(0, value);
};
