// server.js - COMPLETE & SYNCED (2025 Ready)
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
app.use(express.static('public')); // Serve static files

// MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio')
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("DB Error:", err));

// Enhanced Schemas
const fileSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimetype: String,
  size: Number,
  description: { type: String, default: '' },
  uploadDate: { type: Date, default: Date.now }
});
const File = mongoose.model('File', fileSchema);

const contactSchema = new mongoose.Schema({
  name: String, 
  email: String, 
  subject: String, 
  message: String,
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'unread' }
});
const Contact = mongoose.model('Contact', contactSchema);

// Uploads folder
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });

// Multer with better file filtering
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, unique);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow all file types but check size in limits
  cb(null, true);
};

const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter
});

// Email Configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify email configuration
transporter.verify((error, success) => {
  if (error) {
    console.log("EMAIL ERROR:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

// Enhanced Routes

// Upload file with description
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { description = '' } = req.body;

    const newFile = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      description
    });
    
    await newFile.save();

    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      file: { 
        id: newFile._id, 
        url, 
        originalName: req.file.originalname, 
        type: req.file.mimetype, 
        size: req.file.size,
        description
      } 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Get all files
app.get('/api/files', async (req, res) => {
  try {
    const files = await File.find().sort({ uploadDate: -1 });
    const result = files.map(f => ({
      id: f._id,
      url: `${req.protocol}://${req.get('host')}/uploads/${f.filename}`,
      originalName: f.originalName,
      type: f.mimetype,
      size: f.size,
      description: f.description,
      uploadDate: f.uploadDate
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// Update file details
app.put('/api/files/:id', async (req, res) => {
  try {
    const { originalName, description } = req.body;
    const updatedFile = await File.findByIdAndUpdate(
      req.params.id,
      { originalName, description },
      { new: true }
    );
    
    if (!updatedFile) {
      return res.status(404).json({ error: "File not found" });
    }
    
    res.json({ 
      success: true, 
      file: {
        id: updatedFile._id,
        originalName: updatedFile.originalName,
        description: updatedFile.description
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});

// Delete file
app.delete('/api/files/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (file) {
      const filePath = path.join(__dirname, 'uploads', file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await File.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: "File deleted successfully" });
    } else {
      res.status(404).json({ error: "File not found" });
    }
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// Contact form with auto-reply
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Please fill all required fields" });
  }

  try {
    // Save to database
    const newContact = new Contact({ name, email, subject, message });
    await newContact.save();

    // Email to you (portfolio owner)
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `Portfolio Contact: ${subject || "New Message from " + name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #00d4ff; padding-bottom: 10px;">
            New Portfolio Message
          </h2>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject || 'Not specified'}</p>
            <p><strong>Message:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #00d4ff;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This message was sent from your portfolio contact form.
          </p>
        </div>
      `
    });

    // Auto-reply to the sender
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Thank you for contacting Rishabh Singh",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #00d4ff; padding-bottom: 10px;">
            Thank You for Your Message
          </h2>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px;">
            <p>Hello ${name},</p>
            <p>Thank you for reaching out to me through my portfolio. I have received your message and will get back to you as soon as possible.</p>
            <p>For urgent inquiries, you can also reach me directly at rishabhsinghthakur999@gmail.com</p>
            <p><strong>Best regards,</strong><br>Rishabh Singh<br>Full-Stack Developer</p>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This is an automated response. Please do not reply to this email.
          </p>
        </div>
      `
    });

    res.json({ 
      success: true, 
      message: "Message sent successfully! I'll reply soon. Check your email for confirmation." 
    });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: "Failed to send message. Please try again later." });
  }
});

// Get contact messages (for admin)
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ date: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Portfolio Backend'
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Email service: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
  console.log(`🗄️  Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});