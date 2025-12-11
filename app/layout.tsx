import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "photos by erica hu",
  description: "the lightness of noticing",
  generator: "v0.app",
  metadataBase: new URL("https://photo.erica-hu.com"),
  openGraph: {
    title: "photos by erica hu",
    description: "the lightness of noticing",
    url: "https://photo.erica-hu.com",
    siteName: "photos by erica hu",
    images: [
      {
        url: "/preview-image.png",
        width: 1200,
        height: 630,
        alt: "photos by erica hu",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "photos by erica hu",
    description: "the lightness of noticing",
    images: ["/preview-image.png"],
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
