import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import { createCanvas, loadImage } from "canvas";
import ExcelJS from "exceljs";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

/* -------------------- DB -------------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB Connected");
    try {
      const db = mongoose.connection.db;
      await db.collection("certificates").dropIndex("eventId_1");
      console.log("Success: Unique constraint on eventId removed.");
    } catch (err) {
      if (err.code === 27) {
        console.log("Index cleanup: Certificate collection is already unrestricted.");
      } else {
        console.log("Index cleanup note:", err.message);
      }
    }

    // Initialize Global Counter
    const counter = await Counter.findOne({ name: "certCode" });
    if (!counter) {
      await Counter.create({ name: "certCode", seq: 0 });
      console.log("Global Counter initialized at 000000");
    }
  })
  .catch((err) => console.error(err));

/* -------------------- MODELS -------------------- */
const CounterSchema = new mongoose.Schema({
  name: String,
  seq: Number,
});
const Counter = mongoose.model("Counter", CounterSchema);

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  name: String,
  email: String,
  mobile: String,
});

const EventSchema = new mongoose.Schema({
  title: String,
  description: String,
  images: [String],
  startDate: String,
  endDate: String,
  status: { type: String, default: "active" },
  claimExpiry: { type: Date },
  certificateConfig: {
    nameY: Number,
    codeY: Number,
    nameSize: Number,
    templatePath: String
  },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  registeredStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const CertificateSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  certCode: { type: String, required: true },
  templateUrl: { type: String, required: true },
  generatedCertUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Event = mongoose.model("Event", EventSchema);
const Certificate = mongoose.model("Certificate", CertificateSchema);

/* -------------------- AUTH MIDDLEWARE -------------------- */
const auth = (roles = []) => (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.sendStatus(401);
    const decoded = jwt.verify(token, JWT_SECRET);
    if (roles.length && !roles.includes(decoded.role)) return res.sendStatus(403);
    req.user = decoded;
    next();
  } catch {
    res.sendStatus(401);
  }
};

/* -------------------- MULTER CONFIG -------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* -------------------- STUDENT: CLAIM CERTIFICATE -------------------- */
app.post("/api/events/:id/claim", auth(["student"]), async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);

    if (!event || event.status !== "ended") return res.status(400).json({ message: "Event hasn't ended yet." });
    if (new Date() > event.claimExpiry) return res.status(403).json({ message: "Claim window has expired." });
    if (!event.registeredStudents.includes(req.user.id)) return res.status(403).json({ message: "Not registered." });

    let existing = await Certificate.findOne({ eventId: id, studentId: req.user.id });
    if (existing) return res.json({ success: true, certUrl: existing.generatedCertUrl });

    const counter = await Counter.findOneAndUpdate(
      { name: "certCode" },
      { $inc: { seq: 1 } },
      { new: true }
    );
    const uniqueCode = String(counter.seq).padStart(6, '0');

    const student = await User.findById(req.user.id);
    const { nameY, codeY, nameSize, templatePath } = event.certificateConfig;
    const image = await loadImage(templatePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    const centerX = image.width / 2;

    ctx.drawImage(image, 0, 0);
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.font = `bold ${nameSize}px sans-serif`;
    ctx.fillStyle = "black";
    ctx.fillText((student.name || student.username).toUpperCase(), centerX, nameY);

    ctx.font = "bold 30px monospace";
    ctx.fillText(`ID: ${uniqueCode}`, centerX, codeY);

    const filename = `cert-${id}-${req.user.id}.png`;
    fs.writeFileSync(`uploads/${filename}`, canvas.toBuffer("image/png"));

    const cert = await Certificate.create({
      eventId: id,
      studentId: req.user.id,
      certCode: uniqueCode,
      templateUrl: `/uploads/${templatePath.split(/[\\/]/).pop()}`,
      generatedCertUrl: `/uploads/${filename}`
    });

    res.json({ success: true, certUrl: cert.generatedCertUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* -------------------- ORGANIZER: EXCEL REPORT -------------------- */
app.get("/api/events/:id/report", auth(["organizer"]), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("registeredStudents");
    if (!event) return res.status(404).send("Event not found");

    const certificates = await Certificate.find({ eventId: req.params.id });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Participants");

    worksheet.columns = [
      { header: "Student Name", key: "name", width: 30 },
      { header: "Email", key: "email", width: 30 },
      { header: "Mobile", key: "mobile", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Certificate Code", key: "code", width: 20 },
    ];

    event.registeredStudents.forEach(student => {
      const cert = certificates.find(c => c.studentId.toString() === student._id.toString());
      worksheet.addRow({
        name: student.name || student.username,
        email: student.email || "N/A",
        mobile: student.mobile || "N/A",
        status: cert ? "Claimed" : "Not Claimed",
        code: cert ? cert.certCode : "—"
      });
    });

    worksheet.getRow(1).font = { bold: true };
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Report_${event.title.replace(/\s+/g, '_')}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).send("Error generating report"); }
});

/* -------------------- ORGANIZER: PROFILE -------------------- */
app.get("/api/organizer/profile", auth(["organizer"]), async (req, res) => {
  res.json(await User.findById(req.user.id));
});

app.put("/api/organizer/profile", auth(["organizer"]), async (req, res) => {
  const { name, email, mobile } = req.body;
  await User.findByIdAndUpdate(req.user.id, { name, email, mobile });
  res.json({ success: true });
});

/* -------------------- ORGANIZER: EVENT MANAGEMENT -------------------- */
app.get("/api/events/my", auth(["organizer"]), async (req, res) => {
  res.json(await Event.find({ organizerId: req.user.id }));
});

app.post("/api/events", auth(["organizer"]), upload.array("images", 5), async (req, res) => {
  const images = req.files.map((f) => `/uploads/${f.filename}`);
  const event = await Event.create({ ...req.body, images, organizerId: req.user.id });
  res.json(event);
});

app.post("/api/events/:id/end", auth(["organizer"]), upload.single("certificateTemplate"), async (req, res) => {
  try {
    const { id } = req.params;
    const { nameY, codeY, nameSize } = req.body;
    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.organizerId.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" });
    if (!req.file) return res.status(400).json({ message: "Template required" });

    event.status = "ended";
    event.claimExpiry = new Date(Date.now() + 10 * 60 * 1000);
    event.certificateConfig = {
      nameY: parseFloat(nameY),
      codeY: parseFloat(codeY),
      nameSize: parseFloat(nameSize) || 80,
      templatePath: req.file.path
    };

    await event.save();
    res.json({ success: true, message: "Claim window opened", expiry: event.claimExpiry });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/events/:id", auth(["organizer"]), async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event || event.organizerId.toString() !== req.user.id) return res.sendStatus(403);
  await event.deleteOne();
  res.json({ success: true });
});

/* -------------------- STUDENT: EVENT MANAGEMENT -------------------- */
app.post("/api/events/register/:id", auth(["student"]), async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.sendStatus(404);
  const alreadyRegistered = event.registeredStudents.some((id) => id.toString() === req.user.id);
  if (alreadyRegistered) return res.status(400).json({ message: "Already registered" });
  event.registeredStudents.push(req.user.id);
  await event.save();
  res.json({ success: true });
});

app.get("/api/student/my-events", auth(["student"]), async (req, res) => {
  res.json(await Event.find({ registeredStudents: req.user.id }).populate("organizerId", "username"));
});

app.get("/api/student/profile", auth(["student"]), async (req, res) => {
  res.json(await User.findById(req.user.id));
});

app.put("/api/student/profile", auth(["student"]), async (req, res) => {
  const { name, email, mobile } = req.body;
  await User.findByIdAndUpdate(req.user.id, { name, email, mobile });
  res.json({ success: true });
});

/* -------------------- ADMIN: DASHBOARD & REPORTS -------------------- */
/* --- Replace your existing /api/admin/stats route with this --- */
app.get("/api/admin/stats", auth(["admin"]), async (req, res) => {
  try {
    const students = await User.countDocuments({ role: "student" });
    const organizers = await User.countDocuments({ role: "organizer" });
    const totalEvents = await Event.countDocuments(); // NEW LINE

    res.json({ students, organizers, totalEvents }); // ADDED totalEvents to response
  } catch (err) {
    res.status(500).json({ message: "Error fetching stats" });
  }
});

app.get("/api/admin/users", auth(["admin"]), async (req, res) => {
  res.json(await User.find({ role: { $ne: "admin" } }));
});

app.get("/api/admin/events-report", auth(["admin"]), async (req, res) => {
  try {
    const events = await Event.find().populate("organizerId", "name username mobile").lean();
    const reportData = await Promise.all(
      events.map(async (event) => {
        const claimCount = await Certificate.countDocuments({ eventId: event._id });
        return {
          title: event.title,
          organizer: event.organizerId?.name || event.organizerId?.username || "N/A",
          mobile: event.organizerId?.mobile || "N/A",
          registered: event.registeredStudents?.length || 0,
          claimed: claimCount,
        };
      })
    );
    res.json(reportData);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* -------------------- GENERAL -------------------- */
app.get("/api/events", async (req, res) => {
  res.json(await Event.find().populate("organizerId", "username").populate("registeredStudents", "name username email"));
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    const token = jwt.sign({ id: "adminid", role: "admin" }, JWT_SECRET);
    return res.json({ token, role: "admin" });
  }
  const user = await User.findOne({ username });
  if (!user || user.password !== password) return res.sendStatus(401);
  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);
  res.json({ token, role: user.role });
});

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ message: "User exists" });
  await User.create({ username, password, role: "student" });
  res.json({ success: true });
});

/* -------------------- ADMIN: DELETE USER -------------------- */
app.delete("/api/admin/user/:id", auth(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves (if their ID is stored in the token)
    if (id === req.user.id) {
      return res.status(400).json({ message: "Admin cannot delete their own account." });
    }

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* -------------------- ADMIN: CREATE USER -------------------- */
app.post("/api/admin/create-user", auth(["admin"]), async (req, res) => {
  try {
    const { username, password, role, email } = req.body;

    // Check if the username already exists
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Create the new user
    const newUser = await User.create({
      username,
      password, // In a real app, hash this with bcrypt
      role,
      email,
      name: "",   // Initialize with empty strings
      mobile: ""
    });

    res.json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.use("/uploads", express.static("uploads"));
app.listen(5000, () => console.log("Server running on http://localhost:5000"));