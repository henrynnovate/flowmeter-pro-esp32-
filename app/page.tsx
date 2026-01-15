"use client";

import { useEffect, useState } from "react";

/* ===================== TYPES ===================== */

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

/* ===================== PAGE ===================== */

export default function FlowMonitor() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [sessionData, setSessionData] = useState<TelemetryData[]>([]);
  const [status, setStatus] = useState("");

  /* ---------- polling ---------- */
  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch("/api/telemetry");
      const json = await res.json();
      if (json?.timestamp) {
        setData(json);
        setHistory((p) => [...p.slice(-59), json]);
        setSessionData((p) => [...p, json]);
      }
    }, 1000);

    return () => clearInterval(id);
  }, []);

  /* ---------- commands ---------- */
  const sendCommand = async (command: string) => {
    setStatus(`Sending ${command}…`);
    try {
      const res = await fetch("/api/telemetry/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });

      if (res.ok) {
        setStatus(`✓ ${command} sent`);
        if (command === "RESET_SESSION") {
          setTimeout(() => setSessionData([]), 6000);
        }
      }
    } catch {
      setStatus("✗ Command failed");
    } finally {
      setTimeout(() => setStatus(""), 3000);
    }
  };

  /* ---------- export ---------- */
  const exportData = () => {
    if (!sessionData.length) return;

    const csv = [
      "Timestamp,ISO Time,Flow Rate,Session Volume,Battery %,WiFi RSSI,State",
      ...sessionData.map(
        (d) =>
          `${d.timestamp},${new Date(
            d.timestamp * 1000
          ).toISOString()},${d.flowRate},${d.sessionVolume},${d.batteryPercent},${d.wifiRSSI},${d.flowState}`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        Waiting for telemetry…
      </div>
    );
  }

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ---------- HEADER ---------- */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-white">
              Flow Monitor
            </h1>
            <p className="text-slate-400 text-sm md:text-base">
              ESP32 • Real-time telemetry
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto">
            <Button onClick={exportData} color="blue">Export</Button>
            <Button onClick={() => sendCommand("RESET_SESSION")} color="orange">
              Reset Session
            </Button>
            <Button onClick={() => sendCommand("RESET_TOTAL")} color="red">
              Reset Total
            </Button>
          </div>
        </div>

        {status && (
          <div className="bg-slate-800 border border-slate-700 p-3 rounded text-sm text-slate-300">
            {status}
          </div>
        )}

        {/* ---------- MAIN GAUGES ---------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Gauge
            label="Flow Rate"
            value={data.flowRate}
            unit="L/min"
            max={25}
            thresholds={[
              { value: 4, color: "bg-green-500" },
              { value: 10, color: "bg-yellow-500" },
              { value: 25, color: "bg-red-500" },
            ]}
          />

          <Stat label="Session Volume" value={data.sessionVolume} unit="L" />

          <Stat label="Total Volume" value={data.totalVolume} unit="L" />

          <Gauge
            label="Battery"
            value={data.batteryPercent}
            unit="%"
            max={100}
            thresholds={[
              { value: 30, color: "bg-red-500" },
              { value: 60, color: "bg-yellow-500" },
              { value: 100, color: "bg-green-500" },
            ]}
          />
        </div>

        {/* ---------- SECONDARY ---------- */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Gauge
            label="WiFi RSSI"
            value={Math.abs(data.wifiRSSI)}
            unit="dBm"
            max={100}
            invert
            thresholds={[
              { value: 40, color: "bg-green-500" },
              { value: 70, color: "bg-yellow-500" },
              { value: 100, color: "bg-red-500" },
            ]}
          />

          <Stat label="Pulses" value={data.pulses} unit="/sec" />

          <Stat
            label="Uptime"
            value={`${Math.floor(data.timestamp / 3600)}h`}
            unit={`${Math.floor((data.timestamp % 3600) / 60)}m`}
          />
        </div>

        {/* ---------- FLOW HISTORY ---------- */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex justify-between mb-3">
            <h2 className="text-white font-semibold">Flow (60s)</h2>
            <span className="text-xs text-slate-400">0–25 L/min</span>
          </div>

          <div className="h-40 md:h-52 flex items-end gap-1">
            {history.map((r, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-green-500"
                style={{
                  height: `${Math.min((r.flowRate / 25) * 100, 100)}%`,
                }}
              />
            ))}
          </div>
        </div>

        {/* ---------- FOOTER ---------- */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs md:text-sm flex flex-col md:flex-row md:justify-between gap-2">
          <span className="text-slate-400">
            Live • {new Date(data.timestamp * 1000).toLocaleTimeString()}
          </span>
          <span className="text-slate-500">
            Session {data.sessionVolume.toFixed(2)}L • Total{" "}
            {data.totalVolume.toFixed(2)}L
          </span>
        </div>
      </div>
    </div>
  );
}

/* ===================== COMPONENTS ===================== */

function Button({
  children,
  onClick,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color: "blue" | "orange" | "red";
}) {
  const colors = {
    blue: "bg-blue-600 hover:bg-blue-700",
    orange: "bg-orange-600 hover:bg-orange-700",
    red: "bg-red-600 hover:bg-red-700",
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm text-white rounded-lg whitespace-nowrap ${colors[color]}`}
    >
      {children}
    </button>
  );
}

/* ---------- Grafana-style BAR GAUGE ---------- */
function Gauge({
  label,
  value,
  unit,
  max,
  thresholds,
  invert = false,
}: {
  label: string;
  value: number;
  unit: string;
  max: number;
  thresholds: { value: number; color: string }[];
  invert?: boolean;
}) {
  const percent = Math.min((value / max) * 100, 100);

  const color =
    thresholds.find((t) => value <= t.value)?.color ??
    thresholds[thresholds.length - 1].color;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>

      <div className="text-xl md:text-2xl font-bold text-white mb-2">
        {value.toFixed(1)} {unit}
      </div>

      <div className="w-full h-3 bg-slate-700 rounded overflow-hidden">
        <div
          className={`h-full transition-all ${color}`}
          style={{
            width: `${invert ? 100 - percent : percent}%`,
          }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xl md:text-2xl font-bold text-white">
        {value}
      </div>
      <div className="text-xs text-slate-500">{unit}</div>
    </div>
  );
}
