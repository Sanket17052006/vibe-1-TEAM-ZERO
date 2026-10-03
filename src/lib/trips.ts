import { ObjectId } from "mongodb";
import type { Document } from "mongodb";
import { db } from "./db";
import type { Passenger, Place, Trip, User } from "./types";
const collection = async () => (await db()).collection("trips");
const clean = (x: Document): Trip => ({ ...x, _id: String(x._id) }) as unknown as Trip;
export async function listTrips() { return (await (await collection()).find().sort({ scheduledDate: 1, scheduledTime: 1 }).toArray()).map(clean); }
export async function myTrips(user: User) { return (await (await collection()).find({ $or: [{ requesterId: user.id }, { "passengers.userId": user.id }, { "passengers.name": { $regex: `^${user.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }] }).sort({ scheduledDate: -1 }).toArray()).map(clean); }
export async function createTrip(data: { from: Place; to: Place; scheduledDate: string; scheduledTime: string; passengers: string[] }, user: User) {
  if (!["College", "Station", "Office"].includes(data.from) || !["College", "Station", "Office"].includes(data.to) || data.from === data.to) throw new Error("Choose two different valid locations.");
  const date = new Date(`${data.scheduledDate}T${data.scheduledTime}:00`); if (Number.isNaN(date.valueOf()) || date < new Date(Date.now() - 60000)) throw new Error("Choose a valid date and time in the future.");
  const names = data.passengers.map(n => n.trim()).filter(Boolean); if (!names.length || names.length > 8) throw new Error("Add between 1 and 8 passengers.");
  if (!names.some(n => n.toLowerCase() === user.name.toLowerCase())) names.unshift(user.name);
  const passengers = names.map(name => ({ name, ...(name.toLowerCase() === user.name.toLowerCase() ? { userId: user.id } : {}), boardingStatus: "pending" }));
  const trips = await collection(); const item = { requesterId: user.id, requesterName: user.name, from: data.from, to: data.to, scheduledDate: data.scheduledDate, scheduledTime: data.scheduledTime, passengers, status: "requested", createdAt: new Date().toISOString() };
  const result = await trips.insertOne(item); return clean({ ...item, _id: result.insertedId });
}
export async function acceptTrip(id: string) {
  const database = await db(), trips = database.collection("trips");
  const selected = await trips.findOne({ _id: new ObjectId(id) }); if (!selected || selected.status !== "requested") throw new Error("This request is no longer available.");
  const lock = database.collection("dispatch_lock"), lockId = new ObjectId("000000000000000000000001");
  const now = new Date().toISOString();
  try { await lock.insertOne({ _id: lockId, tripId: id, createdAt: now }); } catch { throw new Error("Toto is already reserved for another trip."); }
  try {
    const conflict = await trips.findOne({ _id: { $ne: selected._id }, scheduledDate: selected.scheduledDate, scheduledTime: selected.scheduledTime, status: { $in: ["accepted", "boarding", "completed"] } });
    if (conflict) throw new Error("Toto is already reserved at this date and time.");
    await trips.updateOne({ _id: selected._id, status: "requested" }, { $set: { status: "accepted", acceptedAt: now } });
    await trips.updateMany({ _id: { $ne: selected._id }, scheduledDate: selected.scheduledDate, scheduledTime: selected.scheduledTime, status: "requested" }, { $set: { status: "clashed" } });
    return clean({ ...selected, status: "accepted", acceptedAt: now });
  } finally { await lock.deleteOne({ _id: lockId, tripId: id }); }
}
export async function updateTrip(id: string, action: "start" | "complete" | "boarding", passengerIndex?: number, boardingStatus?: "boarded" | "missed") {
  const trips = await collection(), key = new ObjectId(id), trip = await trips.findOne({ _id: key }); if (!trip) throw new Error("Trip not found.");
  if (action === "start" && trip.status === "accepted") await trips.updateOne({ _id: key }, { $set: { status: "boarding" } });
  else if (action === "boarding" && trip.status === "boarding" && typeof passengerIndex === "number" && boardingStatus) await trips.updateOne({ _id: key }, { $set: { [`passengers.${passengerIndex}.boardingStatus`]: boardingStatus } });
  else if (action === "complete" && ["accepted", "boarding"].includes(trip.status)) { const passengers = trip.passengers as Passenger[]; await trips.updateOne({ _id: key }, { $set: { status: "completed", completedAt: new Date().toISOString(), passengers: passengers.map(p => ({ ...p, boardingStatus: p.boardingStatus === "pending" ? "missed" : p.boardingStatus })) } }); }
  else throw new Error("That trip action is not available.");
  return clean((await trips.findOne({ _id: key }))!);
}
