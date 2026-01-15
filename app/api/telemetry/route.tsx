import { NextRequest, NextResponse } from 'next/server';

interface TelemetryData {
  timestamp: number;
  pulses: number;
  flowRate: number;
  sessionVolume: number;
  totalVolume: number;
  batteryVoltage: number;
  batteryPercent: number;
  wifiRSSI: number;
  flowState: string;
}

let latestData: TelemetryData | null = null;
let command: string = "";

export async function POST(request: NextRequest) {
  latestData = await request.json();
  console.log('Received telemetry data:', latestData);
  return NextResponse.json({ success: true });
}

export async function GET() {
  console.log('Sending telemetry data:', latestData);
  return NextResponse.json(latestData || {});
}