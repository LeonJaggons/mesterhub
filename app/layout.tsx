import type { Metadata } from "next";
import { Geist, Geist_Mono, Darker_Grotesque } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import FeedbackFab from "./components/FeedbackFab";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const darkerGrotesque = Darker_Grotesque({
  variable: "--font-darker-grotesque",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Mestermind",
  description: "Find trusted local professionals in Budapest.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${darkerGrotesque.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col root">
          <Header />
          {children}
          <FeedbackFab />
        </body>
    </html>
  );
}
