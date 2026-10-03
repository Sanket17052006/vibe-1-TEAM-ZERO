import { MongoClient } from "mongodb";
let clientPromise: Promise<MongoClient> | null = null;
export async function db() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MongoDB is not configured. Add MONGODB_URI to .env.local.");
  if (!clientPromise) clientPromise = new MongoClient(uri).connect();
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "internal_mobility");
}
