import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  Scissors,
  Mic,
  Headphones,
  Radio,
  Wrench,
  Palette,
} from "lucide-react";

const TOOLS = [
  { icon: Scissors, labelKey: "nav.studio", label: "Studio DAW", path: "/studio", color: "#ff751f" },
  { icon: Mic, labelKey: "nav.sampleLab", label: "Sample Lab", path: "/sample-lab", color: "#A78BFA" },
  { icon: Headphones, labelKey: "stemSplitter", label: "Stem Splitter", path: "/stem-splitter", color: "#34D399" },
  { icon: Radio, labelKey: "voiceLab", label: "Voice Lab", path: "/voice-lab", color: "#F472B6" },
  { icon: Wrench, labelKey: "nav.audioTools", label: "Audio Tools", path: "/audio-tools", color: "#60A5FA" },
  { icon: Palette, labelKey: "nav.coverDesigner", label: "Cover Designer", path: "/cover-designer", color: "#FBBF24" },
];

export function QuickAccessTools() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  return (
    <div data-testid="quick-access-tools">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
        {t("create.quickTools", "Herramientas Rápidas")}
      </h3>
      <div className="flex flex-wrap gap-3">
        {TOOLS.map((tool) => (
          <button
            key={tool.path}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] cursor-pointer isolate"
            style={{ position: "relative", zIndex: 1 }}
            onClick={() => setLocation(tool.path)}
            data-testid={`quick-tool-${tool.path.slice(1)}`}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${tool.color}15`, border: `1px solid ${tool.color}25` }}
            >
              <tool.icon className="w-4 h-4" style={{ color: tool.color }} />
            </div>
            <span className="text-xs font-medium text-white/70 whitespace-nowrap">
              {t(tool.labelKey, tool.label)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
