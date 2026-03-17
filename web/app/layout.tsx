"use client";

import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider,
} from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Rajdhani, Orbitron } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import "@mysten/dapp-kit/dist/index.css";

const { networkConfig } = createNetworkConfig({
  testnet: { url: "https://rpc-testnet.onelabs.cc:443", network: "testnet" },
  mainnet: { url: "https://rpc-mainnet.onelabs.cc:443", network: "mainnet" },
});

const queryClient = new QueryClient();
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
});
const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-orbitron",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${rajdhani.variable} ${orbitron.variable} ${rajdhani.className} bg-[#0a0a0f] text-white`}
      >
        <QueryClientProvider client={queryClient}>
          <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
            <WalletProvider>
              {children}
              <Toaster
                position="top-center"
                richColors
                theme="dark"
                toastOptions={{
                  style: {
                    fontFamily: "var(--font-rajdhani)",
                    background: "#1a1a2e",
                    border: "1px solid #2a2a3e",
                  },
                }}
              />
            </WalletProvider>
          </SuiClientProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
