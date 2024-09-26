const mongoose = require('mongoose');

const taskSchema = mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company"
    },
    name: String, 
    description: String,
    carNum: String,
    buyerName: String,
    buyerNum: Number,
    sellerName: String,
    sellerNum: Number,
    buyer_RTO_location: String,
    seller_RTO_location: String,
    align_date: Date,
    state: Boolean
});

module.exports = mongoose.model('task', taskSchema);
