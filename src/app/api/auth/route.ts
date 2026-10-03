import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";
export async function POST(req: Request) { try { const { email, password } = await req.json(); if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 }); const user = await (await db()).collection("users").findOne({ email: String(email).toLowerCase().trim() }); if (!user || !(await bcrypt.compare(password, user.passwordHash))) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 }); const safe = { id: String(user._id), name: user.name, email: user.email, role: user.role }; await setSession(safe); return NextResponse.json({ user: safe }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to sign in." }, { status: 503 }); } }
export async function DELETE() { const { cookies } = await import("next/headers"); (await cookies()).delete("mobility_session"); return NextResponse.json({ ok: true }); }
