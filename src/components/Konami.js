import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../utils/LanguageContext';
import { setPlatformerLocale, startPlatformer, stopPlatformer } from '../platformer/controller';
import { syncCoinsWithCode } from '../platformer/model';

const Konami = () => {
    const { t, language } = useLanguage();
    const { code } = useParams();
    const canvasRef = useRef(null);

    useEffect(() => {
        syncCoinsWithCode(code);
        document.title = t('pageTitles.konami') || 'Konami | Prajwal Reddy';
        const canvas = canvasRef.current;
        if (!canvas) return;

        startPlatformer(canvas, {
            language,
            t,
            displayText: t('platformer.loading') || t('displayText')
        });

        return () => {
            stopPlatformer();
        };
    }, [code]);

    useEffect(() => {
        setPlatformerLocale(language, t);
        document.title = t('pageTitles.konami') || 'Konami | Prajwal Reddy';
    }, [language, t]);

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#1e1e1e' }}>
            <canvas
                id="konami-canvas"
                ref={canvasRef}
                style={{ display: 'block', width: '100vw', height: '100vh' }}
            />
        </div>
    );
};

export default Konami;
