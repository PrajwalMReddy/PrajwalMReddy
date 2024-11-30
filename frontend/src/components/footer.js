let languageToSet = localStorage.getItem("language");


export default function Footer() {
    return (
        <footer>
            <hr/>
            <div className="footer-div">
                <img className="footer-logo" src={require("../img/hurricane.png")} alt="Hurricane Logo"/>
                <p className="footer-copyright">Copyright 2024 - Prajwal Reddy</p>
                <div id="footer-third">{/* Empty Div So Other Elements Are Aligned Properly */}</div>
            </div>
        </footer>
    );
}
