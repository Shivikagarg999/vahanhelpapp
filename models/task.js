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
    billGenerated: {
        type: Boolean,
        default: false
    },
    cost: {
        type: Object,        
        default: {}
    },
    sale: {
        type: Object,
        default: {}
    },  
});

module.exports = mongoose.model('task', taskSchema);

//notes
// const AdditionalWork= ["aw1", "aw2", "aw3"];

//cost1={
//    seller:"John",
//    buyer: "Pear",
//    [AdditionalWork]: {value:0, party:null}
// }
// 
// 
// const applyDiscount= true;
// const total= {
//    amount: 1000,
//    ...(applyDiscount $$ {discount:'10%'})
// }