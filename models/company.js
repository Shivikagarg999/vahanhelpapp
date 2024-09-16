const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/crud2', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

const compSchema = mongoose.Schema({
    companyName: String,
    password: String,
    tasks: [{type: mongoose.Schema.Types.ObjectId, ref: "task"}]
});

// Define and export the model
module.exports = mongoose.model('Company', compSchema);
