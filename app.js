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
const axios = require('axios');
  

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
    const { clientName } = req.query; // Retrieve the clientName from query parameters
    const companyId = req.cookies.token;

    if (!companyId) {
        return res.redirect("/login");
    }

    try {
        // Build the query dynamically
        const query = { company: companyId }; // Filter by company
        if (clientName) {
            query.clientName = { $regex: clientName, $options: "i" }; // Case-insensitive search
        }

        // Find tasks matching the query
        const tasks = await Task.find(query).sort({ createdAt: -1 });

        res.render("tasks", { tasks, clientName }); // Pass clientName for form pre-fill
    } catch (err) {
        console.error("Error fetching tasks:", err);
        res.status(500).send("Error fetching tasks.");
    }
});

app.get("/tasks/create", isEMPLoggedIn, async (req, res) => {
    const companies = await Company.find({}, 'companyName'); 
    res.render("create_task" , { companies });
});

app.get('/tasks/search', async (req, res) => {
    const { carNum } = req.query;

    try {
        // Find a single task that exactly matches the carNum (case-insensitive)
        const task = await Task.findOne({ carNum: new RegExp(`^${carNum}$`, 'i') });

        // Render a single result as an array for compatibility with the view
        res.render('employee', { tasks: task ? [task] : [] });
        
    } catch (err) {
        console.error("Error fetching task:", err);
        res.status(500).send("Error fetching task.");
    }
});

app.get("/assign/tasks/edit/:id", isEMPLoggedIn, async (req, res) => {
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
app.post("/assign/tasks/edit/:id", async (req, res) => {
    const taskId = req.params.id;

    // Destructure the required fields from req.body
    const { 
        carNum, 
        task1agentname, 
        task2agentname, 
        description, 
        state,
    } = req.body;

    try {
        // Prepare task data with only the required fields
        const taskData = { 
            carNum, 
            task1agentname, 
            task2agentname, 
            description, 
            state: state === "true" // Ensure state is boolean
        };

        // Update the task with new data
        await Task.findByIdAndUpdate(taskId, taskData);

        // Redirect to the admin tasks page after updating
        res.redirect("/employee");
    } catch (err) {
        console.error('Error updating task:', err.message);
        res.status(500).send("Error updating task.");
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
    res.clearCookie('employee_token')
    res.redirect("/");
});

function isLoggedIn(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.send("You must be logged in");
    }
    next();
}
function isEMPLoggedIn(req, res, next) {
    if (!req.cookies.employee_token) {
        return res.redirect("/emp/login");        
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
            chesisnum: task.chesisnum,
            engineNum: task.engineNum,
             status_RC: task.status_RC,
              status_NOC: task.status_NOC,
              deliverdate: task.deliverdate,
              courierdate: task.courier
        }));

        // Convert JSON to CSV
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(tasksData);

        res.header('Content-Type', 'text/csv');
        res.attachment('tasks.csv');
        res.send(csv);
    } catch (err) {
        console.error('Error downloading tasks:', err.message);
        res.status(500).send("Error downloading tasks.");
    }
});
app.get('/emp-task-download',isEMPLoggedIn, async (req, res) => {
    try {
        // Fetch all tasks from the database
        const tasks = await Task.find();
         
        const fields = [
            'clientName', 'fileReceivedDate', 'carNum', 'caseType', 'AdditionalWork',
            'hptName',  'HPA',  'seller_RTO_location', 'buyer_RTO_location', 'sellerName', 'sellerNum', 
            'sellerAlignedDate',
            'nocReceipt', 'NOCissuedDate', 'NOCreceivedDate', 'HandoverDate_NOC', 
            'buyerName', 'buyerNum',  'buyerAlignedDate',  'name',
            'transferReceipt' ,'description', 'transferDate',      
            'HandoverDate_RC',
            'state', 'createdAt', 
            ' task1agentname', ' task2agentname',
            'sellerPhoto',
            'buyerPhoto',
            'sellerDocs',
            'buyerDocs' ,
            'carVideo',
            'sellerVideo',
            'careOfVideo', 'chesisnum', 'engineNum', 'status_RC', 'status_NOC', 'deliverdate', 'courier'

        ];

        // Convert tasks JSON to CSV
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(tasks);

        // Set headers and send the CSV file as a download
        res.header('Content-Type', 'text/csv');
        res.attachment('tasks.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error generating CSV:', error);
        res.status(500).send('An error occurred while downloading the tasks.');
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
    // Destructure all fields at the start, including clientName
    const { 
        name, description, clientName, carNum, caseType, hptName, 
        sellerAlignedDate, buyerAlignedDate, NOCissuedDate, 
        NOCreceivedDate, fileReceivedDate, AdditionalWork, HPA, 
        transferDate, HandoverDate_RC, HandoverDate_NOC, buyerName, 
        buyerNum, sellerName, sellerNum, buyer_RTO_location, 
        seller_RTO_location, state, chesisnum, engineNum, status_RC, 
        status_NOC, deliverdate, courier 
    } = req.body;

    if (!clientName) {
        return res.status(400).send("Client name is required.");
    }

    try {
        // Find the company associated with the client name
        const company = await Company.findOne({ companyName: clientName });
        if (!company) {
            return res.status(404).send("Company not found for the given client name.");
        }

        const companyId = company._id; // Get the company ID
        const taskData = { company: companyId }; // Initialize task data with company ID

        // Handle file uploads
        for (let key in req.files) {
            const file = req.files[key][0];
            const imageKitResponse = await uploadOnImageKit(file.path); // Use your upload function
            if (imageKitResponse) {
                taskData[key] = imageKitResponse.url; // Store the URL from ImageKit response
            }
        }

        // Add all fields from req.body to taskData
        Object.assign(taskData, { 
            name, description, clientName, carNum, caseType, hptName, 
            sellerAlignedDate, buyerAlignedDate, NOCissuedDate, 
            NOCreceivedDate, fileReceivedDate, AdditionalWork, HPA, 
            transferDate, HandoverDate_RC, HandoverDate_NOC, buyerName, 
            buyerNum, sellerName, sellerNum, buyer_RTO_location, 
            seller_RTO_location, state, chesisnum, engineNum, status_RC, 
            status_NOC, deliverdate, courier 
        });

        // Create a new task
        const newTask = new Task(taskData);
        await newTask.save(); // Save the task to the database

        // Update the company's task array
        await Company.findByIdAndUpdate(companyId, { $push: { tasks: newTask._id } });

        res.redirect('/employee'); // Redirect to the tasks page after successful creation
    } catch (error) {
        console.error('Task creation failed:', error.message, error);
        res.status(500).json({ message: 'Task creation failed', error: error.message });
    }
});

app.get("/tasks/edit/:id", isEMPLoggedIn, async (req, res) => {
    const taskId = req.params.id; // Get the task ID from the URL parameters
    console.log('Received taskId:', taskId); // Log the taskId

    try {
        const task = await Task.findById(taskId); // Find the task by ID
        if (!task) {
            return res.status(404).send("Task not found."); // Handle task not found
        }
        res.render("edit", { task }); // Render the edit view with the task data
    } catch (err) {
        console.error('Error fetching task:', err.message);
        res.status(500).send("Error fetching task."); // Handle server error
    }
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
        chesisnum, engineNum, status_RC, status_NOC, deliverdate, courier,
        state
    } = req.body;

    try {
        // Convert arrays to strings if they exist
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
            buyer_RTO_location: Array.isArray(buyer_RTO_location) ? buyer_RTO_location.join(", ") : buyer_RTO_location, 
            seller_RTO_location: Array.isArray(seller_RTO_location) ? seller_RTO_location.join(", ") : seller_RTO_location, 
            state: state === "true", // Ensure state is boolean
            chesisnum, engineNum, status_RC, status_NOC, deliverdate, courier,
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

        res.redirect("/employee");
    } catch (err) {
        console.error('Error updating task:', err.message);
        res.status(500).send("Error updating task.");
    }
});
 

app.post("/tasks/delete/:id", async (req, res) => {
    const taskId = req.params.id;

    try {
        // Delete the task by its ID
        await Task.findByIdAndDelete(taskId);

        await Company.updateMany({}, { $pull: { tasks: taskId } });

        // Redirect admin to the task listing page after successful deletion
        res.redirect("/employee");
    } catch (err) {
        console.error("Error deleting task:", err);
        return res.status(500).render("error", { message: "Error deleting task." });
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

app.get('/employee',isEMPLoggedIn, async (req, res) => {
    try {
        
        const tasks = await Task.find().populate('company').sort({ createdAt: -1 });; // Fetch all tasks from the database
        res.render('employee', { tasks }); // Pass tasks to the view
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/emp/login', async(req,res)=>{
   res.render('employeelogin')
});
app.post('/emp/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (username === process.env.EMP_USERNAME && password === process.env.EMP_PASSWORD) {
            res.cookie('employee_token', 'employee', { httpOnly: true });
            res.redirect('/employee');
        } else {
            res.render('employeelogin', { error: 'Invalid username or password.' });
        }
    } catch (err) {
        console.error('Error during employee login:', err.message);
        res.status(500).render('employeelogin', { error: 'Error during login.' });
    }
});
app.get('/searchcn', async(req,res)=>{
    let query = {}; // Default query, return all tasks
    if (req.query.search) {
        const searchQuery = req.query.search.toLowerCase();
        query.carNum = { $regex: searchQuery, $options: "i" }; // Regex search, case-insensitive
    }
    
    Task.find(query)
        .then(tasks => {
            res.render("employee", { tasks });
        })
        .catch(err => {
            console.error(err);
            res.status(500).send("Error fetching tasks");
        });
})

app.listen(3000, () => {
    console.log('Server running on port 3000');
}); 
