import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { previewLandingPath, previewSkipsAccessGate } from './lib/previewAccess'

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!)

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Temporal para preview. En producción este bloque no corre y el código de acceso sigue igual.
  if (previewSkipsAccessGate()) {
    if (pathname === '/' || pathname === '/login') {
      return NextResponse.redirect(new URL(previewLandingPath(), request.url))
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('rimas_session')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    try {
      await jwtVerify(token, SECRET)
      return NextResponse.next()
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
}
