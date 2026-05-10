const mongoose = require('mongoose');

// Singleton pattern for single DB instance
class Database {
  constructor() {
    if (Database.instance) {
      return Database.instance;
    }
    this.connected = false;
    Database.instance = this;
  }

  async connect() {
    if (this.connected) {
      console.log('MongoDB already connected');
      return;
    }

    try {
      // Modern options (useNewUrlParser deprecated in Mongoose 7+)
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        maxPoolSize: 10,          // Connection pooling for concurrent uploads/scoring
        serverSelectionTimeoutMS: 5000,  // Fast fail for cloud DBs
        socketTimeoutMS: 45000,   // Long ops (PDF parsing, ML calls)
        bufferCommands: false,    // No queueing on first connect
      });

      this.connected = true;
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      console.log(`📊 DB Name: ${conn.connection.name}`);
      
      // Graceful disconnect on SIGINT/SIGTERM (server shutdown)
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('MongoDB Disconnected (SIGINT)');
        process.exit(0);
      });

    } catch (error) {
      console.error('❌ MongoDB Connection Error:', error.message);
      
      // Retry logic: 5 attempts, 2s delay
      let retryCount = 0;
      const maxRetries = 5;
      const retryDB = async () => {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error('💥 Max retries exceeded. Exiting.');
          process.exit(1);
        }
        
        console.log(`🔄 Retrying DB connection... (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 10, serverSelectionTimeoutMS: 5000
          });
          this.connected = true;
          console.log('✅ MongoDB Reconnected!');
        } catch (retryError) {
          await retryDB();
        }
      };
      
      await retryDB();
    }
  }
}

const db = new Database();
module.exports = db.connect.bind(db);  // Export async connect function