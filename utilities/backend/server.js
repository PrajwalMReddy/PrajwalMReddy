require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const transfersRoutes = require("./routes/transfers");
const app = express();

app.use(express.json());
app.use("/api/transfers", transfersRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(process.env.PORT, () => {
            console.log("Connected To DB And Listening On Port " + process.env.PORT);
        });
    })
    .catch((error) => {
        console.log(error);
    });
