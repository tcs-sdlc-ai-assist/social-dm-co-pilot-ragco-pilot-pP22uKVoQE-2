/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.gravatar.com",
      },
    ],
  },
  experimental: {
    typedRoutes: true,
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  poweredByHeader: false,
};

const requiredServerEnvVars = [
  // Add required server-side env vars here as the project grows
  // e.g. "DATABASE_URL", "OPENAI_API_KEY"
];

const requiredPublicEnvVars = [
  // Add required NEXT_PUBLIC_ env vars here as the project grows
  // e.g. "NEXT_PUBLIC_APP_URL"
];

function validateEnv() {
  const missing = [];

  for (const envVar of requiredServerEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  for (const envVar of requiredPublicEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join("\n")}\n` +
        "Please add them to your .env.local file or deployment environment."
    );
  }
}

if (process.env.NODE_ENV === "production") {
  validateEnv();
}

export default nextConfig;