import {GRID_COLS, GRID_ROWS, level, player, TILE_SIZE} from './model';

export function draw(context, displayText) {
    // Clear
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    // Draw grid blocks
    for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
            const cell = level[y][x];
            if (cell.type === 'block') {
                context.fillStyle = '#444';
                context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
    // Draw player
    context.fillStyle = '#e63946';
    context.fillRect(player.x, player.y, player.width, player.height);

    // Draw displayText centered in pixel font
    if (displayText) {
        context.save();
        context.font = '24px "Press Start 2P", monospace';
        context.fillStyle = '#fff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = '#000';
        context.shadowBlur = 4;
        context.fillText(displayText, context.canvas.width / 2, context.canvas.height / 2);
        context.restore();
    }
}
