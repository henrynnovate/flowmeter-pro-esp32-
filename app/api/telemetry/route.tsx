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

const DEVICE_API_KEY = process.env.DEVICE_API_KEY!;
let latestData: TelemetryData | null = null;

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');

  if (apiKey !== DEVICE_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized device' },
      { status: 401 }
    );
  }

  try {
    latestData = await request.json();
    console.log('Received telemetry:', latestData);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Invalid payload' },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json(latestData || {});
}
