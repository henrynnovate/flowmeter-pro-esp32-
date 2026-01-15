import { NextRequest, NextResponse } from 'next/server';

let currentCommand: string = "";
let commandTimestamp: number = 0;
const COMMAND_TIMEOUT = 10000; // 10 seconds

export async function GET() {
  // Check if command has expired
  if (currentCommand && Date.now() - commandTimestamp > COMMAND_TIMEOUT) {
    currentCommand = "";
  }
  
  const cmd = currentCommand;
  console.log('ESP32 requested command:', cmd || 'none');
  
  // Only clear after ESP32 reads it
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
  
  return NextResponse.json({ success: true, command });
}