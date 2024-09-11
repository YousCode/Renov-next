// pages/api/testConnection.js
import connectToDatabase from '../../lib/mongodb';

export default async function handler(req, res) {
  try {
    await connectToDatabase();
    console.log("Successfully connected to database");
    res.status(200).json({ message: "Successfully connected to database new 6" });
  } catch (error) {
    console.error("Failed to connect to database:", error);
    res.status(500).json({ message: "Failed to connect to database", error: error.message });
  }
}
