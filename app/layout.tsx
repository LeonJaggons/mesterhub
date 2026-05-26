import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Header from "./components/Header";
import FeedbackFab from "./components/FeedbackFab";
import JsonLd from "./components/JsonLd";
import ConditionalFooter from "./components/ConditionalFooter";
import { I18nProvider } from "@/lib/i18n/client";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";
import { homeMetadata, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

const googleSansFlex = localFont({
  src: "../public/GoogleSansFlex.ttf",
  variable: "--font-google-sans-flex",
  display: "swap",
  declarations: [
    { prop: "size-adjust", value: "88%" },
  ],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return homeMetadata(locale);
}

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
        <JsonLd data={[organizationJsonLd(), websiteJsonLd(locale)]} />
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <Header />
          {children}
          <ConditionalFooter />
          <FeedbackFab />
        </I18nProvider>
      </body>
    </html>
  );
}
