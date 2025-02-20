import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import teamRoutes from "./routes/team.js";
import tournamentRoutes from "./routes/tournament.js";
import communityRoutes from "./routes/community.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// Middleware
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads")); // Serve uploaded files

// Set up Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Post Schema
const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  media: { type: String }, // Store image/video file path
  createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model("Post", postSchema);

// Add Post Route (with file upload)
app.post("/api/posts", upload.single("media"), async (req, res) => {
  try {
    const { title, content, author } = req.body;
    const media = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!title || !content || !author) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    const newPost = new Post({ title, content, author, media });
    await newPost.save();
    res.status(201).json({ success: true, message: "Post created successfully", post: newPost });
  } catch (error) {
    console.error("Error adding post:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

// Get All Posts Route
app.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find();
    res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

// Update Post Route
app.put("/api/posts/:id", upload.single("media"), async (req, res) => {
  try {
    const { title, content, author } = req.body;
    const media = req.file ? `/uploads/${req.file.filename}` : undefined;
    
    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      { title, content, author, ...(media && { media }) },
      { new: true, runValidators: true }
    );
    if (!updatedPost) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    res.status(200).json({ success: true, message: "Post updated successfully", post: updatedPost });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/community", communityRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
