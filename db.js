import mongoose from 'mongoose';

const connectDb = async () => {
  const URL = process.env.MONGO_URI || 'mongodb+srv://it:WPtQ9LBcLFyCpx5Y@hupplycluster.mojcy.mongodb.net/';
  try {
    mongoose.set('strictQuery', false);
    const conn = await mongoose.connect(URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDb;
