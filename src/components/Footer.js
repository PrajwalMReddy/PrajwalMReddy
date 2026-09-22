import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../utils/LanguageContext';

const Footer = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const tapCountRef = useRef(0);
    const tapTimerRef = useRef(null);

    const handleLogoClick = () => {
        tapCountRef.current += 1;
        if (tapCountRef.current === 1) {
            tapTimerRef.current = setTimeout(() => {
                tapCountRef.current = 0;
            }, 800);
        } else if (tapCountRef.current >= 3) {
            clearTimeout(tapTimerRef.current);
            tapCountRef.current = 0;
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try {
                    navigator.vibrate(60);
                } catch (_) {}
            }
            navigate('/admin/login');
        }
    };

    return (
        <footer>
            <hr />
            <div className="footer-div">
                <img
                    className="footer-logo"
                    src="/hurricane.png"
                    alt="Hurricane Logo"
                    onClick={handleLogoClick}
                />
                <p className="footer-copyright">{t('copyright')}</p>
                <div id="footer-third"></div>
            </div>
        </footer>
    );
};

export default Footer;