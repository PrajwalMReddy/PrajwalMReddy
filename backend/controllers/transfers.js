const Transfer = require("../models/transfers");
const mongoose = require("mongoose");

// Gets all transfers listed
const getTransfers = async (req, res) => {
    const transfers = await Transfer.find({}).sort({date: -1});
    res.status(200).json(transfers);
};

// Gets the specified transfer
const getTransfer = async (req, res) => {
    const {id} = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({error: "No transfer found for the given id"});
    const transfer = await Transfer.findById(id);

    if (!transfer) return res.status(404).json({error: "No transfer found for the given id"});
    res.status(200).json(transfer);
}

// Adds a new transfer
const createTransfer = async (req, res) => {
    const {transaction, date, description, category, value} = req.body;

    try {
        const transfer = await Transfer.create({transaction, date, description, category, value});
        res.status(200).json(transfer);
    } catch (error) {
        res.status(400).json({error: error.message});
    }
};

// Deletes a new transfer
const deleteTransfer = async (req, res) => {
    const {id} = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({error: "No transfer found for the given id"});

    const transfer = await Transfer.findOneAndDelete({_id: id});
    if (!transfer) return res.status(404).json({error: "No transfer found for the given id"});
    res.status(200).json(transfer);
};

// Updates a new transfer
const updateTransfer = async (req, res) => {
    const {id} = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({error: "No transfer found for the given id"});

    const transfer = await Transfer.findOneAndUpdate({_id: id}, {...req.body});
    if (!transfer) return res.status(404).json({error: "No transfer found for the given id"});
    res.status(200).json(transfer);
};


module.exports = {
    getTransfers, getTransfer, createTransfer, deleteTransfer, updateTransfer,
};
