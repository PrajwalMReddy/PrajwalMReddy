require("dotenv").config();
const express = require("express");

const transfersRoutes = require("./routes/transfers");
const app = express();

app.use(express.json());
app.use("/api/transfers", transfersRoutes);

app.listen(process.env.PORT, () => {
    console.log("Listening On Port " + process.env.PORT);
});
