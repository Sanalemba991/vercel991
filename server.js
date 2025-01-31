const serverless = require('serverless-http');
const express = require("express");
const bcrypt = require("bcryptjs");
const data = require("./data.js");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const fast2sms = require("fast-two-sms");
const otplib = require("otplib");
const jwt = require("jsonwebtoken");
const UserModel = require("./model/User");
const ProductModel = require("./model/Product");
const OrderModel = require("./model/Order");
const authenticateJWT = require("./middlewares/authenticateJWT");
const cors = require("cors");


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/images', express.static('images'));

// Hello route
app.get('/api/', (req, res) => {
  res.status(200).json({ message: "I am okay!" });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    // Check if products already exist in the database
    ProductModel.findOne({ id: data.products[0].id })
      .then((existingProduct) => {
        if (existingProduct) {
          console.log("Product data already exists in the database.");
        } else {
          ProductModel.insertMany(data.products)
            .then(() => {
              console.log("Product data successfully inserted!");
            })
            .catch((err) => {
              console.error("Error inserting product data:", err);
            });
        }
      })
      .catch((err) => {
        console.error("Error checking existing product data:", err);
      });
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });

// OTP storage (in-memory)
let otpStore = {};

// Generate OTP function
const generateOTP = () => {
  const secret = otplib.authenticator.generateSecret();
  return otplib.authenticator.generate(secret);
};

// Send OTP to mobile using Fast2SMS
const sendMessage = async (mobile, token) => {
  const options = {
    authorization: process.env.FAST2SMS_API_KEY,
    message: `Your OTP verification code is ${token}`,
    numbers: [mobile],
  };

  try {
    const response = await fast2sms.sendMessage(options);
    return { success: true, message: "OTP sent successfully!" };
  } catch (error) {
    console.error("Error sending OTP:", error);
    return { success: false, message: "Failed to send OTP." };
  }
};

// User Registration Route
app.post("/signup", async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new UserModel({
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
    });

    const savedUser = await newUser.save();
    const token = generateOTP(); // Generate OTP
    otpStore[phone] = token; // Store OTP

    const result = await sendMessage(phone, token); // Send OTP
    if (result.success) {
      res.status(201).json({
        name: savedUser.name,
        email: savedUser.email,
        id: savedUser._id,
        otpSent: true,
        message: "User registered successfully. OTP sent to the registered phone number.",
      });
    } else {
      res.status(500).json({ error: "User registered, but failed to send OTP." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OTP Verification Route
app.post("/verify-otp", (req, res) => {
  const { mobileNumber, otp } = req.body;

  if (!otp || !mobileNumber) {
    return res.status(400).json({ success: false, message: "Mobile number and OTP are required." });
  }

  if (otpStore[mobileNumber] && otpStore[mobileNumber] === otp) {
    res.status(200).json({ success: true, message: "OTP verified successfully!" });
  } else {
    res.status(400).json({ success: false, message: "Invalid OTP." });
  }
});

// User Login Route with JWT token generation
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "No user found" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ email: user.email, id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h' // Token expires in 1 hour
    });

    res.status(200).json({
      message: "Login successful",
      token: token, // Send the JWT token to the client
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch Products Route
app.get("/products", async (req, res) => {
  try {
    const products = await ProductModel.find();
    if (products.length === 0) {
      return res.status(404).json({ error: "No products found" });
    }
    res.status(200).json({ products });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Fetch Single Product Route
app.get("/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const product = await ProductModel.findOne({ id });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json({ product });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Protected Order Route (JWT Authentication)
app.post("/order", authenticateJWT, async (req, res) => {
  const { items } = req.body;
  const email = req.user.email;  // Get the email from JWT

  if (!email) {
    return res.status(400).json({ message: "Email is required to place an order" });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ message: "Order must contain at least one item" });
  }

  try {
    const order = new OrderModel({
      email, // Assign the email from JWT to the order
      items,
    });

    await order.save();

    res.status(201).json({ message: "Order placed successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start the server locally
app.listen(4000, () => {
  console.log("Server is running on port 4000");
});

// Export the serverless handler for deployment
module.exports.handler = serverless(app);
