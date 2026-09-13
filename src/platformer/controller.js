// Custom levels platformer controller
import { sound } from './audio';
import {
    addDoubleJumpParticles,
    addTextParticle,
    extendInfiniteWorld,
    gameState,
    GRID_ROWS,
    initInfiniteMode,
    loadLevel,
    player,
    resetPlayerToSpawn,
    saveTotalCoins,
    setPlatformerLocale,
    setTileSize,
    syncCoinsWithCode,
    TILE_SIZE
} from './model';
import { draw } from './view';
import { ALERT_ACTIONS, triggerAlert } from './alerts.js';

export { setPlatformerLocale };

const COYOTE_FRAMES = 8;
const JUMP_BUFFER_FRAMES = 8;

const keys = {
    left: false,
    right: false,
    up: false
};

let animFrameId = null;
let boundKeyDown = null;
let boundKeyUp = null;
let boundResize = null;
let boundPointerDown = null;
let boundPointerMove = null;
let boundPointerLeave = null;
let canvasRef = null;
let ctxRef = null;
let displayTextRef = 'Coming Soon';

function getCanvasCoords(e) {
    if (!canvasRef) return { x: 0, y: 0 };
    const rect = canvasRef.getBoundingClientRect();
    const scaleX = canvasRef.width / (rect.width || 1);
    const scaleY = canvasRef.height / (rect.height || 1);
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function isInsideRect(coords, rect) {
    if (!coords || !rect) return false;
    return coords.x >= rect.x &&
           coords.x <= rect.x + rect.width &&
           coords.y >= rect.y &&
           coords.y <= rect.y + rect.height;
}

function handleKeyDown(e) {
    sound.init();

    if (gameState.state === 'WIN') {
        if (e.code === 'Enter' || e.code === 'Space') {
            if (canvasRef) canvasRef.style.cursor = 'default';
            initInfiniteMode(canvasRef ? canvasRef.height : 640, true);
            e.preventDefault();
            return;
        }
        if (e.code === 'KeyR') {
            if (canvasRef) canvasRef.style.cursor = 'default';
            loadLevel(0, canvasRef ? canvasRef.height : 640);
            e.preventDefault();
            return;
        }
        return;
    }

    if (gameState.state === 'GAME_OVER') {
        if (e.code === 'KeyR') {
            if (gameState.isInfinite) {
                initInfiniteMode(canvasRef ? canvasRef.height : 640, false);
            } else {
                loadLevel(gameState.currentLevelIdx, canvasRef ? canvasRef.height : 640);
            }
            e.preventDefault();
            return;
        }
        return;
    }

    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        keys.left = true;
        e.preventDefault();
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        keys.right = true;
        e.preventDefault();
    }
    if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
        if (!keys.up) {
            player.jumpBuffer = JUMP_BUFFER_FRAMES;
        }
        keys.up = true;
        e.preventDefault();
    }
    if (e.code === 'KeyR') {
        if (gameState.isInfinite) {
            initInfiniteMode(canvasRef ? canvasRef.height : 640);
        } else {
            loadLevel(gameState.currentLevelIdx, canvasRef ? canvasRef.height : 640);
        }
        e.preventDefault();
    }
}


function handleKeyUp(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') keys.up = false;
}

function isSolidBlockAt(worldX, worldY) {
    const row = Math.floor(worldY / TILE_SIZE);
    if (row < 0 || row >= GRID_ROWS) {
        return false;
    }

    const col = Math.floor(worldX / TILE_SIZE);
    if (col < 0) {
        return false;
    }

    const level = gameState.currentLevel;
    if (!level) return false;

    if (col >= gameState.levelWidth) {
        return false;
    }

    const grid = level.grid || level.map;
    if (!grid) return false;

    return grid[row] && grid[row][col] === '#';
}

function updatePhysics() {
    if (gameState.state !== 'PLAYING') {
        if (gameState.state === 'WIN') {
            // Spawn celebratory falling confetti particles indefinitely while on victory screen
            if (Math.random() < 0.35) {
                gameState.particles.push({
                    x: Math.random() * (canvasRef ? canvasRef.width : 800),
                    y: -10,
                    vx: (Math.random() - 0.5) * 3,
                    vy: 2 + Math.random() * 3.5,
                    color: ['#fbbf24', '#22c55e', '#38bdf8', '#f43f5e', '#a855f7', '#f59e0b'][Math.floor(Math.random() * 6)],
                    life: 140,
                    maxLife: 140,
                    size: 4 + Math.random() * 4
                });
            }

            // Update celebratory confetti particles
            for (let i = gameState.particles.length - 1; i >= 0; i--) {
                const p = gameState.particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life--;
                if (p.life <= 0) {
                    gameState.particles.splice(i, 1);
                }
            }
        }
        return;
    }

    // Grid-relative physics parameters:
    // Keeps player speed and jump heights perfectly proportioned to grid tiles
    const ts = TILE_SIZE || 40;
    const maxSpeed = (ts * 3.6) / 60;   // ~3.6 tiles per second (crisp, responsive run)
    const accel = maxSpeed * 0.18;      // Snappy acceleration (~5-6 frames)
    const friction = 0.82;              // Crisp deceleration on release
    const jumpPower = ts * 0.22;        // Single jump cleanly clears 1-2 blocks effortlessly
    const doubleJumpPower = ts * 0.20; // Mid-air double jump easily reaches 3.5 blocks
    const gravity = jumpPower / 16;     // Crisp 16-frame apex arc
    const maxFallSpeed = ts * 0.20;     // Controlled, responsive descent


    // Horizontal Movement
    if (keys.left) {
        player.vx -= accel;
    } else if (keys.right) {
        player.vx += accel;
    } else {
        player.vx *= friction;
        if (Math.abs(player.vx) < 0.05) player.vx = 0;
    }

    if (player.vx > maxSpeed) player.vx = maxSpeed;
    if (player.vx < -maxSpeed) player.vx = -maxSpeed;

    // Coyote time & Jump buffering
    if (player.onGround) {
        player.coyoteTime = COYOTE_FRAMES;
        player.canDoubleJump = true;
        player.hasDoubleJumped = false;
    } else if (player.coyoteTime > 0) {
        player.coyoteTime--;
    }

    if (player.jumpBuffer > 0) {
        player.jumpBuffer--;
    }

    // Execute Jump / Double Jump
    if (player.jumpBuffer > 0) {
        if (player.coyoteTime > 0) {
            // Normal Ground Jump / Coyote Jump
            player.vy = -jumpPower;
            player.onGround = false;
            player.coyoteTime = 0;
            player.jumpBuffer = 0;
            player.canDoubleJump = true;
            player.hasDoubleJumped = false;
            sound.playJump();
        } else if (player.canDoubleJump) {
            // Mid-air Double Jump
            player.vy = -doubleJumpPower;
            player.canDoubleJump = false;
            player.hasDoubleJumped = true;
            player.jumpBuffer = 0;
            addDoubleJumpParticles(player.x + player.width / 2, player.y + player.height);
            sound.playDoubleJump();
        }
    }

    // Variable jump height: release early to cut jump height
    if (!keys.up && player.vy < -1.0) {
        player.vy += gravity * 1.2;
    }

    // Gravity
    const prevVy = player.vy;
    player.vy += gravity;
    if (player.vy > maxFallSpeed) player.vy = maxFallSpeed;

    // Update double jump / effect / text particles
    if (gameState.particles && gameState.particles.length > 0) {
        for (let i = gameState.particles.length - 1; i >= 0; i--) {
            const p = gameState.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay || 0.04;
            if (p.alpha <= 0) {
                gameState.particles.splice(i, 1);
            }
        }
    }

    // Horizontal Movement & Collision
    const nextX = player.x + player.vx;
    let collidedX = false;
    if (player.vx !== 0) {
        const checkX = player.vx > 0 ? nextX + player.width : nextX;
        const top = player.y + 2;
        const mid = player.y + player.height / 2;
        const bottom = player.y + player.height - 2;

        if (isSolidBlockAt(checkX, top) || isSolidBlockAt(checkX, mid) || isSolidBlockAt(checkX, bottom)) {
            collidedX = true;
            if (player.vx > 0) {
                player.x = Math.floor(checkX / TILE_SIZE) * TILE_SIZE - player.width - 0.01;
            } else {
                player.x = (Math.floor(checkX / TILE_SIZE) + 1) * TILE_SIZE + 0.01;
            }
            player.vx = 0;
        }
    }
    if (!collidedX) {
        player.x = nextX;
    }

    // Vertical Movement & Collision
    player.onGround = false;
    const nextY = player.y + player.vy;
    if (player.vy !== 0) {
        const checkY = player.vy > 0 ? nextY + player.height : nextY;
        const left = player.x + 3;
        const right = player.x + player.width - 3;

        if (isSolidBlockAt(left, checkY) || isSolidBlockAt(right, checkY)) {
            if (player.vy > 0) {
                // Landed on floor
                player.y = Math.floor(checkY / TILE_SIZE) * TILE_SIZE - player.height;
                player.onGround = true;
                player.canDoubleJump = true;
                player.hasDoubleJumped = false;
                if (prevVy > 4) {
                    sound.playLand();
                }
            } else {
                // Hit ceiling
                player.y = (Math.floor(checkY / TILE_SIZE) + 1) * TILE_SIZE;
            }
            player.vy = 0;
        } else {
            player.y = nextY;
        }
    }

    // Prevent going behind start of level
    if (player.x < 0) player.x = 0;

    // Wall Slide & Wall Jump Mechanics
    player.isWallSliding = false;
    if (!player.onGround) {
        const checkLeft = isSolidBlockAt(player.x - 2, player.y + 4) || isSolidBlockAt(player.x - 2, player.y + player.height - 4);
        const checkRight = isSolidBlockAt(player.x + player.width + 2, player.y + 4) || isSolidBlockAt(player.x + player.width + 2, player.y + player.height - 4);

        if ((checkLeft && keys.left) || (checkRight && keys.right)) {
            const wallDir = checkLeft ? -1 : 1; // -1: wall is on left, 1: wall is on right
            // Wall slide when moving down
            if (player.vy > 0) {
                player.isWallSliding = true;
                player.vy = Math.min(player.vy, maxFallSpeed * 0.32); // Slow friction descent

                // Emit wall slide dust particles
                if (Math.random() < 0.25) {
                    gameState.particles.push({
                        x: wallDir === -1 ? player.x : player.x + player.width,
                        y: player.y + player.height * 0.7,
                        vx: -wallDir * (Math.random() * 1.2 + 0.4),
                        vy: -Math.random() * 1.5,
                        color: '#94a3b8',
                        size: 3,
                        alpha: 0.8,
                        decay: 0.08,
                        life: 16,
                        maxLife: 16
                    });
                }
            }

            // Wall Jump: Press jump while against the wall!
            if (player.jumpBuffer > 0) {
                player.vx = -wallDir * maxSpeed * 1.35; // Launch away from wall
                player.vy = -jumpPower * 0.95;           // Launch upwards
                player.canDoubleJump = true;             // Refreshes double jump!
                player.hasDoubleJumped = false;
                player.jumpBuffer = 0;
                player.coyoteTime = 0;
                player.isWallSliding = false;
                sound.playJump();

                for (let k = 0; k < 6; k++) {
                    gameState.particles.push({
                        x: wallDir === -1 ? player.x : player.x + player.width,
                        y: player.y + player.height / 2,
                        vx: -wallDir * (Math.random() * 2.2 + 1),
                        vy: (Math.random() - 0.5) * 3,
                        color: '#cbd5e1',
                        size: 3.5,
                        alpha: 0.9,
                        decay: 0.07,
                        life: 20,
                        maxLife: 20
                    });
                }
            }
        }
    }

    // Camera follow (centers player with bounds clamping)
    const viewportWidth = canvasRef ? canvasRef.width : 800;
    const maxCameraX = Math.max(0, gameState.levelWidth * TILE_SIZE - viewportWidth);
    gameState.cameraX = Math.max(0, Math.min(player.x - viewportWidth / 3, maxCameraX));

    // Infinite Mode dynamic chunk extension and maximum extent tracking
    if (gameState.isInfinite) {
        const currentDist = Math.max(0, Math.floor(player.x / TILE_SIZE));
        gameState.maxDistance = Math.max(gameState.maxDistance || 0, currentDist);
        gameState.maxStage = Math.max(gameState.maxStage || 1, gameState.infiniteStage || 1);

        const worldEndX = gameState.levelWidth * TILE_SIZE;
        if (player.x > worldEndX - 45 * TILE_SIZE) {
            extendInfiniteWorld();
        }
    }

    // Milestone Banner timer countdown
    if (gameState.milestoneBanner) {
        gameState.milestoneBanner.timer--;
        if (gameState.milestoneBanner.timer <= 0) {
            gameState.milestoneBanner = null;
        }
    }

    // Invulnerability countdown
    if (player.invulnerableTimer > 0) {
        player.invulnerableTimer--;
    }

    // Coins Check & Magnetism Attraction
    const magnetDist = ts * 2.2;
    for (const coin of gameState.coinsInLevel) {
        if (coin.collected) continue;

        // Magnetism pull: coins gently drift toward player when close
        const cx = coin.x + coin.width / 2;
        const cy = coin.y + coin.height / 2;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dist = Math.hypot(px - cx, py - cy);

        if (dist < magnetDist && dist > 0) {
            const pull = Math.min(6, (magnetDist - dist) * 0.12 + 2.5);
            coin.x += ((px - cx) / dist) * pull;
            coin.y += ((py - cy) / dist) * pull;
            coin.isMagnetized = true;
        } else {
            coin.isMagnetized = false;
        }

        if (
            player.x + player.width > coin.x &&
            player.x < coin.x + coin.width &&
            player.y + player.height > coin.y &&
            player.y < coin.y + coin.height
        ) {
            coin.collected = true;
            gameState.totalCoins++;
            saveTotalCoins();
            sound.playMilestone();
            triggerAlert(ALERT_ACTIONS.COIN_COLLECT, {
                x: coin.x + coin.width / 2,
                y: coin.y - 6,
                amount: 1
            });
        }
    }

    // Enemies Patrol & Collision
    for (const enemy of gameState.enemies) {
        if (enemy.dead) continue;

        // 1. Vertical Gravity & Ground Collision
        enemy.vy = (enemy.vy || 0) + gravity;
        if (enemy.vy > maxFallSpeed) enemy.vy = maxFallSpeed;

        const nextY = enemy.y + enemy.vy;
        const checkBottomY = nextY + enemy.height;
        const midX = enemy.x + enemy.width / 2;

        if (enemy.vy > 0 && isSolidBlockAt(midX, checkBottomY)) {
            enemy.y = Math.floor(checkBottomY / TILE_SIZE) * TILE_SIZE - enemy.height;
            enemy.vy = 0;
            enemy.onGround = true;
        } else {
            enemy.y = nextY;
            enemy.onGround = false;
        }

        // 2. Horizontal Movement with Ledge & Wall Detection
        const nextX = enemy.x + enemy.vx;
        const frontX = enemy.vx > 0 ? nextX + enemy.width + 1 : nextX - 1;
        const footX = enemy.vx > 0 ? nextX + enemy.width - 2 : nextX + 2;
        const footCheckY = enemy.y + enemy.height + 4;
        const bodyMidY = enemy.y + enemy.height / 2;

        // Turn around if front hits a solid wall or if walking off a ledge
        const hitWall = isSolidBlockAt(frontX, bodyMidY);
        const willFallOffLedge = enemy.onGround && !isSolidBlockAt(footX, footCheckY);

        if (hitWall || willFallOffLedge) {
            enemy.vx = -enemy.vx;
        } else {
            enemy.x = nextX;
        }

        // Keep within patrol bounds minX / maxX if specified
        if (enemy.minX !== undefined && enemy.x < enemy.minX) {
            enemy.x = enemy.minX;
            enemy.vx = Math.abs(enemy.vx);
        } else if (enemy.maxX !== undefined && enemy.x > enemy.maxX) {
            enemy.x = enemy.maxX;
            enemy.vx = -Math.abs(enemy.vx);
        }

        // Enemy Hopping behavior (Stage 2+)
        if (enemy.isHopper && enemy.onGround) {
            enemy.hopTimer = (enemy.hopTimer || 0) + 1;
            const dist = Math.abs(player.x - enemy.x);
            if (enemy.hopTimer > 100 || (dist < 130 && enemy.hopTimer > 50)) {
                enemy.vy = -5.2;
                enemy.onGround = false;
                enemy.hopTimer = 0;
            }
        }

        // Collision with player
        if (
            player.x + player.width > enemy.x + 3 &&
            player.x < enemy.x + enemy.width - 3 &&
            player.y + player.height > enemy.y + 3 &&
            player.y < enemy.y + enemy.height - 3
        ) {
            // Check if player landed on top of the enemy (stomp!)
            const isStomp = player.vy > 0 && (player.y + player.height - player.vy <= enemy.y + 12);
            if (isStomp) {
                enemy.dead = true;
                // Super bounce if holding jump key, standard high bounce otherwise!
                player.vy = keys.up ? -10.5 : -8.2;
                player.canDoubleJump = true; // Stomp resets double jump for aerial combos!
                player.hasDoubleJumped = false;
                gameState.totalCoins += 2;
                saveTotalCoins();
                sound.playMilestone();
                triggerAlert(ALERT_ACTIONS.ENEMY_STOMP, {
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y - 8,
                    bonus: 2
                });
                // Shockwave ring particles
                for (let k = 0; k < 8; k++) {
                    const angle = (k / 8) * Math.PI * 2;
                    gameState.particles.push({
                        x: enemy.x + enemy.width / 2,
                        y: enemy.y + enemy.height / 2,
                        vx: Math.cos(angle) * 3.5,
                        vy: Math.sin(angle) * 2.5,
                        color: '#fbbf24',
                        size: 3,
                        alpha: 1,
                        decay: 0.06,
                        life: 20,
                        maxLife: 20
                    });
                }
            } else if (player.invulnerableTimer === 0) {
                gameState.lives--;
                gameState.gameOverReason = 'ENEMY';
                sound.playFall();
                player.invulnerableTimer = 60; // 1s invulnerability
                player.vy = -6;
                player.vx = player.x < enemy.x ? -5 : 5;

                triggerAlert(ALERT_ACTIONS.ENEMY_HIT, {
                    x: player.x + player.width / 2,
                    y: player.y - 12,
                    lives: gameState.lives
                });

                if (gameState.lives <= 0) {
                    gameState.state = 'GAME_OVER';
                }
            }
        }
    }
    // Clean up defeated enemies
    if (gameState.enemies.some(e => e.dead)) {
        gameState.enemies = gameState.enemies.filter(e => !e.dead);
    }

    // Finish / Milestone Flag Collision
    if (gameState.isInfinite) {
        if (gameState.flags && gameState.flags.length > 0) {
            for (const flag of gameState.flags) {
                if (
                    !flag.triggered &&
                    player.x + player.width > flag.x + 4 &&
                    player.x < flag.x + flag.width &&
                    player.y + player.height > flag.y - 16 &&
                    player.y < flag.y + flag.height
                ) {
                    flag.triggered = true;
                    sound.playMilestone();
                    gameState.totalCoins += 5;
                    saveTotalCoins();
                    const restoredHeart = gameState.lives < 3;
                    if (restoredHeart) gameState.lives++;
                    gameState.infiniteStage = (flag.stage || gameState.infiniteStage) + 1;
                    triggerAlert(ALERT_ACTIONS.STAGE_CLEARED, {
                        x: flag.x + 8,
                        y: flag.y - 20,
                        stage: flag.stage,
                        restoredHeart
                    });
                }
            }
        }
    } else if (gameState.flag) {
        const flag = gameState.flag;
        if (
            player.x + player.width > flag.x + 4 &&
            player.x < flag.x + flag.width &&
            player.y + player.height > flag.y - 16 &&
            player.y < flag.y + flag.height
        ) {
            sound.playMilestone();
            if (gameState.currentLevelIdx < gameState.levels.length - 1) {
                const nextIdx = gameState.currentLevelIdx + 1;
                const nextName = gameState.levels[nextIdx]?.name || `Level ${nextIdx + 1}`;
                loadLevel(nextIdx, canvasRef ? canvasRef.height : 640);
                triggerAlert(ALERT_ACTIONS.LEVEL_CLEARED, {
                    levelNum: nextIdx,
                    nextLevelName: nextName
                });
            } else {
                // Completed all custom levels! Trigger "YOU WIN" sequence & wait for player button click
                gameState.state = 'WIN';
                gameState.winTimer = 0;
                gameState.totalCoins += 10; // +10 Bonus Coins as victory reward!
                saveTotalCoins();
                sound.playVictory();
                triggerAlert(ALERT_ACTIONS.GAME_WIN, {
                    x: flag.x + 8,
                    y: flag.y - 20
                });
            }
        }
    }

    // Fall below level (chasms and custom level pits)
    if (player.y > GRID_ROWS * TILE_SIZE + 16) {
        gameState.lives--;
        gameState.gameOverReason = 'PIT';
        sound.playFall();
        triggerAlert(ALERT_ACTIONS.FALL_CHASM, {
            x: player.x + player.width / 2,
            y: (GRID_ROWS - 1) * TILE_SIZE,
            lives: gameState.lives
        });

        if (gameState.lives <= 0) {
            gameState.state = 'GAME_OVER';
        } else {
            if (gameState.isInfinite) {
                // Respawn on safe ground near player's recent progress (search backwards for solid ground)
                let safeCol = Math.max(2, Math.floor(player.x / TILE_SIZE) - 2);
                const grid = gameState.currentLevel?.grid;
                if (grid) {
                    while (safeCol > 2) {
                        let hasGround = false;
                        for (let r = 5; r < GRID_ROWS; r++) {
                            if (grid[r] && grid[r][safeCol] === '#') {
                                hasGround = true;
                                break;
                            }
                        }
                        if (hasGround) break;
                        safeCol--;
                    }
                }
                let groundRow = 15;
                if (grid) {
                    for (let r = 0; r < GRID_ROWS; r++) {
                        if (grid[r] && grid[r][safeCol] === '#') {
                            groundRow = r;
                            break;
                        }
                    }
                }
                player.x = safeCol * TILE_SIZE + 2;
                player.y = (groundRow - 1) * TILE_SIZE;
                player.vx = 0;
                player.vy = 0;
                player.invulnerableTimer = 90;
            } else {
                resetPlayerToSpawn();
            }
        }
    }
}

function gameLoop() {
    if (!canvasRef || !ctxRef) return;

    updatePhysics();
    draw(ctxRef, canvasRef.width, canvasRef.height, displayTextRef);

    animFrameId = requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    if (!canvasRef) return;
    canvasRef.width = window.innerWidth;
    canvasRef.height = window.innerHeight;

    const oldTileSize = TILE_SIZE;
    const calculatedTileSize = Math.max(16, Math.floor(canvasRef.height / GRID_ROWS));
    setTileSize(calculatedTileSize);
    player.width = Math.round(TILE_SIZE * 0.7);
    player.height = Math.round(TILE_SIZE * 0.85);

    if (gameState.isInfinite) {
        if (oldTileSize !== calculatedTileSize && oldTileSize > 0) {
            const scale = calculatedTileSize / oldTileSize;
            player.x *= scale;
            player.y *= scale;
            for (const coin of gameState.coinsInLevel) {
                coin.x = coin.c * calculatedTileSize + calculatedTileSize * 0.25;
                coin.y = coin.r * calculatedTileSize + calculatedTileSize * 0.25;
                coin.width = calculatedTileSize * 0.5;
                coin.height = calculatedTileSize * 0.5;
            }
            for (const enemy of gameState.enemies) {
                enemy.x = enemy.c * calculatedTileSize + 2;
                enemy.y = enemy.r * calculatedTileSize + 2;
                enemy.width = calculatedTileSize - 4;
                enemy.height = calculatedTileSize - 4;
                enemy.minX = Math.max(0, (enemy.c - 2) * calculatedTileSize);
                enemy.maxX = (enemy.c + 3) * calculatedTileSize;
            }
            for (const flag of gameState.flags) {
                flag.x = flag.c * calculatedTileSize;
                flag.y = flag.r * calculatedTileSize;
                flag.width = calculatedTileSize;
                flag.height = calculatedTileSize;
            }
        }
    } else if (gameState.currentLevel) {
        loadLevel(gameState.currentLevelIdx, canvasRef.height);
    }
}

export async function startPlatformer(canvas, options = 'Coming Soon') {
    stopPlatformer();
    syncCoinsWithCode();

    if (typeof options === 'object' && options !== null) {
        setPlatformerLocale(options.language || options.lang || 'en', options.t || null);
        displayTextRef = options.displayText || '';
    } else if (typeof options === 'string') {
        displayTextRef = options;
    }

    canvasRef = canvas;
    ctxRef = canvas.getContext('2d');

    canvasRef.width = window.innerWidth;
    canvasRef.height = window.innerHeight;

    boundKeyDown = handleKeyDown;
    boundKeyUp = handleKeyUp;
    boundResize = resizeCanvas;
    boundPointerMove = (e) => {
        if (gameState.state === 'WIN' && gameState.uiButtons) {
            const coords = getCanvasCoords(e);
            if (isInsideRect(coords, gameState.uiButtons.playInfinite)) {
                gameState.hoveredButton = 'playInfinite';
                if (canvasRef) canvasRef.style.cursor = 'pointer';
            } else if (isInsideRect(coords, gameState.uiButtons.replayLevels)) {
                gameState.hoveredButton = 'replayLevels';
                if (canvasRef) canvasRef.style.cursor = 'pointer';
            } else {
                gameState.hoveredButton = null;
                if (canvasRef) canvasRef.style.cursor = 'default';
            }
        } else {
            if (gameState.hoveredButton) gameState.hoveredButton = null;
            if (canvasRef && canvasRef.style.cursor === 'pointer') {
                canvasRef.style.cursor = 'default';
            }
        }
    };

    boundPointerLeave = () => {
        if (gameState.hoveredButton) gameState.hoveredButton = null;
        if (canvasRef && canvasRef.style.cursor === 'pointer') {
            canvasRef.style.cursor = 'default';
        }
    };

    boundPointerDown = (e) => {
        sound.init();
        if (gameState.state === 'WIN') {
            if (gameState.uiButtons) {
                const coords = getCanvasCoords(e);
                if (isInsideRect(coords, gameState.uiButtons.playInfinite)) {
                    gameState.hoveredButton = null;
                    if (canvasRef) canvasRef.style.cursor = 'default';
                    initInfiniteMode(canvasRef ? canvasRef.height : 640, true);
                } else if (isInsideRect(coords, gameState.uiButtons.replayLevels)) {
                    gameState.hoveredButton = null;
                    if (canvasRef) canvasRef.style.cursor = 'default';
                    loadLevel(0, canvasRef ? canvasRef.height : 640);
                }
            }
            return;
        } else if (gameState.state === 'GAME_OVER') {
            if (gameState.isInfinite) {
                initInfiniteMode(canvasRef ? canvasRef.height : 640, false);
            } else {
                loadLevel(gameState.currentLevelIdx, canvasRef ? canvasRef.height : 640);
            }
        }
    };

    window.addEventListener('keydown', boundKeyDown);
    window.addEventListener('keyup', boundKeyUp);
    window.addEventListener('resize', boundResize);
    window.addEventListener('pointerdown', boundPointerDown);
    window.addEventListener('pointermove', boundPointerMove);
    if (canvasRef) {
        canvasRef.addEventListener('pointerleave', boundPointerLeave);
    }

    gameState.state = 'LOADING';

    // Fetch custom levels from API
    try {
        let res = await fetch('/api/konami/levels');
        if (res.status === 404) {
            res = await fetch('/api/cms/content?type=konami');
        }
        if (res.ok) {
            const levels = await res.json();
            if (Array.isArray(levels) && levels.length > 0) {
                gameState.levels = levels;
                loadLevel(0, canvasRef.height);
            } else {
                // No custom levels -> Start procedural infinite platformer!
                initInfiniteMode(canvasRef.height);
            }
        } else {
            initInfiniteMode(canvasRef.height);
        }
    } catch (err) {
        console.warn('Could not fetch custom levels, starting infinite mode:', err);
        initInfiniteMode(canvasRef.height);
    }

    animFrameId = requestAnimationFrame(gameLoop);
}


export function stopPlatformer() {
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    if (boundKeyDown) {
        window.removeEventListener('keydown', boundKeyDown);
        boundKeyDown = null;
    }
    if (boundKeyUp) {
        window.removeEventListener('keyup', boundKeyUp);
        boundKeyUp = null;
    }
    if (boundResize) {
        window.removeEventListener('resize', boundResize);
        boundResize = null;
    }
    if (boundPointerDown) {
        window.removeEventListener('pointerdown', boundPointerDown);
        boundPointerDown = null;
    }
    if (boundPointerMove) {
        window.removeEventListener('pointermove', boundPointerMove);
        boundPointerMove = null;
    }
    if (boundPointerLeave && canvasRef) {
        canvasRef.removeEventListener('pointerleave', boundPointerLeave);
        boundPointerLeave = null;
    }
    if (canvasRef) {
        canvasRef.style.cursor = 'default';
    }
    canvasRef = null;
    ctxRef = null;
}
