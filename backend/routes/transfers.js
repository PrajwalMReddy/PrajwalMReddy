const express = require("express");
const Transfer = require("../models/transfers");
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
router.post('/', async (req, res) => {
    const {transaction, date, description, category, value} = req.body;

    try {
        const transfer = await Transfer.create({transaction, date, description, category, value});
        res.status(200).json(transfer);
    } catch (error) {
        res.status(400).json({error: error.message});
    }
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
