"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowRight, BadgeCheck, Bike, Bot, CalendarDays, Check,
  ChevronRight, CircleHelp, Clock3, Compass, History, LayoutDashboard,
  LoaderCircle, LogOut, MapPin, Plus, Send, ShieldCheck,
  Sparkles, Users, X,
} from "lucide-react";
import type { Boarding, Place, Trip, User } from "@/lib/types";

type View = "Overview" | "My trips" | "History" | "Dispatch" | "Copilot";
type RideDraft = { from: Place; to: Place; scheduledDate: string; scheduledTime: string; passengers: string[] };
const places: Place[] = ["College", "Station", "Office"];
const statusStyle: Record<string, string> = {
  requested: "bg-amber-50 text-amber-800 ring-amber-200",
  accepted: "bg-blue-50 text-blue-800 ring-blue-200",
  boarding: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  clashed: "bg-rose-50 text-rose-800 ring-rose-200",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
};
const navFor = (role: User["role"]): { label: View; icon: typeof LayoutDashboard }[] =>
  role === "rider"
    ? [{ label: "Overview", icon: LayoutDashboard }, { label: "Dispatch", icon: Users }, { label: "History", icon: History }, { label: "Copilot", icon: Bot }]
    : [{ label: "Overview", icon: LayoutDashboard }, { label: "My trips", icon: Compass }, { label: "History", icon: History }, { label: "Copilot", icon: Bot }];

function fmtDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
function Badge({ value }: { value: string }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${statusStyle[value] || statusStyle.cancelled}`}>{value}</span>;
}
function Route({ trip, compact = false }: { trip: Trip; compact?: boolean }) {
  return <span className={`inline-flex min-w-0 items-center font-semibold text-ink ${compact ? "gap-2 text-sm" : "gap-3 text-lg sm:text-xl"}`}>
    <span className="truncate">{trip.from}</span><span className="grid size-6 shrink-0 place-items-center rounded-full bg-forest/5 text-forest"><ArrowRight size={13}/></span><span className="truncate">{trip.to}</span>
  </span>;
}

export default function ModernHome() {
  const [user, setUser] = useState<User | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [view, setView] = useState<View>("Overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [form, setForm] = useState({ from: "College" as Place, to: "Station" as Place, scheduledDate: new Date().toISOString().slice(0, 10), scheduledTime: "11:30", passengers: "" });
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [draft, setDraft] = useState<RideDraft | null>(null);

  async function refresh(target: User | null = user) {
    if (!target) return;
    const response = await fetch(`/api/trips${target.role === "rider" ? "?all=true" : ""}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load trips.");
    setTrips(data.trips);
  }

  useEffect(() => {
    let current = true;
    async function boot() {
      try {
        const response = await fetch("/api/me");
        const data = await response.json();
        if (!current) return;
        if (data.user) {
          setUser(data.user);
          const tripsResponse = await fetch(`/api/trips${data.user.role === "rider" ? "?all=true" : ""}`);
          const tripsData = await tripsResponse.json();
          if (!tripsResponse.ok) throw new Error(tripsData.error || "Could not load trips.");
          if (current) setTrips(tripsData.trips);
        }
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : "Could not connect to the service.");
      } finally { if (current) setLoading(false); }
    }
    void boot();
    return () => { current = false; };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const rider = user?.role === "rider";
  const nav = user ? navFor(user.role) : [];
  const active = trips.find(t => t.status === "boarding");
  const pending = trips.filter(t => t.status === "requested").sort((a,b) => `${a.scheduledDate}${a.scheduledTime}`.localeCompare(`${b.scheduledDate}${b.scheduledTime}`));
  const upcoming = useMemo(() => trips.filter(t => ["requested", "accepted", "boarding"].includes(t.status) && t.scheduledDate >= today).sort((a,b) => `${a.scheduledDate}${a.scheduledTime}`.localeCompare(`${b.scheduledDate}${b.scheduledTime}`)), [trips, today]);
  const completed = trips.filter(t => t.status === "completed");
  const history = trips.filter(t => ["completed", "clashed", "cancelled"].includes(t.status)).sort((a,b) => `${b.scheduledDate}${b.scheduledTime}`.localeCompare(`${a.scheduledDate}${a.scheduledTime}`));

  async function mutate(url: string, body?: unknown, method = "POST") {
    setBusy(true); setError("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong.");
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      throw cause;
    } finally { setBusy(false); }
  }
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fields.get("email"), password: fields.get("password") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign-in failed.");
      setUser(data.user); await refresh(data.user);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }
  async function requestRide(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await mutate("/api/trips", { ...form, passengers: form.passengers.split(",").map(x => x.trim()).filter(Boolean) });
      setRequestOpen(false); setDraft(null); setView("Overview"); setNotice("Your ride request is with the rider."); await refresh();
    } catch { /* The inline error stays visible in the form. */ }
  }
  async function riderAction(tripId: string, action: string, passengerIndex?: number, boardingStatus?: Boarding) {
    try {
      await mutate(`/api/trips/${tripId}`, { action, passengerIndex, boardingStatus }, "PATCH");
      setNotice(action === "accept" ? "Trip accepted. Requests at the same time were marked as clashed." : action === "complete" ? "Trip completed. Toto is available again." : "Trip updated.");
      await refresh();
    } catch { /* The page-level error banner explains the failure. */ }
  }
  async function askCopilot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!prompt.trim()) return;
    try { const data = await mutate("/api/copilot", { prompt }); setAnswer(data.answer); setDraft(data.draft || null); }
    catch { setAnswer("Copilot is temporarily unavailable. Your trips and bookings still work."); setDraft(null); }
  }
  async function signOut() {
    try { await mutate("/api/auth", {}, "DELETE"); } catch { /* Clear the local view even if the server session expired. */ }
    setUser(null); setTrips([]); setView("Overview"); setError(""); setNotice("");
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-paper text-forest"><div className="flex items-center gap-3 text-sm font-medium"><LoaderCircle className="animate-spin" size={19}/>Getting your desk ready</div></main>;
  if (!user) return <SignIn onSubmit={signIn} busy={busy} error={error}/>;

  const isToday = (trip: Trip) => trip.scheduledDate === today;
  const title = view === "Overview" ? (rider ? "Your shift at a glance" : `Welcome back, ${user.name.split(" ")[0]}`) : view === "Dispatch" ? "Dispatch" : view;
  const subtitle = view === "Overview" ? (rider ? "The requests and rides that need your attention." : "Your campus rides, gathered in one place.") : view === "Dispatch" ? "Accept requests and keep the Toto moving." : view === "History" ? "Every trip you took or handled." : view === "Copilot" ? "Ask a question or draft a ride in plain language." : "See what’s booked and what’s still waiting.";

  return <main className="min-h-screen bg-paper text-ink">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white lg:flex">
      <Brand className="border-b border-line px-6 py-5"/>
      <div className="px-5 pb-2 pt-7 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</div>
      <NavItems nav={nav} active={view} onSelect={setView} desktop/>
      <div className="mt-auto border-t border-line p-4">
        <TotoState active={active} upcoming={upcoming[0]}/>
        <UserControl user={user} onSignOut={signOut}/>
      </div>
    </aside>

    <div className="lg:pl-64">
      <div className="sticky top-0 z-20 border-b border-line/80 bg-white/95 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Brand compact/>
          <div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 sm:flex"><span className="size-1.5 rounded-full bg-emerald-500"/>Service running</span><button onClick={signOut} aria-label="Sign out" className="grid size-9 place-items-center rounded-full bg-sage text-forest"><LogOut size={16}/></button></div>
        </div>
      </div>
      <section className="mx-auto min-h-[calc(100dvh-56px)] max-w-6xl px-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-8 lg:min-h-screen lg:px-10 lg:pb-12 lg:pt-9">
        <header className="mb-6 flex items-center justify-between gap-4 sm:mb-8">
          <div className="min-w-0"><div className="mb-1 hidden text-[11px] font-medium text-slate-400 sm:block">Campus mobility <span className="px-1">/</span> {view}</div><h1 className="truncate text-[25px] font-semibold tracking-[-.035em] sm:text-[30px]">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[11px] font-medium text-slate-600 md:flex"><span className="size-1.5 rounded-full bg-emerald-500"/>Toto service active</span>
            {!rider && <button onClick={() => { setRequestOpen(true); setError(""); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#174c3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:h-11 sm:px-4 sm:text-sm"><Plus size={16}/><span className="hidden sm:inline">Request a ride</span><span className="sm:hidden">Request</span></button>}
          </div>
        </header>

        {(error || notice) && <div role={error ? "alert" : "status"} className={`mb-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}><div className="flex items-start gap-2"><span className="mt-0.5">{error ? <CircleHelp size={16}/> : <Check size={16}/>}</span><span>{error || notice}</span></div><button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss message"><X size={16}/></button></div>}

        {view === "Overview" && <div className="space-y-5 sm:space-y-6">
          <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <div className="relative isolate overflow-hidden rounded-3xl bg-forest p-5 text-white sm:p-7">
              <div className="relative z-10 flex h-full min-h-[165px] flex-col justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-100/75"><span className={`size-2 rounded-full ${active ? "bg-orange-300" : upcoming[0]?.status === "accepted" ? "bg-amber-300" : "bg-lime-300"}`}/>{active ? "Toto is on a trip" : upcoming[0]?.status === "accepted" ? "Toto is reserved" : "Toto is available"}</div>
                <div className="mt-8"><h2 className="text-[22px] font-semibold tracking-tight sm:text-[26px]">{active ? `${active.from} to ${active.to}` : upcoming[0]?.status === "accepted" ? "Your ride is confirmed" : rider ? "You’re all caught up" : "Where are you headed?"}</h2><p className="mt-1 max-w-md text-sm leading-6 text-emerald-50/75">{active ? `${active.passengers.length} passengers · ${fmtTime(active.scheduledTime)}` : upcoming[0]?.status === "accepted" ? `${fmtDate(upcoming[0].scheduledDate)} · ${fmtTime(upcoming[0].scheduledTime)}` : rider ? "New requests will appear in your dispatch." : "Book one shared Toto for your whole group."}</p></div>
              </div>
              <span className="pointer-events-none absolute -bottom-12 -right-7 -z-0 text-white/[.07]"><Bike size={190} strokeWidth={1}/></span>
            </div>
            <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between"><div><div className="text-[11px] font-medium text-slate-500">{rider ? "Today’s schedule" : "Your next trip"}</div><h2 className="mt-1 text-base font-semibold">{rider ? `${trips.filter(isToday).length} trips today` : upcoming[0] ? fmtDate(upcoming[0].scheduledDate) : "Nothing booked yet"}</h2></div><span className="grid size-10 place-items-center rounded-2xl bg-sage text-forest"><CalendarDays size={18}/></span></div>
              {upcoming[0] ? <button onClick={() => setView(rider ? "Dispatch" : "My trips")} className="group w-full rounded-2xl bg-paper p-4 text-left transition hover:bg-[#eef4ef]"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">{fmtTime(upcoming[0].scheduledTime)}</span><Badge value={upcoming[0].status}/></div><Route trip={upcoming[0]} compact/><div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500"><span className="truncate">{upcoming[0].passengers.length} people · {rider ? upcoming[0].requesterName : "Group ride"}</span><ChevronRight className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5" size={16}/></div></button> : <div className="rounded-2xl bg-paper px-4 py-5 text-sm text-slate-500">{rider ? "No rides are scheduled for you yet." : "Your next confirmed ride will show up here."}</div>}
              {rider && <button onClick={() => setView("Dispatch")} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline">Open dispatch <ArrowRight size={14}/></button>}
            </section>
          </section>

          <section aria-label="Trip summary" className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-white py-3 shadow-sm shadow-slate-900/[.02]">
            {(rider ? [{ label: "Waiting", value: pending.length, icon: Clock3 }, { label: "Completed", value: completed.length, icon: BadgeCheck }, { label: "Today", value: trips.filter(isToday).length, icon: CalendarDays }] : [{ label: "Upcoming", value: trips.filter(t => ["accepted", "boarding"].includes(t.status)).length, icon: Clock3 }, { label: "Completed", value: completed.length, icon: BadgeCheck }, { label: "Missed", value: trips.filter(t => t.passengers.some(p => p.name.toLowerCase() === user.name.toLowerCase() && p.boardingStatus === "missed")).length, icon: ArrowDownLeft }]).map(item => <div key={item.label} className="flex items-center justify-center gap-2 px-2 sm:gap-3"><span className="hidden size-9 place-items-center rounded-xl bg-sage text-forest sm:grid"><item.icon size={16}/></span><div><div className="text-lg font-semibold leading-5">{item.value}</div><div className="mt-1 text-[10px] font-medium text-slate-500 sm:text-xs">{item.label}</div></div></div>)}
          </section>

          {rider && active && <ActiveTrip trip={active} busy={busy} onAction={riderAction}/>}
          {rider && <section className="overflow-hidden rounded-3xl border border-line bg-white"><SectionTitle title="Needs your attention" detail={`${pending.length} request${pending.length === 1 ? "" : "s"} waiting`} action="See dispatch" onAction={() => setView("Dispatch")}/>{pending.length ? <div className="divide-y divide-line">{pending.slice(0, 3).map(t => <RequestRow key={t._id} trip={t} onAccept={() => riderAction(t._id, "accept")} busy={busy}/>)}</div> : <Empty icon={Check} title="No waiting requests" detail="You’re up to date. New requests will appear here."/>}</section>}
          <section className="overflow-hidden rounded-3xl border border-line bg-white"><SectionTitle title={rider ? "Recently handled" : "Recent trips"} detail={rider ? "Your latest Toto activity" : "Your latest campus journeys"} action="View all" onAction={() => setView(rider ? "History" : "My trips")}/>{trips.length ? <div className="divide-y divide-line">{trips.slice(0, 4).map(t => <TripRow key={t._id} trip={t} rider={!!rider} user={user}/>)}</div> : <Empty icon={Compass} title="Your trip list is clear" detail={rider ? "Accepted and completed trips will appear here." : "Your ride requests and updates will appear here."}/>}</section>
        </div>}

        {view === "My trips" && <section className="overflow-hidden rounded-3xl border border-line bg-white"><SectionTitle title="Your trips" detail={`${trips.length} trip${trips.length === 1 ? "" : "s"} in your desk`}/>{trips.length ? <div className="divide-y divide-line">{trips.map(t => <TripRow key={t._id} trip={t} rider={false} user={user} expanded/>)}</div> : <Empty icon={Compass} title="No trips yet" detail="Plan your first group ride and its status will be easy to find here." action="Request a ride" onAction={() => setRequestOpen(true)}/>}</section>}

        {view === "History" && <section className="overflow-hidden rounded-3xl border border-line bg-white"><SectionTitle title={rider ? "Toto history" : "Your journey history"} detail={rider ? "Every request handled by this Toto" : "Trips include rides where you joined someone else’s request."}/>{history.length ? <div className="divide-y divide-line">{history.map(t => <TripRow key={t._id} trip={t} rider={!!rider} user={user} expanded/>)}</div> : <Empty icon={History} title="Your history is clear" detail="Completed rides and trip outcomes will be saved here."/>}</section>}

        {view === "Dispatch" && <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-sage text-forest"><Users size={18}/></span><div><b className="block text-sm">{pending.length} requests waiting</b><span className="text-xs text-slate-500">One Toto · same-time requests clash automatically</span></div></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800">{trips.filter(isToday).length} today</span></div>
          {active && <ActiveTrip trip={active} busy={busy} onAction={riderAction}/>}
          {trips.filter(t => t.status === "accepted").map(t => <TripRow key={t._id} trip={t} rider user={user} onStart={() => riderAction(t._id, "start")} expanded/>)}
          <section className="overflow-hidden rounded-3xl border border-line bg-white"><SectionTitle title="Incoming requests" detail="Review the group and timing before you accept."/>{pending.length ? <div className="divide-y divide-line">{pending.map(t => <RequestRow key={t._id} trip={t} onAccept={() => riderAction(t._id, "accept")} busy={busy}/>)}</div> : <Empty icon={Check} title="No requests waiting" detail="Accepted trips stay on your dispatch until they’re completed."/>}</section>
          <section className="overflow-hidden rounded-3xl border border-line bg-white"><SectionTitle title="Recently completed" detail="Finished Toto trips"/>{completed.length ? <div className="divide-y divide-line">{completed.slice(0, 4).map(t => <TripRow key={t._id} trip={t} rider user={user}/>)}</div> : <Empty icon={History} title="Nothing completed yet" detail="Completed trips will appear here for quick reference."/>}</section>
        </div>}

        {view === "Copilot" && <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-line bg-white shadow-sm shadow-slate-900/[.025]"><div className="flex items-center gap-3 border-b border-line p-4 sm:p-5"><span className="grid size-10 place-items-center rounded-2xl bg-sage text-forest"><Bot size={19}/></span><div><h2 className="text-sm font-semibold">Mobility Copilot</h2><p className="mt-0.5 text-xs text-slate-500">Answers use your saved trip data</p></div><span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">READY</span></div><div className="min-h-64 space-y-4 bg-[#f8faf8] p-4 sm:p-6"><div className="max-w-[90%] rounded-2xl rounded-tl-md border border-line bg-white p-4 text-sm leading-6 text-slate-700">Hi {user.name.split(" ")[0]}. Ask about your trips{rider ? ", today’s dispatch" : " and missed rides"}, or describe a ride you want to request.</div>{answer && <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-[#e5f1e8] p-4 text-sm leading-6 text-forest">{answer}</div>}{draft && <div className="max-w-[92%] rounded-2xl border border-emerald-100 bg-white p-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-800">Ride draft · review before sending</div><Route trip={{ ...draft, _id: "draft", requesterId: user.id, requesterName: user.name, passengers: draft.passengers.map(name => ({ name, boardingStatus: "pending" })), status: "requested", createdAt: "" }} compact/><p className="mt-2 text-xs text-slate-500">{fmtDate(draft.scheduledDate)} · {fmtTime(draft.scheduledTime)} · {user.name}{draft.passengers.length ? `, ${draft.passengers.join(", ")}` : ""}</p><button onClick={() => { setForm({ ...draft, passengers: draft.passengers.join(", ") }); setRequestOpen(true); }} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-xs font-semibold text-white">Review request <ArrowRight size={14}/></button></div>}</div><div className="border-t border-line p-4 sm:p-5"><div className="mb-3 flex flex-wrap gap-2">{["Show my missed trips", "How many trips this week?", rider ? "What’s happening today?" : "How many trips to Station?"].map(s => <button key={s} onClick={() => setPrompt(s)} className="rounded-full border border-line bg-white px-3 py-2 text-[11px] font-medium text-slate-600 transition hover:bg-paper">{s}</button>)}</div><form onSubmit={askCopilot} className="flex gap-2"><input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ask about your campus rides…" className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-sm outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/5"/><button disabled={busy} aria-label="Send to Copilot" className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest text-white transition hover:bg-[#174c3b] disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={18}/> : <Send size={17}/>}</button></form><p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400"><ShieldCheck size={13}/> Copilot only accesses data allowed for your role.</p></div></section>}
      </section>
    </div>

    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden"><NavItems nav={nav} active={view} onSelect={setView}/></nav>

    {requestOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) setRequestOpen(false); }}><form onSubmit={requestRide} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7"><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden"/><div className="mb-6 flex items-start justify-between gap-3"><div><span className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-forest"><Sparkles size={12}/>One request for your group</span><h2 className="text-xl font-semibold tracking-tight">Plan a ride</h2><p className="mt-1 text-sm text-slate-500">Choose where and when. You can review everything before sending.</p></div><button type="button" onClick={() => setRequestOpen(false)} aria-label="Close request form" className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-slate-500 hover:bg-slate-100"><X size={17}/></button></div><div className="space-y-5"><fieldset><legend className="mb-2 text-xs font-semibold text-slate-700">Route</legend><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-line p-2"><label className="px-2 py-1"><span className="mb-1 block text-[10px] text-slate-400">FROM</span><select value={form.from} onChange={e => setForm({ ...form, from: e.target.value as Place })} className="w-full bg-transparent text-sm font-semibold outline-none">{places.map(p => <option key={p}>{p}</option>)}</select></label><ArrowRight size={16} className="text-slate-400"/><label className="px-2 py-1"><span className="mb-1 block text-[10px] text-slate-400">TO</span><select value={form.to} onChange={e => setForm({ ...form, to: e.target.value as Place })} className="w-full bg-transparent text-sm font-semibold outline-none">{places.map(p => <option key={p}>{p}</option>)}</select></label></div></fieldset><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-700">Date<input required type="date" min={today} value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} className="mt-2 h-12 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-forest"/></label><label className="text-xs font-semibold text-slate-700">Time<input required type="time" value={form.scheduledTime} onChange={e => setForm({ ...form, scheduledTime: e.target.value })} className="mt-2 h-12 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-forest"/></label></div><label className="block text-xs font-semibold text-slate-700">Group members <span className="font-normal text-slate-400">· optional</span><input value={form.passengers} onChange={e => setForm({ ...form, passengers: e.target.value })} placeholder="Names separated by commas" className="mt-2 h-12 w-full rounded-xl border border-line px-3 text-sm outline-none placeholder:text-slate-400 focus:border-forest"/><span className="mt-1.5 block text-[11px] font-normal text-slate-500">You’re included automatically{form.passengers.trim() ? ` · Group of ${form.passengers.split(",").filter(x => x.trim()).length + 1}` : " · Add others to travel together"}.</span></label><div className="flex items-start gap-2 rounded-xl bg-paper p-3 text-xs leading-5 text-slate-600"><MapPin size={15} className="mt-0.5 shrink-0 text-forest"/><span><b className="text-ink">Pickup: College Gate</b><br/>Please allow a short walk to the designated pickup point.</span></div></div>{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}<div className="mt-6 flex gap-2"><button type="button" onClick={() => setRequestOpen(false)} className="h-12 flex-1 rounded-xl border border-line text-sm font-semibold text-slate-600 transition hover:bg-paper">Cancel</button><button disabled={busy} className="flex h-12 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-forest text-sm font-semibold text-white transition hover:bg-[#174c3b] disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={17}/> : <>Send ride request <ArrowRight size={16}/></>}</button></div></form></div>}
  </main>;
}

function Brand({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return <div className={`flex items-center gap-2.5 ${className}`}><span className="grid size-9 place-items-center rounded-xl bg-sage text-forest"><Bike size={19}/></span><span><b className="block text-[13px] font-bold tracking-tight text-ink">mobility desk</b>{!compact && <small className="text-[9px] font-semibold uppercase tracking-[.15em] text-slate-400">Campus transit</small>}</span></div>;
}
function UserControl({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return <div className="mt-4 flex items-center gap-3 border-t border-line pt-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-sage text-xs font-bold text-forest">{user.name.split(" ").map(x => x[0]).join("").slice(0,2)}</span><span className="min-w-0 flex-1"><b className="block truncate text-xs">{user.name}</b><small className="text-[10px] capitalize text-slate-500">{user.role}</small></span><button onClick={onSignOut} title="Sign out" aria-label="Sign out" className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-paper"><LogOut size={16}/></button></div>;
}
function TotoState({ active, upcoming }: { active?: Trip; upcoming?: Trip }) {
  return <div className="rounded-2xl bg-paper p-4"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span className={`size-2 rounded-full ${active ? "bg-orange-500" : upcoming?.status === "accepted" ? "bg-amber-400" : "bg-emerald-500"}`}/>Toto status</div><div className="mt-2 text-sm font-semibold">{active ? "On trip" : upcoming?.status === "accepted" ? "Reserved" : "Available"}</div><div className="mt-1 text-[11px] text-slate-500">One vehicle · shared by all</div></div>;
}
function NavItems({ nav, active, onSelect, desktop = false }: { nav: { label: View; icon: typeof LayoutDashboard }[]; active: View; onSelect: (view: View) => void; desktop?: boolean }) {
  return <div className={`flex ${desktop ? "flex-col gap-1 px-3" : "justify-around gap-1"}`}>{nav.map(item => <button key={item.label} onClick={() => onSelect(item.label)} aria-current={active === item.label ? "page" : undefined} className={`flex items-center rounded-xl font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${desktop ? "w-full gap-3 px-3 py-3 text-sm" : "min-w-0 flex-1 flex-col gap-1 px-1 py-1.5 text-[10px]"} ${active === item.label ? "bg-sage text-forest" : "text-slate-500 hover:bg-paper hover:text-ink"}`}><item.icon size={desktop ? 17 : 19} strokeWidth={active === item.label ? 2.2 : 1.8}/><span className="truncate">{item.label === "Overview" ? "Home" : item.label === "My trips" ? "Trips" : item.label === "Copilot" ? "Ask" : item.label}</span></button>)}</div>;
}
function SectionTitle({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5"><div className="min-w-0"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 truncate text-xs text-slate-500">{detail}</p></div>{action && <button onClick={onAction} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-forest hover:underline">{action}<ChevronRight size={14}/></button>}</div>;
}
function Empty({ icon: Icon, title, detail, action, onAction }: { icon: typeof Compass; title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="px-5 py-9 text-center"><span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-paper text-slate-500"><Icon size={19}/></span><h3 className="text-sm font-semibold">{title}</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{detail}</p>{action && <button onClick={onAction} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-xs font-semibold text-white">{action}<ArrowRight size={14}/></button>}</div>;
}
function TripRow({ trip, rider, user, expanded = false, onStart }: { trip: Trip; rider: boolean; user: User; expanded?: boolean; onStart?: () => void }) {
  const ownPassenger = trip.passengers.find(p => p.userId === user.id || p.name.toLowerCase() === user.name.toLowerCase());
  return <article className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 sm:gap-4 sm:px-5"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper text-forest"><Compass size={17}/></div><div className="min-w-[170px] flex-1"><Route trip={trip} compact/><p className="mt-1.5 text-[11px] text-slate-500">{fmtDate(trip.scheduledDate)} · {fmtTime(trip.scheduledTime)}{rider ? ` · ${trip.requesterName}` : ""}</p>{expanded && <p className="mt-1 text-[11px] text-slate-500">{trip.passengers.length} people: {trip.passengers.map(p => `${p.name}${rider ? ` (${p.boardingStatus})` : ""}`).join(", ")}{!rider && ownPassenger ? ` · Your boarding: ${ownPassenger.boardingStatus}` : ""}</p>}{trip.status === "clashed" && <p className="mt-1 text-[11px] text-rose-700">Another trip had already reserved the Toto at this time.</p>}</div><Badge value={trip.status}/>{onStart && <button onClick={onStart} className="h-9 rounded-xl border border-line px-3 text-xs font-semibold text-forest hover:bg-sage">Start boarding</button>}</article>;
}
function RequestRow({ trip, onAccept, busy }: { trip: Trip; onAccept: () => void; busy: boolean }) {
  return <article className="px-4 py-4 sm:px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Route trip={trip} compact/><p className="mt-1.5 text-xs text-slate-500">{fmtDate(trip.scheduledDate)} · {fmtTime(trip.scheduledTime)} · from {trip.requesterName}</p></div><button onClick={onAccept} disabled={busy} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-forest px-3.5 text-xs font-semibold text-white transition hover:bg-[#174c3b] disabled:opacity-50">Accept <ArrowRight size={14}/></button></div><div className="mt-3 flex flex-wrap gap-1.5">{trip.passengers.map((p,i) => <span key={`${p.name}-${i}`} className="rounded-full bg-paper px-2.5 py-1 text-[10px] font-medium text-slate-600">{p.name}</span>)}</div></article>;
}
function ActiveTrip({ trip, busy, onAction }: { trip: Trip; busy: boolean; onAction: (id: string, action: string, index?: number, boarding?: Boarding) => void }) {
  return <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50 px-4 py-4 sm:px-5"><div><div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-800"><span className="size-2 animate-pulse rounded-full bg-emerald-600"/>Active ride</div><Route trip={trip} compact/></div><Badge value="boarding"/></div><div className="divide-y divide-line">{trip.passengers.map((person,index) => <div key={`${person.name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"><div><b className="text-sm">{person.name}</b><p className="mt-0.5 text-[10px] capitalize text-slate-500">{person.boardingStatus}</p></div><div className="flex gap-2"><button disabled={busy} onClick={() => onAction(trip._id,"boarding",index,"boarded")} aria-pressed={person.boardingStatus === "boarded"} className={`h-10 rounded-xl px-3 text-xs font-semibold transition ${person.boardingStatus === "boarded" ? "bg-emerald-100 text-emerald-900" : "border border-line text-slate-600 hover:bg-emerald-50"}`}>Boarded</button><button disabled={busy} onClick={() => onAction(trip._id,"boarding",index,"missed")} aria-pressed={person.boardingStatus === "missed"} className={`h-10 rounded-xl px-3 text-xs font-semibold transition ${person.boardingStatus === "missed" ? "bg-rose-100 text-rose-900" : "border border-line text-slate-600 hover:bg-rose-50"}`}>Missed</button></div></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-4 sm:px-5"><p className="text-[11px] text-slate-500">Mark each passenger, then finish the ride.</p><button disabled={busy} onClick={() => onAction(trip._id,"complete")} className="h-10 rounded-xl bg-forest px-4 text-xs font-semibold text-white hover:bg-[#174c3b] disabled:opacity-50">Complete trip</button></div></section>;
}
function SignIn({ onSubmit, busy, error }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; busy: boolean; error: string }) {
  return <main className="min-h-[100dvh] bg-paper lg:grid lg:grid-cols-[.9fr_1.1fr]"><section className="relative hidden overflow-hidden bg-forest p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16"><Brand className="relative z-10"/><div className="relative z-10 max-w-lg"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-100"><span className="size-1.5 rounded-full bg-lime-300"/>One Toto · shared journeys</span><h1 className="mt-6 text-5xl font-semibold leading-[1.08] tracking-tight">Campus trips,<br/>all together.</h1><p className="mt-4 max-w-sm text-sm leading-6 text-emerald-50/75">One simple desk for rides between College, Station and Office.</p></div><p className="relative z-10 text-xs text-emerald-100/60">Internal Mobility Desk · Campus transit</p><div className="pointer-events-none absolute -bottom-40 -right-32 size-[30rem] rounded-full border border-white/10"/></section><section className="flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-8"><div className="w-full max-w-[390px]"><div className="mb-10 lg:hidden"><Brand/></div><span className="text-[10px] font-bold uppercase tracking-[.16em] text-forest">Welcome back</span><h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in to your desk</h2><p className="mt-2 text-sm text-slate-500">Your next shared ride is close by.</p><form onSubmit={onSubmit} className="mt-8 space-y-4"><label className="block text-xs font-semibold text-slate-700">Email<input name="email" type="email" autoComplete="username" required placeholder="you@campus.edu" className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/5"/></label><label className="block text-xs font-semibold text-slate-700">Password<input name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/5"/></label>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">{error}</p>}<button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest text-sm font-semibold text-white transition hover:bg-[#174c3b] disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={18}/> : <>Sign in <ArrowRight size={16}/></>}</button></form><div className="mt-6 rounded-2xl border border-line bg-white p-4 text-xs leading-5 text-slate-500"><b className="text-ink">Demo account?</b><p className="mt-1">Sample sign-in details are in the project README.</p></div></div></section></main>;
}
