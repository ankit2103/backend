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
    "mongodb+srv://postmanngts:p2B6gzSGT5kzhbQk@test.dbxznkb.mongodb.net/volleyball_registration",
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
  key_id: "rzp_test_j6TQmy7c9caKEg",
  key_secret: "RRg0M5s9D7Oe8KK0Nf7gxSWD",
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

app.post('/payment-success', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // Verify signature
        const generatedSignature = crypto.createHmac('sha256', 'RRg0M5s9D7Oe8KK0Nf7gxSWD')
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        // Update payment status in MongoDB
        const registration = await Registration.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { paymentStatus: 'Completed' },
            { new: true }
        );

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Send confirmation email to the parent
        

        // Send email to the admin with full registration details
        const adminMailOptions = {
            from: 'uppvlofficial@gmail.com',
            to: 'uppvlofficial@gmail.com',
            subject: 'New Registration - Volleyball League',
            text: `New registration details:\n\n` +
                  `Player Name: ${registration.playerFirstName} ${registration.playerLastName}\n` +
                  `Date of Birth: ${registration.dob}\n` +
                  `Grade: ${registration.playerGrade}\n` +
                  `Previous Seasons Played: ${registration.previousSeasons}\n` +
                  `Positions Played: ${registration.positionsPlayed.join(', ')}\n` +
                  `Positions Trying Out: ${registration.positionsTryingOut.join(', ')}\n` +
                  `Parent Name: ${registration.parentFirstName} ${registration.parentLastName}\n` +
                  `Email: ${registration.parentEmail}\n` +
                  `Phone: ${registration.parentPhone}\n` +
                  `Permission: ${registration.permission ? 'Granted' : 'Not Granted'}\n` +
                  `Payment Status: ${registration.paymentStatus}\n` +
                  `Order ID: ${registration.razorpayOrderId}\n` +
                  `Amount: ₹${registration.amount}\n\n` +
                  `Best regards,\nVolleyball League`
        };

        // Send both emails
        transporter.sendMail(parentMailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email to parent:', error);
            } else {
                console.log('Email sent to parent:', info.response);
            }
        });

        transporter.sendMail(adminMailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email to admin:', error);
            } else {
                console.log('Email sent to admin:', info.response);
            }
        });

        res.status(200).json({ success: true, message: 'Payment verified successfully', data: registration });
    } catch (error) {
        console.error('Error in payment success:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});
// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
