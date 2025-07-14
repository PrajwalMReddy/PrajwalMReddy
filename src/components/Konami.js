import React, {useEffect} from 'react';
import {useLanguage} from '../utils/LanguageContext';

const Konami = () => {
    const {t} = useLanguage();

    useEffect(() => {
        document.title = t('pageTitles.konami');
    }, [t]);

    return (<div id="app-root">
    </div>);
};

export default Konami;
