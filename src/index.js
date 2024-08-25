let languageIndexes = {
    "ಕನ್ನಡ": {
        "index": "/kn/mane.html",
        "projects": "/kn/yojanegalu.html",
        "blog": "/kn/mimbaraha.html",
        "contact": "/kn/samparka.html",
    },
    "English": {
        "mane": "/en/index.html",
        "yojanegalu": "/en/projects.html",
        "mimbaraha": "/en/blog.html",
        "samparka": "/en/contact.html",
    }
};

function languageChoiceChange() {
    let languageChoice = document.getElementById("nav-language-choice");
    let language = languageChoice.options[languageChoice.selectedIndex].text;

    // Temporary Code
    let fullURL = window.location.href;
    let currentPage = fullURL.substring(fullURL.lastIndexOf('/') + 1, fullURL.lastIndexOf('.'));

    localStorage.setItem("language", language);
    window.location.href = fullURL.substring(0, fullURL.lastIndexOf('/', fullURL.lastIndexOf('/') - 1)) + languageIndexes[language][currentPage];
}
