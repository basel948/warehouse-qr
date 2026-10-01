export { default } from "next-auth/middleware";

export const config = {
  // Login and the forgot/reset password pages must work while logged out.
  matcher: ["/admin/((?!login|forgot-password|reset-password).*)"],
};
