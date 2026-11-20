import React, { useState, useEffect, useCallback } from 'react';
import { assistantApi } from '../../../utils/assistantApi';
import { useContent } from '../../../utils/ContentContext';

// Minimalist, monochromatic line weather & utility icons
function WeatherIcon({ name, size = 18, className = '' }) {
    switch (name) {
        case 'clear':
        case 'sun':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
            );
        case 'partly-cloudy':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.5 8.5A4.5 4.5 0 0 0 8 11.5" />
                    <path d="M17.5 19H9a5 5 0 0 1-.7-9.96 6 6 0 0 1 11.4 2.5 4 4 0 0 1-2.2 7.46Z" />
                </svg>
            );
        case 'cloudy':
        case 'fog':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <path d="M17.5 19H9a5 5 0 0 1-.7-9.96 6 6 0 0 1 11.4 2.5 4 4 0 0 1-2.2 7.46Z" />
                </svg>
            );
        case 'rain':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                    <path d="m8 19-2 3M12 19l-2 3M16 19l-2 3" />
                </svg>
            );
        case 'heavy-rain':
        case 'thunderstorm':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <path d="M17.5 15H9a5 5 0 0 1-.7-9.96 6 6 0 0 1 11.4 2.5 4 4 0 0 1-2.2 7.46Z" />
                    <path d="m13 15-3 5h4l-2 4" />
                </svg>
            );
        case 'snow':
        case 'sleet':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <path d="M17.5 15H9a5 5 0 0 1-.7-9.96 6 6 0 0 1 11.4 2.5 4 4 0 0 1-2.2 7.46Z" />
                    <path d="M8 19v.01M12 20v.01M16 19v.01" />
                </svg>
            );
        case 'droplet':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
            );
        case 'wind':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2" />
                </svg>
            );
        case 'uv':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
            );
        case 'sunrise':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <path d="M12 2v6M4.93 10.93l1.41 1.41M20 18h2M2 18h2M19.07 10.93l-1.41 1.41M22 22H2M8 18a4 4 0 0 1 8 0" />
                </svg>
            );
        case 'sunset':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <path d="M12 10V4M4.93 10.93l1.41 1.41M20 18h2M2 18h2M19.07 10.93l-1.41 1.41M22 22H2M8 18a4 4 0 0 1 8 0" />
                </svg>
            );
        case 'refresh':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                </svg>
            );
        default:
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                </svg>
            );
    }
}

const WeatherWidget = () => {
    const { t, formatNumber, formatTime } = useContent();

    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const loadWeather = useCallback(async ({ forceFresh = true } = {}) => {
        try {
            setError(null);
            const params = {};
            if (forceFresh) {
                params.fresh = 'true';
            }

            const res = await assistantApi.getWeather(params);
            if (res && res.weather) {
                setWeather(res.weather);
            } else if (res && (res.configured === false || !res.weather)) {
                setWeather(null);
            } else {
                throw new Error(res?.status || t('admin.weather.error'));
            }
        } catch (err) {
            console.error('Weather load error:', err);
            setError(err.message || t('admin.weather.error'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [t]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadWeather({ forceFresh: true });
    };

    useEffect(() => {
        loadWeather({ forceFresh: true });
    }, [loadWeather]);

    const unit = weather?.unit || 'F';

    const displayTemp = (tempF, tempC) => {
        if (unit === 'C') {
            const val = tempC !== undefined ? tempC : Math.round(((tempF - 32) * 5) / 9);
            return `${formatNumber(val)}°C`;
        }
        const val = tempF !== undefined ? tempF : Math.round((tempC * 9) / 5 + 32);
        return `${formatNumber(val)}°F`;
    };

    const displaySpeed = (speedMph, speedKmh) => {
        if (unit === 'C') {
            return t('admin.ui.weatherWidget.kmh', { p0: formatNumber(speedKmh || Math.round(speedMph * 1.609)) });
        }
        return t('admin.ui.weatherWidget.mph', { p0: formatNumber(speedMph || 0) });
    };

    // Condition names come from the WMO code; the icon category covers providers without one.
    const conditionLabel = (item) => (item.conditionCode !== undefined && item.conditionCode !== null
        ? t(`admin.ui.weatherWidget.wmo.c${item.conditionCode}`)
        : t(`admin.ui.weatherWidget.icons.${item.conditionIcon || 'partly-cloudy'}`));

    // Local clock times: ISO-like "2026-11-16T15:00" or "07:02 AM"
    const clockLabel = (value, minutes = true) => {
        if (!value) return '';
        const iso = String(value).match(/T(\d{2}):(\d{2})/);
        const ampm = String(value).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        let h; let m;
        if (iso) { h = Number(iso[1]); m = Number(iso[2]); }
        else if (ampm) { h = (Number(ampm[1]) % 12) + (ampm[3].toUpperCase() === 'PM' ? 12 : 0); m = Number(ampm[2]); }
        else return '';
        return formatTime(new Date(2000, 0, 1, h, m), minutes ? {} : { minutes: false });
    };

    const summaryText = (rec) => {
        if (!rec || !rec.outfitKey) return '';
        const rain = rec.rainTiming || { kind: 'dry' };
        const rainText = rain.kind === 'peak'
            ? t('admin.ui.weatherWidget.rainPeak', { time: clockLabel(rain.time, false), p: formatNumber(rain.chance) })
            : rain.kind === 'possible'
                ? t('admin.ui.weatherWidget.rainPossible', { p: formatNumber(rain.chance) })
                : t('admin.ui.weatherWidget.rainDry');
        return t('admin.ui.weatherWidget.summary', { outfit: t(`admin.ui.weatherWidget.outfits.${rec.outfitKey}`), rain: rainText });
    };

    if (loading) {
        return (
            <article className="briefing-memo-document admin-weather-widget" aria-label={t('admin.weather.title')}>
                <header className="memo-masthead weather-memo-masthead">
                    <div className="memo-header-top">
                        <h2 className="memo-title">
                            {t('admin.weather.title')}
                        </h2>
                    </div>
                </header>
                <div className="weather-loading-box">
                    <div className="weather-loading-spinner" />
                    <div className="weather-loading-text">
                        {t('admin.weather.loading')}
                    </div>
                </div>
            </article>
        );
    }

    if (!weather) {
        return (
            <article className="briefing-memo-document admin-weather-widget" aria-label={t('admin.weather.title')}>
                <header className="memo-masthead weather-memo-masthead">
                    <div className="memo-header-top">
                        <div className="weather-title-group">
                            <h2 className="memo-title">
                                {t('admin.weather.title')}
                            </h2>
                        </div>
                    </div>
                </header>
                <div className="weather-empty-box" style={{ padding: '28px 16px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.88rem', fontWeight: 600, color: 'inherit' }}>
                        {t('admin.weather.noLocationTitle')}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.75 }}>
                        {t('admin.weather.noLocationHelp')}
                    </p>
                </div>
            </article>
        );
    }

    const w = weather || {};
    const rec = w.recommendations || {};
    const chanceOfRain = w.chanceOfRain || 0;
    const condIcon = w.conditionIcon || 'partly-cloudy';

    return (
        <article className="briefing-memo-document admin-weather-widget" aria-label={t('admin.weather.title')}>
            {/* Header: Title, Location & Refresh */}
            <header className="memo-masthead weather-memo-masthead">
                <div className="memo-header-top">
                    <div className="weather-title-group">
                        <h2 className="memo-title">
                            {t('admin.weather.title')}
                        </h2>
                        {w.location && (
                            <span className="weather-location-sub" title={w.location}>
                                {w.location}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {/* Error Notification */}
            {error && (
                <div className="weather-error-banner">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="weather-retry-btn"
                    >
                        {t('admin.weather.retry')}
                    </button>
                </div>
            )}

            {/* 1. Main Weather Display (Minimalist & Unboxed) */}
            <div className="weather-current-row">
                <div className="weather-current-main">
                    <div className="weather-current-lead">
                        <WeatherIcon name={condIcon} size={30} className="weather-current-icon" />
                        <span className="weather-current-temp">
                            {displayTemp(w.temperatureF, w.temperatureC)}
                        </span>
                        <div className="weather-current-meta">
                            <span className="weather-current-condition">{conditionLabel(w)}</span>
                            <div className="weather-current-details">
                                <span>{t('admin.ui.weatherWidget.high', { p0: displayTemp(w.highF, w.highC) })}</span>
                                <span className="weather-meta-sep">·</span>
                                <span>{t('admin.ui.weatherWidget.low', { p0: displayTemp(w.lowF, w.lowC) })}</span>
                                <span className="weather-meta-sep">·</span>
                                <span>{t('admin.weather.feelsLike')} {displayTemp(w.feelsLikeF, w.feelsLikeC)}</span>
                            </div>
                        </div>
                    </div>
                    {(w.sunrise || w.sunset) && (
                        <div className="weather-sun-chip" aria-label={t('admin.ui.weatherWidget.sunriseAndSunset')}>
                            {w.sunrise && (
                                <span className="weather-sun-chip-item" title={t('admin.weather.sunrise')}>
                                    <WeatherIcon name="sunrise" size={13} />
                                    <span>{clockLabel(w.sunriseTime || w.sunrise)}</span>
                                </span>
                            )}
                            {w.sunrise && w.sunset && <span className="weather-meta-sep">·</span>}
                            {w.sunset && (
                                <span className="weather-sun-chip-item" title={t('admin.weather.sunset')}>
                                    <WeatherIcon name="sunset" size={13} />
                                    <span>{clockLabel(w.sunsetTime || w.sunset)}</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {summaryText(rec) && (
                    <p className="weather-current-note">
                        {summaryText(rec)}
                    </p>
                )}
            </div>

            {/* 2. Minimalist Metric Stats Strip */}
            <div className="weather-stats-row">
                <div className="weather-stat-item">
                    <span className="weather-stat-label">{t('admin.weather.rainChance')}</span>
                    <span className="weather-stat-value">{formatNumber(chanceOfRain)}%</span>
                </div>
                <div className="weather-stat-item">
                    <span className="weather-stat-label">{t('admin.weather.wind')}</span>
                    <span className="weather-stat-value">{displaySpeed(w.windSpeedMph, w.windSpeedKmh)}</span>
                </div>
                <div className="weather-stat-item">
                    <span className="weather-stat-label">{t('admin.weather.humidity')}</span>
                    <span className="weather-stat-value">{formatNumber(w.humidity || 0)}%</span>
                </div>
                <div className="weather-stat-item">
                    <span className="weather-stat-label">{t('admin.weather.uvIndex')}</span>
                    <span className="weather-stat-value">{formatNumber(`${Math.round(w.uvIndex || 0)} / 10`)}</span>
                </div>
            </div>

            {/* 3. Sleek, Flat Hourly Outlook Strip */}
            {Array.isArray(w.hourly) && w.hourly.length > 0 && (
                <div className="weather-hourly-wrap">
                    <div className="weather-hourly-strip">
                        {w.hourly.slice(0, 8).map((hourItem, idx) => {
                            const isNow = idx === 0;
                            const hourLabel = isNow ? t('admin.weather.now') : clockLabel(hourItem.time, false);
                            const hasRain = hourItem.rainChance >= 20;
                            const iconName = hourItem.conditionIcon || (hasRain ? 'rain' : 'cloudy');
                            return (
                                <div
                                    key={hourItem.time || idx}
                                    className={`weather-hourly-item ${isNow ? 'is-now' : ''}`}
                                    title={t('admin.ui.weatherWidget.rain', { p0: hourLabel, p1: conditionLabel(hourItem), p2: formatNumber(hourItem.rainChance) })}
                                >
                                    <span className="weather-hourly-time">
                                        {hourLabel}
                                    </span>
                                    <WeatherIcon name={iconName} size={16} className="weather-hourly-icon" />
                                    <span className="weather-hourly-temp">
                                        {displayTemp(hourItem.tempF, hourItem.tempC)}
                                    </span>
                                    {hasRain ? (
                                        <span className="weather-hourly-rain">
                                            {formatNumber(hourItem.rainChance)}%
                                        </span>
                                    ) : (
                                        <span className="weather-hourly-rain-spacer" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </article>
    );
};

export default WeatherWidget;
