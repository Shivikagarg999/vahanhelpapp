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
    cost: {
        type: Object,
        default: () => ({
            DRC: { value: 0, seller: false, buyer: false },
            EURO_MODIFY: { value: 0, seller: false, buyer: false },
            HPT: { value: 0, seller: false, buyer: false },
            NOC: { value: 0, seller: false, buyer: false },
            NOC_REGD: { value: 0, seller: false, buyer: false },
            TO: { value: 0, seller: false, buyer: false },
            LOCAL_TRF: { value: 0, seller: false, buyer: false },
            HPA: { value: 0, seller: false, buyer: false },
            RC_PARTICULAR: { value: 0, seller: false, buyer: false },
            ADDITIONAL_WORK: { value: 0, seller: false, buyer: false }
        }),
        validate: {
            validator: function (v) {
                return Object.values(v).every(
                    field => typeof field.value === 'number' &&
                             typeof field.seller === 'boolean' &&
                             typeof field.buyer === 'boolean'
                );
            },
            message: props => `Invalid cost field values!`
        }
    },
    sale:{
        type: Object,
        default: () => ({
            DRC: { value: 0},
            EURO_MODIFY: { value: 0},
            HPT: { value: 0},
            NOC: { value: 0},
            NOC_REGD: { value: 0},
            TO: { value: 0},
            LOCAL_TRF: { value: 0},
            HPA: { value: 0},
            RC_PARTICULAR: { value: 0},
            ADDITIONAL_WORK: { value: 0}
        })
    }
});

module.exports = mongoose.model('task', taskSchema);
