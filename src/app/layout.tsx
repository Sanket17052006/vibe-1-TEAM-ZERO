import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Internal Mobility Desk", description: "One Toto. Every campus journey." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
