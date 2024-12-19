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
    buyerNum: String,
    sellerName: String,
    sellerNum: String,
    buyer_RTO_location: String,
    seller_RTO_location: String,
    // new fields 
    buyerppstatus: String,
    sellerppstatus: String,
    spoc: String,
    state: String,                                         
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
    },
    task1agentname: String,
    task2agentname: String,
    chesisnum: String,
    engineNum: String,
    status_RC: String,
    status_NOC: String,
    deliverdate: Date,
    courier: Date,
    cost:{
        type: Object,
        default: {
            DRC: 0,
            EURO_MODIFY: 0,
            HPT: 0,
            NOC: 0,
            NOC_REGD: 0,
            TO: 0,
            LOCAL_TRF: 0,
            HPA: 0,
            RC_PARTICULAR: 0
        }
    },
    sale:{
        type: Object,
        default: {
            DRC: 0,
            EURO_MODIFY: 0,
            HPT: 0,
            NOC: 0,
            NOC_REGD: 0,
            TO: 0,
            LOCAL_TRF: 0,
            HPA: 0,
            RC_PARTICULAR: 0
        }
    }
});

module.exports = mongoose.model('task', taskSchema);
