'use client'

// La barra roja de marca es también el indicador de carga del sistema:
// en reposo es el gradiente Encendido; cargando, un destello la recorre.
export default function LaserBar({ loading = false }: { loading?: boolean }) {
  return <div className={`laser ${loading ? 'laser-loading' : ''}`} aria-hidden />
}
