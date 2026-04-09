import { NextResponse } from "next/server";

import type { APIResponse } from "@/types";

interface HealthData {
  status: "ok";
  timestamp: string;
  version: string;
}

export async function GET(): Promise<NextResponse<APIResponse<HealthData>>> {
  const healthData: HealthData = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "1.0.0",
  };

  const response: APIResponse<HealthData> = {
    success: true,
    data: healthData,
    error: null,
    timestamp: healthData.timestamp,
  };

  return NextResponse.json(response, { status: 200 });
}