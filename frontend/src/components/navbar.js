function NavBarLinks() {
    return (
        <ul id="nav-list">
            <li id="nav-main"><a href="index.html" className="nav-link">Prajwal Reddy</a></li>
            <li className="nav-element"><a href="projects.html" className="nav-link">Projects</a></li>
            <li className="nav-element"><a href="blog.html" className="nav-link">Blog</a></li>
            <li className="nav-element"><a href="contact.html" className="nav-link">Contact Me</a></li>
        </ul>
    );
}

function NavBarLanguageSwitcher() {
    function languageChoiceChange() {
        // TODO
    }

    return (
        <div id="nav-language-div">
            <label id="nav-language-text" htmlFor="nav-language-choice">Change Language</label>
            <select id="nav-language-choice" onChange={languageChoiceChange} name="languages">
                <option className="nav-language-option" value="language-two">English</option>
                <option className="nav-language-option" value="language-one">ಕನ್ನಡ</option>
            </select>
        </div>
    );
}

export default function NavBar() {
    return (
        <nav id="nav-div">
            <NavBarLinks/>
            <NavBarLanguageSwitcher/>
        </nav>
    );
}
