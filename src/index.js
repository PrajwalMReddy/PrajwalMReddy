let languageCodes = {
    "kn": "ಕನ್ನಡ", "en": "English",
};

// Changing the language of a page on load if preferred language is different from loaded page's language
window.addEventListener("load", (event) => {
    let fullURL = window.location.href;
    let currentPage = fullURL.substring(fullURL.lastIndexOf('/') + 1, fullURL.lastIndexOf('.'));

    let preferredLanguage = localStorage.getItem("language");
    let currentLanguage = languageCodes[fullURL.substring(fullURL.lastIndexOf('/', fullURL.lastIndexOf('/') - 1) + 1, fullURL.lastIndexOf('/'))];

    if ((preferredLanguage !== currentLanguage)) {
        loadPreferredLanguagePage(fullURL, preferredLanguage, currentPage);
    }
});

function languageChoiceChange() {
    let languageChoice = document.getElementById("nav-language-choice");
    let language = languageChoice.options[languageChoice.selectedIndex].text;

    // Temporary Code
    let fullURL = window.location.href;
    let currentPage = fullURL.substring(fullURL.lastIndexOf('/') + 1, fullURL.lastIndexOf('.'));

    localStorage.setItem("language", language);
    loadPreferredLanguagePage(fullURL, language, currentPage);
}

let languageIndexes = {
    "ಕನ್ನಡ": {
        "index": "/kn/mane",
        "projects": "/kn/yojanegalu",
        "blog": "/kn/mimbaraha",
        "contact": "/kn/samparka",
    }, "English": {
        "mane": "/en/index",
        "yojanegalu": "/en/projects",
        "mimbaraha": "/en/blog",
        "samparka": "/en/contact",
    },
};

function loadPreferredLanguagePage(url, newLanguage, currentPage) {
    let preferredLanguagePage = languageIndexes[newLanguage][currentPage];

    if (preferredLanguagePage === undefined) {
        return; // To be decided how to handle this case
    }

    let urlStem = "";
    if (preferredLanguagePage.includes("blog") || preferredLanguagePage.includes("mimbaraha")) {
        urlStem = url.substring(0, url.lastIndexOf('/', (url.lastIndexOf('/', url.lastIndexOf('/') - 1) - 1)));
    } else {
        urlStem = url.substring(0, url.lastIndexOf('/', url.lastIndexOf('/') - 1));
    }

    window.location.href = urlStem + preferredLanguagePage + ".html";
}
