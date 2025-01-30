const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  id: { type: Number, required: true },

  ProductPicture: { type: String, default: null },
  ProductName: { type: String, required: true },
  ModelNumber: { type: String, required: true },
  Quantity: { type: String, required: true },
  Size: { type: String, default: null },  
  Price: { type: Number, default: null },  
  OnlinePrice: { type: Number, default: null }, 
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
