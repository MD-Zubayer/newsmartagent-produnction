import { NextResponse } from "next/server";

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // ONLY access token check
  const token = request.cookies.get("access_token")?.value;

  const isLoggedIn = !!token;

  console.log("Path:", pathname, "AccessToken:", isLoggedIn);

  if (pathname.startsWith("/dashboard") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/signup", request.url));
  }

  if (pathname === "/signup" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/signup"],
};
