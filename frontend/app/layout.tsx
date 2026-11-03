import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Firefly | A personal cloud, built at home",
  description: "A personal platform-as-a-service for learning, building, and hosting projects on hardware I own. Follow the Phoenix Firefly build.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
