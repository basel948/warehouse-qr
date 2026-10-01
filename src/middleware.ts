export { default } from "next-auth/middleware";

export const config = {
  // "/admin" itself must be listed: the second pattern only matches paths
  // *under* /admin/, so the dashboard was reachable without logging in.
  // Login and the forgot/reset password pages must work while logged out.
  matcher: ["/admin", "/admin/((?!login|forgot-password|reset-password).*)"],
};
