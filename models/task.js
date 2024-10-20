const mongoose = require('mongoose');

const taskSchema = mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company"
    },
    name: String, 
    description: String,
    carNum: String,
    clientName: String,
    caseType: String,
    hptName: String,
    sellerAlignedDate: Date,
    buyerAlignedDate: Date,
    NOCissuedDate:Date,
    NOCreceivedDate: Date,
    fileReceivedDate: Date,
    AdditionalWork: String,
    HPA: String,
    transferDate: Date,
    HandoverDate_RC: Date,
    HandoverDate_NOC: Date,
    buyerName: String,
    buyerNum: Number,
    sellerName: String,
    sellerNum: Number,
    buyer_RTO_location: String,
    seller_RTO_location: String,
    state: Boolean,
    sellerPhoto: String,
    buyerPhoto: String,
    sellerDocs: String,
    buyerDocs: String,
    carVideo: String,
    sellerVideo: String,
    careOfVideo: String,
    nocReceipt: String,
    transferReceipt: String,
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('task', taskSchema);