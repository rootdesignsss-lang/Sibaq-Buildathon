import type { Metadata } from "next";
import { Suspense } from "react";
import { Lato } from "next/font/google";
import SmoothScroll from "@/components/hireyou/smooth-scroll";
import "./globals.css";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "HIREYOU | Skills-first hiring",
  description: "Find work or hire through role-specific work samples, clear results, and direct conversations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${lato.variable} h-full antialiased`} data-scroll-behavior="smooth">
      <body className="min-h-full bg-[#080908] text-white">
        <Suspense fallback={null}>
          <SmoothScroll />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
