import { NextRequest, NextResponse } from 'next/server';

const DEVICE_API_KEY = process.env.DEVICE_API_KEY!;
let currentCommand = "";
let commandTimestamp = 0;
const COMMAND_TIMEOUT = 10000;

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');

  if (apiKey !== DEVICE_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (currentCommand && Date.now() - commandTimestamp > COMMAND_TIMEOUT) {
    currentCommand = "";
    commandTimestamp = 0;
  }

  const cmd = currentCommand;

  if (cmd) {
    currentCommand = "";
    commandTimestamp = 0;
  }

  return new Response(cmd, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
}

export async function POST(request: NextRequest) {
  const { command } = await request.json();
  currentCommand = command;
  commandTimestamp = Date.now();

  console.log('Command set:', command);
  return NextResponse.json({ success: true });
}
