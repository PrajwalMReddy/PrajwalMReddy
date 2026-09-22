import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../utils/LanguageContext';
import { useAuth } from '../utils/AuthContext';
import Settings from './Settings';

const SideNav = () => {
    const { t } = useLanguage();
    const { authenticated } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const pressTimerRef = useRef(null);
    const isLongPressRef = useRef(false);
    const touchStartPosRef = useRef({ x: 0, y: 0 });
    const tapCountRef = useRef(0);
    const tapTimerRef = useRef(null);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    const triggerAdmin = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate(60);
            } catch (_) {}
        }
        setIsOpen(false);
        navigate('/admin/login');
    };

    const startPress = (e) => {
        isLongPressRef.current = false;
        if (e.touches && e.touches[0]) {
            touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
        pressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            triggerAdmin();
        }, 750);
    };

    const cancelPress = () => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches && e.touches[0]) {
            const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
            const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
            if (dx > 30 || dy > 30) {
                cancelPress();
            }
        }
    };

    const handleMainClick = (e) => {
        if (isLongPressRef.current) {
            e.preventDefault();
            e.stopPropagation();
            isLongPressRef.current = false;
            return;
        }

        // Multi-tap detection (Triple tap triggers admin login)
        tapCountRef.current += 1;
        if (tapCountRef.current === 1) {
            tapTimerRef.current = setTimeout(() => {
                tapCountRef.current = 0;
            }, 800);
        } else if (tapCountRef.current >= 3) {
            e.preventDefault();
            e.stopPropagation();
            clearTimeout(tapTimerRef.current);
            tapCountRef.current = 0;
            triggerAdmin();
            return;
        }

        setIsOpen(false);
    };

    return (<>
        <button
            className="hamburger-menu"
            onClick={toggleMenu}
            aria-label="Toggle menu"
        >
            <span></span>
            <span></span>
            <span></span>
        </button>
        <nav id="nav-div" className={isOpen ? 'open' : ''}>
            <ul id="nav-list">
                <li id="nav-main">
                    <Link
                        to="/"
                        className="nav-link"
                        onClick={handleMainClick}
                        onTouchStart={startPress}
                        onTouchEnd={cancelPress}
                        onTouchMove={handleTouchMove}
                        onTouchCancel={cancelPress}
                        onMouseDown={startPress}
                        onMouseUp={cancelPress}
                        onMouseLeave={cancelPress}
                        onContextMenu={(e) => {
                            if (isLongPressRef.current) {
                                e.preventDefault();
                            }
                        }}
                        style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                    >
                        {t('navName')}
                    </Link>
                </li>
                <li className="nav-element"><Link to="/projects" className="nav-link"
                    onClick={() => setIsOpen(false)}>{t('project')}</Link></li>
                {/*<li className="nav-element"><Link to="/experience" className="nav-link"
                                                  onClick={() => setIsOpen(false)}>{t('experience')}</Link></li>*/}
                <li className="nav-element"><Link to="/blog" className="nav-link"
                    onClick={() => setIsOpen(false)}>{t('blog')}</Link></li>
                <li className="nav-element"><Link to="/photography" className="nav-link"
                    onClick={() => setIsOpen(false)}>{t('photography')}</Link></li>
                <li className="nav-element"><Link to="/about" className="nav-link"
                    onClick={() => setIsOpen(false)}>{t('contact')}</Link></li>
                {authenticated && (
                    <li className="nav-element">
                        <Link
                            to="/admin"
                            className="nav-link"
                            onClick={() => setIsOpen(false)}
                        >
                            {t('navAdmin', 'Admin')}
                        </Link>
                    </li>
                )}
            </ul>
            <Settings />
        </nav>
        {isOpen && <div className="overlay" onClick={toggleMenu}></div>}
    </>);
};

export default SideNav;

