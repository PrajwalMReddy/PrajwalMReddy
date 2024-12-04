const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const transferSchema = new Schema({
    transaction: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    value: {
        type: Number,
        required: true
    },
}, { timestamps: true });


module.exports = mongoose.model('Transfer', transferSchema);
