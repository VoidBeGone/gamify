import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { CelebrationManager } from "@/components/celebrations/CelebrationManager";
import { AppSidebar } from "@/components/nav/AppSidebar";
import { MobileNav } from "@/components/nav/MobileNav";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const displayFace = Space_Grotesk({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LevelUp",
  description: "Your personal progression cockpit.",
};

export const viewport: Viewport = {
  themeColor: "#0d0d0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${displayFace.variable} h-full`}
    >
      <body className="flex min-h-full antialiased">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          {/* pb-16 clears the fixed mobile nav on small screens */}
          <div className="flex-1 pb-16 md:pb-0">{children}</div>
        </div>
        <MobileNav />
        <CelebrationManager />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            },
          }}
        />
      </body>
    </html>
  );
}
