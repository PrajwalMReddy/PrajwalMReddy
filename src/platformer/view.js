// Custom levels platformer renderer
import { formatNumber, getPlatformerText, gameState, GRID_ROWS, player, TILE_SIZE } from './model.js';

export function getCanvasFont(size, weight = 'normal', isMonospace = true) {
    if (gameState.lang === 'kn') {
        return `${weight} ${size}px 'Segoe UI', 'Nirmala UI', Tahoma, sans-serif`;
    }
    return `${weight} ${size}px ${isMonospace ? 'monospace' : "'Segoe UI', Tahoma, sans-serif"}`;
}

export function draw(ctx, width, height, displayText = 'Coming Soon') {
    // 1. Clear background
    ctx.fillStyle = '#181a1b';
    ctx.fillRect(0, 0, width, height);

    // 2. Empty State -> Coming Soon
    if (gameState.state === 'EMPTY' || gameState.state === 'LOADING') {
        ctx.save();
        ctx.font = getCanvasFont(22, 'bold', false);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        const fallback = gameState.state === 'LOADING'
            ? getPlatformerText('loading')
            : getPlatformerText('comingSoon');
        ctx.fillText(displayText || fallback, width / 2, height / 2);
        ctx.restore();
        return;
    }


    // 3. Camera translation for custom level world
    // Always anchor the ground (Row 15) firmly to the bottom edge of the canvas so it ALWAYS shows
    const worldHeight = GRID_ROWS * TILE_SIZE;
    const cameraY = -(height - worldHeight);

    ctx.save();
    ctx.translate(-Math.floor(gameState.cameraX), -Math.floor(cameraY));

    const level = gameState.currentLevel;
    const grid = level ? (level.grid || level.map) : null;
    if (grid) {
        const totalLevelWidth = Math.max(gameState.levelWidth || 0, level.width || 0);
        const visibleStartCol = Math.max(0, Math.floor((gameState.cameraX - TILE_SIZE) / TILE_SIZE));
        const visibleEndCol = Math.ceil((gameState.cameraX + width + 2 * TILE_SIZE) / TILE_SIZE);
        const gridEndCol = Math.min(totalLevelWidth, visibleEndCol);

        // Draw Ground Blocks (High-contrast, vibrant retro platformer aesthetic)
        for (let r = 0; r < GRID_ROWS; r++) {
            const row = grid[r] || [];
            for (let c = visibleStartCol; c < gridEndCol; c++) {
                if (row[c] === '#') {
                    const bx = c * TILE_SIZE;
                    const by = r * TILE_SIZE;
                    const isGroundBase = r === GRID_ROWS - 1;
                    const blockHeight = isGroundBase
                        ? Math.max(TILE_SIZE, height - (by - cameraY) + 2)
                        : TILE_SIZE;

                    const isTopSurface = (r === 0) || (grid[r - 1] && grid[r - 1][c] !== '#');
                    const isCeiling = (r < GRID_ROWS - 1) && (grid[r + 1] && grid[r + 1][c] !== '#');
                    const isAlpinePeak = isTopSurface && r <= 7;

                    // Solid Block Base (Dark Slate Bedrock)
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(bx, by, TILE_SIZE, blockHeight);

                    // Inner Stone Tile Body
                    ctx.fillStyle = '#334155';
                    ctx.fillRect(bx + 1, by + 1, TILE_SIZE - 2, TILE_SIZE - 2);

                    if (isAlpinePeak) {
                        // --- Alpine Mountain Snow Cap ---
                        // Pure Snow White Cap (#f8fafc)
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(bx, by, TILE_SIZE, 5);

                        // Ice-Blue Frost Highlight (#93c5fd)
                        ctx.fillStyle = '#93c5fd';
                        ctx.fillRect(bx, by, TILE_SIZE, 2);

                        // Decorative snow icicles
                        ctx.fillStyle = '#e2e8f0';
                        ctx.fillRect(bx + 4, by + 5, 3, 3);
                        ctx.fillRect(bx + Math.floor(TILE_SIZE / 2) - 1, by + 5, 4, 4);
                        ctx.fillRect(bx + TILE_SIZE - 7, by + 5, 3, 2);
                    } else if (isCeiling && r <= 8) {
                        // --- Subterranean Cavern Ceiling / Stalactite Rock ---
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(bx, by + TILE_SIZE - 4, TILE_SIZE, 4);

                        // Crystal glint (Amethyst or Sapphire)
                        const crystalColor = (c % 2 === 0) ? '#c084fc' : '#38bdf8';
                        ctx.fillStyle = crystalColor;
                        ctx.fillRect(bx + 5, by + TILE_SIZE - 3, 2, 2);
                        ctx.fillRect(bx + TILE_SIZE - 7, by + TILE_SIZE - 3, 2, 2);
                    } else if (isTopSurface) {
                        // --- Lush Emerald Grass Turf ---
                        ctx.fillStyle = '#10b981';
                        ctx.fillRect(bx, by, TILE_SIZE, 4);

                        // Bright Mint Highlight (#6ee7b7)
                        ctx.fillStyle = '#6ee7b7';
                        ctx.fillRect(bx, by, TILE_SIZE, 1.5);

                        // Stylized grass blades / ledge details
                        ctx.fillStyle = '#059669';
                        ctx.fillRect(bx + 3, by + 4, 3, 2);
                        ctx.fillRect(bx + Math.floor(TILE_SIZE / 2) - 1, by + 4, 3, 2);
                        ctx.fillRect(bx + TILE_SIZE - 6, by + 4, 3, 2);
                    }

                    // 3D Bevel Edge Shadows
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
                    ctx.fillRect(bx + TILE_SIZE - 2, by, 2, TILE_SIZE);
                    ctx.fillRect(bx, by + TILE_SIZE - 2, TILE_SIZE, 2);
                }
            }
        }

        // Chasm Abyss & World Edge Rendering
        for (let c = visibleStartCol; c < visibleEndCol; c++) {
            const hasGround = (c < gridEndCol) && grid[GRID_ROWS - 1] && (grid[GRID_ROWS - 1][c] === '#');
            const bx = c * TILE_SIZE;
            const by = (GRID_ROWS - 1) * TILE_SIZE;
            const blockHeight = Math.max(TILE_SIZE, height - (by - cameraY) + 2);

            if (!hasGround) {
                if (c < gridEndCol) {
                    // --- Intentional Chasm Bottomless Abyss ---
                    // Deep pit void
                    ctx.fillStyle = '#070a12';
                    ctx.fillRect(bx, by, TILE_SIZE, blockHeight);

                    // Deep hazard gradient (darkness transitioning to fiery pit embers)
                    const pitGrad = ctx.createLinearGradient(bx, by, bx, by + blockHeight);
                    pitGrad.addColorStop(0, 'rgba(7, 10, 18, 0)');
                    pitGrad.addColorStop(1, 'rgba(239, 68, 68, 0.28)');
                    ctx.fillStyle = pitGrad;
                    ctx.fillRect(bx, by, TILE_SIZE, blockHeight);

                    // 3D Cliff Edge Shadows on adjacent solid ground columns
                    if (c > 0 && grid[GRID_ROWS - 1] && grid[GRID_ROWS - 1][c - 1] === '#') {
                        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
                        ctx.fillRect(bx, by, 3, blockHeight);
                    }
                    if (c < gridEndCol - 1 && grid[GRID_ROWS - 1] && grid[GRID_ROWS - 1][c + 1] === '#') {
                        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
                        ctx.fillRect(bx + TILE_SIZE - 3, by, 3, blockHeight);
                    }
                } else {
                    // Beyond world edge: seamless horizon ground
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(bx, by, TILE_SIZE, blockHeight);
                    ctx.fillStyle = '#334155';
                    ctx.fillRect(bx + 1, by + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    ctx.fillStyle = '#10b981';
                    ctx.fillRect(bx, by, TILE_SIZE, 4);
                }
            }
        }
    }

    // Draw Coins with Shimmer & Magnetism Aura
    const coinBob = Math.sin(Date.now() / 200) * 3;
    for (const coin of gameState.coinsInLevel) {
        if (coin.collected) continue;
        const cy = coin.y + (coin.isMagnetized ? 0 : coinBob);

        // Magnetism Attraction Aura or Ambient Glow
        ctx.fillStyle = coin.isMagnetized ? 'rgba(251, 191, 36, 0.55)' : 'rgba(255, 215, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(coin.x + coin.width / 2, cy + coin.height / 2, coin.width * (coin.isMagnetized ? 0.9 : 0.7), 0, Math.PI * 2);
        ctx.fill();

        // Golden coin body
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(coin.x + coin.width / 2, cy + coin.height / 2, coin.width * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Inner coin core
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(coin.x + coin.width / 2, cy + coin.height / 2, coin.width * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Shine glint
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(coin.x + coin.width / 2 - 2, cy + coin.height / 2 - 3, 2, 2);
    }

    // Draw Enemies
    for (const enemy of gameState.enemies) {
        // Red hazard bug/body
        ctx.fillStyle = '#e53e3e';
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);

        // Dark shell stripe
        ctx.fillStyle = '#9b2c2c';
        ctx.fillRect(enemy.x + 3, enemy.y + 3, enemy.width - 6, enemy.height - 6);

        // Glowing eyes
        ctx.fillStyle = '#fef08a';
        const eyeOffset = enemy.vx >= 0 ? enemy.width - 6 : 3;
        ctx.fillRect(enemy.x + eyeOffset, enemy.y + 4, 3, 3);
    }

    // Draw Finish / Milestone Flags
    const flagsToDraw = gameState.flags && gameState.flags.length > 0
        ? gameState.flags
        : (gameState.flag ? [gameState.flag] : []);

    for (const flag of flagsToDraw) {
        const fx = flag.x;
        const fy = flag.y;

        // Flag pole
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(fx + 6, fy - 16, 4, TILE_SIZE + 16);

        // Flag banner (green when untriggered, golden when reached)
        const wave = Math.sin(Date.now() / 250) * 2;
        ctx.fillStyle = flag.triggered ? '#fbbf24' : '#22c55e';
        ctx.beginPath();
        ctx.moveTo(fx + 10, fy - 16);
        ctx.lineTo(fx + 26 + wave, fy - 6);
        ctx.lineTo(fx + 10, fy + 4);
        ctx.closePath();
        ctx.fill();

        // Gold sphere top
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(fx + 8, fy - 16, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw Player
    if (player.invulnerableTimer === 0 || Math.floor(player.invulnerableTimer / 4) % 2 === 0) {
        ctx.fillStyle = '#e63946';
        ctx.fillRect(player.x, player.y, player.width, player.height);

        // Player accent
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(player.x + 2, player.y + 2, player.width - 4, 4);

        // Player eye
        ctx.fillStyle = '#ffffff';
        const eyeX = player.vx >= 0 ? player.x + player.width - 6 : player.x + 3;
        ctx.fillRect(eyeX, player.y + 7, 3, 3);
    }

    // Draw Particles (double jump / dust / floating text)
    if (gameState.particles && gameState.particles.length > 0) {
        for (const p of gameState.particles) {
            ctx.save();
            const alpha = Math.max(0, p.alpha !== undefined ? p.alpha : (p.life / p.maxLife));
            ctx.globalAlpha = alpha;

            if (p.type === 'text') {
                ctx.font = `bold ${p.size || 14}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4;
                ctx.fillStyle = p.color || '#ffffff';
                ctx.fillText(p.text, p.x, p.y);
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    ctx.restore(); // Restore camera translation

    // 4. In-Game HUD (Screen Space)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const hudX = 20;
    const hudY = 20;
    const hudWidth = Math.min(520, width - 40);
    const hudHeight = 58;

    // Glassmorphism HUD container
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(hudX, hudY, hudWidth, hudHeight, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
        ctx.stroke();
    } else {
        ctx.fillRect(hudX, hudY, hudWidth, hudHeight);
    }

    // Title / Mode display
    ctx.fillStyle = '#f8fafc';
    ctx.font = getCanvasFont(13, 'bold');
    if (gameState.isInfinite) {
        const currentDist = Math.max(0, Math.floor(player.x / TILE_SIZE));
        gameState.maxDistance = Math.max(gameState.maxDistance || 0, currentDist);
        gameState.maxStage = Math.max(gameState.maxStage || 1, gameState.infiniteStage || 1);
        const titleText = getPlatformerText('infiniteTitle', {
            stage: gameState.maxStage,
            distance: gameState.maxDistance
        });
        ctx.fillText(titleText, hudX + 16, hudY + 19);
    } else {
        const lvlNum = gameState.currentLevelIdx + 1;
        const totalLvls = gameState.levels.length;
        const titleText = getPlatformerText('levelTitle', {
            current: lvlNum,
            total: totalLvls,
            name: gameState.currentLevel?.name || 'World'
        });
        ctx.fillText(titleText, hudX + 16, hudY + 19);
    }

    // Responsive anchors for hearts and coins inside HUD
    const heartsX = hudX + Math.max(215, hudWidth - 250);
    const coinsX = hudX + Math.max(340, hudWidth - 110);

    // Lives
    let hearts = '';
    for (let i = 0; i < 3; i++) {
        hearts += i < gameState.lives ? '♥ ' : '♡ ';
    }
    ctx.fillStyle = '#ef4444';
    ctx.font = '16px monospace';
    ctx.fillText(hearts, heartsX, hudY + 19);

    // Coins
    ctx.fillStyle = '#ffd700';
    ctx.font = getCanvasFont(12, 'bold');
    ctx.fillText(`COINS: ${formatNumber(gameState.totalCoins, gameState.lang)}`, coinsX, hudY + 19);

    // Controls hint
    ctx.fillStyle = '#94a3b8';
    ctx.font = getCanvasFont(11, 'normal');
    ctx.fillText(getPlatformerText('controlsHint'), hudX + 16, hudY + 41);

    ctx.restore();

    // 5. Milestone & Alert Notification Banner (Positioned cleanly BELOW the HUD with 12px margin)
    if (gameState.milestoneBanner) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const b = gameState.milestoneBanner;
        const bText = b.text || '';
        const bSub = b.subText || '';
        const isDanger = b.type === 'danger';

        ctx.font = 'bold 14px monospace';
        const textW = ctx.measureText(bText).width;
        const subW = bSub ? ctx.measureText(bSub).width * 0.85 : 0;
        const bWidth = Math.max(textW, subW) + 48;
        const bHeight = bSub ? 52 : 36;
        const bX = width / 2 - bWidth / 2;
        const bY = hudY + hudHeight + 12; // Positioned cleanly BELOW HUD, never overlaps!

        if (isDanger) {
            ctx.fillStyle = 'rgba(159, 18, 57, 0.95)';
            ctx.strokeStyle = '#f43f5e';
            ctx.shadowColor = 'rgba(244, 63, 94, 0.4)';
        } else {
            ctx.fillStyle = 'rgba(22, 101, 52, 0.95)';
            ctx.strokeStyle = '#4ade80';
            ctx.shadowColor = 'rgba(74, 222, 128, 0.4)';
        }

        ctx.shadowBlur = 14;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(bX, bY, bWidth, bHeight, 10);
        } else {
            ctx.rect(bX, bY, bWidth, bHeight);
        }
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (bSub) {
            ctx.font = 'bold 13px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(bText, width / 2, bY + 18);

            ctx.font = '11.5px monospace';
            ctx.fillStyle = isDanger ? '#fecdd3' : '#bbf7d0';
            ctx.fillText(bSub, width / 2, bY + 36);
        } else {
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(bText, width / 2, bY + bHeight / 2);
        }

        ctx.restore();
    }

    // 6. Game State Overlays (WIN / GAME OVER)
    if (gameState.state === 'WIN') {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 0, width, height);

        // Falling confetti celebration particles
        if (gameState.particles && gameState.particles.length > 0) {
            for (const p of gameState.particles) {
                if (p.type === 'text') continue;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                ctx.fillRect(p.x, p.y, p.size, p.size * 1.3);
            }
            ctx.globalAlpha = 1;
        }

        // Celebratory "You Win" sign / card
        const cardWidth = Math.min(520, width - 36);
        const cardHeight = 352;
        const cardX = (width - cardWidth) / 2;
        const cardY = (height - cardHeight) / 2;

        ctx.shadowColor = 'rgba(251, 191, 36, 0.55)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 16);
        } else {
            ctx.rect(cardX, cardY, cardWidth, cardHeight);
        }
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Trophy Icon
        ctx.font = '38px monospace';
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', width / 2, cardY + 42);

        // YOU WIN! title
        ctx.font = getCanvasFont(32, 'bold');
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(getPlatformerText('youWinTitle'), width / 2, cardY + 84);

        // Subtitle
        ctx.font = getCanvasFont(14, 'bold');
        ctx.fillStyle = '#22c55e';
        ctx.fillText(getPlatformerText('allLevelsCompleted'), width / 2, cardY + 118);

        // Victory Reward Box
        const rewardBoxY = cardY + 144;
        const rewardBoxHeight = 56;
        ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(cardX + 24, rewardBoxY, cardWidth - 48, rewardBoxHeight, 10);
        } else {
            ctx.rect(cardX + 24, rewardBoxY, cardWidth - 48, rewardBoxHeight);
        }
        ctx.fill();
        ctx.stroke();

        ctx.font = getCanvasFont(13, 'bold');
        ctx.fillStyle = '#4ade80';
        ctx.fillText(getPlatformerText('rewardUnlocked'), width / 2, rewardBoxY + 19);

        ctx.fillStyle = '#f8fafc';
        ctx.font = getCanvasFont(12, 'normal');
        ctx.fillText(getPlatformerText('victoryCoinsAwarded', { coins: gameState.totalCoins }), width / 2, rewardBoxY + 38);

        // --- BUTTONS ---
        // 1. Primary Action Button: [ Play Unlimited Platformer ]
        const btnW = Math.min(320, cardWidth - 60);
        const btnH = 46;
        const btnX = (width - btnW) / 2;
        const btnY = cardY + 216;

        const isHoverInfinite = gameState.hoveredButton === 'playInfinite';

        ctx.save();
        if (isHoverInfinite) {
            ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
            ctx.shadowBlur = 18;
            ctx.fillStyle = '#059669';
            ctx.strokeStyle = '#6ee7b7';
            ctx.lineWidth = 2.5;
        } else {
            ctx.shadowColor = 'rgba(16, 185, 129, 0.35)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#047857';
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
        }

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(btnX, btnY, btnW, btnH, 10);
        } else {
            ctx.rect(btnX, btnY, btnW, btnH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = getCanvasFont(15, 'bold');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getPlatformerText('playUnlimitedBtn'), width / 2, btnY + btnH / 2);
        ctx.restore();

        // 2. Secondary Action Button: [ Replay Custom Levels ]
        const repW = Math.min(240, cardWidth - 90);
        const repH = 36;
        const repX = (width - repW) / 2;
        const repY = cardY + 272;

        const isHoverReplay = gameState.hoveredButton === 'replayLevels';

        ctx.save();
        if (isHoverReplay) {
            ctx.shadowColor = 'rgba(148, 163, 184, 0.5)';
            ctx.shadowBlur = 12;
            ctx.fillStyle = 'rgba(51, 65, 85, 0.95)';
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2;
        } else {
            ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.lineWidth = 1.5;
        }

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(repX, repY, repW, repH, 8);
        } else {
            ctx.rect(repX, repY, repW, repH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = isHoverReplay ? '#f8fafc' : '#cbd5e1';
        ctx.font = getCanvasFont(12.5, 'bold');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getPlatformerText('replayLevelsBtn'), width / 2, repY + repH / 2);
        ctx.restore();

        // Prompt Hint
        ctx.fillStyle = '#64748b';
        ctx.font = getCanvasFont(11, 'normal');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getPlatformerText('clickButtonPrompt'), width / 2, cardY + 326);

        // Store button bounding boxes on gameState for hit testing
        gameState.uiButtons = {
            playInfinite: { x: btnX, y: btnY, width: btnW, height: btnH },
            replayLevels: { x: repX, y: repY, width: repW, height: repH }
        };

        ctx.restore();
    } else if (gameState.state === 'GAME_OVER') {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(0, 0, width, height);

        // Centered Game Over Plaque
        const cardWidth = Math.min(500, width - 36);
        const cardHeight = 248;
        const cardX = (width - cardWidth) / 2;
        const cardY = (height - cardHeight) / 2;

        ctx.shadowColor = 'rgba(239, 68, 68, 0.55)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 16);
        } else {
            ctx.rect(cardX, cardY, cardWidth, cardHeight);
        }
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Failure Icon
        ctx.font = '36px monospace';
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', width / 2, cardY + 36);

        // GAME OVER heading
        ctx.font = getCanvasFont(30, 'bold');
        ctx.fillStyle = '#ef4444';
        ctx.fillText(getPlatformerText('gameOverTitle'), width / 2, cardY + 74);

        // Specific Loss Reason
        ctx.font = getCanvasFont(13.5, 'normal');
        ctx.fillStyle = '#fca5a5';
        let reasonText = getPlatformerText('gameOverDefaultReason');
        if (gameState.gameOverReason === 'PIT') {
            reasonText = getPlatformerText('gameOverPitReason');
        } else if (gameState.gameOverReason === 'ENEMY') {
            reasonText = getPlatformerText('gameOverEnemyReason');
        }
        ctx.fillText(reasonText, width / 2, cardY + 102);

        // Run Stats Box
        const statsY = cardY + 122;
        const statsH = 54;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(cardX + 24, statsY, cardWidth - 48, statsH, 8);
        } else {
            ctx.rect(cardX + 24, statsY, cardWidth - 48, statsH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = getCanvasFont(13, 'normal');
        if (gameState.isInfinite) {
            const finalDist = gameState.maxDistance;
            const finalStage = gameState.maxStage;
            ctx.fillText(getPlatformerText('infiniteRunStats', {
                distance: finalDist,
                stage: finalStage
            }), width / 2, statsY + 18);
        } else {
            ctx.fillText(getPlatformerText('customLevelStats', {
                name: gameState.currentLevel?.name || 'Custom Level'
            }), width / 2, statsY + 18);
        }
        ctx.fillStyle = '#fbbf24';
        ctx.font = getCanvasFont(13, 'bold');
        ctx.fillText(getPlatformerText('coinsSaved', { coins: gameState.totalCoins }), width / 2, statsY + 38);

        // Action Prompt
        ctx.fillStyle = '#38bdf8';
        ctx.font = getCanvasFont(13.5, 'bold');
        ctx.fillText(getPlatformerText('restartActionPrompt'), width / 2, cardY + 208);

        ctx.restore();
    }
}
