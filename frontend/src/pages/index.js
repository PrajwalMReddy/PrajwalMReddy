function IndexInformation() {
    return (
        <div id="home">
            <h1 id="home-heading">Hello World!</h1>
            <div id="home-info">
                <p className="home-text">I'm Prajwal Reddy</p>
                <p className="home-text">a student, programmer, and builder.</p>
                <p className="home-text-sub">
                    I am a college student at Cornell University, studying a double major in Computer Science and
                    Economics.
                    However, I am also passionate about Linguistics and Urban Planning, often developing
                    applications that focus on issues in these areas.
                    My other non-academic interests include world building and conlanging.
                </p>
            </div>
        </div>
    );
}

function IndexSkills() {
    return (
        <div id="skill-div">
            <h2 id="skill-heading">My Programming Skills</h2>
            <div className="skill-line">
                <p className="skill-info">Python</p>
                <p className="skill-info">Java and Kotlin</p>
                <p className="skill-info">C and C++</p>
                <p className="skill-info">Dart + Flutter</p>
                <p className="skill-info">PHP</p>
            </div>
            <div className="skill-line">
                <p className="skill-info">SQL + MySQL</p>
                <p className="skill-info">HTML + CSS + JavaScript</p>
                <p className="skill-info">Rust</p>
                <p className="skill-info">Arduino</p>
            </div>
        </div>
    );
}

export default function Index() {
    return (
        <main>
            <IndexInformation />
            <IndexSkills />
        </main>
    );
}
