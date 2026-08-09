const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const Student = require("./models/Student");
const multer = require("multer");
const fs = require("fs");
const app = express();

const PORT = 3000;

// Middleware
app.use("/uploads", express.static("uploads"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
// ------------------ MongoDB ------------------
mongoose.connect("mongodb://127.0.0.1:27017/notes_portal")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ------------------ Multer ------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ------------------ Models ------------------
const documentSchema = new mongoose.Schema({
  department: String,
  type: String, // "note" or "question"
  subjectName: String,
  subjectCode: String,
  filePath: String,
  uploadDate: { type: Date, default: Date.now }
});
const Document = mongoose.model("Document", documentSchema);

// ------------------ Routes ------------------

// Home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Login
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "views", "login.html")));
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const student = await Student.findOne({ email, password });
   if (student) res.redirect("/dashboard");
    else res.send("Invalid Email or Password");
  } catch (err) { console.log(err); res.send("Login Error"); }
});

// Signup
app.get("/signup", (req, res) => res.sendFile(path.join(__dirname, "views", "signup.html")));
app.post("/signup", async (req, res) => {
  const { name, email, password, key } = req.body;
  if (key !== "SRRCET") return res.send("Invalid College Access Key");
  try {
    const newStudent = new Student({ name, email, password });
    await newStudent.save();
    res.send("Signup Successful");
  } catch (err) { console.log(err); res.send("Error creating account"); }
});


// Dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

// Upload
app.get("/upload", (req, res) => res.sendFile(path.join(__dirname, "views", "upload.html")));
app.post("/upload", upload.single("pdf"), async (req, res) => {
  const { department, subjectName, subjectCode, type } = req.body;
  if (!["note","question"].includes(type)) return res.send("Invalid document type");

  let filePath = req.file.path;
  const existingDocs = await Document.find({ department, subjectName, subjectCode, type });

  if (existingDocs.length > 0) {
    const ext = filePath.split('.').pop();
    filePath = `uploads/${subjectName}_${type}${existingDocs.length + 1}.${ext}`;
    fs.renameSync(req.file.path, filePath);
  }

  const newDoc = new Document({ department, type, subjectName, subjectCode, filePath });
  await newDoc.save();
  res.send(`${type === "note" ? "Note" : "Question Paper"} Uploaded Successfully`);
});

// ------------------ Dynamic Department Pages ------------------
app.get("/:dept", (req, res) => {
  const dept = req.params.dept.toUpperCase();

  const allowedDepts = ["CSE","IT","ECE","MECH","CIVIL","AI","AGRI"];

  if (!allowedDepts.includes(dept)) {
    return res.send("Department not found");
  }

  res.sendFile(path.join(__dirname, "views", "deptHome.html"));
});
// ------------------ Dynamic Listing ------------------
app.get("/:dept/:type", async (req, res) => {
  const dept = req.params.dept.toUpperCase();
  const type = req.params.type === "questions" ? "question" : "note";
  const search = req.query.search;

  let query = { department: dept, type };
  if (search) {
    query.$or = [
      { subjectName: { $regex: search, $options: "i" } },
      { subjectCode: { $regex: search, $options: "i" } }
    ];
  }

  const docs = await Document.find(query);

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
<title>${dept} ${type === "note" ? "Notes" : "Question Papers"}</title>
<link rel="stylesheet" href="/department.css">
</head>
    <body>
<div class="container">
      <h1>${dept} ${type === "note" ? "Notes" : "Question Papers"}</h1>
      <form method="GET" action="/${dept}/${req.params.type}">
        <input type="text" name="search" placeholder="Enter Subject Name or Code">
        <button type="submit">Search</button>
      </form>
      <h3>Available ${type === "note" ? "Notes" : "Question Papers"}</h3>
  `;

 docs.forEach(doc => {
  html += `
  <div class="doc-card">
      <p><b>Subject:</b> ${doc.subjectName}</p>
      <p><b>Code:</b> ${doc.subjectCode}</p>
      <p><b>Uploaded:</b> ${doc.uploadDate.toDateString()}</p>

      <div class="actions">
      <a href="/${doc.filePath}" target="_blank">Preview</a>
      <a href="/${doc.filePath}" download>Download</a>
      </div>
  </div>
  `;
});

 html += `<a class="back-btn" href="/${dept}">⬅ Back to ${dept}</a></div></body></html>`;
  res.send(html);
});

// ------------------ Start Server ------------------
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
