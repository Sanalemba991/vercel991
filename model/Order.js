const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  email: { type: String, required: true }, 
  items: [
    { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Product",
      required: true
    }
  ],
  status: { type: String, default: "Pending" },
  orderDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
