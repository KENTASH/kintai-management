export function Footer({ loginDate }: { loginDate: string }) {
  return (
    <footer className="h-8 border-t py-1.5 bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600">
      <div className="container flex justify-between items-center px-4">
        <div className="text-xs text-gray-200">© NISZ HAMAMATSU 2025</div>
        <div className="text-xs text-gray-200">{loginDate}</div>
      </div>
    </footer>
  )
}