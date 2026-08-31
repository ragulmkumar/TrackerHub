import colorPalette from "../themes/colorPalette";

/**
 * ToggleSwitch - A clear, modern enable/disable toggle switch.
 *
 * Renders a labelled switch with an "Enabled"/"Disabled" status badge.
 * Used across the App Configuration cards to turn services on/off.
 */
export default function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
}) {
  const sizes = {
    sm: { w: "w-9", h: "h-5", knob: "h-4 w-4", translate: "translate-x-4" },
    md: { w: "w-11", h: "h-6", knob: "h-5 w-5", translate: "translate-x-5" },
    lg: { w: "w-14", h: "h-7", knob: "h-6 w-6", translate: "translate-x-7" },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <p
              className="text-sm font-medium"
              style={{ color: colorPalette.text.primary }}
            >
              {label}
            </p>
          )}
          {description && (
            <p
              className="mt-0.5 text-xs"
              style={{ color: colorPalette.text.secondary }}
            >
              {description}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ${s.w} ${s.h} ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
        style={{
          backgroundColor: checked
            ? colorPalette.success.main
            : colorPalette.divider || "#CBD5E1",
        }}
        aria-label={label || (checked ? "Disable service" : "Enable service")}
      >
        <span
          className={`inline-block transform rounded-full bg-white shadow transition-transform duration-200 ${s.knob} ${
            checked ? s.translate : "translate-x-0.5"
          }`}
        />
      </button>
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
          checked ? "text-white" : ""
        }`}
        style={{
          backgroundColor: checked
            ? colorPalette.success.main
            : "rgba(148,163,184,0.15)",
          color: checked ? "#FFFFFF" : colorPalette.text.disabled,
        }}
      >
        {checked ? "Enabled" : "Disabled"}
      </span>
    </div>
  );
}
