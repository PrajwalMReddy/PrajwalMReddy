import React, {useEffect, useRef} from 'react';
import {useLanguage} from '../utils/LanguageContext';
import { animate } from "../utils/konami/controller";
import {TILE_SIZE} from "../utils/konami/model";

const Konami = () => {
    const {t} = useLanguage();
    const canvasRef = useRef(null);

    useEffect(() => {
        document.title = t('pageTitles.konami');
        const canvas = canvasRef.current;
        if (!canvas) {
            console.warn('Canvas ref is null');
            return;
        }
        // Calculate grid size to fit window exactly
        const cols = Math.floor(window.innerWidth / TILE_SIZE);
        const rows = Math.floor(window.innerHeight / TILE_SIZE);
        canvas.width = cols * TILE_SIZE;
        canvas.height = rows * TILE_SIZE;
        const context = canvas.getContext('2d');
        if (!context) {
            console.warn('2D context is null');
            return;
        }
        const displayText = t('displayText');
        console.log('Canvas and context initialized', canvas, context);
        animate(context, displayText);
    }, [t]);

    return (<div id="app-root" style={{width: '100vw', height: '100vh', overflow: 'hidden'}}>
        <canvas
            id="konami-canvas"
            ref={canvasRef}
            style={{display: 'block', width: '100vw', height: '100vh', background: '#222'}}
        ></canvas>
    </div>);
};

export default Konami;
