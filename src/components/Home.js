import React from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';

const Home = () => {
    const {t} = useLanguage();

    return (
        <div id="app-root">
            <SideNav/>

            <main>
                <div id="home">
                    <h1 id="home-heading">{t('homeTitle')}</h1>
                    <div id="home-info">
                        <p className="home-text">{t('homeIntro')}</p>
                        <p className="home-text">{t('homeSubtitle')}</p>
                        <p className="home-text-sub">{t('homeDescription')}</p>
                    </div>
                </div>

                <div id="skill-div">
                    <h2 id="skill-heading">{t('skillsTitle')}</h2>
                    <div className="skill-line">
                        <p className="skill-info">{t('skills.python')}</p>
                        <p className="skill-info">{t('skills.javaKotlin')}</p>
                        <p className="skill-info">{t('skills.cpp')}</p>
                        <p className="skill-info">{t('skills.dartFlutter')}</p>
                        <p className="skill-info">{t('skills.php')}</p>
                    </div>
                    <div className="skill-line">
                        <p className="skill-info">{t('skills.sql')}</p>
                        <p className="skill-info">{t('skills.web')}</p>
                        <p className="skill-info">{t('skills.rust')}</p>
                        <p className="skill-info">{t('skills.arduino')}</p>
                    </div>
                </div>
            </main>

            <Footer/>
        </div>
    );
};

export default Home; 