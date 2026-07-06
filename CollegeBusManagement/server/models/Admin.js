const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    adminId: { type: String, trim: true, unique: true, sparse: true }, // employee / admin reg no
    role: { type: String, default: "admin" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
