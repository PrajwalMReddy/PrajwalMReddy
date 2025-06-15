import React from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import pulsarImg from '@img/pulsar.png';
import midilangImg from '@img/midilang.png';
import kannadadiscoImg from '@img/kannadadisco.png';
import sentimentImg from '@img/research-paper.png';
import firemediaImg from '@img/firemedia.png';
import jetblastersImg from '@img/jetblasters.png';
import robocupImg from '@img/robocup-2023.png';
import northlandImg from '@img/city-skyline.png';
import ProjectCard from './ProjectCard';

const Projects = () => {
    const {t} = useLanguage();

    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <h1 id="project-heading">{t('projectsTitle')}</h1>
                <div id="project-type-programming">
                    <h2 className="project-type-heading">{t('programmingProjects')}</h2>
                    <div className="project-line">
                        <ProjectCard
                            title={t('projects.pulsar.title')}
                            image={pulsarImg}
                            description={t('projects.pulsar.desc')}
                            link="https://github.com/PrajwalMReddy/Pulsar"
                        />
                        <ProjectCard
                            title={t('projects.midilang.title')}
                            image={midilangImg}
                            description={t('projects.midilang.desc')}
                            link="https://github.com/PrajwalMReddy/MIDILang"
                        />
                    </div>
                    <div className="project-line">
                        <ProjectCard
                            title={t('projects.kannadadisco.title')}
                            image={kannadadiscoImg}
                            description={t('projects.kannadadisco.desc')}
                            link="https://kannadadisco.com"
                        />
                        <ProjectCard
                            title={t('projects.sentiment.title')}
                            image={sentimentImg}
                            description={t('projects.sentiment.desc')}
                            link="https://www.internationaljournalssrg.org/IJCSE/paper-details?Id=499"
                        />
                    </div>
                    <div className="project-line">
                        <ProjectCard
                            title={t('projects.firemedia.title')}
                            image={firemediaImg}
                            description={t('projects.firemedia.desc')}
                            link="https://github.com/PrajwalMReddy/FireMedia"
                        />
                        <ProjectCard
                            title={t('projects.jetblasters.title')}
                            image={jetblastersImg}
                            description={t('projects.jetblasters.desc')}
                            link="https://github.com/PrajwalMReddy/JetBlasters"
                        />
                    </div>
                </div>
                <div id="project-type-other">
                    <h2 className="project-type-heading">{t('otherProjects')}</h2>
                    <div className="project-line">
                        <ProjectCard
                            title={t('projects.robocup.title')}
                            image={robocupImg}
                            description={t('projects.robocup.desc')}
                        />
                        <ProjectCard
                            title={t('projects.northland.title')}
                            image={northlandImg}
                            description={t('projects.northland.desc')}
                        />
                    </div>

                </div>
            </main>
            <Footer/>
        </div>
    );
};

export default Projects; 