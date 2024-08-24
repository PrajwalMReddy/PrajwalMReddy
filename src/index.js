let languageIndexes = {
    "ಕನ್ನಡ": "ಮನೆ.html",
    "English": "index.html"
};

function languageChoiceChange() {
    let languageChoice = document.getElementById("nav-language-choice");
    let language = languageChoice.options[languageChoice.selectedIndex].text;

    localStorage.setItem("language", language);
    window.location.href = languageIndexes[language];
}
