import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Header from "./components/Header";
import FeedbackFab from "./components/FeedbackFab";
import ConditionalFooter from "./components/ConditionalFooter";

const googleSansFlex = localFont({
  src: "../public/GoogleSansFlex.ttf",
  variable: "--font-google-sans-flex",
  display: "swap",
  declarations: [
    { prop: "size-adjust", value: "88%" },
  ],
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
      className={`${googleSansFlex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col root">
          <Header />
          {children}
          <ConditionalFooter />
          <FeedbackFab />
        </body>
    </html>
  );
}
