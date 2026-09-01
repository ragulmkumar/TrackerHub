import { useState } from "react";
import AuthenticationCard from "./AuthenticationCard";
import ServerRuntimeCard from "./ServerRuntimeCard";
import AreaLocationConfigCard from "./AreaLocationConfigCard";
import WebhookConfigCard from "./WebhookConfigCard";
import TrackerAccessControlCard from "./TrackerAccessControlCard";
import TrackerRegistryCard from "./TrackerRegistryCard";
import SenseCapConfigCard from "./SenseCapConfigCard";
import LwnsMqttConfigCard from "./LwnsMqttConfigCard";
import colorPalette from "../themes/colorPalette";

export default function AppConfigurationTab() {
  const [activeSection, setActiveSection] = useState(null);

  const sections = [
    { id: "auth", label: "Authentication", component: <AuthenticationCard /> },
    {
      id: "runtime",
      label: "Server Runtime",
      component: <ServerRuntimeCard />,
    },
    {
      id: "area",
      label: "Area Location",
      component: <AreaLocationConfigCard />,
    },
    { id: "webhook", label: "Webhook", component: <WebhookConfigCard /> },
    {
      id: "tracker-registry",
      label: "Tracker Registry",
      component: <TrackerRegistryCard />,
    },
    {
      id: "tracker",
      label: "Tracker Access",
      component: <TrackerAccessControlCard />,
    },
    {
      id: "sensecap",
      label: "SenseCAP MQTT",
      component: <SenseCapConfigCard />,
    },
    {
      id: "lwns",
      label: "LWNS MQTT",
      component: <LwnsMqttConfigCard />,
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-wrap gap-2 mb-6">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() =>
                setActiveSection(
                  activeSection === section.id ? null : section.id,
                )
              }
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                activeSection === section.id ? "text-white" : ""
              }`}
              style={{
                background:
                  activeSection === section.id
                    ? `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`
                    : "rgba(255,255,255,0.7)",
                color:
                  activeSection === section.id
                    ? "white"
                    : colorPalette.text.primary,
                border:
                  activeSection === section.id
                    ? "none"
                    : `1px solid ${colorPalette.divider}`,
              }}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6">
          {sections.map((section) => (
            <div
              key={section.id}
              className={activeSection === section.id ? "block" : "hidden"}
            >
              {section.component}
            </div>
          ))}

          {activeSection === null && (
            <div className="text-center py-12">
              <p
                className="text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Select a configuration section above to view and edit its
                settings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
