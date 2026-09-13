import { generateProceduralChunk } from './procedural.js';
import { konami } from '../locales/konami.js';

// Custom levels platformer model
export const GRID_ROWS = 16;
export let TILE_SIZE = 40;

export const KANNADA_DIGITS = ['೦', '೧', '೨', '೩', '೪', '೫', '೬', '೭', '೮', '೯'];

export const formatNumber = (value, lang = 'en') => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (lang === 'kn') {
        return str.replace(/[0-9]/g, (digit) => KANNADA_DIGITS[Number(digit)]);
    }
    return str;
};

export function setTileSize(size) {
    TILE_SIZE = size;
}

export const player = {
    x: 60,
    y: 300,
    width: 28,
    height: 34,
    vx: 0,
    vy: 0,
    onGround: false,
    coyoteTime: 0,
    jumpBuffer: 0,
    invulnerableTimer: 0,
    canDoubleJump: true,
    hasDoubleJumped: false
};

export const gameState = {
    state: 'LOADING', // 'LOADING' | 'EMPTY' | 'PLAYING' | 'WIN' | 'GAME_OVER'
    levels: [],
    currentLevelIdx: 0,
    currentLevel: null,
    levelWidth: 40,
    cameraX: 0,
    lives: 3,
    totalCoins: 0,
    coinsInLevel: [],
    enemies: [],
    flag: null,
    flags: [],
    spawn: { x: 2, y: 14 },
    particles: [],
    isInfinite: false,
    infiniteStage: 1,
    maxDistance: 0,
    maxStage: 1,
    lastChunkGround: 15,
    milestoneBanner: null,
    winTimer: 0,
    gameOverReason: null,
    uiButtons: {
        playInfinite: null,
        replayLevels: null
    },
    hoveredButton: null,
    lang: 'en',
    t: null
};

export function setPlatformerLocale(lang = 'en', t = null) {
    gameState.lang = lang || 'en';
    gameState.t = t;
}

export function getPlatformerText(key, params = {}) {
    const lang = gameState.lang || 'en';
    let template = '';

    if (typeof gameState.t === 'function') {
        const tVal = gameState.t('platformer.' + key);
        if (tVal && tVal !== 'platformer.' + key) {
            template = tVal;
        } else {
            const rootVal = gameState.t(key);
            if (rootVal && rootVal !== key) {
                template = rootVal;
            }
        }
    }

    if (!template) {
        template = konami[lang]?.platformer?.[key] || konami.en?.platformer?.[key] || key;
    }

    if (typeof template !== 'string') return template;

    return template.replace(/\{(\w+)\}/g, (match, paramKey) => {
        if (paramKey in params) {
            const val = params[paramKey];
            if (typeof val === 'number') {
                return formatNumber(val, lang);
            }
            return String(val);
        }
        return match;
    });
}

export function saveTotalCoins() {
    try {
        localStorage.setItem('konami_coins', String(gameState.totalCoins));
        const currentCode = sessionStorage.getItem('validKonamiCode');
        if (currentCode) {
            localStorage.setItem('konami_coins_code', currentCode);
        }
    } catch (e) {
        // ignore
    }
}

export function resetTotalCoins(newCode = null) {
    gameState.totalCoins = 0;
    try {
        localStorage.setItem('konami_coins', '0');
        if (newCode) {
            localStorage.setItem('konami_coins_code', newCode);
        } else {
            localStorage.removeItem('konami_coins_code');
        }
    } catch (e) {
        // ignore
    }
}

export function syncCoinsWithCode(code) {
    try {
        const activeCode = code || sessionStorage.getItem('validKonamiCode');
        const savedCode = localStorage.getItem('konami_coins_code');
        if (!activeCode || savedCode !== activeCode) {
            gameState.totalCoins = 0;
            localStorage.setItem('konami_coins', '0');
            if (activeCode) {
                localStorage.setItem('konami_coins_code', activeCode);
            } else {
                localStorage.removeItem('konami_coins_code');
            }
        } else {
            const savedCoins = localStorage.getItem('konami_coins');
            gameState.totalCoins = parseInt(savedCoins, 10) || 0;
        }
    } catch (e) {
        gameState.totalCoins = 0;
    }
}

// Initial sync on module load
syncCoinsWithCode();


export function loadLevel(levelIndex, viewportHeight = 640) {
    gameState.isInfinite = false;
    gameState.maxDistance = 0;
    gameState.maxStage = 1;
    gameState.milestoneBanner = null;
    gameState.gameOverReason = null;
    gameState.uiButtons = { playInfinite: null, replayLevels: null };
    gameState.hoveredButton = null;

    if (!gameState.levels || gameState.levels.length === 0) {
        return initInfiniteMode(viewportHeight);
    }

    if (levelIndex < 0 || levelIndex >= gameState.levels.length) {
        // User finished all custom levels -> transition to procedural infinite mode!
        return initInfiniteMode(viewportHeight);
    }

    const level = gameState.levels[levelIndex];
    gameState.currentLevelIdx = levelIndex;
    gameState.currentLevel = level;
    gameState.levelWidth = level.width || 40;

    // Calculate TILE_SIZE dynamically based on viewport height so 16 rows fit nicely
    const calculatedTileSize = Math.max(16, Math.floor(viewportHeight / GRID_ROWS));
    setTileSize(calculatedTileSize);

    player.width = Math.round(TILE_SIZE * 0.7);
    player.height = Math.round(TILE_SIZE * 0.85);

    // Parse grid entities: coins, enemies, flag, spawn
    gameState.coinsInLevel = [];
    gameState.enemies = [];
    gameState.flag = null;
    gameState.flags = [];
    gameState.spawn = { x: 2, y: 14 };

    const grid = level.grid || level.map || [];

    // Unlimited ground guarantee: bottom floor (Row 15) is always solid '#' across all columns
    if (!grid[GRID_ROWS - 1]) grid[GRID_ROWS - 1] = [];
    for (let c = 0; c < gameState.levelWidth; c++) {
        grid[GRID_ROWS - 1][c] = '#';
    }

    for (let r = 0; r < GRID_ROWS; r++) {
        const row = grid[r] || [];
        for (let c = 0; c < gameState.levelWidth; c++) {
            const char = row[c];
            if (char === 'C') {
                gameState.coinsInLevel.push({
                    c,
                    r,
                    x: c * TILE_SIZE + TILE_SIZE * 0.25,
                    y: r * TILE_SIZE + TILE_SIZE * 0.25,
                    width: TILE_SIZE * 0.5,
                    height: TILE_SIZE * 0.5,
                    collected: false
                });
            } else if (char === 'E') {
                gameState.enemies.push({
                    c,
                    r,
                    x: c * TILE_SIZE + 2,
                    y: r * TILE_SIZE + 2,
                    width: TILE_SIZE - 4,
                    height: TILE_SIZE - 4,
                    vx: 1.2,
                    minX: Math.max(0, (c - 2) * TILE_SIZE),
                    maxX: (c + 3) * TILE_SIZE
                });
            } else if (char === 'F') {
                const fObj = {
                    c,
                    r,
                    x: c * TILE_SIZE,
                    y: r * TILE_SIZE,
                    width: TILE_SIZE,
                    height: TILE_SIZE
                };
                gameState.flag = fObj;
                gameState.flags.push(fObj);
            } else if (char === 'P') {
                gameState.spawn = { x: c, y: r };
            }
        }
    }

    // Reset player position to spawn
    resetPlayerToSpawn();

    gameState.lives = 3;
    gameState.cameraX = 0;
    gameState.state = 'PLAYING';
    return true;
}

export function initInfiniteMode(viewportHeight = 640, isVictoryReward = false) {
    gameState.isInfinite = true;
    gameState.infiniteStage = 1;
    gameState.maxDistance = 0;
    gameState.maxStage = 1;
    gameState.lastChunkGround = 15;
    gameState.winTimer = 0;
    gameState.gameOverReason = null;
    gameState.uiButtons = { playInfinite: null, replayLevels: null };
    gameState.hoveredButton = null;
    gameState.milestoneBanner = isVictoryReward
        ? { text: '🎁 VICTORY REWARD: PROCEDURAL INFINITE PLATFORMER! ♾️', timer: 180 }
        : null;

    const calculatedTileSize = Math.max(16, Math.floor(viewportHeight / GRID_ROWS));
    setTileSize(calculatedTileSize);

    player.width = Math.round(TILE_SIZE * 0.7);
    player.height = Math.round(TILE_SIZE * 0.85);

    // Generate initial chunk (columns 0-60) with player spawn
    const firstChunk = generateProceduralChunk(0, 60, 1, 15, true);

    gameState.currentLevel = {
        id: 'infinite-mode',
        name: 'Infinite Run',
        width: firstChunk.length,
        grid: firstChunk.grid
    };
    gameState.levelWidth = firstChunk.length;
    gameState.coinsInLevel = [...firstChunk.coins];
    gameState.enemies = [...firstChunk.enemies];
    gameState.flags = firstChunk.flag ? [firstChunk.flag] : [];
    gameState.flag = firstChunk.flag;
    gameState.spawn = firstChunk.spawn || { x: 2, y: 14 };
    gameState.lastChunkGround = firstChunk.endGroundRow;

    // Pre-extend chunks so world is far ahead of player (total ~180 columns, 3 stages)
    extendInfiniteWorld();
    extendInfiniteWorld();

    resetPlayerToSpawn();
    gameState.lives = 3;
    gameState.cameraX = 0;
    gameState.state = 'PLAYING';
    return true;
}

export function extendInfiniteWorld() {
    if (!gameState.isInfinite || !gameState.currentLevel) return;

    const startCol = gameState.levelWidth;
    const stageForChunk = (gameState.flags.length || 0) + 1;
    const nextChunk = generateProceduralChunk(startCol, 60, stageForChunk, gameState.lastChunkGround, false);

    // Append columns to current grid
    for (let r = 0; r < GRID_ROWS; r++) {
        if (!gameState.currentLevel.grid[r]) gameState.currentLevel.grid[r] = [];
        gameState.currentLevel.grid[r].push(...nextChunk.grid[r]);
    }

    gameState.levelWidth += nextChunk.length;
    if (gameState.currentLevel) {
        gameState.currentLevel.width = gameState.levelWidth;
    }
    gameState.lastChunkGround = nextChunk.endGroundRow;

    if (nextChunk.coins && nextChunk.coins.length > 0) {
        gameState.coinsInLevel.push(...nextChunk.coins);
    }
    if (nextChunk.enemies && nextChunk.enemies.length > 0) {
        gameState.enemies.push(...nextChunk.enemies);
    }
    if (nextChunk.flag) {
        gameState.flags.push(nextChunk.flag);
    }
}

export function resetPlayerToSpawn() {
    player.x = gameState.spawn.x * TILE_SIZE + 2;
    player.y = gameState.spawn.y * TILE_SIZE + 2;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.coyoteTime = 0;
    player.jumpBuffer = 0;
    player.invulnerableTimer = 45; // 0.75s grace period
    player.canDoubleJump = true;
    player.hasDoubleJumped = false;
}

export function addDoubleJumpParticles(cx, cy) {
    if (!gameState.particles) gameState.particles = [];
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        const speed = Math.random() * 2 + 1.5;
        gameState.particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed * 0.6 + 1.0, // slight downward bias
            size: Math.random() * 3 + 2,
            alpha: 1.0,
            color: '#60a5fa'
        });
    }
}

export function addTextParticle(x, y, text, color = '#ffffff', size = 15) {
    if (!gameState.particles) gameState.particles = [];
    gameState.particles.push({
        type: 'text',
        x,
        y,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -1.3,
        size,
        alpha: 1.0,
        decay: 0.02,
        color,
        text
    });
}

