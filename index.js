// Import required modules
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail", // or your email service provider
  auth: {
    user: 'uppvlofficial@gmail.com', // your email
    pass: 'udmghpdmgbeeukka', // your email password or app-specific password
  },
});

require("dotenv").config();

// Initialize express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB

mongoose
  .connect(
    "mongodb+srv://user20:NOyTc677xndnxhgX@cluster0.k2p9x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0/volleyball_registration",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => console.error("Could not connect to MongoDB...", err));

// Create Mongoose schema and model
const RegistrationSchema = new mongoose.Schema({
  playerFirstName: String,
  playerLastName: String,
  dob: Date,
  playerGrade: String,
  previousSeasons: Number,
  positionsPlayed: [String],
  positionsTryingOut: [String],
  parentFirstName: String,
  parentLastName: String,
  parentEmail: String,
  parentPhone: String,
  permission: Boolean,
  paymentStatus: { type: String, default: "Pending" },
  razorpayOrderId: String,
  amount: Number,
});

const Registration = mongoose.model("Registration", RegistrationSchema);

// Initialize Razorpay
const razorpayInstance = new Razorpay({
  key_id: "rzp_test_ishlhVJvqUBNSe",
  key_secret: "Tqb09NB6TPWoZQ0wdJTJqK0i",
});

// API endpoint to handle registration form submission
app.post("/register", async (req, res) => {
  try {
    const {
      playerFirstName,
      playerLastName,
      dob,
      playerGrade,
      previousSeasons,
      positionsPlayed,
      positionsTryingOut,
      parentFirstName,
      parentLastName,
      parentEmail,
      parentPhone,
      permission,
    } = req.body;

    // Validate required fields
    if (
      !playerFirstName ||
      !playerLastName ||
      !dob ||
      !playerGrade ||
      !parentFirstName ||
      !parentLastName ||
      !parentEmail ||
      !parentPhone
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all required fields." });
    }

    // Create an order with Razorpay
    const amount = 50000; // Registration fee in paise (₹500.00)
    const options = {
      amount: amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpayInstance.orders.create(options);

    if (!order) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to create Razorpay order" });
    }

    // Save registration data to MongoDB
    const registration = new Registration({
      playerFirstName,
      playerLastName,
      dob,
      playerGrade,
      previousSeasons,
      positionsPlayed,
      positionsTryingOut,
      parentFirstName,
      parentLastName,
      parentEmail,
      parentPhone,
      permission,
      razorpayOrderId: order.id,
      amount: amount / 100, // Converting to rupees
    });

    await registration.save();
    res
      .status(201)
      .json({ success: true, orderId: order.id, amount: amount / 100 });
  } catch (error) {
    console.error("Error in registration:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/payment-success", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Verify signature using Razorpay's signature verification method
    const generatedSignature = crypto
      .createHmac("sha256", "Tqb09NB6TPWoZQ0wdJTJqK0i")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    // Update payment status in MongoDB
    const registration = await Registration.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { paymentStatus: "Completed" },
      { new: true }
    );

    if (!registration) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    res
      .status(200)
      .json({
        success: true,
        message: "Payment verified successfully",
        data: registration,
      });
  } catch (error) {
    console.error("Error in payment success:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
