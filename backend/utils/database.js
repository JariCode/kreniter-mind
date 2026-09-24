const mongoose = require('mongoose')

// Connect to MongoDB
async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('MongoDB connected')
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    process.exit(1)
  }
}

module.exports = connectDatabase