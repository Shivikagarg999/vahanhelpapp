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
const moment = require('moment');

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
    res.render("home");console.log('Server running on port 3000');
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
    const { clientName } = req.query; 
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
        let tasks = []; // Default: no tasks found

        if (carNum) {
            // Find tasks matching the car number (partial or full, case-insensitive)
            tasks = await Task.find({ carNum: new RegExp(carNum, 'i') });
        }

        // Count documents for task states
        const completedCount = await Task.countDocuments({ state: 'Completed' });
        const pendingCount = await Task.countDocuments({ state: 'Pending' });

        // Render the view with tasks and counts
        res.render('employee', { tasks, completedCount, pendingCount });
    } catch (err) {
        console.error("Error fetching tasks:", err);
        res.status(500).send("Error fetching tasks.");
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
            state
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
            buyer_pp_status: task.buyerppstatus,
            seller_pp_status: task.seller_pp_status,
            client_spoc: task.spoc,

            transferDate: task.transferDate ? task.transferDate.toISOString().split('T')[0] : 'N/A',
            HandoverDate_RC: task.HandoverDate_RC ? task.HandoverDate_RC.toISOString().split('T')[0] : 'N/A',
            HandoverDate_NOC: task.HandoverDate_NOC ? task.HandoverDate_NOC.toISOString().split('T')[0] : 'N/A',
            buyerName: task.buyerName,
            buyerNum: task.buyerNum,
            sellerName: task.sellerName,
            sellerNum: task.sellerNum,
            buyer_RTO_location: task.buyer_RTO_location,
            seller_RTO_location: task.seller_RTO_location,
            state: task.state,
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
            'clientName', 'fileReceivedDate', 
            'carNum', 'caseType', 'AdditionalWork',
            'hptName',  'HPA',  'seller_RTO_location', 
            'buyer_RTO_location', 'sellerName', 'sellerNum', 
            'sellerAlignedDate',  'sellerppstatus',
            'nocReceipt', 'NOCissuedDate', 
            'NOCreceivedDate', 'HandoverDate_NOC', 
            'buyerName', 'buyerNum',  'buyerAlignedDate', 
            'buyerppstatus', 'name',
            'transferReceipt' ,'description', 
            'transferDate','HandoverDate_RC',
            'state', 'createdAt', 
            'task1agentname', 'task2agentname',
            'spoc',
            'sellerPhoto',
            'buyerPhoto',
            'sellerDocs',
            'buyerDocs' ,
            'carVideo',
            'sellerVideo',
            'careOfVideo', 'chesisnum', 
            'engineNum', 'status_RC', 'status_NOC',
            'deliverdate', 'courier'
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
        status_NOC, deliverdate, courier, buyerppstatus, sellerppstatus, spoc
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

        Object.assign(taskData, { 
            name, description, clientName, carNum, caseType, hptName, 
            sellerAlignedDate, buyerAlignedDate, NOCissuedDate, 
            NOCreceivedDate, fileReceivedDate, AdditionalWork, HPA, 
            transferDate, HandoverDate_RC, HandoverDate_NOC, buyerName, 
            buyerNum, sellerName, sellerNum, buyer_RTO_location, 
            seller_RTO_location, state, chesisnum, engineNum, status_RC, 
            status_NOC, deliverdate, courier, buyerppstatus, sellerppstatus, spoc
        });

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

    try {
        // Fetch the task by ID and populate the associated company
        const task = await Task.findById(taskId).populate('company'); 
        if (!task) {
            return res.status(404).send("Task not found."); // Handle task not found
        }

        // Fetch all companies to show in the dropdown or any other required display
        const companies = await Company.find(); // Assuming you have a Company model

        // Render the edit page with the task and the list of all companies
        res.render("edit", { task, companies });
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
        buyerppstatus, sellerppstatus, spoc,
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
            state, 
            chesisnum, engineNum, status_RC, status_NOC, deliverdate, courier,
            buyerppstatus, sellerppstatus, spoc,
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
        const completedCount = await Task.countDocuments({ state: 'Completed' });
        const pendingCount = await Task.countDocuments({ state: 'Pending' });
        res.render('employee', { tasks, completedCount, pendingCount }); // Pass tasks to the view
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

app.post('/searchcn', async (req, res) => {
    const carNum = req.body.carNum;
    try {
        // Filter tasks based on the car number
        const tasks = await Task.find({ carNum: new RegExp(carNum, 'i') });
        const completedCount = await Task.countDocuments({ state: 'Completed' });
        const pendingCount = await Task.countDocuments({ state: 'Pending' });
 
        // Render the agent page with filtered tasks
        res.render('employee',  { tasks: task ? [task] : [], completedCount, pendingCount });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error searching tasks');
    }
});


// Route to handle search by car number and restrict to company-specific tasks
app.get('/tasks/client/search', async (req, res) => {
    try {
        // Retrieve logged-in company's ID from cookies/session
        const companyId = req.cookies.token; // Adjust according to your implementation

        if (!companyId) {
            return res.redirect('/login'); // Redirect to login if no companyId found
        }

        // Find the company and populate its tasks
        const company = await Company.findById(companyId).populate('tasks');
        if (!company) {
            return res.status(404).send('Company not found.');
        }

        // Build query to filter tasks
        let filteredTasks = company.tasks; // Start with all tasks linked to the company
        if (req.query.carNum) {
            const searchQuery = req.query.carNum.toLowerCase();
            filteredTasks = filteredTasks.filter(task =>
                task.carNum.toLowerCase().includes(searchQuery) // Match `carNum` with query
            );
        }

        // Render the results
        res.render('tasks', { tasks: filteredTasks });
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).send('Error fetching tasks');
    }
});
app.get('/analytics', isEMPLoggedIn, async (req, res) => {
    try {
        // Fetch all-time task stats
        const totalTasks = await Task.countDocuments();
        const pendingTasks = await Task.countDocuments({ state: 'Pending' });
        const completedTasks = await Task.countDocuments({ state: 'Completed' });

        // Render the 'analytics' view and pass all-time totals
        res.render('analytics', {
            totalTasks,
            pendingTasks,
            completedTasks
        });
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/get-data', async (req, res) => {
    try {
      // Fetch all tasks from the MongoDB database
      const tasks = await Task.find();
  
      // Send the tasks data as JSON response
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: 'Error fetching tasks' });
    }
  });


function isAgentLogin(req, res) {
    const { username, password } = req.body;

    const AGENT_NAME = process.env.AGENT_NAME;
    const AGENT_PASS = process.env.AGENT_PASS;

    if (username === AGENT_NAME && password === AGENT_PASS) {
        return true;
    }
    return false;
}

// Routes
app.get('/agent-login', (req, res) => {
    res.render('agentlogin');
});

app.post('/agent-login', async (req, res) => {
    if (await isAgentLogin(req, res)) {
        try {
            res.render('agent', { tasks: [] });
        } catch (err) {
            console.error(err);
            res.status(500).send('Error fetching tasks');
        }
    } else {
        res.status(401).send('Invalid credentials!');
    }
});

app.post('/search-car', async (req, res) => {
    const carNum = req.body.carNum;
    try {
        // Filter tasks based on the car number
        const tasks = await Task.find({ carNum: new RegExp(carNum, 'i') });

        // Render the agent page with filtered tasks
        res.render('agent', { tasks: tasks });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error searching tasks');
    }
});

app.post('/sync-tasks', async (req, res) => {
    try {
        // Fetch tasks from MongoDB
        const tasks = await Task.find({}); // Modify this query as needed

        // Prepare the data to send to Google Apps Script
        const taskData = {
            tasks: tasks.map(task => ({
                name: task.name,
                clientName: task.clientName,
                carNum: task.carNum,
                sellerName: task.sellerName,
                buyerName: task.buyerName,
                sellerAlignedDate: task.sellerAlignedDate,
                buyerAlignedDate: task.buyerAlignedDate,
                NOCissuedDate: task.NOCissuedDate,
                transferDate: task.transferDate,
                HandoverDate_RC: task.HandoverDate_RC
            }))
        };

        // Google Apps Script URL (replace with your actual URL)
        const googleScriptUrl = 'https://script.google.com/macros/s/your_script_url/exec'; // Replace with the actual script URL

        // Send the data to Google Apps Script
        const response = await axios.post(googleScriptUrl, taskData);

        // Send success response back
        res.status(200).send('Tasks synced to Google Sheets successfully!');
    } catch (error) {
        console.error('Error syncing tasks:', error);
        res.status(500).send('Error syncing tasks');
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
                            tasktype: row.name?.trim(),
                            description: row.description?.trim(),
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
                            sellerPhoto: row.sellerPhoto,
                            buyerPhoto: row.buyerPhoto,  
                            sellerDocs: row.sellerDocs,
                            buyerDocs: row.buyerDocs,
                            carVideo: row.carVideo,
                            sellerVideo: row.sellerVideo,
                            careOfVideo: row.careOfVideo,
                            nocReceipt: row.nocReceipt,
                            transferReceipt: row.transferReceipt,
                            chesisnum: row.chesisnum,
                            engineNum: row.engineNum,
                            status_RC: row.status_RC,
                            status_NOC: row.status_NOC,
                            deliverdate: row.deliverdate,
                            courierdate: row.courier
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

        res.redirect('/employee');
    } catch (err) {
        console.error('Error importing tasks:', err.message);
        res.status(500).send("Error importing tasks.");
    }
});

// app.get('/api/hpa', (req, res) => {
//     const apiUrl = 'https://script.google.com/macros/s/AKfycbzvY3plk7PPa7INhmxeHhVYRV7Py-XaB26Xf2RGkwH7iiVbRW50b-4ZjX39yKO8cohH/exec';
    
//     fetch(apiUrl)
//         .then(response => response.json())
//         .then(data => res.json(data)) // Sends the data back to the frontend
//         .catch(error => res.status(500).send("Error fetching data"));
// });

// finance page
// app.get("/finance", async(req,res)=>{
//     try {
//         const tasks = await Task.find().populate('company').sort({ createdAt: -1 });; // Fetch all tasks from the database
//         // const completedCount = await Task.countDocuments({ state: 'Completed' });
//         // const pendingCount = await Task.countDocuments({ state: 'Pending' });
//         res.render('finance', { tasks});
//     } catch (error) {
//         console.error('Error fetching tasks:', error);
//         res.status(500).send('Internal Server Error');
//     }
// })



// app.post('/finance/:id/save', async (req, res) => {
//     const { id } = req.params; // Use URL parameter `id` directly
//     const task_id = id; // This will be the same as the parameter

//     try {
//         // Find the task by ID
//         const task = await Task.findById(task_id);
        
//         if (!task) {
//             return res.status(404).send('Task not found');
//         }

//         // Iterate over each cost field and update seller and buyer values
//         Object.keys(req.body).forEach(field => {
//             if (field.endsWith('_seller_value') || field.endsWith('_buyer_value')) {
//                 const fieldName = field.split('_')[0]; // Extract the cost field name (e.g., DRC)
//                 const type = field.includes('seller') ? 'seller' : 'buyer';
                
//                 // Update the seller or buyer value
//                 const fieldValue = req.body[field] === 'on' || req.body[field] === '1'; // Check if it's checked or 'on'
//                 if (task.cost[fieldName]) {
//                     task.cost[fieldName][type] = fieldValue;
//                 }
//             } else if (field.endsWith('_value')) {
//                 const fieldName = field.split('_')[0]; // Extract the cost field name (e.g., DRC)
//                 const value = req.body[field];
                
//                 // Update the cost value
//                 if (task.cost[fieldName]) {
//                     task.cost[fieldName].value = value;
//                 }
//             }
//         });

//         // Save the task
//         await task.save();
//         res.redirect('/finance');
//     } catch (error) {
//         console.error(error);
//         res.status(500).send('Error saving task');
//     }
// });



app.use((req, res, next) => {
    res.status(404).render('404');
});
app.listen(3000, () => {
    console.log('Server running on port 3000');
}); 