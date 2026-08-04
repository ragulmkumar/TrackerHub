import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import LoginAnimation from "../assets/lotties/LoginAnime.json";
import { default as LottieModule } from "lottie-react";
const Lottie = LottieModule.default || LottieModule;
import colorPalette from "../themes/colorPalette";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState({
    username: false,
    password: false,
  });
  const { login, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, from, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${colorPalette.background.default} 0%, ${colorPalette.background.paper} 100%)`,
      }}
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Orbs */}
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
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-pulse-slow"
            style={{
              width: Math.random() * 6 + 2 + "px",
              height: Math.random() * 6 + 2 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              background:
                i % 2 === 0
                  ? colorPalette.primary.light
                  : colorPalette.secondary.light,
              opacity: Math.random() * 0.3 + 0.1,
              animationDelay: Math.random() * 5 + "s",
              animationDuration: Math.random() * 8 + 4 + "s",
            }}
          />
        ))}
      </div>

      {/* Main Container */}
      <div className="w-full max-w-6xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-16 items-center">
          {/* Left Side - Brand & Animation */}
          <div className="hidden lg:flex flex-col items-center justify-center space-y-8">
            {/* Brand Badge */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                  boxShadow: `0 8px 32px ${colorPalette.primary.main}40`,
                }}
              >
                <svg
                  className="w-8 h-8 text-white"
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
              <h1
                className="text-4xl font-bold tracking-tight"
                style={{ color: colorPalette.text.primary }}
              >
                Tracker
                <span style={{ color: colorPalette.primary.main }}>Hub</span>
              </h1>
            </div>

            {/* Lottie Animation */}
            <div className="w-full max-w-md">
              <Lottie
                animationData={LoginAnimation}
                loop={true}
                className="w-full h-auto"
                style={{ maxHeight: "380px" }}
              />
            </div>

            {/* Tagline */}
            <div className="text-center space-y-2">
              <h2
                className="text-2xl font-semibold"
                style={{ color: colorPalette.text.primary }}
              >
                Welcome Back!
              </h2>
              <p style={{ color: colorPalette.text.secondary }}>
                Secure access to your tracking dashboard
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: colorPalette.success.main }}
                />
                <span
                  className="text-sm"
                  style={{ color: colorPalette.text.secondary }}
                >
                  All systems operational
                </span>
              </div>
            </div>
          </div>

          {/* Right Side - Login Card */}
          <div className="flex justify-center">
            <div
              className="w-full max-w-110 relative rounded-3xl p-8 transition-all duration-500"
              style={{
                background: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: "1px solid rgba(255, 255, 255, 0.8)",
                boxShadow:
                  "0 30px 80px -20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.5) inset",
              }}
            >
              {/* Glass Reflection */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-linear-to-br from-white/40 to-transparent rotate-12 blur-2xl" />
                <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-linear-to-tl from-white/20 to-transparent -rotate-12 blur-2xl" />
              </div>

              {/* Mobile Brand (visible on small screens) */}
              <div className="lg:hidden flex flex-col items-center mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                      boxShadow: `0 8px 32px ${colorPalette.primary.main}30`,
                    }}
                  >
                    <svg
                      className="w-6 h-6 text-white"
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
                  <h1
                    className="text-2xl font-bold"
                    style={{ color: colorPalette.text.primary }}
                  >
                    Tracker
                    <span style={{ color: colorPalette.primary.main }}>
                      Hub
                    </span>
                  </h1>
                </div>
                <div className="w-12 h-12">
                  <Lottie
                    animationData={LoginAnimation}
                    loop={true}
                    className="w-full h-full"
                  />
                </div>
              </div>

              {/* Form Header */}
              <div className="text-center mb-8 relative">
                <h2
                  className="text-2xl font-bold mb-2"
                  style={{ color: colorPalette.text.primary }}
                >
                  Sign In
                </h2>
                <p
                  className="text-sm"
                  style={{ color: colorPalette.text.secondary }}
                >
                  Enter your credentials to access your account
                </p>
                <div
                  className="mt-4 h-1 w-16 mx-auto rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                  }}
                />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5 relative">
                {/* Username Field */}
                <div className="space-y-1.5">
                  <label
                    className="text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                    style={{
                      color: isFocused.username
                        ? colorPalette.primary.main
                        : colorPalette.text.secondary,
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
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() =>
                        setIsFocused({ ...isFocused, username: true })
                      }
                      onBlur={() =>
                        setIsFocused({ ...isFocused, username: false })
                      }
                      className="w-full rounded-xl px-4 py-3.5 text-sm transition-all duration-300 outline-none"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.8)",
                        border: `2px solid ${
                          isFocused.username
                            ? colorPalette.primary.main
                            : "rgba(203, 213, 225, 0.4)"
                        }`,
                        color: colorPalette.text.primary,
                        boxShadow: isFocused.username
                          ? `0 0 0 4px ${colorPalette.primary.main}15`
                          : "none",
                      }}
                      placeholder="Enter your username"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label
                      className="text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                      style={{
                        color: isFocused.password
                          ? colorPalette.primary.main
                          : colorPalette.text.secondary,
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
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-xs font-medium transition-all duration-200 hover:opacity-80"
                      style={{ color: colorPalette.primary.main }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() =>
                        setIsFocused({ ...isFocused, password: true })
                      }
                      onBlur={() =>
                        setIsFocused({ ...isFocused, password: false })
                      }
                      className="w-full rounded-xl px-4 pr-12 py-3.5 text-sm transition-all duration-300 outline-none"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.8)",
                        border: `2px solid ${
                          isFocused.password
                            ? colorPalette.primary.main
                            : "rgba(203, 213, 225, 0.4)"
                        }`,
                        color: colorPalette.text.primary,
                        boxShadow: isFocused.password
                          ? `0 0 0 4px ${colorPalette.primary.main}15`
                          : "none",
                      }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-110"
                      style={{ color: colorPalette.text.disabled }}
                    >
                      {showPassword ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div
                    className="rounded-xl px-4 py-3 text-sm flex items-center gap-3 animate-shake"
                    style={{
                      backgroundColor: `${colorPalette.error.main}10`,
                      color: colorPalette.error.dark,
                      border: `1px solid ${colorPalette.error.main}20`,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${colorPalette.error.main}20`,
                      }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none relative overflow-hidden group mt-2"
                  style={{
                    background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                    boxShadow: `0 4px 20px ${colorPalette.primary.main}40`,
                  }}
                >
                  <div className="absolute inset-0 w-full h-full transition-all duration-500 opacity-0 group-hover:opacity-20 bg-linear-to-r from-transparent via-white to-transparent -translate-x-full group-hover:translate-x-full" />

                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Sign In</span>
                      <svg
                        className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Footer Links */}
                <div className="text-center pt-4">
                  <p
                    className="text-xs"
                    style={{ color: colorPalette.text.disabled }}
                  >
                    By signing in, you agree to our{" "}
                    <button
                      type="button"
                      className="font-medium transition-colors hover:underline"
                      style={{ color: colorPalette.primary.main }}
                    >
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button
                      type="button"
                      className="font-medium transition-colors hover:underline"
                      style={{ color: colorPalette.primary.main }}
                    >
                      Privacy Policy
                    </button>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Animations */}
      <style>{`
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
            opacity: 0.1;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
            transform: scale(1.5);
          }
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-4px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(4px);
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
        .animate-shake {
          animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
