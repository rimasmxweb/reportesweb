import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!)

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ['/dashboard/:path*'],
}
