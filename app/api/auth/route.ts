import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import type { APIResponse, AuthUser } from "@/types";
import { UserRole } from "@/types";
import { generateToken, verifyToken, extractTokenFromHeader } from "@/lib/auth";

// ─── Simulated User Store (Pilot) ────────────────────────────────────────────

interface SimulatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password: string;
  avatarUrl: string | null;
  createdAt: string;
}

const SIMULATED_USERS: SimulatedUser[] = [
  {
    id: "user_admin_001",
    email: "admin@stockland.com.au",
    name: "Alex Morgan",
    role: UserRole.ADMIN,
    password: "admin123",
    avatarUrl: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "user_agent_001",
    email: "agent@stockland.com.au",
    name: "Sarah Mitchell",
    role: UserRole.AGENT,
    password: "agent123",
    avatarUrl: null,
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "user_reviewer_001",
    email: "reviewer@stockland.com.au",
    name: "James Chen",
    role: UserRole.REVIEWER,
    password: "reviewer123",
    avatarUrl: null,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "user_readonly_001",
    email: "readonly@stockland.com.au",
    name: "Emily Watson",
    role: UserRole.READONLY,
    password: "readonly123",
    avatarUrl: null,
    createdAt: "2024-02-15T00:00:00Z",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findUserByEmail(email: string): SimulatedUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  return SIMULATED_USERS.find((u) => u.email.toLowerCase() === normalizedEmail) ?? null;
}

function findUserByEmailAndRole(email: string, role: UserRole): SimulatedUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  return (
    SIMULATED_USERS.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.role === role,
    ) ?? null
  );
}

function toAuthUser(user: SimulatedUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    lastLoginAt: new Date().toISOString(),
  };
}

function errorResponse(
  message: string,
  status: number,
): NextResponse<APIResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

// ─── POST /api/auth — Login ──────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
): Promise<NextResponse<APIResponse<{ user: AuthUser; token: string } | null>>> {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return errorResponse("Invalid request body.", 400);
    }

    const { email, password, role } = body as {
      email?: string;
      password?: string;
      role?: string;
    };

    if (!email || typeof email !== "string" || email.trim().length === 0) {
      return errorResponse("Email is required.", 400);
    }

    if (!password || typeof password !== "string" || password.trim().length === 0) {
      return errorResponse("Password is required.", 400);
    }

    // Validate role if provided
    const validRoles = Object.values(UserRole) as string[];
    const requestedRole = role && validRoles.includes(role) ? (role as UserRole) : undefined;

    // Find user — if role is provided, match both email and role
    // For the pilot, any email that matches a simulated user is accepted
    // In production, this would validate against a real user store
    let user: SimulatedUser | null = null;

    if (requestedRole) {
      user = findUserByEmailAndRole(email, requestedRole);
      // If no exact match with role, fall back to email-only match
      if (!user) {
        user = findUserByEmail(email);
      }
    } else {
      user = findUserByEmail(email);
    }

    // For the pilot: accept any email/password combination
    // If the email doesn't match a simulated user, create a dynamic user
    if (!user) {
      const dynamicRole = requestedRole ?? UserRole.AGENT;
      const dynamicUser: SimulatedUser = {
        id: `user_${uuidv4().replace(/-/g, "").substring(0, 12)}`,
        email: email.trim().toLowerCase(),
        name: email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        role: dynamicRole,
        password: password,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      };
      user = dynamicUser;
    } else {
      // Validate password for known simulated users
      if (user.password !== password) {
        return errorResponse("Invalid email or password.", 401);
      }
    }

    // If a specific role was requested and differs from the user's default,
    // override the role for the session (pilot flexibility)
    const sessionRole = requestedRole ?? user.role;

    const authUser: AuthUser = {
      ...toAuthUser(user),
      role: sessionRole,
    };

    const token = await generateToken(authUser);

    const response: APIResponse<{ user: AuthUser; token: string }> = {
      success: true,
      data: {
        user: authUser,
        token,
      },
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return errorResponse("An unexpected error occurred during authentication.", 500);
  }
}

// ─── GET /api/auth — Validate Token & Return User Info ───────────────────────

export async function GET(
  request: NextRequest,
): Promise<NextResponse<APIResponse<AuthUser | null>>> {
  try {
    const authHeader = request.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return errorResponse("Missing or invalid authorization header.", 401);
    }

    const user = await verifyToken(token);

    if (!user) {
      return errorResponse("Invalid or expired token.", 401);
    }

    const response: APIResponse<AuthUser> = {
      success: true,
      data: user,
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return errorResponse("An unexpected error occurred during token validation.", 500);
  }
}