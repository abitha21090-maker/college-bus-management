const crypto = require("crypto");
const Student = require("../models/Student");
const Staff = require("../models/Staff");

const RAZORPAY_API = "https://api.razorpay.com/v1/orders";

const modelFor = (role) => (role === "staff" ? Staff : Student);

const razorpayAuthHeader = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  return "Basic " + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
};

// POST /api/payment/create-order  (student or staff)
// Creates a Razorpay order for the fixed bus fee amount and hands the
// order details back to the frontend to open the Razorpay checkout widget.
const createOrder = async (req, res) => {
  try {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, BUS_FEE_AMOUNT_INR, BUS_FEE_TERM } = process.env;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        message: "Online payment isn't set up yet. Ask the admin to pay your bus fee manually, or contact the office.",
      });
    }
    if (req.user.payment?.status === "paid") {
      return res.status(400).json({ message: "Your bus fee is already marked paid." });
    }

    const amountInRupees = Number(BUS_FEE_AMOUNT_INR) || 5000;
    const amountInPaise = Math.round(amountInRupees * 100);

    const response = await fetch(RAZORPAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: razorpayAuthHeader(),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `busfee_${req.userRole}_${req.user._id}_${Date.now()}`,
        notes: { role: req.userRole, userId: String(req.user._id), name: req.user.name },
      }),
    });

    const order = await response.json();
    if (!response.ok) {
      return res.status(502).json({ message: order?.error?.description || "Could not create payment order" });
    }

    // Stash the order id so we can double-check it on verification
    const Model = modelFor(req.userRole);
    await Model.findByIdAndUpdate(req.user._id, { "payment.razorpayOrderId": order.id });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      term: BUS_FEE_TERM || "",
      name: req.user.name,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/payment/verify  (student or staff)
// Verifies the signature Razorpay's checkout widget hands back after a
// successful payment, then marks the rider's bus fee as paid.
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    const Model = modelFor(req.userRole);
    const user = await Model.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.payment?.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "This order does not match your account" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed. Please contact the admin." });
    }

    const amountInRupees = Number(process.env.BUS_FEE_AMOUNT_INR) || 5000;
    user.payment = {
      status: "paid",
      amount: amountInRupees,
      term: process.env.BUS_FEE_TERM || "",
      paidOn: new Date(),
      remarks: "Paid online via Razorpay",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    };
    await user.save();

    res.json({ message: "Payment verified. Your bus fee is now marked paid.", payment: user.payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createOrder, verifyPayment };
