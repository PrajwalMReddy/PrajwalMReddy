// Extensible Action & Text Alert Registry for Platformer
// Centralizes all event-driven in-game banners, floating text particles, and notifications.
import { addTextParticle, formatNumber, getPlatformerText, gameState } from './model.js';

/**
 * Enumeration of all discrete game events/actions that can trigger text alerts.
 * To extend, simply add a new action key here and define its template in GAME_ALERTS.
 */
export const ALERT_ACTIONS = {
    // 1. Collectibles & Economy
    COIN_COLLECT: 'COIN_COLLECT',

    // 2. Combat & Hazard Interactions
    ENEMY_STOMP: 'ENEMY_STOMP',
    ENEMY_HIT: 'ENEMY_HIT',
    FALL_CHASM: 'FALL_CHASM',

    // 3. Level & Progression Milestones
    STAGE_CLEARED: 'STAGE_CLEARED',
    LEVEL_CLEARED: 'LEVEL_CLEARED',
    VICTORY_REWARD: 'VICTORY_REWARD',

    // 4. Endgame States
    GAME_OVER: 'GAME_OVER',
    GAME_WIN: 'GAME_WIN'
};

/**
 * Action Alert Configuration Map
 * Defines banners, floating text particles, colors, and durations for each action.
 */
export const GAME_ALERTS = {
    [ALERT_ACTIONS.COIN_COLLECT]: {
        particle: (ctx) => ({
            text: `+${formatNumber(ctx.amount || 1, gameState.lang)} COIN`,
            color: '#fbbf24',
            size: 14
        })
    },

    [ALERT_ACTIONS.ENEMY_STOMP]: {
        particle: (ctx) => ({
            text: `+${formatNumber(ctx.bonus || 2, gameState.lang)} COINS ${getPlatformerText('bugStomp')}`,
            color: '#34d399',
            size: 15
        })
    },

    [ALERT_ACTIONS.ENEMY_HIT]: {
        particle: () => ({
            text: '-1 LIFE',
            color: '#ef4444',
            size: 18
        }),
        banner: (ctx) => {
            const heartUnit = ctx.lives === 1 ? getPlatformerText('heartSingle') : getPlatformerText('heartsPlural');
            return {
                text: getPlatformerText('hitByBugBanner', { lives: ctx.lives, heartUnit }),
                type: 'danger',
                timer: 130
            };
        }
    },

    [ALERT_ACTIONS.FALL_CHASM]: {
        particle: () => ({
            text: '-1 LIFE',
            color: '#ef4444',
            size: 18
        }),
        banner: (ctx) => {
            const heartUnit = ctx.lives === 1 ? getPlatformerText('heartSingle') : getPlatformerText('heartsPlural');
            return {
                text: getPlatformerText('fellIntoChasmBanner', { lives: ctx.lives, heartUnit }),
                type: 'danger',
                timer: 130
            };
        }
    },

    [ALERT_ACTIONS.STAGE_CLEARED]: {
        particle: (ctx) => ({
            text: ctx.restoredHeart
                ? `+${formatNumber(5, gameState.lang)} COINS & +${formatNumber(1, gameState.lang)} LIFE`
                : `+${formatNumber(5, gameState.lang)} COINS`,
            color: '#34d399',
            size: 16
        }),
        banner: (ctx) => ({
            text: getPlatformerText('stageClearedBanner', { stage: ctx.stage || 1 }),
            subText: ctx.restoredHeart
                ? getPlatformerText('heartRestoredSub')
                : getPlatformerText('fullHealthSub'),
            type: 'success',
            timer: 160
        })
    },

    [ALERT_ACTIONS.LEVEL_CLEARED]: {
        banner: (ctx) => ({
            text: getPlatformerText('levelClearedBanner', { level: ctx.levelNum }),
            subText: ctx.nextLevelName
                ? getPlatformerText('upNextSub', { name: ctx.nextLevelName })
                : getPlatformerText('headingToNextSub'),
            type: 'success',
            timer: 160
        })
    },

    [ALERT_ACTIONS.VICTORY_REWARD]: {
        banner: () => ({
            text: getPlatformerText('victoryRewardBanner'),
            type: 'reward',
            timer: 180
        })
    },

    [ALERT_ACTIONS.GAME_OVER]: {
        reasons: {
            PIT: () => getPlatformerText('gameOverPitReason'),
            ENEMY: () => getPlatformerText('gameOverEnemyReason'),
            DEFAULT: () => getPlatformerText('gameOverDefaultReason')
        }
    },

    [ALERT_ACTIONS.GAME_WIN]: {
        particle: () => ({
            text: getPlatformerText('victoryParticle'),
            color: '#fbbf24',
            size: 16
        }),
        title: () => getPlatformerText('youWinTitle'),
        subText: () => getPlatformerText('allLevelsCompleted'),
        reward: () => getPlatformerText('rewardUnlocked')
    }
};

/**
 * Triggers a configured text alert (banner and/or floating particle) for a given action.
 * @param {string} action - One of ALERT_ACTIONS
 * @param {object} context - Action-specific payload (e.g. { x, y, lives, stage, levelNum })
 */
export function triggerAlert(action, context = {}) {
    const config = GAME_ALERTS[action];
    if (!config) return;

    // Trigger on-screen banner alert if defined
    if (config.banner) {
        gameState.milestoneBanner = config.banner(context);
    }

    // Trigger floating text particle if coordinates and particle template are defined
    if (config.particle && typeof context.x === 'number' && typeof context.y === 'number') {
        const p = config.particle(context);
        addTextParticle(context.x, context.y, p.text, p.color, p.size);
    }
}
