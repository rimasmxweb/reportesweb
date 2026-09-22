import Link from 'next/link'

const C = { fontFamily: "'Barlow Condensed', sans-serif" }

export default function DashboardNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg-page)' }}>
      <p className="text-[#E8192C] text-xs uppercase tracking-[0.35em] font-bold mb-3" style={C}>
        Rimas MX
      </p>
      <h1 className="text-[#0a0a0b] text-4xl sm:text-5xl font-black uppercase tracking-wide" style={C}>
        No encontramos esta página
      </h1>
      <p className="text-[#5b5b63] text-sm mt-3 max-w-md">
        El artista o el lanzamiento no existe, o no está en tu acceso.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center h-10 px-5 rounded-full text-white text-xs uppercase tracking-widest font-bold"
        style={{ ...C, background: 'var(--grad-encendido)', boxShadow: 'var(--shadow-red-glow)' }}
      >
        Volver a artistas
      </Link>
    </div>
  )
}
