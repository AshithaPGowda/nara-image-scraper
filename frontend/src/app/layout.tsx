import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NARA Image Scraper',
  description: 'Download images from the National Archives catalog',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <main className="flex-grow">
          {children}
        </main>
        <footer className="bg-white/80 backdrop-blur-sm border-t border-blue-100 py-4 mt-auto">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-gray-600">
              Data from the{' '}
              <a
                href="https://catalog.archives.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                National Archives Catalog
              </a>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              © {new Date().getFullYear()} Ashitha. All rights reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
