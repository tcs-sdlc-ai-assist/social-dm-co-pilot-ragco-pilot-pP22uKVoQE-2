import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { AuthUser } from "@/types";
import { UserRole } from "@/types";
import { config } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";
import type { APIResponse } from "@/types";

// ─── JWT Secret Encoding ─────────────────────────────────────────────────────

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(config.jwt.secret);
}

// ─── Token Payload Interface ─────────────────────────────────────────────────

interface TokenPayload extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

// ─── Parse Expiry String ─────────────────────────────────────────────────────

function parseExpiresIn(expiresIn: string): string {
  // jose accepts strings like "8h", "1d", "30m" directly
  return expiresIn;
}

// ─── Token Generation ────────────────────────────────────────────────────────

/**
 * Generates a signed JWT token for the given authenticated user.
 * The token includes user identity and role claims.
 */
export async function generateToken(user: AuthUser): Promise<string> {
  const secretKey = getSecretKey();
  const expiresIn = parseExpiresIn(config.jwt.expiresIn);

  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  } satisfies Omit<TokenPayload, "iat" | "exp" | "iss">)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer("social-dm-copilot")
    .sign(secretKey);

  return token;
}

// ─── Token Verification ──────────────────────────────────────────────────────

/**
 * Verifies a JWT token and returns the AuthUser if valid.
 * Returns null if the token is invalid, expired, or malformed.
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const secretKey = getSecretKey();

    const { payload } = await jwtVerify(secretKey instanceof Uint8Array ? token : token, secretKey, {
      issuer: "social-dm-copilot",
    });

    const tokenPayload = payload as TokenPayload;

    if (!tokenPayload.sub || !tokenPayload.email || !tokenPayload.role) {
      return null;
    }

    // Validate role is a known UserRole
    const validRoles: string[] = Object.values(UserRole);
    if (!validRoles.includes(tokenPayload.role)) {
      return null;
    }

    const user: AuthUser = {
      id: tokenPayload.sub,
      email: tokenPayload.email,
      name: tokenPayload.name ?? "",
      role: tokenPayload.role as UserRole,
      avatarUrl: tokenPayload.avatarUrl ?? null,
      createdAt: tokenPayload.createdAt ?? new Date().toISOString(),
      lastLoginAt: tokenPayload.lastLoginAt ?? null,
    };

    return user;
  } catch {
    return null;
  }
}

// ─── Token Extraction ────────────────────────────────────────────────────────

/**
 * Extracts the Bearer token from an Authorization header string.
 * Returns null if the header is missing, empty, or not in "Bearer <token>" format.
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const trimmed = authHeader.trim();

  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = trimmed.slice(7).trim();

  if (token.length === 0) {
    return null;
  }

  return token;
}

// ─── Error Response Helpers ──────────────────────────────────────────────────

function unauthorizedResponse(message: string = "Unauthorized"): NextResponse<APIResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status: 401 },
  );
}

function forbiddenResponse(message: string = "Forbidden"): NextResponse<APIResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status: 403 },
  );
}

// ─── Auth Context Type ───────────────────────────────────────────────────────

export interface AuthenticatedRequest extends NextRequest {
  user?: AuthUser;
}

// ─── Route Handler Types ─────────────────────────────────────────────────────

type RouteHandlerContext = { params: Record<string, string> };

type AuthenticatedRouteHandler = (
  request: NextRequest,
  context: RouteHandlerContext & { user: AuthUser },
) => Promise<NextResponse>;

// ─── withAuth Middleware ─────────────────────────────────────────────────────

/**
 * Higher-order function that wraps an API route handler with JWT authentication.
 * Validates the Bearer token from the Authorization header and injects the
 * authenticated user into the handler context.
 *
 * Optionally accepts an array of allowed roles for role-based access control.
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (request, context) => {
 *   const { user } = context;
 *   // user is guaranteed to be a valid AuthUser
 *   return NextResponse.json({ success: true, data: user });
 * }, [UserRole.ADMIN, UserRole.AGENT]);
 * ```
 */
export function withAuth(
  handler: AuthenticatedRouteHandler,
  allowedRoles?: UserRole[],
): (request: NextRequest, context?: RouteHandlerContext) => Promise<NextResponse> {
  return async (
    request: NextRequest,
    context?: RouteHandlerContext,
  ): Promise<NextResponse> => {
    // Extract token from Authorization header
    const authHeader = request.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return unauthorizedResponse("Missing or invalid authorization header");
    }

    // Verify token and extract user
    const user = await verifyToken(token);

    if (!user) {
      return unauthorizedResponse("Invalid or expired token");
    }

    // Check role-based access control
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.role)) {
        return forbiddenResponse(
          `Access denied. Required role: ${allowedRoles.join(" or ")}`,
        );
      }
    }

    // Call the handler with the authenticated user in context
    const handlerContext: RouteHandlerContext & { user: AuthUser } = {
      params: context?.params ?? {},
      user,
    };

    return handler(request, handlerContext);
  };
}