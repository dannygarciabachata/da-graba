import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Palette, RefreshCw, Sparkles, X, Upload, Image, Wand2, Loader2, SlidersHorizontal } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

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

const FILTER_PRESETS = [
  { id: "none", name: "Original", brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, grayscale: 0, hueRotate: 0 },
  { id: "vivid", name: "Vivid", brightness: 110, contrast: 120, saturation: 140, blur: 0, sepia: 0, grayscale: 0, hueRotate: 0 },
  { id: "warm", name: "Warm", brightness: 105, contrast: 105, saturation: 110, blur: 0, sepia: 30, grayscale: 0, hueRotate: 0 },
  { id: "cool", name: "Cool", brightness: 100, contrast: 110, saturation: 90, blur: 0, sepia: 0, grayscale: 0, hueRotate: 180 },
  { id: "vintage", name: "Vintage", brightness: 90, contrast: 85, saturation: 70, blur: 0, sepia: 50, grayscale: 0, hueRotate: 0 },
  { id: "noir", name: "Noir", brightness: 95, contrast: 130, saturation: 0, blur: 0, sepia: 0, grayscale: 100, hueRotate: 0 },
  { id: "dreamy", name: "Dreamy", brightness: 115, contrast: 90, saturation: 120, blur: 1, sepia: 10, grayscale: 0, hueRotate: 0 },
  { id: "moody", name: "Moody", brightness: 80, contrast: 120, saturation: 80, blur: 0, sepia: 20, grayscale: 20, hueRotate: 0 },
  { id: "sunset", name: "Sunset", brightness: 105, contrast: 110, saturation: 130, blur: 0, sepia: 20, grayscale: 0, hueRotate: -20 },
  { id: "fade", name: "Fade", brightness: 120, contrast: 80, saturation: 60, blur: 0, sepia: 15, grayscale: 0, hueRotate: 0 },
];

interface CoverArtDesignerProps {
  songTitle?: string;
  artistName?: string;
  songId?: number;
  onSave?: (dataUrl: string) => void;
  onClose?: () => void;
}

export function CoverArtDesigner({ songTitle = "", artistName = "", songId, onSave, onClose }: CoverArtDesignerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(songTitle);
  const [artist, setArtist] = useState(artistName);
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [font, setFont] = useState(FONTS[0]);
  const [titleSize, setTitleSize] = useState([48]);
  const [artistSize, setArtistSize] = useState([24]);
  const [showSubtitle, setShowSubtitle] = useState(true);
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<"template" | "upload" | "ai" | "filters">("template");
  const [selectedFilter, setSelectedFilter] = useState(FILTER_PRESETS[0]);
  const [customFilters, setCustomFilters] = useState({ brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, grayscale: 0, hueRotate: 0 });
  const { toast } = useToast();

  const generateCoverMutation = useMutation({
    mutationFn: async (data: { prompt: string; songId?: number }) => {
      const res = await apiRequest("POST", "/api/ai/generate-cover", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.imageUrl) {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          setUploadedImage(img);
          setActiveTab("filters");
          toast({ description: "AI cover art generated!" });
        };
        img.src = data.imageUrl;
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate cover art", variant: "destructive" });
    },
  });

  const getFilterString = useCallback(() => {
    const f = selectedFilter.id === "none" ? customFilters : selectedFilter;
    const parts = [];
    if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
    if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
    if (f.saturation !== 100) parts.push(`saturate(${f.saturation}%)`);
    if (f.blur > 0) parts.push(`blur(${f.blur}px)`);
    if (f.sepia > 0) parts.push(`sepia(${f.sepia}%)`);
    if (f.grayscale > 0) parts.push(`grayscale(${f.grayscale}%)`);
    if (f.hueRotate !== 0) parts.push(`hue-rotate(${f.hueRotate}deg)`);
    return parts.length > 0 ? parts.join(" ") : "none";
  }, [selectedFilter, customFilters]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 800;
    canvas.width = size;
    canvas.height = size;

    if (uploadedImage) {
      ctx.save();
      ctx.filter = getFilterString();
      const imgRatio = uploadedImage.width / uploadedImage.height;
      let drawW = size, drawH = size, drawX = 0, drawY = 0;
      if (imgRatio > 1) {
        drawH = size;
        drawW = size * imgRatio;
        drawX = -(drawW - size) / 2;
      } else {
        drawW = size;
        drawH = size / imgRatio;
        drawY = -(drawH - size) / 2;
      }
      ctx.drawImage(uploadedImage, drawX, drawY, drawW, drawH);
      ctx.restore();

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, size - 200, size, 200);
    } else {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, template.gradient[0]);
      grad.addColorStop(1, template.gradient[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, 100 + Math.random() * 200, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = `${template.textColor}10`;
      ctx.lineWidth = 1;
      for (let i = 0; i < size; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
      }
    }

    const textColor = uploadedImage ? "#FFFFFF" : template.textColor;
    const displayTitle = title || "Your Title";
    ctx.fillStyle = textColor;
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
    const textY = uploadedImage
      ? size - 120 - totalTextHeight / 2
      : showSubtitle && artist
        ? size / 2 - totalTextHeight / 2 - 20
        : size / 2 - totalTextHeight / 2;

    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 3;

    lines.forEach((line, i) => {
      ctx.fillText(line, size / 2, textY + i * lineHeight + lineHeight / 2);
    });

    if (showSubtitle && artist) {
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 8;
      ctx.font = `${artistSize[0]}px ${font.family}`;
      ctx.globalAlpha = 0.8;
      ctx.fillText(artist, size / 2, textY + totalTextHeight + 30);
      ctx.globalAlpha = 1;
    }

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const badgeText = "DGB Audio";
    ctx.font = `10px ${font.family}`;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = textColor;
    ctx.textAlign = "right";
    ctx.fillText(badgeText, size - 20, size - 20);
    ctx.globalAlpha = 1;
  }, [title, artist, template, font, titleSize, artistSize, showSubtitle, uploadedImage, getFilterString]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        setUploadedImage(img);
        setActiveTab("filters");
        toast({ description: "Image uploaded! Apply filters to customize." });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAI = () => {
    if (!aiPrompt.trim()) return;
    generateCoverMutation.mutate({ prompt: aiPrompt, songId });
  };

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

  const applyFilter = (preset: typeof FILTER_PRESETS[0]) => {
    setSelectedFilter(preset);
    if (preset.id !== "none") {
      setCustomFilters({ brightness: preset.brightness, contrast: preset.contrast, saturation: preset.saturation, blur: preset.blur, sepia: preset.sepia, grayscale: preset.grayscale, hueRotate: preset.hueRotate });
    }
  };

  const removeBackground = () => {
    if (!uploadedImage) return;
    setUploadedImage(null);
    toast({ description: "Background removed - using gradient template" });
  };

  const TABS = [
    { id: "template", label: "Templates", icon: Palette },
    { id: "upload", label: "Upload", icon: Upload },
    { id: "ai", label: "AI Generate", icon: Wand2 },
    { id: "filters", label: "Filters", icon: SlidersHorizontal },
  ] as const;

  return (
    <Card className="w-full" data-testid="cover-art-designer">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Cover Art Designer
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">AI-Powered</Badge>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-designer">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" className="bg-black/20 border-white/10" data-testid="input-cover-title" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Artist</Label>
                <Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist name" className="bg-black/20 border-white/10" data-testid="input-cover-artist" />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "template" && (
                <motion.div key="template" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Template</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {TEMPLATES.map((t) => (
                        <button key={t.id} onClick={() => { setTemplate(t); setUploadedImage(null); }}
                          className={`h-10 rounded-lg border-2 transition-all ${template.id === t.id && !uploadedImage ? "border-primary shadow-lg shadow-primary/20 scale-105" : "border-white/10"}`}
                          style={{ background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }}
                          title={t.name} data-testid={`button-template-${t.id}`} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Font</Label>
                    <Select value={font.id} onValueChange={(v) => setFont(FONTS.find((f) => f.id === v) || FONTS[0])}>
                      <SelectTrigger className="bg-black/20 border-white/10" data-testid="select-cover-font"><SelectValue /></SelectTrigger>
                      <SelectContent>{FONTS.map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Title: {titleSize[0]}px</Label>
                      <Slider value={titleSize} onValueChange={setTitleSize} min={24} max={80} step={2} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Artist: {artistSize[0]}px</Label>
                      <Slider value={artistSize} onValueChange={setArtistSize} min={12} max={48} step={2} />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "upload" && (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-primary/30 transition-colors"
                    data-testid="dropzone-upload"
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload an image</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WebP supported</p>
                  </div>
                  {uploadedImage && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={removeBackground} data-testid="button-remove-bg">
                        <Image className="h-3.5 w-3.5 mr-1" />
                        Remove Image
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setActiveTab("filters")} data-testid="button-go-filters">
                        <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                        Apply Filters
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "ai" && (
                <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1.5">
                      <Wand2 className="h-3.5 w-3.5 text-primary" />
                      Describe your cover art
                    </Label>
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="A neon-lit street in Santo Domingo at night, Dominican flag colors, tropical vibes with palm trees silhouettes..."
                      className="bg-black/20 border-white/10 min-h-[80px] resize-none text-sm"
                      data-testid="input-ai-cover-prompt"
                    />
                  </div>
                  <Button
                    onClick={handleGenerateAI}
                    disabled={generateCoverMutation.isPending || !aiPrompt.trim()}
                    className="w-full bg-primary text-black gap-2"
                    data-testid="button-generate-ai-cover"
                  >
                    {generateCoverMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Generate with AI</>
                    )}
                  </Button>
                </motion.div>
              )}

              {activeTab === "filters" && (
                <motion.div key="filters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <Label className="text-sm">Filter Presets</Label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FILTER_PRESETS.map((preset) => (
                      <button key={preset.id} onClick={() => applyFilter(preset)}
                        className={`py-1.5 px-1 rounded-md text-[10px] font-medium transition-all ${
                          selectedFilter.id === preset.id ? "bg-primary/15 text-primary border border-primary/30" : "bg-white/5 text-muted-foreground border border-transparent hover:border-white/10"
                        }`}
                        data-testid={`filter-${preset.id}`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Brightness: {customFilters.brightness}%</Label>
                      <Slider value={[customFilters.brightness]} onValueChange={([v]) => { setCustomFilters(p => ({...p, brightness: v})); setSelectedFilter(FILTER_PRESETS[0]); }} min={50} max={150} step={5} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Contrast: {customFilters.contrast}%</Label>
                      <Slider value={[customFilters.contrast]} onValueChange={([v]) => { setCustomFilters(p => ({...p, contrast: v})); setSelectedFilter(FILTER_PRESETS[0]); }} min={50} max={150} step={5} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Saturation: {customFilters.saturation}%</Label>
                      <Slider value={[customFilters.saturation]} onValueChange={([v]) => { setCustomFilters(p => ({...p, saturation: v})); setSelectedFilter(FILTER_PRESETS[0]); }} min={0} max={200} step={5} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sepia: {customFilters.sepia}%</Label>
                      <Slider value={[customFilters.sepia]} onValueChange={([v]) => { setCustomFilters(p => ({...p, sepia: v})); setSelectedFilter(FILTER_PRESETS[0]); }} min={0} max={100} step={5} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col items-center gap-3">
            <canvas ref={canvasRef} className="w-full max-w-[300px] aspect-square rounded-xl border border-white/10 shadow-xl" style={{ imageRendering: "auto" }} data-testid="canvas-cover-preview" />
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
                Save Cover Art
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
