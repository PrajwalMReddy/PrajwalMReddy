let languageCodes = {
    "kn": "ಕನ್ನಡ", "en": "English",
    "ಕನ್ನಡ": "kn", "English": "en",
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

// TODO Remove the /ln codes
let languagePageMappings = {
    "ಕನ್ನಡ": {
        "index": "mane",
        "projects": "yojanegalu",
        "blog": "mimbaraha",
        "contact": "samparka",
    }, "English": {
        "mane": "index",
        "yojanegalu": "projects",
        "mimbaraha": "blog",
        "samparka": "contact",
    },
};

function loadPreferredLanguagePage(url, newLanguage, currentPage) {
    let preferredLanguagePage = languagePageMappings[newLanguage][currentPage];
    preferredLanguagePage = "/" + languageCodes[newLanguage] + "/" + preferredLanguagePage;

    if (preferredLanguagePage === undefined) {
        return; // To be decided how to handle this case
    }

    let urlStem = "";
    if (preferredLanguagePage.includes("blogs") || preferredLanguagePage.includes("mimbarahagalu")) {
        urlStem = url.substring(0, url.lastIndexOf('/', (url.lastIndexOf('/', url.lastIndexOf('/') - 1) - 1)));
    } else {
        urlStem = url.substring(0, url.lastIndexOf('/', url.lastIndexOf('/') - 1));
    }

    window.location.href = urlStem + preferredLanguagePage + ".html";
}
