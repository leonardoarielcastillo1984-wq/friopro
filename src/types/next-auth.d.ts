import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: "SUPER_ADMIN" | "TECHNICIAN";
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role?: "SUPER_ADMIN" | "TECHNICIAN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "SUPER_ADMIN" | "TECHNICIAN";
  }
}
