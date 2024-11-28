const express = require("express");
const router = express.Router();
const {
    getTransfers, getTransfer, createTransfer, deleteTransfer, updateTransfer
} = require("../controllers/transfers");

// Gets all transfers listed
router.get('/', getTransfers);

// Gets the specified transfer
router.get("/:id", getTransfer);

// Adds a new transfer
router.post('/', createTransfer);

// Deletes a new transfer
router.delete("/:id", deleteTransfer);

// Updates a new transfer
router.patch("/:id", updateTransfer);


module.exports = router;
