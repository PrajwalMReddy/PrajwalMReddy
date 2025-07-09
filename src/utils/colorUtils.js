// Utility functions for color switching and interpolation

export const colorStopsLight = [{pct: 0, color: '#2C3E50'}, {pct: 0.16, color: '#0074D9'}, {
    pct: 0.33, color: '#2ECC40'
}, {pct: 0.5, color: '#FFDC00'}, {pct: 0.66, color: '#FF4136'}, {pct: 0.83, color: '#F012BE'}, {
    pct: 1, color: '#2C3E50'
}];

export const colorStopsDark = [{pct: 0, color: '#F5F7FA'}, {pct: 0.16, color: '#39CCCC'}, {
    pct: 0.33, color: '#FF851B'
}, {pct: 0.5, color: '#FFDC00'}, {pct: 0.66, color: '#FF4136'}, {pct: 0.83, color: '#F012BE'}, {
    pct: 1, color: '#F5F7FA'
}];

export const isDarkMode = () => document.body.classList.contains('dark-mode');

export function interpolateColor(color1, color2, t) {
    // Remove # and parse
    const c1 = color1.substring(1);
    const c2 = color2.substring(1);
    const r1 = parseInt(c1.substring(0, 2), 16), g1 = parseInt(c1.substring(2, 4), 16),
        b1 = parseInt(c1.substring(4, 6), 16);
    const r2 = parseInt(c2.substring(0, 2), 16), g2 = parseInt(c2.substring(2, 4), 16),
        b2 = parseInt(c2.substring(4, 6), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function getInterpolatedColorAtPercent(pct, stops) {
    for (let i = 1; i < stops.length; i++) {
        if (pct <= stops[i].pct) {
            const prev = stops[i - 1];
            const next = stops[i];
            const localT = (pct - prev.pct) / (next.pct - prev.pct);
            return interpolateColor(prev.color, next.color, localT);
        }
    }
    return stops[stops.length - 1].color;
} 