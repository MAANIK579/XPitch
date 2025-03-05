const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const cookie = require('cookie-parser');
const app = express();
const MongoStore = require('connect-mongo');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Middleware
app.use(cookie());
app.use(cors({
    origin: 'https://xpitch.netlify.app/',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: 'mongodb+srv://gargruchimay1984:4OnMnds2rgg8anek@cluster0.s5f9p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
    }),
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

// MongoDB Connection
mongoose.connect('mongodb+srv://gargruchimay1984:4OnMnds2rgg8anek@cluster0.s5f9p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema and Model
const userSchema = new mongoose.Schema({
    username: String,
    fullname: String,
    email: { type: String, unique: true },
    password: String,
    dob: Date,
    player_id: { type: String, unique: true },
    experience: Number
});
const User = mongoose.model('User', userSchema);

// Auth Middleware
const requireAuth = (req, res, next) => {
    console.log(req.cookies)
    if (!req.session.userEmail) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
};

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: Images only!');
        }
    }
});

// Serve static files
app.use('/uploads', express.static('uploads'));

// Routes
app.post('/signup', express.json(), async (req, res) => {
    try {
        const {
            username,
            fullname,
            email,
            password,
            dob,
            player_id,
            experience
        } = req.body;

        // Check for existing email or player ID
        const existingUser = await User.findOne({ $or: [{ email }, { player_id }] });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ message: "Email already exists" });
            }
            if (existingUser.player_id === player_id) {
                return res.status(400).json({ message: "Player ID already exists" });
            }
        }

        const newUser = new User({
            username,
            fullname,
            email,
            password,
            dob: new Date(dob),
            player_id,
            experience: Number(experience)
        });

        await newUser.save();

        req.session.userEmail = newUser.email;
        res.status(201).json({ message: "User created successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Update login route with better error handling
app.post('/login', express.json(), async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            console.log('Login attempt with non-existent email:', email);
            return res.status(401).json({ message: "Invalid credentials" });
        }

        if (user.password !== password) {
            console.log('Password mismatch for email:', email);
            return res.status(401).json({ message: "Invalid credentials" });
        }

        req.session.userEmail = user.email;
        console.log('Successful login for:', email);
        console.log(req.session)
        res.status(200)
            .json({ message: "Login successful" });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Server error" });
    }
});

app.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.session.userEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            username: user.username,
            fullname: user.fullname,
            email: user.email,
            dob: user.dob,
            player_id: user.player_id,
            experience: user.experience
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Add this route before the server starts listening
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

// Add after User model
// Post Schema and Model
const postSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    imageUrl: String,
    caption: String,
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// Add these routes before server starts listening
// Create Post
app.post('/post', requireAuth, upload.single('file'), async (req, res) => {
    try {
        const { caption } = req.body;
        const user = await User.findOne({ email: req.session.userEmail });

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const newPost = new Post({
            user: user._id,
            imageUrl: `/uploads/${req.file.filename}`,
            caption
        });

        await newPost.save();
        res.status(201).json({ message: "Post created successfully", post: newPost });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Delete all posts for current user

app.delete('/posts/delete-all', requireAuth, async (req, res) => {
    try {
        // 1. Verify user session
        if (!req.session.userEmail) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        // 2. Find user
        const user = await User.findOne({ email: req.session.userEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 3. Get all user posts
        const posts = await Post.find({ user: user._id });

        // 4. Delete associated files
        await Promise.all(posts.map(async (post) => {
            try {
                const filePath = path.join(__dirname, post.imageUrl);
                await fs.unlink(filePath);
            } catch (fileError) {
                console.error('⚠️ Error deleting file:', post.imageUrl, fileError.message);
            }
        }));

        // 5. Delete from database
        await Post.deleteMany({ user: user._id });

        // 6. Send response
        res.json({
            success: true,
            message: `Deleted ${posts.length} posts successfully`
        });

    } catch (error) {
        console.error('🚨 Server Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message // Send actual error message
        });
    }
});

// Delete Post route
app.delete('/posts/:id', requireAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('user');

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Verify ownership
        const currentUser = await User.findOne({ email: req.session.userEmail });
        if (post.user._id.toString() !== currentUser._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized to delete this post' });
        }

        // Delete image file
        const fs = require('fs').promises;
        const imagePath = path.join(__dirname, post.imageUrl);
        await fs.unlink(imagePath);

        // Delete from database
        await Post.deleteOne({ _id: req.params.id });

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Posts (public)
app.get('/posts', async (req, res) => {

    try {
        const posts = await Post.find()
            .populate('user', 'username fullname')
            .sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

app.get('/myposts', requireAuth, async (req, res) => {

    try {
        const user = await User.findOne({ email: req.session.userEmail });
        const posts = await Post.find({ user: user._id })
            .populate('user', 'username fullname')
            .sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Get single post
app.get('/posts/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('user');
        res.json(post);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Like post
app.post('/posts/:id/like', requireAuth, async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(
            req.params.id,
            { $inc: { likes: 1 } },
            { new: true }
        );
        res.json(post);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Get comments
app.get('/posts/:id/comments', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).select('comments');
        res.json(post.comments || []);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Add profile route
// View other users' profiles
app.get('/view-profile/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('-password')
            .lean();

        if (!user) return res.status(404).json({ message: 'User not found' });

        const posts = await Post.find({ user: user._id })
            .sort({ createdAt: -1 })
            .lean();

        res.json({ user, posts });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));