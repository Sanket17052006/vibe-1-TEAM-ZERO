import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { myTrips, listTrips } from "@/lib/trips";
import type { Place } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const user = await requireRole();
    const { prompt } = await req.json() as { prompt: string };
    const q = String(prompt || "").toLowerCase();
    const trips = user.role === "rider" ? await listTrips() : await myTrips(user);
    let answer = "I can help with your trips, missed rides, route history, or today's Toto. Try one of those questions.";
    let draft: { from: Place; to: Place; scheduledDate: string; scheduledTime: string; passengers: string[] } | undefined;

    const route = q.match(/from\s+(college|station|office)\s+to\s+(college|station|office)/i);
    const time = q.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (route && time && user.role !== "rider") {
      let hour = Number(time[1]);
      const minute = time[2] || "00";
      if (time[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
      if (time[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
      const tomorrow = /tomorrow/.test(q), day = new Date();
      if (tomorrow) day.setDate(day.getDate() + 1);
      const passengerText = q.split(/\bwith\b/i)[1]?.replace(/\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?.*$/i, "").replace(/\b(?:today|tomorrow)\b.*$/i, "").replace(/[.!?]+$/g, "") || "";
      const passengers = passengerText.split(/,|\band\b/i).map(x => x.trim()).filter(x => /^[a-z][a-z .'-]{0,39}$/i.test(x));
      draft = { from: route[1][0].toUpperCase() + route[1].slice(1).toLowerCase() as Place, to: route[2][0].toUpperCase() + route[2].slice(1).toLowerCase() as Place, scheduledDate: day.toISOString().slice(0, 10), scheduledTime: `${String(hour).padStart(2, "0")}:${minute}`, passengers };
      answer = "I drafted that ride request. Review the route, time and group, then confirm it to send the request to the rider.";
    } else if (/clash/.test(q)) {
      const clash = trips.find(t => t.status === "clashed");
      const conflict = clash ? (user.role === "rider" ? trips : await listTrips()).find(t => t.scheduledDate === clash.scheduledDate && t.scheduledTime === clash.scheduledTime && ["accepted", "boarding", "completed"].includes(t.status)) : undefined;
      answer = clash ? `Your ${clash.scheduledTime} ${clash.from} to ${clash.to} request on ${clash.scheduledDate} clashed${conflict ? ` with the accepted ${conflict.from} to ${conflict.to} trip at the same time` : " because the shared Toto was already assigned at that time"}. Only one Toto is available.` : "I couldn't find a clashed request in your trip history.";
    } else if (/missed/.test(q)) {
      const missed = trips.filter(t => t.passengers.some(p => (p.userId === user.id || p.name.toLowerCase() === user.name.toLowerCase()) && p.boardingStatus === "missed"));
      answer = missed.length ? `You have ${missed.length} missed trip${missed.length === 1 ? "" : "s"}: ${missed.map(t => `${t.from} to ${t.to} on ${t.scheduledDate} at ${t.scheduledTime}`).join("; ")}.` : "You have no missed trips in your history.";
    } else if (/week|how many|count/.test(q)) {
      const since = new Date(); since.setDate(since.getDate() - 7);
      const recent = trips.filter(t => new Date(`${t.scheduledDate}T${t.scheduledTime}`) >= since);
      answer = `You have ${recent.length} trip${recent.length === 1 ? "" : "s"} in the last 7 days.`;
    } else if (/station/.test(q)) {
      const count = trips.filter(t => t.from === "Station" || t.to === "Station").length;
      answer = `Your history includes ${count} trip${count === 1 ? "" : "s"} that start or end at Station.`;
    } else if (/today|happening|dispatch/.test(q) && user.role === "rider") {
      const today = new Date().toISOString().slice(0, 10), rows = trips.filter(t => t.scheduledDate === today), active = rows.find(t => t.status === "boarding");
      answer = `Today's dispatch: ${rows.length} requests, ${rows.filter(t => ["accepted", "boarding"].includes(t.status)).length} accepted, ${rows.filter(t => t.status === "completed").length} completed, ${rows.filter(t => t.status === "requested").length} pending.${active ? ` Active: ${active.from} to ${active.to}, ${active.passengers.filter(p => p.boardingStatus === "boarded").length} boarded and ${active.passengers.filter(p => p.boardingStatus === "pending").length} pending.` : " No active trip."}`;
    } else if (/trip|history|join|ride/.test(q)) {
      answer = trips.length ? `I found ${trips.length} trip${trips.length === 1 ? "" : "s"} in your history. ${trips.slice(0, 3).map(t => `${t.scheduledDate}: ${t.from} to ${t.to} (${t.status})`).join("; ")}` : "There are no trips in your history yet.";
    }
    return NextResponse.json({ answer, draft });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Copilot is unavailable." }, { status: 503 }); }
}
