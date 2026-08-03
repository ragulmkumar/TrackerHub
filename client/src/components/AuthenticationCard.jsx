import { useEffect, useMemo, useState } from "react";
import {
  loadAuthenticationConfiguration,
  saveAuthenticationConfiguration,
} from "../services/configApiService";
import colorPalette from "../themes/colorPalette";

const PASSWORD_MASK = "********";

const defaultAuthState = {
  username: "admin",
  password: PASSWORD_MASK,
};

function validatePasswordStrength(password) {
  if (!password) {
    return "New password is required";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "Password must include both uppercase and lowercase letters";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character";
  }
  return "";
}

export default function AuthenticationCard() {
  const [config, setConfig] = useState(defaultAuthState);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordPreview = useMemo(() => {
    return config.password || PASSWORD_MASK;
  }, [config.password]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await loadAuthenticationConfiguration();
      setConfig({
        username: data?.username || defaultAuthState.username,
        password: data?.password || PASSWORD_MASK,
      });
    } catch (err) {
      setError(err.message || "Unable to load authentication configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (newPassword || confirmPassword) {
        const strengthError = validatePasswordStrength(newPassword);
        if (strengthError) {
          throw new Error(strengthError);
        }
        if (newPassword !== confirmPassword) {
          throw new Error("New password confirmation does not match");
        }
      }

      const payload = {
        username: config.username,
        password: PASSWORD_MASK,
        newPassword,
        confirmPassword,
      };

      await saveAuthenticationConfiguration(payload);
      setMessage("Authentication configuration updated successfully.");
      setEditing(false);
      setNewPassword("");
      setConfirmPassword("");
      await loadConfig();
    } catch (err) {
      setError(err.message || "Failed to update authentication configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-[0.3em]"
            style={{ color: colorPalette.primary.main }}
          >
            Authentication Configuration
          </p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ color: colorPalette.text.primary }}
          >
            Administrator credential settings
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: colorPalette.text.secondary }}
          >
            Review the current built-in administrator account and update the
            credential password securely.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
            }}
          >
            Edit configuration
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError("");
                setMessage("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="rounded-xl px-3 py-2 text-sm font-semibold"
              style={{
                backgroundColor: "rgba(255,255,255,0.7)",
                color: colorPalette.text.primary,
                border: `1px solid ${colorPalette.divider}`,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
              style={{
                background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {(message || error) && (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-300 bg-rose-50 text-rose-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}
        >
          {error || message}
        </div>
      )}

      {loading ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
          Loading authentication configuration...
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <label
            className="text-sm font-medium"
            style={{ color: colorPalette.text.secondary }}
          >
            Username
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none"
              value={config.username}
              readOnly
            />
          </label>

          <label
            className="text-sm font-medium"
            style={{ color: colorPalette.text.secondary }}
          >
            Password
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none"
              value={passwordPreview}
              readOnly
            />
          </label>

          {editing && (
            <>
              <label
                className="text-sm font-medium"
                style={{ color: colorPalette.text.secondary }}
              >
                New password
                <input
                  type="password"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm outline-none"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter a new password"
                />
              </label>

              <label
                className="text-sm font-medium"
                style={{ color: colorPalette.text.secondary }}
              >
                Confirm new password
                <input
                  type="password"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm outline-none"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm the new password"
                />
              </label>
            </>
          )}
        </div>
      )}
    </section>
  );
}
