const express = require('express');
const app = express();
const session = require('express-session');
const cookieParser = require('cookie-parser');
const Company = require('./models/company');
const Task = require('./models/task');
const multer = require('multer');
const path = require('path');
const csv = require('csv-parser');
const fs = require('fs');
const { Parser } = require('json2csv');
const Admin = require('./models/admin');

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/registerar", (req, res) => {
    res.render("register");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/registerar", async (req, res) => {
    const { company, password } = req.body;
    try {
        if (!company || !password) {
            return res.render("register", { error: "Company name and password are required." });
        }

        // Check if the company already exists
        const existingCompany = await Company.findOne({ companyName: company });
        if (existingCompany) {
            return res.render("register", { error: "Company name already exists. Please choose another." });
        }

        // Skip password hashing
        const newCompany = new Company({ companyName: company, password });
        await newCompany.save();

        // Set a token cookie upon registration
        res.cookie('token', newCompany._id.toString(), { httpOnly: true });
        res.redirect("/login");
    } catch (err) {
        console.error('Error registering company:', err.message);
        res.status(500).render("register", { error: "Error registering company." });
    }
});


app.post("/login", async (req, res) => {
    const { company, password } = req.body;
    try {
        const foundCompany = await Company.findOne({ companyName: company });
        if (foundCompany && foundCompany.password === password) {
            res.cookie("token", foundCompany._id.toString(), { httpOnly: true });
            res.redirect("/tasks");
        } else {
            res.render("login", { error: "Invalid company name or password." });
        }
    } catch (err) {
        res.status(500).render("login", { error: "Error logging in." });
    }
});

app.get("/tasks", async (req, res) => {
    const companyId = req.cookies.token;
    if (!companyId) {
        return res.redirect("/login");
    }
    try {
        const company = await Company.findById(companyId).populate('tasks');
        if (!company) {
            return res.redirect("/login");
        }
        res.render("tasks", { tasks: company.tasks });
    } catch (err) {
        res.status(500).send("Error fetching tasks.");
    }
});

app.post("/tasks", async (req, res) => {
    const { name, description, carNum } = req.body;
    const companyId = req.cookies.token;
    if (!companyId) {
        return res.redirect("/login");
    }
    try {
        const newTask = new Task({
            company: companyId,
            name,
            description,
            carNum,
            state: false
        });
        await newTask.save();
        
        // Update the company's tasks array
        await Company.findByIdAndUpdate(companyId, { $push: { tasks: newTask._id } });

        res.redirect("/tasks");
    } catch (err) {
        res.status(500).send("Error creating task.");
    }
});

app.get('/tasks/search', async (req, res) => {
    const { carNum } = req.query;
    let tasks;

    if (carNum) {
        tasks = await Task.find({ carNum: new RegExp(carNum, 'i') });
    } else {
        tasks = await Task.find();
    }

    res.render('tasks', { tasks });
});

app.post("/tasks/edit/:id", async (req, res) => {
    const taskId = req.params.id;
    const { name, description, carNum, state } = req.body;
    try {
        await Task.findByIdAndUpdate(taskId, { 
            name, 
            description, 
            carNum, 
            state: state === "true"
        });
        res.redirect("/tasks");
    } catch (err) {
        console.error('Error updating task:', err.message);
        res.status(500).send("Error updating task.");
    }
});

app.post("/tasks/delete/:id", async (req, res) => {
    const taskId = req.params.id;
    const companyId = req.cookies.token;
    try {
        await Task.findByIdAndDelete(taskId);
        await Company.findByIdAndUpdate(companyId, { $pull: { tasks: taskId } });
        res.redirect("/tasks");
    } catch (err) {
        res.status(500).send("Error deleting task.");
    }
});

app.get("/tasks/edit/:id", async (req, res) => {
    const taskId = req.params.id;
    const companyId = req.cookies.token;
    if (!companyId) {
        return res.redirect("/login");
    }
    try {
        const task = await Task.findOne({ _id: taskId, company: companyId });
        if (!task) {
            return res.status(404).send("Task not found.");
        }
        res.render("edit", { task });
    } catch (err) {
        res.status(500).send("Error fetching task.");
    }
});

// CSV Import Route
app.post('/tasks/import', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send("No file uploaded.");
    }

    const filePath = req.file.path;

    try {
        const tasks = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                // Check if required fields are present and not empty
                if (row.name && row.description && row.carNum) {
                    tasks.push(row);
                }
            })
            .on('end', async () => {
                try {
                    const companyId = req.cookies.token;

                    for (const task of tasks) {
                        const { name, description, carNum, state } = task;

                        const newTask = new Task({
                            company: companyId,
                            name,
                            description,
                            carNum,
                            state: state === 'true'
                        });

                        await newTask.save();
                        await Company.findByIdAndUpdate(companyId, { $push: { tasks: newTask._id } });
                    }

                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Error deleting file:', err.message);
                    });

                    res.redirect('/tasks');
                } catch (err) {
                    console.error('Error processing tasks:', err.message);
                    res.status(500).send("Error processing tasks.");
                }
            })
            .on('error', (err) => {
                console.error('Error reading CSV file:', err.message);
                res.status(500).send("Error reading CSV file.");
            });
    } catch (err) {
        console.error('Error importing tasks:', err.message);
        res.status(500).send("Error importing tasks.");
    }
});

app.get("/logout", (req, res) => {
    res.clearCookie('token');
    res.redirect("/");
});

function isLoggedIn(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.send("You must be logged in");
    }
    next();
}

app.get("/admin/login", (req, res) => {
    res.render("admin_login");
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            res.cookie('admin_token', 'admin', { httpOnly: true });
            res.redirect('/admin-tasks');
        } else {
            res.render('admin_login', { error: 'Invalid username or password.' });
        }
    } catch (err) {
        console.error('Error during admin login:', err.message);
        res.status(500).render('admin_login', { error: 'Error during login.' });
    }
});

app.get("/admin-tasks", isAdminLoggedIn, async (req, res) => {
    try {
        const tasks = await Task.find().populate('company');
        res.render("admin-tasks", { tasks });
    } catch (err) {
        res.status(500).send("Error fetching tasks.");
    }
});

function isAdminLoggedIn(req, res, next) {
    if (!req.cookies.admin_token) {
        return res.redirect("/admin/login");
    }
    next();
}

app.get('/admin/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.redirect('/admin/login');
});
app.get('/tasks/download', async (req, res) => {
    const companyId = req.cookies.token;
    if (!companyId) {
        return res.redirect("/login");
    }
    
    try {
        // Fetch tasks for the logged-in company
        const tasks = await Task.find({ company: companyId }).populate('company');
        
        // Prepare data for CSV
        const tasksData = tasks.map(task => ({
            Name: task.name,
            Description: task.description,
            CarNumber: task.carNum,
            Status: task.state ? 'Completed' : 'Pending'
        }));

        // Convert JSON to CSV
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(tasksData);

        // Set the response headers to download the file
        res.header('Content-Type', 'text/csv');
        res.attachment('tasks.csv');
        res.send(csv);
    } catch (err) {
        console.error('Error downloading tasks:', err.message);
        res.status(500).send("Error downloading tasks.");
    }
});
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
