import React from 'react';
import {useLanguage} from '../utils/LanguageContext';
import hurricaneLogo from '@img/hurricane.png';

const Footer = () => {
    const {t} = useLanguage();
    return (<footer>
        <hr/>
        <div className="footer-div">
            <img className="footer-logo" src={hurricaneLogo} alt="Hurricane Logo"/>
            <p className="footer-copyright">{t('copyright')}</p>
            <div id="footer-third"></div>
        </div>
    </footer>);
};

export default Footer;