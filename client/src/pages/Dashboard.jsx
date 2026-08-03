import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import colorPalette from "../themes/colorPalette";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats] = useState({
    totalTrackers: 24,
    activeTrackers: 18,
    alerts: 3,
    systemHealth: "98.5%",
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${colorPalette.background.default} 0%, ${colorPalette.background.paper} 100%)`,
      }}
    >
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-10%] right-[-5%] w-125 h-125 rounded-full blur-3xl animate-float"
          style={{
            background: `radial-gradient(circle, ${colorPalette.primary.light}30, transparent 70%)`,
            animationDuration: "15s",
          }}
        />
        <div
          className="absolute bottom-[-10%] left-[-5%] w-112.5 h-112.5 rounded-full blur-3xl animate-float-delayed"
          style={{
            background: `radial-gradient(circle, ${colorPalette.secondary.light}25, transparent 70%)`,
            animationDuration: "18s",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, ${colorPalette.info.light}15, transparent 70%)`,
          }}
        />

        {/* Floating Particles */}
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-pulse-slow"
            style={{
              width: Math.random() * 4 + 2 + "px",
              height: Math.random() * 4 + 2 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              background:
                i % 2 === 0
                  ? colorPalette.primary.light
                  : colorPalette.secondary.light,
              opacity: Math.random() * 0.2 + 0.05,
              animationDelay: Math.random() * 5 + "s",
              animationDuration: Math.random() * 8 + 4 + "s",
            }}
          />
        ))}
      </div>

      {/* Main Container */}
      <div className="w-full max-w-6xl relative z-10">
        {/* Header Section */}
        <div className="mb-8">
          <div
            className="rounded-3xl p-6 transition-all duration-500"
            style={{
              background: "rgba(255, 255, 255, 0.6)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid rgba(255, 255, 255, 0.8)",
              boxShadow:
                "0 20px 60px -20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5) inset",
            }}
          >
            {/* Glass Reflection */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-linear-to-br from-white/30 to-transparent rotate-12 blur-2xl" />
            </div>

            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Left Side - Greeting */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                      boxShadow: `0 4px 16px ${colorPalette.primary.main}30`,
                    }}
                  >
                    <svg
                      className="w-5 h-5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                      <path d="M2 17L12 22L22 17" />
                      <path d="M2 12L12 17L22 12" />
                    </svg>
                  </div>
                  <p
                    className="text-xs font-medium uppercase tracking-widest"
                    style={{ color: colorPalette.primary.main }}
                  >
                    Dashboard Overview
                  </p>
                </div>
                <h1
                  className="text-2xl md:text-3xl font-bold"
                  style={{ color: colorPalette.text.primary }}
                >
                  Welcome back,{" "}
                  <span style={{ color: colorPalette.primary.main }}>
                    {user || "Admin"}
                  </span>
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <p
                    className="text-sm"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    {formatDate(currentTime)}
                  </p>
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: colorPalette.text.disabled }}
                  />
                  <p
                    className="text-sm font-medium"
                    style={{ color: colorPalette.primary.main }}
                  >
                    {formatTime(currentTime)}
                  </p>
                </div>
              </div>

              {/* Right Side - Actions */}
              <div className="flex items-center gap-3">
                <div
                  className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor: `${colorPalette.success.main}10`,
                    border: `1px solid ${colorPalette.success.main}20`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: colorPalette.success.main }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: colorPalette.success.dark }}
                  >
                    System Online
                  </span>
                </div>
                <Link
                  to="/monitor"
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                    color: colorPalette.primary.contrastText,
                    boxShadow: `0 4px 16px ${colorPalette.primary.main}30`,
                  }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12h2m14 0h2M4.2 4.2l1.4 1.4m13 13l1.4 1.4M4.2 19.8l1.4-1.4m13-13l1.4-1.4M12 3a9 9 0 100 18 9 9 0 000-18z"
                    />
                  </svg>
                  Monitor
                </Link>
                <Link
                  to="/configuration"
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                    color: colorPalette.primary.contrastText,
                    boxShadow: `0 4px 16px ${colorPalette.primary.main}30`,
                  }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Configure
                </Link>
                <button
                  onClick={logout}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${colorPalette.error.main}, ${colorPalette.error.dark})`,
                    color: colorPalette.error.contrastText,
                    boxShadow: `0 4px 16px ${colorPalette.error.main}30`,
                  }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Trackers",
              value: stats.totalTrackers,
              icon: "📡",
              color: colorPalette.primary.main,
            },
            {
              label: "Active Trackers",
              value: stats.activeTrackers,
              icon: "📍",
              color: colorPalette.success.main,
            },
            {
              label: "Active Alerts",
              value: stats.alerts,
              icon: "⚠️",
              color: colorPalette.warning.main,
            },
            {
              label: "System Health",
              value: stats.systemHealth,
              icon: "💚",
              color: colorPalette.info.main,
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="rounded-2xl p-5 transition-all duration-300 hover:scale-105 hover:shadow-lg"
              style={{
                background: "rgba(255, 255, 255, 0.5)",
                backdropFilter: "blur(12px) saturate(160%)",
                WebkitBackdropFilter: "blur(12px) saturate(160%)",
                border: "1px solid rgba(255, 255, 255, 0.6)",
                boxShadow: "0 8px 32px -12px rgba(0, 0, 0, 0.06)",
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    {stat.label}
                  </p>
                  <p
                    className="text-2xl font-bold mt-1"
                    style={{ color: colorPalette.text.primary }}
                  >
                    {stat.value}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: `${stat.color}15`,
                    border: `1px solid ${stat.color}20`,
                  }}
                >
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Welcome Card */}
            <div
              className="rounded-3xl p-6 transition-all duration-500"
              style={{
                background: "rgba(255, 255, 255, 0.5)",
                backdropFilter: "blur(12px) saturate(160%)",
                WebkitBackdropFilter: "blur(12px) saturate(160%)",
                border: "1px solid rgba(255, 255, 255, 0.6)",
                boxShadow: "0 8px 32px -12px rgba(0, 0, 0, 0.06)",
              }}
            >
              <h2
                className="text-lg font-semibold mb-3"
                style={{ color: colorPalette.text.primary }}
              >
                🚀 Getting Started
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: colorPalette.text.secondary }}
              >
                You are now authenticated and can extend this dashboard with
                tracker state, MQTT controls, and live WebSocket updates. The
                system is ready for real-time monitoring and management.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Real-time Tracking",
                  "MQTT Integration",
                  "WebSocket Updates",
                ].map((feature, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{
                      backgroundColor: `${colorPalette.primary.main}10`,
                      color: colorPalette.primary.main,
                      border: `1px solid ${colorPalette.primary.main}15`,
                    }}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {/* Activity/Recent Updates */}
            <div
              className="rounded-3xl p-6 transition-all duration-500"
              style={{
                background: "rgba(255, 255, 255, 0.5)",
                backdropFilter: "blur(12px) saturate(160%)",
                WebkitBackdropFilter: "blur(12px) saturate(160%)",
                border: "1px solid rgba(255, 255, 255, 0.6)",
                boxShadow: "0 8px 32px -12px rgba(0, 0, 0, 0.06)",
              }}
            >
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: colorPalette.text.primary }}
              >
                📊 Recent Activity
              </h2>
              <div className="space-y-3">
                {[
                  {
                    action: "Tracker #1423 updated location",
                    time: "2 min ago",
                  },
                  { action: "New tracker registered", time: "15 min ago" },
                  { action: "Alert: Battery low on #987", time: "1 hour ago" },
                ].map((activity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{ color: colorPalette.text.primary }}
                    >
                      {activity.action}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: colorPalette.text.disabled }}
                    >
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Quick Actions & Status */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div
              className="rounded-3xl p-6 transition-all duration-500"
              style={{
                background: "rgba(255, 255, 255, 0.5)",
                backdropFilter: "blur(12px) saturate(160%)",
                WebkitBackdropFilter: "blur(12px) saturate(160%)",
                border: "1px solid rgba(255, 255, 255, 0.6)",
                boxShadow: "0 8px 32px -12px rgba(0, 0, 0, 0.06)",
              }}
            >
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: colorPalette.text.primary }}
              >
                ⚡ Quick Actions
              </h2>
              <div className="space-y-3">
                {[
                  { label: "Add New Tracker", icon: "➕" },
                  { label: "View All Trackers", icon: "📋" },
                  { label: "System Settings", icon: "⚙️" },
                ].map((action, idx) => (
                  <button
                    key={idx}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      color: colorPalette.text.primary,
                    }}
                  >
                    <span className="text-lg">{action.icon}</span>
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* System Status */}
            <div
              className="rounded-3xl p-6 transition-all duration-500"
              style={{
                background: "rgba(255, 255, 255, 0.5)",
                backdropFilter: "blur(12px) saturate(160%)",
                WebkitBackdropFilter: "blur(12px) saturate(160%)",
                border: "1px solid rgba(255, 255, 255, 0.6)",
                boxShadow: "0 8px 32px -12px rgba(0, 0, 0, 0.06)",
              }}
            >
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: colorPalette.text.primary }}
              >
                🔋 System Status
              </h2>
              <div className="space-y-3">
                {[
                  { label: "API Status", value: "Connected", status: "online" },
                  { label: "WebSocket", value: "Active", status: "online" },
                  { label: "Database", value: "Healthy", status: "online" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{ color: colorPalette.text.secondary }}
                    >
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            item.status === "online"
                              ? colorPalette.success.main
                              : colorPalette.error.main,
                        }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{
                          color:
                            item.status === "online"
                              ? colorPalette.success.dark
                              : colorPalette.error.dark,
                        }}
                      >
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Animations */}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        @keyframes float-delayed {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(-30px, 20px) scale(0.9);
          }
          66% {
            transform: translate(20px, -30px) scale(1.1);
          }
        }
        @keyframes pulse-slow {
          0%,
          100% {
            opacity: 0.05;
            transform: scale(1);
          }
          50% {
            opacity: 0.2;
            transform: scale(1.5);
          }
        }
        .animate-float {
          animation: float 15s infinite ease-in-out;
        }
        .animate-float-delayed {
          animation: float-delayed 18s infinite ease-in-out;
        }
        .animate-pulse-slow {
          animation: pulse-slow 6s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
