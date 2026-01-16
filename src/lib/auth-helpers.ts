import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  return {
    id: (session.user as any).id as string | undefined,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: (session.user as any).role as "SUPER_ADMIN" | "TECHNICIAN" | undefined,
  };
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.role) redirect("/login");

  return {
    id: user.id ?? "",
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
