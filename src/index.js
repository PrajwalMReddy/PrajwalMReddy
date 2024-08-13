function languageChoiceChange() {
    let languageChoice = document.getElementById("nav-language-choice");
    let language = languageChoice.options[languageChoice.selectedIndex].text;
    localStorage.setItem("language", language);
}
