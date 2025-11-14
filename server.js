// server.js - FINAL & PERFECT (2025 Ready)
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("DB Error:", err));

// Schemas
const fileSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimetype: String,
  size: Number,
  uploadDate: { type: Date, default: Date.now }
});
const File = mongoose.model('File', fileSchema);

const contactSchema = new mongoose.Schema({
  name: String, email: String, subject: String, message: String,
  date: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', contactSchema);

// Uploads folder
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, unique);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Email
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  // 16-digit App Password
  }
});

transporter.verify((err) => {
  err ? console.log("EMAIL ERROR:", err.message) : console.log("Email ready!");
});

// Routes
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const newFile = new File({
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
  await newFile.save();

  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ success: true, file: { id: newFile._id, url, originalName: req.file.originalname, type: req.file.mimetype, size: req.file.size } });
});

app.get('/api/files', async (req, res) => {
  const files = await File.find().sort({ uploadDate: -1 });
  const result = files.map(f => ({
    id: f._id,
    url: `${req.protocol}://${req.get('host')}/uploads/${f.filename}`,
    originalName: f.originalName,
    type: f.mimetype,
    size: f.size
  }));
  res.json(result);
});

app.delete('/api/files/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (file) {
      fs.unlinkSync(path.join(__dirname, 'uploads', file.filename));
      await File.findByIdAndDelete(req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "Fill all" });

  try {
    await new Contact({ name, email, subject, message }).save();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `Portfolio: ${subject || "New Message"}`,
      html: `<h3>New Message</h3><p><b>Name:</b> ${name}<br><b>Email:</b> ${email}</p><p>${message.replace(/\n/g, '<br>')}</p>`
    });
    res.json({ success: true, message: "Sent! I'll reply soon" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`LIVE ON PORT ${PORT}`));