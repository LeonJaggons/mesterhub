import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Header from "./components/Header";
import FeedbackFab from "./components/FeedbackFab";
import ConditionalFooter from "./components/ConditionalFooter";
import { I18nProvider } from "@/lib/i18n/client";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";
import { Analytics } from "@vercel/analytics/next";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html
      lang={locale}
      className={`${googleSansFlex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col root">
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <Header />
          {children}
          <ConditionalFooter />
          <FeedbackFab />
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
