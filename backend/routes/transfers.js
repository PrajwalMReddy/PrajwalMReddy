const express = require("express");
const router = express.Router();

// Gets all transfers listed
router.get('/', (req, res) => {
    res.json({message: "GET All Transfers"});
});

// Gets the specified transfer
router.get("/:id", (req, res) => {
    res.json({message: "GET Single Transfer"});
});

// Adds a new transfer
router.post('/', (req, res) => {
    res.json({message: "POST Single Transfer"});
});

// Deletes a new transfer
router.delete("/:id", (req, res) => {
    res.json({message: "DELETE Single Transfer"});
});

// Updates a new transfer
router.patch("/:id", (req, res) => {
    res.json({message: "UPDATE Single Transfer"});
});

module.exports = router;
