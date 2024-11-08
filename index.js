let languageCodeMappings = {
    "kn": "ಕನ್ನಡ", "en": "English", "es": "español",
    "ಕನ್ನಡ": "kn", "English": "en", "español": "es"
};

let languagePageMappings = {
    "ಕನ್ನಡ": {
        "index": "mane",
        "projects": "yojanegalu",
        "blog": "mimbaraha",
        "contact": "samparka",

        "blogs/test-blog": "mimbarahagalu/parikshe-mimbaraha",
    }, "English": {
        "mane": "index",
        "yojanegalu": "projects",
        "mimbaraha": "blog",
        "samparka": "contact",

        "mimbarahagalu/parikshe-mimbaraha": "blogs/test-blog",
    },
};

// Changing the language of a page on load if preferred language is different from loaded page's language
window.addEventListener("load", (event) => {
    loadPreferredLanguagePage(window.location.href, localStorage.getItem("language"));
});

function languageChoiceChange() {
    let languageChoice = document.getElementById("nav-language-choice");
    let language = languageChoice.options[languageChoice.selectedIndex].text;

    localStorage.setItem("language", language);
    loadPreferredLanguagePage(window.location.href, language);
}

// Returns everything after the language code till the file type
// That is, everything after en/ or kn/ and before .html
function getCurrentPage(url, oldLanguage) {
    return url.substring(url.indexOf(languageCodeMappings[oldLanguage]) + 3, url.indexOf(".html"));
}

function loadPreferredLanguagePage(url, newLanguage) {
    // TODO Change to handle Spanish
    let oldLanguage; if (newLanguage === "ಕನ್ನಡ") oldLanguage = "English"; else if (newLanguage === "English") oldLanguage = "ಕನ್ನಡ";

    let preferredLanguagePage = languagePageMappings[newLanguage][getCurrentPage(url, oldLanguage)];
    if (preferredLanguagePage === undefined) return; // TODO Decide how to handle this case

    let subdirectory = languageCodeMappings[newLanguage] + "/" + preferredLanguagePage + ".html"; // Constructing the entire subdirectory link
    let domain = url.substring(0, url.indexOf(languageCodeMappings[oldLanguage]) - 1); // Constructing the domain name

    // Adding it all together
    window.location.href = domain + "/" + subdirectory;
}
