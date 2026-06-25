import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { UserProvider } from "@/components/user-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nordic Casino — Coin Games",
  description:
    "Wager your Nordic coins on Coin Flip and Mines. Log in with Discord — balances sync with the coin bot.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          forcedTheme="dark"
        >
          <UserProvider>
            <Header />
            <main>{children}</main>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
