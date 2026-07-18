"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface PriceAlert {
  id: string;
  address: string;
  symbol: string;
  targetPrice: number;
  direction: "above" | "below";
  createdAt: number;
  triggered: boolean;
}

interface PriceAlertsProps {
  address: string;
  symbol: string;
  currentPrice: number | null;
}

const STORAGE_KEY = "b20_price_alerts";

/**
 * Load alerts from localStorage
 */
function loadAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save alerts to localStorage
 */
function saveAlerts(alerts: PriceAlert[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {}
}

/**
 * Request browser notification permission
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

/**
 * Send browser notification
 */
function sendNotification(title: string, body: string) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: `b20-alert-${Date.now()}`,
      requireInteraction: true,
    });
  }
}

export default function PriceAlerts({ address, symbol, currentPrice }: PriceAlertsProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load alerts from localStorage on mount
  useEffect(() => {
    setAlerts(loadAlerts());
    requestNotificationPermission().then(setPermissionGranted);
  }, []);

  // Save alerts whenever they change
  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  // Check alerts against current price every 15s
  useEffect(() => {
    if (currentPrice == null || alerts.length === 0) return;

    const checkAlerts = () => {
      const now = Date.now();
      setAlerts((prev) =>
        prev.map((alert) => {
          if (alert.triggered) return alert;

          const shouldTrigger =
            alert.direction === "above"
              ? currentPrice >= alert.targetPrice
              : currentPrice <= alert.targetPrice;

          if (shouldTrigger) {
            // Fire notification
            if (permissionGranted) {
              sendNotification(
                `B20 Alert: ${symbol} ${alert.direction === "above" ? "↑" : "↓"}`,
                `${symbol} is now ${alert.direction === "above" ? "above" : "below"} $${alert.targetPrice.toLocaleString()} (current: $${currentPrice.toLocaleString()})`
              );
            }
            return { ...alert, triggered: true };
          }
          return alert;
        })
      );
    };

    // Check immediately, then on interval
    checkAlerts();
    checkIntervalRef.current = setInterval(checkAlerts, 15000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [currentPrice, alerts, permissionGranted, symbol]);

  const addAlert = useCallback(() => {
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) return;

    const newAlert: PriceAlert = {
      id: `${address}-${Date.now()}`,
      address: address.toLowerCase(),
      symbol,
      targetPrice: price,
      direction,
      createdAt: Date.now(),
      triggered: false,
    };

    setAlerts((prev) => [newAlert, ...prev]);
    setTargetPrice("");
    setShowForm(false);
  }, [address, symbol, targetPrice, direction]);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const resetAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, triggered: false } : a))
    );
  }, []);

  const tokenAlerts = alerts.filter((a) => a.address === address.toLowerCase());
  const activeCount = tokenAlerts.filter((a) => !a.triggered).length;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Price Alerts</h2>
          {activeCount > 0 && (
            <span className="rounded-full bg-[#0052FF]/20 px-2 py-0.5 text-[10px] text-[#0052FF]">
              {activeCount} active
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-all"
        >
          {showForm ? "Cancel" : "+ New Alert"}
        </button>
      </div>

      {/* Notification permission banner */}
      {!permissionGranted && (
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
          <p className="text-xs text-yellow-400">
            ⚠️ Browser notifications are disabled. Enable them for alert delivery.
          </p>
          <button
            onClick={() => requestNotificationPermission().then(setPermissionGranted)}
            className="mt-1 text-xs text-yellow-300 underline hover:text-yellow-200"
          >
            Enable notifications
          </button>
        </div>
      )}

      {/* Add alert form */}
      {showForm && (
        <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                Target Price (USD)
              </label>
              <input
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#0052FF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                Direction
              </label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "above" | "below")}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#0052FF] focus:outline-none"
              >
                <option value="above">Above (≥)</option>
                <option value="below">Below (≤)</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[10px] text-gray-500">
              Current: {currentPrice != null ? `$${currentPrice.toLocaleString()}` : "—"}
            </p>
            <button
              onClick={addAlert}
              disabled={!targetPrice || parseFloat(targetPrice) <= 0}
              className="rounded-lg bg-[#0052FF] px-4 py-2 text-xs font-medium text-white hover:bg-[#0052FF]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Create Alert
            </button>
          </div>
        </div>
      )}

      {/* Alert list */}
      {tokenAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-3xl mb-2">🔔</div>
          <p className="text-sm text-gray-500">No alerts set for this token</p>
          <p className="text-xs text-gray-600 mt-1">
            Create an alert to get notified when price hits your target
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokenAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-all ${
                alert.triggered
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                    alert.triggered
                      ? "bg-green-500/20 text-green-400"
                      : alert.direction === "above"
                      ? "bg-[#0052FF]/20 text-[#0052FF]"
                      : "bg-purple-500/20 text-purple-400"
                  }`}
                >
                  {alert.triggered ? "✓" : alert.direction === "above" ? "↑" : "↓"}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    ${alert.targetPrice.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {alert.direction === "above" ? "Above" : "Below"} · Created{" "}
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {alert.triggered && (
                  <button
                    onClick={() => resetAlert(alert.id)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] text-red-400 hover:bg-red-500/20 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current price indicator */}
      {currentPrice != null && (
        <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2">
          <p className="text-xs text-gray-500">
            Current price:{" "}
            <span className="font-mono text-white">${currentPrice.toLocaleString()}</span>
          </p>
        </div>
      )}
    </div>
  );
}
