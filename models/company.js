require('dotenv').config();
const mongoose = require('mongoose');


mongoose.connect(process.env.mongoURI, {
    connectTimeoutMS: 10000, 
    socketTimeoutMS: 45000
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

const compSchema = mongoose.Schema({
    companyName: String,
    password: String,
    tasks: [{type: mongoose.Schema.Types.ObjectId, ref: "task"}],
    isAdmin: { type: Boolean, default: false }
});

// Define and export the model
module.exports = mongoose.model('Company', compSchema);
