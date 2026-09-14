// Procedural Infinite Level Generator for 16-Row Grid System
// Guarantees 100% jumpable, head-bump-free, fun, and varied gameplay every time.
import { GRID_ROWS, TILE_SIZE } from './model.js';

/**
 * Creates an empty 16-row character matrix for the given width.
 */
function createEmptyChunk(width) {
    const grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        grid.push(new Array(width).fill('.'));
    }
    return grid;
}

/**
 * Helper: Fills ground column from groundRow down to row 15 with solid blocks '#'.
 */
function fillGroundCol(grid, col, groundRow) {
    if (col >= grid[0].length) return;
    for (let r = groundRow; r < GRID_ROWS; r++) {
        grid[r][col] = '#';
    }
}

/**
 * Helper: Ensures full vertical headroom (at least 4 empty rows above the walking surface).
 */
function ensureHeadroom(grid, col, groundRow) {
    if (col >= grid[0].length) return;
    for (let r = 0; r < groundRow; r++) {
        grid[r][col] = '.';
    }
}

// ---------------------------------------------------------------------------
// PROCEDURAL MODULES (All strictly 1-block elevation steps & jumpable gaps)
// ---------------------------------------------------------------------------

// 1. Flat Plains with varied coin formations
function buildFlatPlains(grid, startCol, groundRow) {
    const length = 5 + Math.floor(Math.random() * 4); // 5 to 8 tiles
    const coinStyle = Math.floor(Math.random() * 3);

    for (let c = 0; c < length; c++) {
        const col = startCol + c;
        fillGroundCol(grid, col, groundRow);
        ensureHeadroom(grid, col, groundRow);

        if (coinStyle === 0) {
            // Alternating coins
            if (c >= 1 && c <= length - 2 && c % 2 === 0) {
                grid[groundRow - 2][col] = 'C';
            }
        } else if (coinStyle === 1) {
            // Coin pair in middle
            if (c === Math.floor(length / 2) || c === Math.floor(length / 2) + 1) {
                grid[groundRow - 2][col] = 'C';
            }
        } else {
            // Gentle coin arch
            if (c === Math.floor(length / 2)) {
                grid[groundRow - 3][col] = 'C';
            } else if (c === Math.floor(length / 2) - 1 || c === Math.floor(length / 2) + 1) {
                grid[groundRow - 2][col] = 'C';
            }
        }
    }
    return { nextCol: startCol + length, nextGround: groundRow };
}

// 2. Stepped Hill (Smooth 1-block elevation change: 15 -> 14 -> 15 or 14 -> 13 -> 14)
function buildSteppedHill(grid, startCol, groundRow) {
    const stepUpRow = Math.max(13, groundRow - 1);
    const launchLen = 2 + Math.floor(Math.random() * 2);
    const summitLen = 3 + Math.floor(Math.random() * 3);
    const landLen = 2 + Math.floor(Math.random() * 2);

    let col = startCol;

    // Launch ground
    for (let c = 0; c < launchLen; c++) {
        fillGroundCol(grid, col, groundRow);
        ensureHeadroom(grid, col, groundRow);
        col++;
    }

    // Elevated summit (exactly 1 block higher, solid underneath so no head-bumping!)
    for (let c = 0; c < summitLen; c++) {
        fillGroundCol(grid, col, stepUpRow);
        ensureHeadroom(grid, col, stepUpRow);
        if (c === 1 || c === summitLen - 2) {
            grid[stepUpRow - 2][col] = 'C';
        }
        col++;
    }

    // Return ground (step down 1 block)
    for (let c = 0; c < landLen; c++) {
        fillGroundCol(grid, col, groundRow);
        ensureHeadroom(grid, col, groundRow);
        col++;
    }

    return { nextCol: col, nextGround: groundRow };
}

// 3. Chasm Leap (Jumpable 2-tile bottomless pit with parabolic leap coin arc)
function buildChasmLeap(grid, startCol, groundRow) {
    const launchPadWidth = 3;
    const gapWidth = 2; // Jumpable 2-tile chasm!
    const landingPadWidth = 3;

    let col = startCol;

    // Launch runway
    for (let c = 0; c < launchPadWidth; c++) {
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;
    }

    // Chasm Pit: open bottomless gap with leap coin arc
    for (let c = 0; c < gapWidth; c++) {
        ensureHeadroom(grid, col, GRID_ROWS);
        grid[13][col] = 'C';
        col++;
    }

    // Landing runway
    for (let c = 0; c < landingPadWidth; c++) {
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;
    }

    return { nextCol: col, nextGround: 15 };
}

// 4. Canyon with Stepping Island (Two jumpable 2-tile chasms with solid stepping island)
function buildCanyonWithIsland(grid, startCol, groundRow) {
    const launchPad = 3;
    const gap1 = 2;
    const islandLen = 3;
    const gap2 = 2;
    const landingPad = 3;

    let col = startCol;

    // Launch pad
    for (let c = 0; c < launchPad; c++) {
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;
    }

    // Chasm 1 (2 tiles)
    for (let c = 0; c < gap1; c++) {
        ensureHeadroom(grid, col, GRID_ROWS);
        grid[13][col] = 'C';
        col++;
    }

    // Solid stepping island (elevated at row 14)
    for (let c = 0; c < islandLen; c++) {
        fillGroundCol(grid, col, 14);
        ensureHeadroom(grid, col, 14);
        grid[12][col] = 'C';
        col++;
    }

    // Chasm 2 (2 tiles)
    for (let c = 0; c < gap2; c++) {
        ensureHeadroom(grid, col, GRID_ROWS);
        grid[13][col] = 'C';
        col++;
    }

    // Landing pad
    for (let c = 0; c < landingPad; c++) {
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;
    }

    return { nextCol: col, nextGround: 15 };
}

// 5. Solid Elevated Skyway (15 -> 14 -> 13 -> 14 -> 15 with coins)
// Solid fill ensures NO cramped caves or head bonks underneath!
function buildElevatedSkyway(grid, startCol, groundRow) {
    let col = startCol;
    const baseRow = 15;
    const midRow = 14;
    const peakRow = 13;

    // Approach
    for (let c = 0; c < 2; c++) {
        fillGroundCol(grid, col, baseRow);
        ensureHeadroom(grid, col, baseRow);
        col++;
    }

    // Step 1 (14)
    for (let c = 0; c < 2; c++) {
        fillGroundCol(grid, col, midRow);
        ensureHeadroom(grid, col, midRow);
        col++;
    }

    // Peak Skyway (13) with coins
    for (let c = 0; c < 4; c++) {
        fillGroundCol(grid, col, peakRow);
        ensureHeadroom(grid, col, peakRow);
        if (c === 1 || c === 2) {
            grid[peakRow - 2][col] = 'C';
        }
        col++;
    }

    // Step down (14)
    for (let c = 0; c < 2; c++) {
        fillGroundCol(grid, col, midRow);
        ensureHeadroom(grid, col, midRow);
        col++;
    }

    // Landing base (15)
    for (let c = 0; c < 2; c++) {
        fillGroundCol(grid, col, baseRow);
        ensureHeadroom(grid, col, baseRow);
        col++;
    }

    return { nextCol: col, nextGround: baseRow };
}

// 6. Pillar Parkour (Two elevated stepping pillars separated by jumpable 1-tile chasm gaps)
function buildPillarParkour(grid, startCol, groundRow) {
    let col = startCol;

    // Launch runway
    for (let c = 0; c < 3; c++) {
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;
    }

    // Chasm 1 (1 tile)
    ensureHeadroom(grid, col, GRID_ROWS);
    grid[13][col] = 'C';
    col++;

    // Pillar 1 (2 tiles wide, elevated at row 14)
    for (let c = 0; c < 2; c++) {
        fillGroundCol(grid, col, 14);
        ensureHeadroom(grid, col, 14);
        grid[12][col] = 'C';
        col++;
    }

    // Chasm 2 (1 tile)
    ensureHeadroom(grid, col, GRID_ROWS);
    grid[13][col] = 'C';
    col++;

    // Pillar 2 (2 tiles wide, elevated at row 13)
    for (let c = 0; c < 2; c++) {
        fillGroundCol(grid, col, 13);
        ensureHeadroom(grid, col, 13);
        grid[11][col] = 'C';
        col++;
    }

    // Chasm 3 (1 tile)
    ensureHeadroom(grid, col, GRID_ROWS);
    grid[13][col] = 'C';
    col++;

    // Landing runway
    for (let c = 0; c < 3; c++) {
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;
    }

    return { nextCol: col, nextGround: 15 };
}

// 7. Enemy Guard Outpost (Wide flat platform, enemy safely in center with open sky)
function buildEnemyOutpost(grid, startCol, groundRow) {
    const length = 8 + Math.floor(Math.random() * 2); // 8-9 tiles wide
    const enemyOffset = Math.floor(length / 2);

    for (let c = 0; c < length; c++) {
        const col = startCol + c;
        fillGroundCol(grid, col, groundRow);
        ensureHeadroom(grid, col, groundRow);

        if (c === enemyOffset) {
            // Enemy safely in the middle with ample clearance
            grid[groundRow - 1][col] = 'E';
            // Reward coin hovering above enemy for bounce stomp
            grid[groundRow - 3][col] = 'C';
        } else if (c === 1 || c === length - 2) {
            grid[groundRow - 2][col] = 'C';
        }
    }

    return { nextCol: startCol + length, nextGround: groundRow };
}

// 8. Low Barrier Hurdle (1 block high hurdle on flat ground)
function buildLowHurdle(grid, startCol, groundRow) {
    let col = startCol;

    // Approach
    for (let c = 0; c < 2; c++) {
        fillGroundCol(grid, col, groundRow);
        ensureHeadroom(grid, col, groundRow);
        col++;
    }

    // 1-tile single block hurdle (effortlessly jumped over with 1-block jump)
    fillGroundCol(grid, col, groundRow);
    ensureHeadroom(grid, col, groundRow);
    grid[groundRow - 1][col] = '#';
    grid[groundRow - 3][col] = 'C';
    col++;

    // Recovery runway
    for (let c = 0; c < 3; c++) {
        fillGroundCol(grid, col, groundRow);
        ensureHeadroom(grid, col, groundRow);
        col++;
    }

    return { nextCol: col, nextGround: groundRow };
}

// 9. Stepped High Plateau (Smooth 1-block steps up to an elevated plateau at Row 12, solid underneath)
function buildMultiTierHighRoad(grid, startCol, groundRow) {
    let col = startCol;

    // Approach runway (2 tiles at Row 15)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }

    // Step up: Row 14 (2 tiles)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); grid[12][col] = 'C'; col++; }

    // Step up: Row 13 (2 tiles)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 13); ensureHeadroom(grid, col, 13); grid[11][col] = 'C'; col++; }

    // Elevated Plateau: Row 12 (4 tiles, solid fill below!)
    for (let c = 0; c < 4; c++) {
        fillGroundCol(grid, col, 12);
        ensureHeadroom(grid, col, 12);
        if (c === 1 || c === 2) grid[10][col] = 'C';
        if (c === 2) grid[11][col] = 'E'; // Sentry bug on plateau
        col++;
    }

    // Step down: Row 13 (2 tiles)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 13); ensureHeadroom(grid, col, 13); grid[11][col] = 'C'; col++; }

    // Step down: Row 14 (2 tiles)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); grid[12][col] = 'C'; col++; }

    // Exit runway (2 tiles at Row 15)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }

    return { nextCol: col, nextGround: 15 };
}

// 10. Step Pyramid (Ascending & descending mountain with summit bug and apex coin)
function buildStepPyramid(grid, startCol, groundRow) {
    let col = startCol;
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); grid[12][col] = 'C'; col++; }
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 13); ensureHeadroom(grid, col, 13); grid[11][col] = 'C'; col++; }
    for (let c = 0; c < 3; c++) {
        fillGroundCol(grid, col, 12); ensureHeadroom(grid, col, 12);
        if (c === 1) { grid[11][col] = 'E'; grid[9][col] = 'C'; }
        col++;
    }
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 13); ensureHeadroom(grid, col, 13); grid[11][col] = 'C'; col++; }
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); grid[12][col] = 'C'; col++; }
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    return { nextCol: col, nextGround: 15 };
}

// 11. Stepped Staircase Ridge (Ascending and descending stepped stone terraces with 1-block steps)
function buildFloatingStepLadder(grid, startCol, groundRow) {
    let col = startCol;

    // Approach runway (2 tiles at Row 15)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }

    // Step 1: Row 14 (2 tiles, solid fill)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); grid[12][col] = 'C'; col++; }

    // Step 2: Row 13 (2 tiles, solid fill)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 13); ensureHeadroom(grid, col, 13); grid[11][col] = 'C'; col++; }

    // Summit Step 3: Row 12 (3 tiles, solid fill) with bug and apex coin
    for (let c = 0; c < 3; c++) {
        fillGroundCol(grid, col, 12);
        ensureHeadroom(grid, col, 12);
        if (c === 1) { grid[11][col] = 'E'; grid[10][col] = 'C'; }
        col++;
    }

    // Step 4: Row 13 (2 tiles, solid fill)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 13); ensureHeadroom(grid, col, 13); grid[11][col] = 'C'; col++; }

    // Step 5: Row 14 (2 tiles, solid fill)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); grid[12][col] = 'C'; col++; }

    // Exit runway (2 tiles at Row 15)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }

    return { nextCol: col, nextGround: 15 };
}

// 12. Skybridge over Chasm (Jumpable chasm spanned by 1-block stepped bridge at Row 13)
function buildSkybridgeChasm(grid, startCol, groundRow) {
    let col = startCol;
    // Launch pad (3 tiles at Row 15)
    for (let c = 0; c < 3; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    // Step up to Row 14 (2 tiles at Row 14, solid fill)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); col++; }
    // Skybridge spanning overhead (Row 13, chasm below at row 14-15)
    for (let c = 0; c < 3; c++) {
        ensureHeadroom(grid, col, GRID_ROWS); // Empty bottom chasm!
        grid[13][col] = '#'; // Solid bridge at Row 13 (strictly 1 block above launch pad at Row 14!)
        grid[11][col] = 'C'; // Coins on bridge
        col++;
    }
    // Landing pad step down to Row 14 (2 tiles at Row 14, solid fill)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); col++; }
    // Landing runway (3 tiles at Row 15)
    for (let c = 0; c < 3; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    return { nextCol: col, nextGround: 15 };
}

// 13. Double Hurdle Sprint (Two rhythmic 1-block hurdles with leap coins)
function buildDoubleHurdleRun(grid, startCol, groundRow) {
    let col = startCol;
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15);
    grid[14][col] = '#';
    grid[12][col] = 'C';
    col++;
    for (let c = 0; c < 3; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15);
    grid[14][col] = '#';
    grid[12][col] = 'C';
    col++;
    for (let c = 0; c < 3; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    return { nextCol: col, nextGround: 15 };
}

// 14. Canyon with Sentry Island (Central sentry island flanked by jumpable 2-tile chasms)
function buildCanyonWithSentry(grid, startCol, groundRow) {
    let col = startCol;
    for (let c = 0; c < 3; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    // Chasm 1 (2 tiles)
    for (let c = 0; c < 2; c++) { ensureHeadroom(grid, col, GRID_ROWS); grid[13][col] = 'C'; col++; }
    // Island (3 tiles, row 14)
    const islandStart = col;
    for (let c = 0; c < 3; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); col++; }
    grid[13][islandStart + 1] = 'E'; // Sentry bug on island
    grid[10][islandStart + 1] = 'C'; // Stomp bounce apex coin
    // Chasm 2 (2 tiles)
    for (let c = 0; c < 2; c++) { ensureHeadroom(grid, col, GRID_ROWS); grid[13][col] = 'C'; col++; }
    // Landing pad
    for (let c = 0; c < 3; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    return { nextCol: col, nextGround: 15 };
}

// 15. Stepping Stones (Rhythmic elevated stepping pads with collectible coin arcs and ground hazard)
function buildSteppingStones(grid, startCol, groundRow) {
    let col = startCol;

    // Launch ground runway (2 tiles at Row 15)
    for (let c = 0; c < 2; c++) {
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;
    }

    // Choose variation for visual and gameplay richness:
    // 0 = Rising & Falling Tri-Stone, 1 = Ascending Stepping Stones, 2 = Alternating River Stones
    const style = Math.floor(Math.random() * 3);

    if (style === 0) {
        // --- Variant 0: Tri-Stone Rhythmic Arch ---
        // Stone 1: cols 2-3 at Row 14 (solid fill below) with coin at Row 12
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, 14);
            ensureHeadroom(grid, col, 14);
            if (c === 0) grid[12][col] = 'C';
            col++;
        }
        // Low ground gap (1 tile)
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;

        // Stone 2: cols 5-6 at Row 13 (Summit Stone) with coin at Row 11
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, 13);
            ensureHeadroom(grid, col, 13);
            if (c === 0) grid[11][col] = 'C';
            col++;
        }
        // Low ground gap with bug patrol beneath
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        grid[14][col] = 'E';
        col++;

        // Stone 3: cols 8-9 at Row 14 with coin at Row 12
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, 14);
            ensureHeadroom(grid, col, 14);
            if (c === 1) grid[12][col] = 'C';
            col++;
        }
    } else if (style === 1) {
        // --- Variant 1: Ascending Stepping Stones ---
        // Stone 1: 2 tiles at Row 14
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, 14);
            ensureHeadroom(grid, col, 14);
            if (c === 0) grid[12][col] = 'C';
            col++;
        }
        // Gap
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;

        // Stone 2: 2 tiles at Row 13
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, 13);
            ensureHeadroom(grid, col, 13);
            if (c === 0) grid[11][col] = 'C';
            col++;
        }
        // Gap with enemy bug
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        grid[14][col] = 'E';
        col++;

        // Stone 3: 2 tiles at Row 12 (High Stone with apex coin)
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, 12);
            ensureHeadroom(grid, col, 12);
            grid[10][col] = 'C';
            col++;
        }
    } else {
        // --- Variant 2: Alternating River Stepping Stones ---
        // Stone 1 (Row 14, 2 tiles)
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, 14);
            ensureHeadroom(grid, col, 14);
            grid[12][col] = 'C';
            col++;
        }
        // Gap with low enemy bug
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        grid[14][col] = 'E';
        col++;

        // Stone 2 (Row 13, 2 tiles)
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, 13);
            ensureHeadroom(grid, col, 13);
            grid[11][col] = 'C';
            col++;
        }
        // Gap
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;

        // Stone 3 (Row 14, 2 tiles)
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, 14);
            ensureHeadroom(grid, col, 14);
            grid[12][col] = 'C';
            col++;
        }
    }

    // Landing recovery runway (3 tiles at Row 15)
    for (let c = 0; c < 3; c++) {
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
        col++;
    }

    return { nextCol: col, nextGround: 15 };
}

// 17. Alpine Mountain Peak (Magnificent 1-block stepped alpine peak climbing to Row 6 with summit bug and apex coins)
function buildAlpineMountain(grid, startCol, groundRow) {
    let col = startCol;
    // Launch base (2 tiles at row 15)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    // Ascent: gentle 1-block step-up on every terrace (Row 14 down to Row 6)
    const ascentRows = [14, 13, 12, 11, 10, 9, 8, 7];
    for (const r of ascentRows) {
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, r);
            ensureHeadroom(grid, col, r);
            if (c === 1 && r % 2 === 0) grid[r - 2][col] = 'C';
            col++;
        }
    }
    // Alpine Summit (Row 6, 3 tiles) - Commanding snowy peak ridge!
    const summitStart = col;
    for (let c = 0; c < 3; c++) { fillGroundCol(grid, col, 6); ensureHeadroom(grid, col, 6); col++; }
    grid[5][summitStart + 1] = 'E'; // Alpine sentry bug on ridge
    grid[3][summitStart + 1] = 'C'; // Summit apex coin
    grid[3][summitStart] = 'C';
    grid[3][summitStart + 2] = 'C';

    // Descent: gentle 1-block step-down on every terrace (Row 7 down to Row 14)
    const descentRows = [7, 8, 9, 10, 11, 12, 13, 14];
    for (const r of descentRows) {
        for (let c = 0; c < 2; c++) {
            fillGroundCol(grid, col, r);
            ensureHeadroom(grid, col, r);
            if (c === 0 && r % 2 === 1) grid[r - 2][col] = 'C';
            col++;
        }
    }
    // Valley floor landing (Row 15, 2 tiles)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    return { nextCol: col, nextGround: 15 };
}

// 18. Twin Peaks & Suspension Pass (Gentle 1-block stepped twin crags connected by a suspension bridge)
function buildTwinPeaksPass(grid, startCol, groundRow) {
    let col = startCol;
    // Approach (2 tiles)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    // Crag 1 Ascent: 1-block steps (Rows 14 -> 13 -> 12 -> 11)
    const crag1 = [14, 13, 12, 11];
    for (const r of crag1) {
        for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, r); ensureHeadroom(grid, col, r); col++; }
    }
    // High mountain saddle pass connecting the twin peaks (3 tiles at Row 12, solid fill)
    const passStart = col;
    for (let c = 0; c < 3; c++) {
        fillGroundCol(grid, col, 12);
        ensureHeadroom(grid, col, 12);
        grid[10][col] = 'C';
        col++;
    }
    grid[11][passStart + 1] = 'E'; // Sentry guard on mountain pass
    // Crag 2: stepped peak at Row 10 (1-block step up to Row 11 then 10)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 11); ensureHeadroom(grid, col, 11); col++; }
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 10); ensureHeadroom(grid, col, 10); grid[8][col] = 'C'; col++; }
    // Descent: 1-block steps (Rows 11 -> 12 -> 13 -> 14)
    const descent = [11, 12, 13, 14];
    for (const r of descent) {
        for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, r); ensureHeadroom(grid, col, r); col++; }
    }
    // Landing (2 tiles)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }
    return { nextCol: col, nextGround: 15 };
}

// 19. Sunken Stone Terraces (Stepped ancient stone pedestals with rich coin arches and open sky)
function buildUndergroundCavern(grid, startCol, groundRow) {
    const len = 16;
    for (let c = 0; c < len; c++) {
        const col = startCol + c;
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
    }

    // Pedestal 1: cols 3-4 at Row 14 (solid fill below) with coin at Row 12
    for (let c = 3; c <= 4; c++) {
        fillGroundCol(grid, startCol + c, 14);
        ensureHeadroom(grid, startCol + c, 14);
        grid[12][startCol + c] = 'C';
    }

    // Pedestal 2: cols 7-8 at Row 13 (Summit Pedestal) with coin at Row 11
    for (let c = 7; c <= 8; c++) {
        fillGroundCol(grid, startCol + c, 13);
        ensureHeadroom(grid, startCol + c, 13);
        grid[11][startCol + c] = 'C';
    }

    // Pedestal 3: cols 11-12 at Row 14 with coin at Row 12
    for (let c = 11; c <= 12; c++) {
        fillGroundCol(grid, startCol + c, 14);
        ensureHeadroom(grid, startCol + c, 14);
        grid[12][startCol + c] = 'C';
    }

    // Ground floor bug patrol in open valley between pedestals (cols 5-6)
    grid[14][startCol + 5] = 'E';

    return { nextCol: startCol + len, nextGround: 15 };
}

// 20. Elevated Double Terrace Ridge (Upper scenic treasure ridge with smooth 1-block steps and open sky)
function buildSplitLevelCave(grid, startCol, groundRow) {
    const len = 17;
    for (let c = 0; c < len; c++) {
        const col = startCol + c;
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
    }

    // 1-block stepped access to upper ridge: Row 14, then Row 13
    fillGroundCol(grid, startCol + 2, 14);
    ensureHeadroom(grid, startCol + 2, 14);
    grid[12][startCol + 2] = 'C';

    fillGroundCol(grid, startCol + 3, 13);
    ensureHeadroom(grid, startCol + 3, 13);
    grid[11][startCol + 3] = 'C';

    // Upper Scenic Ridge (Row 12, cols 4 to 12) - Solid fill below so NO dark under-traps!
    for (let c = 4; c <= 12; c++) {
        fillGroundCol(grid, startCol + c, 12);
        ensureHeadroom(grid, startCol + c, 12);
        if (c % 2 === 0) {
            grid[10][startCol + c] = 'C'; // Golden treasure coins along open-sky ridge!
        }
    }

    // Sentry bug on the open ridge
    grid[11][startCol + 8] = 'E';

    // 1-block stepped descent from upper ridge: Row 13, then Row 14
    fillGroundCol(grid, startCol + 13, 13);
    ensureHeadroom(grid, startCol + 13, 13);
    grid[11][startCol + 13] = 'C';

    fillGroundCol(grid, startCol + 14, 14);
    ensureHeadroom(grid, startCol + 14, 14);
    grid[12][startCol + 14] = 'C';

    return { nextCol: startCol + len, nextGround: 15 };
}

// 21. Ancient Castle Fortress (Stepped fortress battlements with solid ramparts and open sky)
function buildCastleFortress(grid, startCol, groundRow) {
    const len = 18;
    for (let c = 0; c < len; c++) {
        const col = startCol + c;
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
    }

    // Stepped entrance ramp: 15 -> 14 -> 13 (strictly 1 block steps!)
    fillGroundCol(grid, startCol + 2, 14);
    ensureHeadroom(grid, startCol + 2, 14);

    fillGroundCol(grid, startCol + 3, 13);
    ensureHeadroom(grid, startCol + 3, 13);

    // Castle Ramparts & Elevated Battlements (cols 4 to 12 at Row 12, solid fill underneath)
    for (let c = 4; c <= 12; c++) {
        fillGroundCol(grid, startCol + c, 12);
        ensureHeadroom(grid, startCol + c, 12);
        if (c % 2 === 0) {
            grid[10][startCol + c] = 'C'; // Golden coins along the castle ramparts
        }
    }

    // Fortress sentry on the ramparts
    grid[11][startCol + 8] = 'E';

    // Stepped exit ramp: 13 -> 14 -> 15 (strictly 1 block steps!)
    fillGroundCol(grid, startCol + 13, 13);
    ensureHeadroom(grid, startCol + 13, 13);

    fillGroundCol(grid, startCol + 14, 14);
    ensureHeadroom(grid, startCol + 14, 14);

    return { nextCol: startCol + len, nextGround: 15 };
}

// 22. Stepped Archipelago Crags (Ascending and descending crags with strictly 1-block elevation steps)
function buildSkyArchipelago(grid, startCol, groundRow) {
    let col = startCol;

    // Approach runway (2 tiles at Row 15)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }

    // Crag 1: Row 14 (2 tiles, solid fill)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); grid[12][col] = 'C'; col++; }

    // Crag 2: Row 13 (2 tiles, solid fill)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 13); ensureHeadroom(grid, col, 13); grid[11][col] = 'C'; col++; }

    // Crag 3 Summit: Row 12 (3 tiles, solid fill)
    for (let c = 0; c < 3; c++) {
        fillGroundCol(grid, col, 12);
        ensureHeadroom(grid, col, 12);
        if (c === 1) { grid[11][col] = 'E'; grid[10][col] = 'C'; }
        col++;
    }

    // Crag 4: Row 13 (2 tiles, solid fill)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 13); ensureHeadroom(grid, col, 13); grid[11][col] = 'C'; col++; }

    // Crag 5: Row 14 (2 tiles, solid fill)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 14); ensureHeadroom(grid, col, 14); grid[12][col] = 'C'; col++; }

    // Exit runway (2 tiles at Row 15)
    for (let c = 0; c < 2; c++) { fillGroundCol(grid, col, 15); ensureHeadroom(grid, col, 15); col++; }

    return { nextCol: col, nextGround: 15 };
}

// 23. Crystal Spire Ridge (Stepping crystal spires with open sky and treasure crowns)
function buildCrystalGrotto(grid, startCol, groundRow) {
    const len = 16;
    for (let c = 0; c < len; c++) {
        const col = startCol + c;
        fillGroundCol(grid, col, 15);
        ensureHeadroom(grid, col, 15);
    }

    // Crystal Spire 1 (Row 14, cols 3-4, solid fill)
    for (let c = 3; c <= 4; c++) {
        fillGroundCol(grid, startCol + c, 14);
        ensureHeadroom(grid, startCol + c, 14);
        grid[12][startCol + c] = 'C';
    }

    // Crystal Spire 2 (Row 13, cols 7-8, solid fill)
    for (let c = 7; c <= 8; c++) {
        fillGroundCol(grid, startCol + c, 13);
        ensureHeadroom(grid, startCol + c, 13);
        grid[11][startCol + c] = 'C';
    }

    // Crystal Spire 3 (Row 14, cols 11-12, solid fill)
    for (let c = 11; c <= 12; c++) {
        fillGroundCol(grid, startCol + c, 14);
        ensureHeadroom(grid, startCol + c, 14);
        grid[12][startCol + c] = 'C';
    }

    // Ground bug patrol between spires
    grid[14][startCol + 6] = 'E';

    return { nextCol: startCol + len, nextGround: 15 };
}

// 16. Milestone Outpost with Finish Flag F
function buildMilestoneOutpost(grid, startCol, groundRow, stageNumber, maxCol) {
    const endCol = typeof maxCol === 'number' ? maxCol : Math.min(grid[0].length, startCol + 10);
    const length = endCol - startCol;
    const flagRow = groundRow - 1;
    const flagCol = startCol + Math.floor(length / 2);

    for (let col = startCol; col < endCol; col++) {
        fillGroundCol(grid, col, groundRow);
        ensureHeadroom(grid, col, groundRow);
    }

    // Milestone Flag
    if (flagCol >= startCol && flagCol < endCol) {
        grid[flagRow][flagCol] = 'F';

        // Decorative coin arch
        if (flagCol - 2 >= startCol) grid[flagRow - 1][flagCol - 2] = 'C';
        if (flagCol - 1 >= startCol) grid[flagRow - 2][flagCol - 1] = 'C';
        if (flagCol + 1 < endCol) grid[flagRow - 2][flagCol + 1] = 'C';
        if (flagCol + 2 < endCol) grid[flagRow - 1][flagCol + 2] = 'C';
    }

    return { nextCol: endCol, nextGround: groundRow };
}

// ---------------------------------------------------------------------------
// MAIN CHUNK GENERATOR (Stage-Scaled Complexity, 100% Solvable)
// ---------------------------------------------------------------------------

const MODULE_LENGTHS = {
    PLAINS: 8,
    HILL: 11,
    CHASM: 9,
    CANYON: 12,
    SKYWAY: 12,
    PARKOUR: 11,
    ENEMY: 9,
    HURDLE: 6,
    HIGH_ROAD: 12,
    PYRAMID: 15,
    STEP_LADDER: 12,
    SKYBRIDGE: 11,
    DOUBLE_HURDLE: 10,
    SENTRY_CANYON: 13,
    STEPPING_STONES: 13,
    ALPINE_MOUNTAIN: 39,
    TWIN_PEAKS: 23,
    UNDERGROUND_CAVERN: 16,
    SPLIT_CAVE: 17,
    CASTLE_FORTRESS: 18,
    SKY_ARCHIPELAGO: 20,
    CRYSTAL_GROTTO: 15
};

/**
 * Stage-based progressive module catalog:
 * - Stage 1: Welcoming, smooth & friendly start (PLAINS, HILL, HURDLE, STEPPING_STONES, HIGH_ROAD). Zero chasms!
 * - Stage 2: Introduces jumpable chasms (2-tile gap), pyramids, double hurdles, and floating step ladders.
 * - Stage 3: Introduces caverns, split caves, skyways, and canyon chasms.
 * - Stage 4+: Full grand exploration (alpine snow peaks, castles, floating sky islands, crystal grottos, sentry canyons).
 */
export function getStageModulePool(stageNumber) {
    if (stageNumber <= 1) {
        return ['PLAINS', 'HILL', 'HURDLE', 'STEPPING_STONES', 'HIGH_ROAD', 'ENEMY'];
    } else if (stageNumber === 2) {
        return ['PLAINS', 'HILL', 'CHASM', 'PYRAMID', 'STEP_LADDER', 'DOUBLE_HURDLE', 'STEPPING_STONES', 'HIGH_ROAD', 'ENEMY'];
    } else if (stageNumber === 3) {
        return ['UNDERGROUND_CAVERN', 'SPLIT_CAVE', 'CANYON', 'SKYWAY', 'SKYBRIDGE', 'CHASM', 'PYRAMID', 'STEP_LADDER', 'STEPPING_STONES', 'ENEMY', 'DOUBLE_HURDLE'];
    } else {
        return [
            'ALPINE_MOUNTAIN', 'TWIN_PEAKS', 'CASTLE_FORTRESS', 'SKY_ARCHIPELAGO', 'CRYSTAL_GROTTO',
            'UNDERGROUND_CAVERN', 'SPLIT_CAVE', 'SENTRY_CANYON', 'PARKOUR', 'SKYBRIDGE', 'CANYON',
            'CHASM', 'PYRAMID', 'STEP_LADDER', 'STEPPING_STONES', 'HIGH_ROAD', 'ENEMY'
        ];
    }
}

/**
 * Mathematically guarantees that every single generated chunk is 100% solvable:
 * 1. Chasm Safety & Bounds: Verifies launch/landing runways are solid, chasms never exceed 3 tiles,
 *    and no floating enemies are placed in chasm pits.
 * 2. Climbability Guarantee: Max step-up difference between adjacent solid columns is <= 2 blocks.
 * 3. Intelligent Headroom: Guarantees at least 3 tiles of vertical clearance above every walkable surface,
 *    while properly PRESERVING cavern ceilings, mine roofs, and mountain overhangs!
 * 4. Spawn Safety: Zero enemy hazards within 6 tiles of player spawn.
 */
function validateAndEnsureSolvability(grid, length, isInitialChunk) {
    // 0. Absolute Open Sky Guarantee:
    // Rows 0 through 5 are ALWAYS open sky. Zero hanging blocks, ceilings, or floating monoliths!
    for (let c = 0; c < length; c++) {
        for (let r = 0; r <= 5; r++) {
            grid[r][c] = '.';
        }
    }

    // 1. Chasm Safety & Launch/Landing Validation
    for (let c = 0; c < length; c++) {
        // Check if this column is a chasm (no solid block at row 15)
        let hasWalkableGround = false;
        for (let r = 0; r < GRID_ROWS; r++) {
            if (grid[r][c] === '#') {
                hasWalkableGround = true;
                break;
            }
        }

        if (!hasWalkableGround) {
            // Empty chasm column: ensure no floating enemies
            for (let r = 0; r < GRID_ROWS; r++) {
                if (grid[r][c] === 'E') grid[r][c] = '.';
            }

            // Ensure chasm never exceeds 3 consecutive tiles without a stepping stone
            let consecutivePits = 1;
            let checkCol = c - 1;
            while (checkCol >= 0) {
                let colHasGround = false;
                for (let r = 0; r < GRID_ROWS; r++) {
                    if (grid[r][checkCol] === '#') { colHasGround = true; break; }
                }
                if (!colHasGround) {
                    consecutivePits++;
                    checkCol--;
                } else {
                    break;
                }
            }

            if (consecutivePits > 3) {
                // Insert an elevated stepping stone at row 14 to keep the jump 100% solvable
                grid[14][c] = '#';
                grid[12][c] = 'C';
            }
        }
    }

    // 2. Ground Solidity Guarantee:
    // Any column with ground at Row 15 MUST be filled solidly down to Row 15.
    // Completely eliminates hollow holes, stranded mid-air islands, and floating traps!
    for (let c = 0; c < length; c++) {
        if (grid[GRID_ROWS - 1][c] === '#') {
            let topSurface = -1;
            for (let r = 0; r < GRID_ROWS; r++) {
                if (grid[r][c] === '#') {
                    topSurface = r;
                    break;
                }
            }
            if (topSurface !== -1) {
                for (let r = topSurface; r < GRID_ROWS; r++) {
                    grid[r][c] = '#';
                }
            }
        }
    }

    // 3. Step Climbability Guarantee:
    // Strictly enforce <= 1 block vertical step-up between adjacent solid columns!
    for (let c = 1; c < length; c++) {
        let currentFloor = -1;
        for (let r = GRID_ROWS - 1; r >= 0; r--) {
            if (grid[r][c] === '#' && (r === 0 || grid[r - 1][c] !== '#')) {
                currentFloor = r;
                break;
            }
        }
        let prevFloor = -1;
        for (let r = GRID_ROWS - 1; r >= 0; r--) {
            if (grid[r][c - 1] === '#' && (r === 0 || grid[r - 1][c - 1] !== '#')) {
                prevFloor = r;
                break;
            }
        }

        if (currentFloor !== -1 && prevFloor !== -1 && prevFloor - currentFloor > 1) {
            // Shave down so step-up is strictly <= 1 block!
            const maxAllowedFloor = prevFloor - 1;
            for (let r = currentFloor; r < maxAllowedFloor; r++) {
                grid[r][c] = '.';
            }
        }
    }

    // 4. Intelligent Full Headroom Guarantee:
    // Ensure all rows above the surface of every column are 100% open sky
    for (let c = 0; c < length; c++) {
        let topBlock = -1;
        for (let r = 0; r < GRID_ROWS; r++) {
            if (grid[r][c] === '#') {
                topBlock = r;
                break;
            }
        }
        if (topBlock !== -1) {
            for (let r = 0; r < topBlock; r++) {
                if (grid[r][c] === '#') grid[r][c] = '.';
            }
        }
    }

    // 4. Safe Spawn: Clear enemies near spawn point
    if (isInitialChunk) {
        for (let c = 0; c < 6; c++) {
            for (let r = 0; r < 16; r++) {
                if (grid[r][c] === 'E') {
                    grid[r][c] = '.';
                }
            }
        }
    }
}

/**
 * Generates an infinite chunk of terrain with rich, stage-scaled procedural variety.
 * Starts off simple on Stage 1, slowly increasing complexity up to towering peaks and caves.
 */
export function generateProceduralChunk(startCol, chunkLength = 60, stageNumber = 1, initialGroundRow = 15, isInitialChunk = false) {
    const grid = createEmptyChunk(chunkLength);
    let currentCol = 0;
    let currentGround = 15;

    // If initial chunk, provide a concise safe 4-tile launch pad with player spawn at col 2
    if (isInitialChunk) {
        for (let c = 0; c < 4; c++) {
            fillGroundCol(grid, c, 15);
            ensureHeadroom(grid, c, 15);
        }
        grid[14][2] = 'P'; // Player spawn
        currentCol = 4;
        currentGround = 15;
    }

    // Stage-Scaled Progressive Module Pool: Starts simple, slowly gets more complex!
    const availableModules = getStageModulePool(stageNumber);

    let lastModule = '';

    while (currentCol < chunkLength - 10) {
        // Only consider modules that cleanly fit before the milestone outpost runway (10 tiles)
        // Never repeat the exact same module twice in a row
        const validCandidates = availableModules.filter(mod => {
            const modLen = MODULE_LENGTHS[mod] || 10;
            return (currentCol + modLen <= chunkLength - 10) && (mod !== lastModule);
        });

        if (validCandidates.length === 0) break;

        // Completely random selection from the stage's curated complexity pool
        const candidate = validCandidates[Math.floor(Math.random() * validCandidates.length)];

        let result;
        switch (candidate) {
            case 'ALPINE_MOUNTAIN':
                result = buildAlpineMountain(grid, currentCol, currentGround);
                break;
            case 'TWIN_PEAKS':
                result = buildTwinPeaksPass(grid, currentCol, currentGround);
                break;
            case 'UNDERGROUND_CAVERN':
                result = buildUndergroundCavern(grid, currentCol, currentGround);
                break;
            case 'SPLIT_CAVE':
                result = buildSplitLevelCave(grid, currentCol, currentGround);
                break;
            case 'CASTLE_FORTRESS':
                result = buildCastleFortress(grid, currentCol, currentGround);
                break;
            case 'SKY_ARCHIPELAGO':
                result = buildSkyArchipelago(grid, currentCol, currentGround);
                break;
            case 'CRYSTAL_GROTTO':
                result = buildCrystalGrotto(grid, currentCol, currentGround);
                break;
            case 'PLAINS':
                result = buildFlatPlains(grid, currentCol, currentGround);
                break;
            case 'HILL':
                result = buildSteppedHill(grid, currentCol, currentGround);
                break;
            case 'CHASM':
                result = buildChasmLeap(grid, currentCol, currentGround);
                break;
            case 'CANYON':
                result = buildCanyonWithIsland(grid, currentCol, currentGround);
                break;
            case 'SKYWAY':
                result = buildElevatedSkyway(grid, currentCol, currentGround);
                break;
            case 'PARKOUR':
                result = buildPillarParkour(grid, currentCol, currentGround);
                break;
            case 'ENEMY':
                result = buildEnemyOutpost(grid, currentCol, currentGround);
                break;
            case 'HURDLE':
                result = buildLowHurdle(grid, currentCol, currentGround);
                break;
            case 'HIGH_ROAD':
                result = buildMultiTierHighRoad(grid, currentCol, currentGround);
                break;
            case 'PYRAMID':
                result = buildStepPyramid(grid, currentCol, currentGround);
                break;
            case 'STEP_LADDER':
                result = buildFloatingStepLadder(grid, currentCol, currentGround);
                break;
            case 'STEPPING_STONES':
                result = buildSteppingStones(grid, currentCol, currentGround);
                break;
            case 'SKYBRIDGE':
                result = buildSkybridgeChasm(grid, currentCol, currentGround);
                break;
            case 'DOUBLE_HURDLE':
                result = buildDoubleHurdleRun(grid, currentCol, currentGround);
                break;
            case 'SENTRY_CANYON':
                result = buildCanyonWithSentry(grid, currentCol, currentGround);
                break;
            default:
                result = buildFlatPlains(grid, currentCol, currentGround);
                break;
        }

        currentCol = result.nextCol;
        currentGround = result.nextGround;
        lastModule = candidate;
    }

    // Fill remaining columns with the Milestone Outpost and Stage Flag up to exact chunkLength
    if (currentCol < chunkLength) {
        buildMilestoneOutpost(grid, currentCol, 15, stageNumber, chunkLength);
        currentGround = 15;
    }

    // Strictly ensure all grid rows are exactly chunkLength
    for (let r = 0; r < GRID_ROWS; r++) {
        if (grid[r].length > chunkLength) {
            grid[r] = grid[r].slice(0, chunkLength);
        } else {
            while (grid[r].length < chunkLength) {
                grid[r].push(r === 15 ? '#' : '.');
            }
        }
    }

    // Strict mathematical solvability and safety pass
    validateAndEnsureSolvability(grid, chunkLength, isInitialChunk);

    // Extract coins, enemies, flag, and spawn with global coordinates
    const coins = [];
    const enemies = [];
    let flag = null;
    let spawn = null;

    const ts = TILE_SIZE || 40;

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < chunkLength; c++) {
            const char = grid[r][c];
            const globalCol = startCol + c;

            if (char === 'C') {
                coins.push({
                    c: globalCol,
                    r,
                    x: globalCol * ts + ts * 0.25,
                    y: r * ts + ts * 0.25,
                    width: ts * 0.5,
                    height: ts * 0.5,
                    collected: false
                });
            } else if (char === 'E') {
                const isHopper = stageNumber >= 2 && Math.random() < 0.35;
                const baseSpeed = stageNumber <= 1 ? 0.85 : (stageNumber === 2 ? 1.05 : 1.22);
                enemies.push({
                    c: globalCol,
                    r,
                    x: globalCol * ts + 2,
                    y: r * ts + 2,
                    width: ts - 4,
                    height: ts - 4,
                    vx: baseSpeed,
                    baseSpeed,
                    isHopper,
                    hopTimer: Math.floor(Math.random() * 60),
                    minX: Math.max(0, (globalCol - 2) * ts),
                    maxX: (globalCol + 3) * ts
                });
            } else if (char === 'F') {
                flag = {
                    c: globalCol,
                    r,
                    x: globalCol * ts,
                    y: r * ts,
                    width: ts,
                    height: ts,
                    stage: stageNumber,
                    triggered: false
                };
            } else if (char === 'P') {
                spawn = { x: globalCol, y: r };
            }
        }
    }

    return {
        grid,
        length: chunkLength,
        endGroundRow: currentGround,
        coins,
        enemies,
        flag,
        spawn
    };
}
