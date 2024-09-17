const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
// 122.161.48.226
// Database connection

// require('dotenv').config();

// Database connection
mongoose.connect('mongodb+srv://shivikagarg91:dep123@cluster0.4rkz8.mongodb.net/')
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error😒:', err));

// Define the schema and model
const userSchema = new mongoose.Schema({
    company: String,
    taskDescription: String,
    state: String
});
const User = mongoose.model('User', userSchema);

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('home');
});

app.get('/formcreate', (req, res) => {
    res.render('index');
});
app.get('/reg', (req, res) => {
    res.render('reg');
});

app.post('/create', async (req, res) => {
    try {
        const { company, taskDescription, state } = req.body;
        // Validate input
        if (!company || !taskDescription || !state) {
            return res.status(400).send('All fields are required');
        }
        const createdUser = await User.create({ company, taskDescription, state });
        res.redirect('/read');
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).send('Error creating task');
    }
});

app.get('/read', async (req, res) => {
    try {
        const tasks = await User.find();
        res.render('read', { tasks });
    } catch (error) {
        console.error('Error reading tasks:', error);
        res.status(500).send('Error reading tasks');
    }
});

app.get('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await User.findByIdAndDelete(id);
        res.redirect('/read');
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).send('Error deleting task');
    }
});


app.get('/edit/:id', async (req, res) => {
    try {
        const task = await User.findById(req.params.id);
        if (!task) {
            return res.status(404).send('Task not found');
        }
        res.render('edit', { task });
    } catch (error) {
        console.error('Error fetching task for edit:', error);
        res.status(500).send('Error fetching task for edit');
    }
});

app.post('/edit/:id', async (req, res) => {
    try {
        const { company, taskDescription, state } = req.body;
        const updatedTask = await User.findByIdAndUpdate(req.params.id, { company, taskDescription, state }, { new: true });
        if (!updatedTask) {
            return res.status(404).send('Task not found');
        }
        res.redirect('/read');
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).send('Error updating task');
    }
});
app.listen(8000, () => {
    console.log('Server running on http://localhost:8000');
});
