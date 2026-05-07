export interface PathPoint {
  x: number;
  y: number;
}

export interface PathfinderOptions {
  width: number;
  height: number;
  isBlocked: (x: number, y: number) => boolean;
  maxNodes?: number;
}

interface AStarNode {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: AStarNode | null;
}

const heuristic = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by);

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const findPath = (
  start: PathPoint,
  goal: PathPoint,
  options: PathfinderOptions,
): PathPoint[] | null => {
  const { width, height, isBlocked } = options;
  const maxNodes = options.maxNodes ?? width * height;

  if (start.x === goal.x && start.y === goal.y) {
    return [];
  }
  if (
    goal.x < 0 ||
    goal.y < 0 ||
    goal.x >= width ||
    goal.y >= height ||
    isBlocked(goal.x, goal.y)
  ) {
    return null;
  }

  const open: AStarNode[] = [];
  const closed = new Uint8Array(width * height);
  const bestG = new Float64Array(width * height);
  bestG.fill(Number.POSITIVE_INFINITY);

  const startNode: AStarNode = {
    x: start.x,
    y: start.y,
    g: 0,
    f: heuristic(start.x, start.y, goal.x, goal.y),
    parent: null,
  };
  open.push(startNode);
  bestG[start.y * width + start.x] = 0;

  let processed = 0;
  while (open.length > 0) {
    processed += 1;
    if (processed > maxNodes) {
      return null;
    }

    let bestIndex = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (open[i].f < open[bestIndex].f) {
        bestIndex = i;
      }
    }
    const current = open[bestIndex];
    open.splice(bestIndex, 1);

    if (current.x === goal.x && current.y === goal.y) {
      const path: PathPoint[] = [];
      let node: AStarNode | null = current;
      while (node && node.parent) {
        path.push({ x: node.x, y: node.y });
        node = node.parent;
      }
      path.reverse();
      return path;
    }

    closed[current.y * width + current.x] = 1;

    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const neighborIndex = ny * width + nx;
      if (closed[neighborIndex] === 1) {
        continue;
      }
      const isGoal = nx === goal.x && ny === goal.y;
      if (!isGoal && isBlocked(nx, ny)) {
        continue;
      }
      const tentativeG = current.g + 1;
      if (tentativeG >= bestG[neighborIndex]) {
        continue;
      }
      bestG[neighborIndex] = tentativeG;
      open.push({
        x: nx,
        y: ny,
        g: tentativeG,
        f: tentativeG + heuristic(nx, ny, goal.x, goal.y),
        parent: current,
      });
    }
  }

  return null;
};
