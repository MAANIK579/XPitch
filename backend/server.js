const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const cookie = require('cookie-parser');
const app = express();
const MongoStore = require('connect-mongo');

// Middleware
app.use(cookie());
app.use(cors({
    origin: 'http://127.0.0.1:5500', // Change to your actual frontend port
    credentials: true
}));
app.use(express.json());
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
    password: String
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

// Routes
app.post('/signup', async (req, res) => {
    try {
        const { username, fullname, email, password } = req.body;
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const newUser = new User({ username, fullname, email, password });
        await newUser.save();

        // Automatically log in after signup
        req.session.userEmail = newUser.email;
        res.status(201).json({ message: "User created successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Update login route with better error handling
app.post('/login', async (req, res) => {
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
            email: user.email
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

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));