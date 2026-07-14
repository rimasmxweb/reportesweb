'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import LaserBar from '../components/LaserBar'

const C = { fontFamily: "'Barlow Condensed', sans-serif" }

export default function LoginPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Código incorrecto')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      <LaserBar loading={loading} />

      {/* Orbe ambiental */}
      <div
        className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgb(232 25 44 / .28), transparent 65%)',
          animation: 'float-orb 14s ease-in-out infinite',
        }}
      />

      {/* Marca de agua outline */}
      <p
        aria-hidden
        className="absolute bottom-[-4vw] left-0 whitespace-nowrap pointer-events-none select-none text-[26vw] font-black uppercase leading-none"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          WebkitTextStroke: '1px rgba(255,255,255,.05)',
          color: 'transparent',
        }}
      >
        RIMAS
      </p>

      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="flex items-center justify-center mb-14">
            <Image
              src="/logo-rimas.png"
              alt="Rimas"
              width={180}
              height={45}
              priority
              style={{ height: 'auto' }}
            />
          </div>

          {/* Card */}
          <div
            key={error || 'ok'}
            className={`rounded-2xl bg-[#0e0e10] border border-[#222226] p-8 shadow-[0_24px_60px_-20px_rgb(0_0_0/.8)] animate-rise relative ${error ? 'animate-shake' : ''}`}
          >
            <p className="text-[#E8192C] text-xs font-bold uppercase tracking-[0.2em] mb-1" style={C}>
              Campaign Dashboard
            </p>
            <h2 className="text-white text-2xl font-black uppercase mb-8" style={C}>
              Acceso Interno
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  className="block text-[#666] text-xs uppercase tracking-[0.15em] mb-2"
                  style={C}
                >
                  Código de Acceso
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="RIMAS-XXXX-XX"
                  className="w-full bg-black border border-[#2a2a2a] text-white placeholder-[#333] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E8192C] focus:shadow-[var(--shadow-red-halo)] transition-all font-mono tracking-widest"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-[#E8192C] text-xs text-center tracking-wide">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !code}
                className={`w-full text-white font-black uppercase tracking-[0.15em] py-3 rounded-xl text-sm relative overflow-hidden hover:brightness-110 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${loading ? 'sweep-once sweep-loop' : ''}`}
                style={{ ...C, background: 'var(--grad-encendido)', boxShadow: 'var(--shadow-red-glow)' }}
              >
                {loading ? 'Verificando...' : 'Ingresar'}
              </button>
            </form>
          </div>

          <p className="text-center text-[#333] text-xs mt-6 tracking-wider">
            RIMAS ENTERTAINMENT · MX
          </p>
        </div>
      </div>
    </div>
  )
}
