import './globals.css'

export const metadata = {
  title: 'Creator Ramp',
  description: 'Creator Ramp Prototype',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
