export const TILE_SIZE = 40;
export let GRID_COLS = 20;
export let GRID_ROWS = 15;

// Extensible cell format: { type: 'empty' | 'block' | ... }
export let level = [];

export function createDefaultLevel(cols, rows) {
    const grid = [];
    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
            if (y === rows - 1 || (y === rows - 4 && x > 4 && x < 8) || (y === rows - 6 && x > 10 && x < 15)) {
                row.push({type: 'block'});
            } else {
                row.push({type: 'empty'});
            }
        }
        grid.push(row);
    }
    return grid;
}

export const player = {
    x: TILE_SIZE * 2,
    y: TILE_SIZE * (GRID_ROWS - 3),
    width: TILE_SIZE * 0.8,
    height: TILE_SIZE * 0.8,
    vx: 0,
    vy: 0,
    speed: 5,
    jumpPower: 13,
    onGround: false
};

export function setGridSize(cols, rows) {
    GRID_COLS = cols;
    GRID_ROWS = rows;
}

export function setLevel(newLevel) {
    level = newLevel;
}
