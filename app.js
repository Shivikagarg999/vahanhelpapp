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
const uploadOnImageKit = require('./imagekit');
const task = require('./models/task');

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

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

        // Sort tasks by `createdAt` or `updatedAt` in descending order
        const sortedTasks = company.tasks.sort((a, b) => b.createdAt - a.createdAt);
        
        res.render("tasks", { tasks: sortedTasks });
    } catch (err) {
        res.status(500).send("Error fetching tasks.");
    }
});


app.get("/tasks/create", (req, res) => {
    const companyId = req.cookies.token;
    if (!companyId) {
        return res.redirect("/login");
    }
    res.render("create_task");
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

app.post("/tasks/edit/:id", upload.fields([
    { name: 'sellerPhoto', maxCount: 1 },
    { name: 'buyerPhoto', maxCount: 1 },
    { name: 'sellerDocs', maxCount: 1 },
    { name: 'buyerDocs', maxCount: 1 },
    { name: 'carVideo', maxCount: 1 },
    { name: 'sellerVideo', maxCount: 1 },
    { name: 'careOfVideo', maxCount: 1 },
    { name: 'nocReceipt', maxCount: 1 },
    { name: 'transferReceipt', maxCount: 1 }
]), async (req, res) => {
    const taskId = req.params.id;

    // Destructure all fields from req.body
    const { 
        name, 
        description, 
        carNum, 
        clientName, 
        caseType, 
        hptName, 
        sellerAlignedDate, 
        buyerAlignedDate, 
        NOCissuedDate, 
        NOCreceivedDate, 
        fileReceivedDate, 
        AdditionalWork, 
        HPA, 
        transferDate, 
        HandoverDate_RC, 
        HandoverDate_NOC, 
        buyerName, 
        buyerNum, 
        sellerName, 
        sellerNum, 
        buyer_RTO_location, 
        seller_RTO_location, 
        state // Keep state for task status
    } = req.body; 

    try {
        // Prepare task data from the form fields
        const taskData = { 
            name, 
            description, 
            carNum, 
            clientName, 
            caseType, 
            hptName, 
            sellerAlignedDate, 
            buyerAlignedDate, 
            NOCissuedDate, 
            NOCreceivedDate, 
            fileReceivedDate, 
            AdditionalWork, 
            HPA, 
            transferDate, 
            HandoverDate_RC, 
            HandoverDate_NOC, 
            buyerName, 
            buyerNum, 
            sellerName, 
            sellerNum, 
            buyer_RTO_location, 
            seller_RTO_location, 
            state: state === "true" // Ensure state is boolean
        };

        // Handle file uploads (if any)
        if (req.files) {
            for (let key in req.files) {
                const file = req.files[key][0];
                const imageKitResponse = await uploadOnImageKit(file.path); // Using ImageKit upload
                if (imageKitResponse) {
                    taskData[key] = imageKitResponse.url; // Get the URL from ImageKit response
                }
            }
        }

        // Update the task with new data
        await Task.findByIdAndUpdate(taskId, taskData);

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

// Admin Task Delete Route
app.post("/admin/tasks/delete/:id", isAdminLoggedIn, async (req, res) => {
    const taskId = req.params.id;

    try {
        // Delete the task by its ID
        await Task.findByIdAndDelete(taskId);

        await Company.updateMany({}, { $pull: { tasks: taskId } });

        // Redirect admin to the task listing page after successful deletion
        res.redirect("/admin/tasks");
    } catch (err) {
        console.error("Error deleting task:", err);
        return res.status(500).render("error", { message: "Error deleting task." });
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
})

// Admin Task Edit Route
app.get("/admin/tasks/edit/:id", isAdminLoggedIn, async (req, res) => {
    const taskId = req.params.id;

    try {
        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).render("error", { message: "Task not found" });
        }

        res.render("admin-edit", { task });
    } catch (err) {
        console.error("Error fetching task:", err);
        return res.status(500).render("error", { message: "An error occurred while fetching the task" });
    }
});


app.post('/tasks/import', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send("No file uploaded.");
    }

    const filePath = req.file.path;

    try {
        const tasks = [];

        const parseCSV = () => {
            return new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        console.log("Processing row: ", row);

                        // Trim whitespace from row values
                        const name = row.name?.trim();
                        const description = row.description?.trim();

                        // Check for essential fields to avoid blank tasks
                        
                            tasks.push({
                                company: req.cookies.token,
                                name,
                                description,
                                carNum: row.carNum?.trim(),
                                clientName: row.clientName?.trim(),
                                caseType: row.caseType?.trim(),
                                hptName: row.hptName?.trim(),
                                sellerAlignedDate: row.sellerAlignedDate ? new Date(row.sellerAlignedDate) : null,
                                buyerAlignedDate: row.buyerAlignedDate ? new Date(row.buyerAlignedDate) : null,
                                NOCissuedDate: row.NOCissuedDate ? new Date(row.NOCissuedDate) : null,
                                NOCreceivedDate: row.NOCreceivedDate ? new Date(row.NOCreceivedDate) : null,
                                fileReceivedDate: row.fileReceivedDate ? new Date(row.fileReceivedDate) : null,
                                AdditionalWork: row.AdditionalWork?.trim(),
                                HPA: row.HPA?.trim(),
                                transferDate: row.transferDate ? new Date(row.transferDate) : null,
                                HandoverDate_RC: row.HandoverDate_RC ? new Date(row.HandoverDate_RC) : null,
                                HandoverDate_NOC: row.HandoverDate_NOC ? new Date(row.HandoverDate_NOC) : null,
                                buyerName: row.buyerName?.trim(),
                                buyerNum: row.buyerNum?.trim(),
                                sellerName: row.sellerName?.trim(),
                                sellerNum: row.sellerNum?.trim(),
                                buyer_RTO_location: row.buyer_RTO_location?.trim(),
                                seller_RTO_location: row.seller_RTO_location?.trim(),
                                state: row.state === 'true', 
                                sellerPhoto: task.sellerPhoto,
                                buyerPhoto: task.buyerPhoto,
                                sellerDocs: task.sellerDocs,
                                buyerDocs: task.buyerDocs,
                                carVideo: task.carVideo,
                                sellerVideo: task.sellerVideo,
                                careOfVideo: task.careOfVideo,
                                nocReceipt: task.nocReceipt,
                                transferReceipt: task.transferReceipt,
                            });
                        
                    })
                    .on('end', resolve)
                    .on('error', (err) => {
                        console.error("Error parsing CSV:", err.message);
                        reject(err);
                    });
            });
        };

        await parseCSV();

        console.log("Parsed tasks: ", tasks); 

        await Promise.all(tasks.map(async (task) => {
            try {
                const newTask = new Task(task);
                await newTask.save();
                await Company.findByIdAndUpdate(task.company, { $push: { tasks: newTask._id } });
            } catch (err) {
                console.error("Error saving task to DB:", err.message, "Task:", task);
            }
        }));

        // Delete the uploaded file after processing
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting file:', err.message);
        });

        res.redirect('/tasks');
    } catch (err) {
        console.error('Error importing tasks:', err.message);
        res.status(500).send("Error importing tasks.");
    }
});

app.get('/tasks/view/:id', async (req, res) => {
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

        res.render('viewTask', { task });
    } catch (err) {
        console.error('Error fetching task:', err.message);
        res.status(500).send("Error fetching task.");
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
        const tasks = await Task.find().populate('company').sort({ createdAt: -1 }); // Sort by newest first
        res.render("admin-tasks", { tasks });
    } catch (err) {
        console.error("Error fetching tasks:", err);
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
        
        // Prepare data for CSV with all fields included
        const tasksData = tasks.map(task => ({
            name: task.name,
            description: task.description,
            carNum: task.carNum,
            clientName: task.clientName,
            caseType: task.caseType,
            hptName: task.hptName,
            sellerAlignedDate: task.sellerAlignedDate ? task.sellerAlignedDate.toISOString().split('T')[0] : 'N/A',
            buyerAlignedDate: task.buyerAlignedDate ? task.buyerAlignedDate.toISOString().split('T')[0] : 'N/A',
            NOCissuedDate: task.NOCissuedDate ? task.NOCissuedDate.toISOString().split('T')[0] : 'N/A',
            NOCreceivedDate: task.NOCreceivedDate ? task.NOCreceivedDate.toISOString().split('T')[0] : 'N/A',
            fileReceivedDate: task.fileReceivedDate ? task.fileReceivedDate.toISOString().split('T')[0] : 'N/A',
            AdditionalWork: task.AdditionalWork,
            HPA: task.HPA,
            transferDate: task.transferDate ? task.transferDate.toISOString().split('T')[0] : 'N/A',
            HandoverDate_RC: task.HandoverDate_RC ? task.HandoverDate_RC.toISOString().split('T')[0] : 'N/A',
            HandoverDate_NOC: task.HandoverDate_NOC ? task.HandoverDate_NOC.toISOString().split('T')[0] : 'N/A',
            buyerName: task.buyerName,
            buyerNum: task.buyerNum,
            sellerName: task.sellerName,
            sellerNum: task.sellerNum,
            buyer_RTO_location: task.buyer_RTO_location,
            seller_RTO_location: task.seller_RTO_location,
            state: task.state ? 'Completed' : 'Pending',
            sellerPhoto: task.sellerPhoto,
            buyerPhoto: task.buyerPhoto,
            sellerDocs: task.sellerDocs,
            buyerDocs: task.buyerDocs ,
            carVideo: task.carVideo ,
            sellerVideo: task.sellerVideo,
            careOfVideo: task.careOfVideo,
            nocReceipt: task.nocReceipt ,
            transferReceipt: task.transferReceipt,
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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads'); // Temporarily store locally
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Keep the original filename
    }
});

// app.use('/uploads', express.static('uploads'));
const uploadStorage = multer({ storage });

app.get('/upload', (req, res)=>{
    res.render('upload')
})


app.post('/upload', upload.fields([
    { name: 'sellerPhoto', maxCount: 1 },
    { name: 'buyerPhoto', maxCount: 1 },
    { name: 'sellerDocs', maxCount: 1 },
    { name: 'buyerDocs', maxCount: 1 },
    { name: 'carVideo', maxCount: 1 },
    { name: 'sellerVideo', maxCount: 1 },
    { name: 'careOfVideo', maxCount: 1 },
    { name: 'nocReceipt', maxCount: 1 },
    { name: 'transferReceipt', maxCount: 1 }
]), async (req, res) => {
    const companyId = req.cookies.token;
    if (!companyId) {
        return res.redirect("/login");
    }

    try {
        const taskData = { company: companyId };

        for (let key in req.files) {
            const file = req.files[key][0];
            const imageKitResponse = await uploadOnImageKit(file.path); // Use ImageKit upload function
            if (imageKitResponse) {
                taskData[key] = imageKitResponse.url; // ImageKit returns a direct URL
            }
        }

        // Collect additional fields from request body
        const { name, description, carNum, clientName, caseType, hptName, sellerAlignedDate, buyerAlignedDate, NOCissuedDate, NOCreceivedDate, fileReceivedDate, AdditionalWork, HPA, transferDate, HandoverDate_RC, HandoverDate_NOC, buyerName, buyerNum, sellerName, sellerNum, buyer_RTO_location, seller_RTO_location, state } = req.body;

        // Add these fields to taskData
        Object.assign(taskData, { name, description, carNum, clientName, caseType, hptName, sellerAlignedDate, buyerAlignedDate, NOCissuedDate, NOCreceivedDate, fileReceivedDate, AdditionalWork, HPA, transferDate, HandoverDate_RC, HandoverDate_NOC, buyerName, buyerNum, sellerName, sellerNum, buyer_RTO_location, seller_RTO_location, state });

        const newTask = new Task(taskData);
        await newTask.save();
        await Company.findByIdAndUpdate(companyId, { $push: { tasks: newTask._id } });

        res.redirect('/tasks');

    } catch (error) {
        console.error('File upload failed:', error);
        res.status(500).json({ message: 'File upload failed', error });
    }
});
app.listen(3000, () => {
    console.log('Server running on port 3000');
}); 
