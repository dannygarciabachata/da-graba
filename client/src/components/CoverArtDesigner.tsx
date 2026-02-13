import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Palette, Type, RefreshCw, Sparkles, X } from "lucide-react";

const TEMPLATES = [
  { id: "gradient-neon", name: "Neon Glow", gradient: ["#00F3FF", "#7B2FFF"], textColor: "#FFFFFF" },
  { id: "gradient-sunset", name: "Sunset", gradient: ["#FF6B6B", "#FFE66D"], textColor: "#1a1a2e" },
  { id: "gradient-ocean", name: "Deep Ocean", gradient: ["#0F3460", "#16213E"], textColor: "#E94560" },
  { id: "gradient-fire", name: "Fire", gradient: ["#FF4301", "#FFAC41"], textColor: "#FFFFFF" },
  { id: "gradient-purple", name: "Purple Haze", gradient: ["#6C63FF", "#3F3D56"], textColor: "#FFFFFF" },
  { id: "gradient-gold", name: "Gold Rush", gradient: ["#FFD700", "#B8860B"], textColor: "#1a1a1a" },
  { id: "gradient-midnight", name: "Midnight", gradient: ["#0D0D0D", "#1A1A2E"], textColor: "#00F3FF" },
  { id: "gradient-tropical", name: "Tropical", gradient: ["#11998E", "#38EF7D"], textColor: "#FFFFFF" },
  { id: "gradient-rose", name: "Rose Gold", gradient: ["#B76E79", "#E8B4B8"], textColor: "#2D1F21" },
];

const FONTS = [
  { id: "inter", name: "Inter", family: "Inter, sans-serif" },
  { id: "jetbrains", name: "JetBrains Mono", family: "'JetBrains Mono', monospace" },
  { id: "serif", name: "Serif Classic", family: "Georgia, serif" },
  { id: "impact", name: "Bold Impact", family: "Impact, sans-serif" },
];

interface CoverArtDesignerProps {
  songTitle?: string;
  artistName?: string;
  onSave?: (dataUrl: string) => void;
  onClose?: () => void;
}

export function CoverArtDesigner({ songTitle = "", artistName = "", onSave, onClose }: CoverArtDesignerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(songTitle);
  const [artist, setArtist] = useState(artistName);
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [font, setFont] = useState(FONTS[0]);
  const [titleSize, setTitleSize] = useState([48]);
  const [artistSize, setArtistSize] = useState([24]);
  const [showSubtitle, setShowSubtitle] = useState(true);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 800;
    canvas.width = size;
    canvas.height = size;

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, template.gradient[0]);
    grad.addColorStop(1, template.gradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * size,
        Math.random() * size,
        100 + Math.random() * 200,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = `${template.textColor}10`;
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    const displayTitle = title || "Your Title";
    ctx.fillStyle = template.textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const tSize = titleSize[0];
    ctx.font = `bold ${tSize}px ${font.family}`;

    const maxWidth = size - 80;
    const words = displayTitle.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    const lineHeight = tSize * 1.2;
    const totalTextHeight = lines.length * lineHeight;
    const startY = showSubtitle && artist
      ? size / 2 - totalTextHeight / 2 - 20
      : size / 2 - totalTextHeight / 2;

    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;

    lines.forEach((line, i) => {
      ctx.fillText(line, size / 2, startY + i * lineHeight + lineHeight / 2);
    });

    if (showSubtitle && artist) {
      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      ctx.font = `${artistSize[0]}px ${font.family}`;
      ctx.globalAlpha = 0.7;
      ctx.fillText(artist, size / 2, startY + totalTextHeight + 30);
      ctx.globalAlpha = 1;
    }

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const badgeText = "DGB Audio";
    ctx.font = `10px ${font.family}`;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = template.textColor;
    ctx.textAlign = "right";
    ctx.fillText(badgeText, size - 20, size - 20);
    ctx.globalAlpha = 1;
  }, [title, artist, template, font, titleSize, artistSize, showSubtitle]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${title || "cover"}-art.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave?.(dataUrl);
  };

  const randomize = () => {
    const randomTemplate = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const randomFont = FONTS[Math.floor(Math.random() * FONTS.length)];
    setTemplate(randomTemplate);
    setFont(randomFont);
    setTitleSize([36 + Math.floor(Math.random() * 32)]);
  };

  return (
    <Card className="w-full" data-testid="cover-art-designer">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Cover Art Designer
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Built-in</Badge>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-designer">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song title"
                className="bg-black/20 border-white/10"
                data-testid="input-cover-title"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Artist Name</Label>
              <Input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name"
                className="bg-black/20 border-white/10"
                data-testid="input-cover-artist"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Template</Label>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t)}
                    className={`h-12 rounded-lg border-2 transition-all ${
                      template.id === t.id ? "border-primary shadow-lg shadow-primary/20 scale-105" : "border-white/10"
                    }`}
                    style={{ background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }}
                    title={t.name}
                    data-testid={`button-template-${t.id}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Font</Label>
              <Select value={font.id} onValueChange={(v) => setFont(FONTS.find((f) => f.id === v) || FONTS[0])}>
                <SelectTrigger className="bg-black/20 border-white/10" data-testid="select-cover-font">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONTS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Title Size: {titleSize[0]}px</Label>
              <Slider
                value={titleSize}
                onValueChange={setTitleSize}
                min={24}
                max={80}
                step={2}
                data-testid="slider-title-size"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Artist Size: {artistSize[0]}px</Label>
              <Slider
                value={artistSize}
                onValueChange={setArtistSize}
                min={12}
                max={48}
                step={2}
                data-testid="slider-artist-size"
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <canvas
              ref={canvasRef}
              className="w-full max-w-[300px] aspect-square rounded-xl border border-white/10 shadow-xl"
              style={{ imageRendering: "auto" }}
              data-testid="canvas-cover-preview"
            />
            <div className="flex gap-2 w-full max-w-[300px]">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={randomize} data-testid="button-randomize">
                <RefreshCw className="h-3.5 w-3.5" />
                Randomize
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleDownload} data-testid="button-download-cover">
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </div>
            {onSave && (
              <Button className="w-full max-w-[300px] bg-primary text-black gap-1.5" onClick={handleSave} data-testid="button-save-cover">
                <Sparkles className="h-4 w-4" />
                Save & Download
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
