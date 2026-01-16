import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/auth-secret";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdmin = pathname.startsWith("/admin");
  const isWorkOrders = pathname.startsWith("/workorders");
  const isClients = pathname.startsWith("/clients");
  const isEquipments = pathname.startsWith("/equipments");
  const isStats = pathname.startsWith("/stats");
  const isAccount = pathname.startsWith("/account");
  const isCheckout = pathname.startsWith("/checkout");
  const isPayments = pathname.startsWith("/payments");

  if (
    !isAdmin &&
    !isWorkOrders &&
    !isClients &&
    !isEquipments &&
    !isStats &&
    !isAccount &&
    !isCheckout &&
    !isPayments
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: getAuthSecret(),
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isWorkOrders || isClients || isEquipments || isStats || isAccount || isCheckout || isPayments) {
    return NextResponse.next();
  }

  const role = (token as any).role as string | undefined;

  if (role !== "SUPER_ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/workorders/:path*",
    "/clients/:path*",
    "/equipments/:path*",
    "/stats",
    "/account/:path*",
    "/checkout",
    "/payments",
  ],
};
