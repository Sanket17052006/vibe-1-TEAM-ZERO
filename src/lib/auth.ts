import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role, User } from "./types";
function signingKey() { if (process.env.NODE_ENV === "production" && (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)) throw new Error("AUTH_SECRET must contain at least 32 characters in production"); return new TextEncoder().encode(process.env.AUTH_SECRET || "development-only-secret-change-me-32-chars"); }
export async function setSession(user: User) { const token = await new SignJWT({ ...user }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(signingKey()); (await cookies()).set("mobility_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 }); }
export async function getUser(): Promise<User | null> { const token = (await cookies()).get("mobility_session")?.value; if (!token) return null; try { return (await jwtVerify(token, signingKey())).payload as unknown as User; } catch { return null; } }
export async function requireRole(...roles: Role[]) { const user = await getUser(); if (!user) throw new Error("Unauthorized"); if (roles.length && !roles.includes(user.role)) throw new Error("Forbidden"); return user; }
