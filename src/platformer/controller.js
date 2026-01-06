// Controller for Konami platformer
import {createDefaultLevel, GRID_COLS, GRID_ROWS, level, player, setGridSize, setLevel, TILE_SIZE} from './model';
import {draw} from './view';

const keys = {left: false, right: false, up: false};
let jumpKeyHeld = false;
let jumpBuffer = 0;
let coyoteTime = 0;

const ACCEL = 1.2;
const MAX_SPEED = 6;
const FRICTION = 0.7;
const GRAVITY = 0.7;
const JUMP_POWER = 13;
const COYOTE_FRAMES = 8;
const JUMP_BUFFER_FRAMES = 8;

function handleKeyDown(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') keys.up = true;
}

function handleKeyUp(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') keys.up = false;
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

function getTileAt(px, py) {
    const x = Math.floor(px / TILE_SIZE);
    const y = Math.floor(py / TILE_SIZE);
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return {type: 'block'};
    return level[y][x];
}

function isSolidAt(px, py) {
    return getTileAt(px, py).type === 'block';
}

function update() {
    // --- Horizontal movement with acceleration and friction ---
    if (keys.left) {
        player.vx -= ACCEL;
    } else if (keys.right) {
        player.vx += ACCEL;
    } else {
        // Apply friction
        player.vx *= FRICTION;
        if (Math.abs(player.vx) < 0.1) player.vx = 0;
    }
    // Clamp max speed
    if (player.vx > MAX_SPEED) player.vx = MAX_SPEED;
    if (player.vx < -MAX_SPEED) player.vx = -MAX_SPEED;

    // --- Coyote time and jump buffering ---
    if (player.onGround) {
        coyoteTime = COYOTE_FRAMES;
    } else if (coyoteTime > 0) {
        coyoteTime--;
    }
    if (keys.up) {
        if (!jumpKeyHeld) {
            jumpBuffer = JUMP_BUFFER_FRAMES;
            jumpKeyHeld = true;
        }
    } else {
        jumpKeyHeld = false;
    }
    if (jumpBuffer > 0) jumpBuffer--;

    // --- Jumping ---
    if (jumpBuffer > 0 && coyoteTime > 0) {
        player.vy = -JUMP_POWER;
        player.onGround = false;
        jumpBuffer = 0;
        coyoteTime = 0;
    }

    // --- Variable jump height ---
    if (!keys.up && player.vy < 0) {
        player.vy += GRAVITY * 1.5; // fall faster if jump released
    }

    // --- Gravity ---
    player.vy += GRAVITY;
    if (player.vy > 16) player.vy = 16;

    // Move horizontally
    let newX = player.x + player.vx;
    let collidedX = false;
    if (player.vx !== 0) {
        const dir = player.vx > 0 ? 1 : -1;
        const nextLeft = dir > 0 ? player.x + player.width : newX;
        const top = player.y;
        const bottom = player.y + player.height - 1;
        if (isSolidAt(nextLeft, top) || isSolidAt(nextLeft, bottom)) {
            collidedX = true;
            if (dir > 0) {
                player.x = Math.floor((player.x + player.width) / TILE_SIZE) * TILE_SIZE - player.width;
            } else {
                player.x = Math.ceil(player.x / TILE_SIZE) * TILE_SIZE;
            }
            player.vx = 0;
        }
    }
    if (!collidedX) {
        player.x = newX;
    }

    // Move vertically
    let newY = player.y + player.vy;
    player.onGround = false;
    if (player.vy !== 0) {
        const dir = player.vy > 0 ? 1 : -1;
        const left = player.x;
        const right = player.x + player.width - 1;
        const nextTop = dir > 0 ? player.y + player.height : newY;
        if (isSolidAt(left, nextTop) || isSolidAt(right, nextTop)) {
            if (dir > 0) {
                player.y = Math.floor((player.y + player.height) / TILE_SIZE) * TILE_SIZE - player.height;
                player.onGround = true;
            } else {
                player.y = Math.ceil(player.y / TILE_SIZE) * TILE_SIZE;
            }
            player.vy = 0;
        } else {
            player.y = newY;
        }
    }

    // Prevent going out of bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > GRID_COLS * TILE_SIZE) player.x = GRID_COLS * TILE_SIZE - player.width;
    if (player.y + player.height > GRID_ROWS * TILE_SIZE) {
        player.y = GRID_ROWS * TILE_SIZE - player.height;
        player.vy = 0;
        player.onGround = true;
    }
}

let contextRef = null;

export function animate(context, displayText) {
    // Set grid size based on canvas
    const cols = Math.floor(context.canvas.width / TILE_SIZE);
    const rows = Math.floor(context.canvas.height / TILE_SIZE);
    setGridSize(cols, rows);
    setLevel(createDefaultLevel(cols, rows));
    player.x = TILE_SIZE * 2;
    player.y = TILE_SIZE * (rows - 3);
    contextRef = context;

    function loop() {
        update();
        draw(context, displayText);
        requestAnimationFrame(loop);
    }

    loop();
}
