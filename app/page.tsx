"use client";

import { useEffect, useState } from 'react';

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

export default function FlowMonitor() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [history, setHistory] = useState<TelemetryData[]>([]); // Last 60s for chart
  const [sessionData, setSessionData] = useState<TelemetryData[]>([]); // Full session data
  const [commandStatus, setCommandStatus] = useState<string>("");

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/telemetry');
      const json = await res.json();
      
      if (json && json.timestamp) {
        setData(json as TelemetryData);
        setHistory(prev => [...prev.slice(-59), json as TelemetryData]); // Last 60s for chart
        setSessionData(prev => [...prev, json as TelemetryData]); // Store ALL session data
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const sendCommand = async (command: string) => {
    setCommandStatus(`Sending ${command}...`);
    try {
      const res = await fetch('/api/telemetry/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (res.ok) {
        setCommandStatus(`✓ ${command} sent! Waiting for ESP32...`);
        
        // If resetting session, clear session data after export
        if (command === 'RESET_SESSION') {
          // Wait a bit for ESP32 to process
          setTimeout(() => {
            setSessionData([]);
            setCommandStatus(`✓ Session reset complete!`);
            setTimeout(() => setCommandStatus(""), 2000);
          }, 6000); // Wait 6 seconds for ESP32 to read command
        } else {
          setTimeout(() => setCommandStatus(""), 3000);
        }
      }
    } catch (error) {
      setCommandStatus(`✗ Failed to send command`);
      setTimeout(() => setCommandStatus(""), 3000);
    }
  };

  const exportData = () => {
    if (sessionData.length === 0) {
      alert('No session data to export yet!');
      return;
    }
    
    const csv = [
      'Timestamp,Date Time,Flow Rate (L/min),Session Volume (L),Battery (%),WiFi (dBm),State',
      ...sessionData.map(d => 
        `${d.timestamp},${new Date(d.timestamp * 1000).toISOString()},${d.flowRate},${d.sessionVolume},${d.batteryPercent},${d.wifiRSSI},${d.flowState}`
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    setCommandStatus(`✓ Exported ${sessionData.length} readings!`);
    setTimeout(() => setCommandStatus(""), 3000);
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Waiting for data...</div>
      </div>
    );
  }

  const getFlowColor = (flowRate: number): string => {
    if (flowRate < 0.1) return 'text-slate-400';
    if (flowRate < 2) return 'text-blue-400';
    if (flowRate < 5) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getBatteryColor = (percent: number): string => {
    if (percent > 60) return 'bg-green-500';
    if (percent > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSignalColor = (rssi: number): string => {
    if (rssi > -60) return 'text-green-400';
    if (rssi > -70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getFlowStateBadge = (state: string) => {
    const colors = {
      'NO_FLOW': 'bg-slate-500/20 text-slate-400',
      'STEADY': 'bg-green-500/20 text-green-400',
      'TRANSIENT': 'bg-yellow-500/20 text-yellow-400'
    };
    return colors[state as keyof typeof colors] || 'bg-gray-500/20 text-gray-400';
  };

  const FLOW_CHART_MAX = 25; // L/min 
  const Y_AXIS_STEPS = 4;

  const getBarColor = (flow: number) => {
    if (flow < 4) return 'bg-slate-500';
    if (flow < 10) return 'bg-blue-500';
    if (flow < 20) return 'bg-green-500';
    return 'bg-yellow-500';
  };


  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Actions */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Flow Monitor</h1>
            <p className="text-slate-400">Real-time Flow Monitor • YF-S201B + ESP32</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => sendCommand('RESET_SESSION')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            >
              Reset Session
            </button>
            <button
              onClick={() => sendCommand('RESET_TOTAL')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Reset Total
            </button>
          </div>
        </div>

        {/* Command Status */}
        {commandStatus && (
          <div className="mb-6 p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-sm">
            {commandStatus}
          </div>
        )}

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Flow Rate */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-slate-400 text-sm mb-2">Flow Rate</div>
            <div className={`text-4xl font-bold ${getFlowColor(data.flowRate ?? 0)}`}>
              {(data.flowRate ?? 0).toFixed(2)}
            </div>
            <div className="text-slate-500 text-sm mt-1">L/min</div>
            <div className="mt-3">
              <span className={`px-2 py-1 rounded text-xs ${getFlowStateBadge(data.flowState)}`}>
                {data.flowState}
              </span>
            </div>
          </div>

          {/* Session Volume */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-slate-400 text-sm mb-2">Session Volume</div>
            <div className="text-4xl font-bold text-purple-400">
              {(data.sessionVolume ?? 0).toFixed(2)}
            </div>
            <div className="text-slate-500 text-sm mt-1">Litres</div>
            <div className="text-slate-500 text-xs mt-3">
              Current batch
            </div>
          </div>

          {/* Total Volume */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-slate-400 text-sm mb-2">Total Volume</div>
            <div className="text-4xl font-bold text-blue-400">
              {(data.totalVolume ?? 0).toFixed(2)}
            </div>
            <div className="text-slate-500 text-sm mt-1">Litres</div>
            <div className="text-slate-500 text-xs mt-3">
              {data.pulses ?? 0} pulses
            </div>
          </div>

          {/* Battery */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-slate-400 text-sm mb-2">Battery</div>
            <div className="flex items-end gap-2 mb-2">
              <div className="text-4xl font-bold text-white">
                {data.batteryPercent ?? 0}%
              </div>
              <div className="text-slate-500 text-sm mb-2">
                {(data.batteryVoltage ?? 0).toFixed(2)}V
              </div>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mt-3">
              <div 
                className={`h-2 rounded-full transition-all ${getBatteryColor(data.batteryPercent ?? 0)}`}
                style={{ width: `${data.batteryPercent ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* WiFi Signal */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-slate-400 text-sm mb-2">WiFi Signal</div>
            <div className="flex items-center justify-between">
              <div className={`text-3xl font-bold ${getSignalColor(data.wifiRSSI ?? -100)}`}>
                {data.wifiRSSI ?? -100} dBm
              </div>
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-2 rounded ${
                      (data.wifiRSSI ?? -100) > -60 - (i * 10) 
                        ? getSignalColor(data.wifiRSSI ?? -100).replace('text-', 'bg-')
                        : 'bg-slate-700'
                    }`}
                    style={{ height: `${(i + 1) * 8}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Uptime */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-slate-400 text-sm mb-2">Uptime</div>
            <div className="text-3xl font-bold text-white">
              {Math.floor(data.timestamp / 3600)}h {Math.floor((data.timestamp % 3600) / 60)}m
            </div>
            <div className="text-slate-500 text-sm mt-1">
              {data.timestamp % 60}s
            </div>
          </div>

          {/* Pulses */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="text-slate-400 text-sm mb-2">Current Reading</div>
            <div className="text-3xl font-bold text-cyan-400">
              {data.pulses ?? 0}
            </div>
            <div className="text-slate-500 text-sm mt-1">pulses/sec</div>
          </div>
        </div>

        {/* Flow Chart */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Flow History (60s)</h2>
            <div className="text-sm text-slate-400">
              Scale: 0 – {FLOW_CHART_MAX} L/min
            </div>
          </div>

          <div className="relative h-52 flex items-end">
            {/* Y-axis labels + grid */}
            <div className="absolute inset-0 flex flex-col justify-between text-xs text-slate-500 pointer-events-none">
              {[...Array(Y_AXIS_STEPS + 1)].map((_, i) => {
                const value = FLOW_CHART_MAX - (i * FLOW_CHART_MAX) / Y_AXIS_STEPS;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-10 text-right">{value.toFixed(0)}</span>
                    <div className="flex-1 border-t border-slate-700" />
                  </div>
                );
              })}
            </div>

            {/* Bars */}
            <div className="relative flex items-end gap-1 w-full h-full pl-12">
              {history.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  No data yet...
                </div>
              ) : (
                history.map((reading, i) => {
                  const height = Math.min(
                    (reading.flowRate / FLOW_CHART_MAX) * 100,
                    100
                  );

                

                  return (
                    <div
                      key={i}
                      className={`flex-1 ${getBarColor(reading.flowRate)} rounded-t transition-all`}
                      style={{ height: `${height}%`, minHeight: '2px' }}
                      title={`${reading.flowRate.toFixed(2)} L/min`}
                    />
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-between text-xs text-slate-500 mt-2 pl-12">
            <span>-60s</span>
            <span>Now</span>
          </div>
        </div>


        {/* Status Footer */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between text-sm flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-slate-400">
                Live • {new Date(data.timestamp * 1000).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-slate-500">
              Session: {(data.sessionVolume ?? 0).toFixed(2)}L • Total: {(data.totalVolume ?? 0).toFixed(2)}L • {sessionData.length} readings
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}