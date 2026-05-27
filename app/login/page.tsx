'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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
    <div className="min-h-screen bg-black flex flex-col">
      {/* Red top bar */}
      <div className="h-1 w-full bg-[#E8192C]" />

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="flex items-center justify-center mb-14">
            <Image
              src="/logo-rimas.png"
              alt="Rimas"
              width={180}
              height={45}
              priority
            />
          </div>

          {/* Card */}
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] rounded-sm p-8">
            <p
              className="text-[#E8192C] text-xs font-bold uppercase tracking-[0.2em] mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Campaign Dashboard
            </p>
            <h2
              className="text-white text-2xl font-black uppercase mb-8"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Acceso Interno
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  className="block text-[#666] text-xs uppercase tracking-[0.15em] mb-2"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Código de Acceso
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="RIMAS-XXXX-XX"
                  className="w-full bg-black border border-[#2a2a2a] text-white placeholder-[#333] rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-[#E8192C] transition-colors font-mono tracking-widest"
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
                className="w-full bg-[#E8192C] hover:bg-[#c0101f] text-white font-black uppercase tracking-[0.15em] py-3 rounded-sm text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
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
