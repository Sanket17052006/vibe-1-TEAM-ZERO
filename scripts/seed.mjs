import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
if (!process.env.MONGODB_URI) { console.error("Set MONGODB_URI in .env.local first."); process.exit(1); }
const client = await new MongoClient(process.env.MONGODB_URI).connect();
try {
 const db = client.db(process.env.MONGODB_DB || "internal_mobility"), users = db.collection("users");
 for (const [name,email,role] of [["Rahul Sharma","rahul@campus.demo","student"],["Priya Das","priya@campus.demo","employee"],["Ravi Singh","ravi@campus.demo","rider"]]) {
  await users.updateOne({ email }, { $set: { name, email, role, passwordHash: await bcrypt.hash("RideDemo2026!", 12), createdAt: new Date().toISOString() } }, { upsert: true });
 }
 console.log("Demo accounts ready (password: RideDemo2026!).");
} finally { await client.close(); }
