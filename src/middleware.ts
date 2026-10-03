export { default } from "next-auth/middleware";

export const config = {
  // "/admin" itself must be listed: the second pattern only matches paths
  // *under* /admin/, so the dashboard was reachable without logging in.
  // Login and the forgot/reset password pages must work while logged out, and
  // so must the admin app icons (the login page and home-screen installs load them).
  matcher: ["/admin", "/admin/((?!login|forgot-password|reset-password|icon|apple-icon).*)"],
};
