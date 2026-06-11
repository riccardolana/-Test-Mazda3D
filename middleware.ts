/**
 * Vercel Edge Middleware — HTTP Basic Auth gate for the whole deployment
 * (pages, GLB, HDRIs, everything). Any username, password "mazda3D".
 * Hardcoded on purpose: this is a demo access gate, not real security.
 * Local `npm run dev` is unaffected (middleware only runs on Vercel).
 */
export const config = { matcher: "/(.*)" };

export default function middleware(request: Request): Response | undefined {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (password === "mazda3D") return undefined; // continue to the asset
  }
  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Mazda 3D Experience"' },
  });
}
