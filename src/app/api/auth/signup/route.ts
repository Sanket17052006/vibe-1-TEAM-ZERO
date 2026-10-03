import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { name, email, password, role } = await req.json();
    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }
    if (!["student", "employee", "rider"].includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const database = await db();
    const users = database.collection("users");
    const existing = await users.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await users.insertOne({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      role,
      passwordHash,
      createdAt: new Date().toISOString(),
    });

    const safe = { id: String(result.insertedId), name: String(name).trim(), email: String(email).toLowerCase().trim(), role };
    await setSession(safe);
    return NextResponse.json({ user: safe });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to create account." }, { status: 503 });
  }
}