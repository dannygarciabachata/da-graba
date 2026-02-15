import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Palette, RefreshCw, Sparkles, X, Upload, Image, Wand2, Loader2, SlidersHorizontal, Save, History, Trash2, GripVertical, Star, Zap } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

const GLAMOUR_EFFECTS = [
  { id: "none", name: "None", icon: X },
  { id: "glamour", name: "Glamour Glow", icon: Star },
  { id: "vignette", name: "Vignette", icon: Image },
  { id: "grain", name: "Film Grain", icon: SlidersHorizontal },
  { id: "neonGlow", name: "Neon Glow", icon: Zap },
  { id: "duotone", name: "Duotone", icon: Palette },
];

interface TextPosition {
  x: number;
  y: number;
}

interface CoverArtDesignerProps {
  songTitle?: string;
  artistName?: string;
  songId?: number;
  existingImageUrl?: string;
  onSave?: (dataUrl: string) => void;
  onApplied?: () => void;
  onClose?: () => void;
}

export function CoverArtDesigner({ songTitle = "", artistName = "", songId, existingImageUrl, onSave, onApplied, onClose }: CoverArtDesignerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
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
  const [aiEffectPrompt, setAiEffectPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<"template" | "upload" | "ai" | "filters" | "effects" | "history">("template");
  const [selectedFilter, setSelectedFilter] = useState(FILTER_PRESETS[0]);
  const [customFilters, setCustomFilters] = useState({ brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, grayscale: 0, hueRotate: 0 });
  const [glamourEffect, setGlamourEffect] = useState("none");
  const [duotoneColor, setDuotoneColor] = useState("#FF00FF");
  const [titlePos, setTitlePos] = useState<TextPosition>({ x: 400, y: 600 });
  const [artistPos, setArtistPos] = useState<TextPosition>({ x: 400, y: 680 });
  const [dragging, setDragging] = useState<"title" | "artist" | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [designName, setDesignName] = useState("Untitled Design");
  const [currentDesignId, setCurrentDesignId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: savedDesigns = [], refetch: refetchDesigns } = useQuery<any[]>({
    queryKey: ["/api/cover-designs"],
  });

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

  const suggestEffectsMutation = useMutation({
    mutationFn: async (data: { prompt: string; currentFilters: any }) => {
      const res = await apiRequest("POST", "/api/ai/suggest-effects", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.brightness !== undefined) {
        setCustomFilters({
          brightness: data.brightness ?? 100,
          contrast: data.contrast ?? 100,
          saturation: data.saturation ?? 100,
          blur: data.blur ?? 0,
          sepia: data.sepia ?? 0,
          grayscale: data.grayscale ?? 0,
          hueRotate: data.hueRotate ?? 0,
        });
        setSelectedFilter(FILTER_PRESETS[0]);
      }
      if (data.glamour) setGlamourEffect("glamour");
      else if (data.vignette) setGlamourEffect("vignette");
      else if (data.grain) setGlamourEffect("grain");
      else if (data.neonGlow) setGlamourEffect("neonGlow");
      if (data.duotone) {
        setGlamourEffect("duotone");
        setDuotoneColor(data.duotone);
      }
      toast({ description: data.suggestion || "AI effects applied!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to get AI suggestions", variant: "destructive" });
    },
  });

  const saveDesignMutation = useMutation({
    mutationFn: async (data: any) => {
      if (currentDesignId) {
        const res = await apiRequest("PATCH", `/api/cover-designs/${currentDesignId}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/cover-designs", data);
        return res.json();
      }
    },
    onSuccess: (data) => {
      setCurrentDesignId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/cover-designs"] });
      toast({ description: "Design saved!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save design", variant: "destructive" });
    },
  });

  const deleteDesignMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cover-designs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cover-designs"] });
      toast({ description: "Design deleted" });
    },
  });

  const saveRenderMutation = useMutation({
    mutationFn: async (data: { imageData: string; designId?: number }) => {
      const res = await apiRequest("POST", "/api/cover-designs/save-render", data);
      return res.json();
    },
  });

  const applyToSongMutation = useMutation({
    mutationFn: async () => {
      if (!songId) throw new Error("No song selected");
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("No canvas");
      const imageData = canvas.toDataURL("image/png");
      const renderResult = await saveRenderMutation.mutateAsync({ imageData });
      if (!renderResult?.url) throw new Error("Failed to render");
      const res = await apiRequest("PATCH", `/api/songs/${songId}/cover`, { imageUrl: renderResult.url });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({ description: "Cover art applied to your song!" });
      onApplied?.();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply cover art", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (existingImageUrl) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setUploadedImage(img);
      };
      img.src = existingImageUrl;
    }
  }, [existingImageUrl]);

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

    if (glamourEffect === "glamour") {
      const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.7);
      grd.addColorStop(0, "rgba(255, 215, 0, 0.15)");
      grd.addColorStop(0.5, "rgba(255, 180, 0, 0.08)");
      grd.addColorStop(1, "rgba(255, 215, 0, 0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);
    } else if (glamourEffect === "vignette") {
      const grd = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.7);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);
    } else if (glamourEffect === "grain") {
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 40;
        data[i] += noise;
        data[i + 1] += noise;
        data[i + 2] += noise;
      }
      ctx.putImageData(imageData, 0, 0);
    } else if (glamourEffect === "neonGlow") {
      ctx.save();
      ctx.shadowColor = "#00F3FF";
      ctx.shadowBlur = 30;
      ctx.strokeStyle = "rgba(0, 243, 255, 0.3)";
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 20, size - 40, size - 40);
      ctx.strokeRect(35, 35, size - 70, size - 70);
      ctx.restore();
    } else if (glamourEffect === "duotone") {
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      const r = parseInt(duotoneColor.slice(1, 3), 16);
      const g = parseInt(duotoneColor.slice(3, 5), 16);
      const b = parseInt(duotoneColor.slice(5, 7), 16);
      for (let i = 0; i < data.length; i += 4) {
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const t = lum / 255;
        data[i] = Math.round(r * t);
        data[i + 1] = Math.round(g * t);
        data[i + 2] = Math.round(b * t);
      }
      ctx.putImageData(imageData, 0, 0);
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

    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 3;

    lines.forEach((line, i) => {
      ctx.fillText(line, titlePos.x, titlePos.y + i * lineHeight - totalTextHeight / 2 + lineHeight / 2);
    });

    if (showSubtitle && artist) {
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 8;
      ctx.font = `${artistSize[0]}px ${font.family}`;
      ctx.globalAlpha = 0.8;
      ctx.fillText(artist, artistPos.x, artistPos.y);
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
  }, [title, artist, template, font, titleSize, artistSize, showSubtitle, uploadedImage, getFilterString, glamourEffect, duotoneColor, titlePos, artistPos]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const preview = previewRef.current;
    if (!preview) return { x: 0, y: 0 };
    const rect = preview.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 800 / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const hitTest = useCallback((cx: number, cy: number): "title" | "artist" | null => {
    const tSize = titleSize[0];
    if (Math.abs(cx - titlePos.x) < 200 && Math.abs(cy - titlePos.y) < tSize) {
      return "title";
    }
    if (showSubtitle && artist && Math.abs(cx - artistPos.x) < 150 && Math.abs(cy - artistPos.y) < artistSize[0]) {
      return "artist";
    }
    return null;
  }, [titlePos, artistPos, titleSize, artistSize, showSubtitle, artist]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const hit = hitTest(coords.x, coords.y);
    if (hit) {
      setDragging(hit);
      const pos = hit === "title" ? titlePos : artistPos;
      setDragOffset({ x: coords.x - pos.x, y: coords.y - pos.y });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }, [getCanvasCoords, hitTest, titlePos, artistPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const newX = Math.max(40, Math.min(760, coords.x - dragOffset.x));
    const newY = Math.max(40, Math.min(760, coords.y - dragOffset.y));
    if (dragging === "title") {
      setTitlePos({ x: newX, y: newY });
    } else {
      setArtistPos({ x: newX, y: newY });
    }
  }, [dragging, getCanvasCoords, dragOffset]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

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

  const handleSuggestEffects = () => {
    if (!aiEffectPrompt.trim()) return;
    suggestEffectsMutation.mutate({ prompt: aiEffectPrompt, currentFilters: customFilters });
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

  const handleSaveDesign = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL("image/png");

    const renderResult = await saveRenderMutation.mutateAsync({
      imageData,
      designId: currentDesignId || undefined,
    });

    saveDesignMutation.mutate({
      name: designName,
      songId: songId || null,
      templateId: template.id,
      fontId: font.id,
      titleText: title,
      artistText: artist,
      titleSize: titleSize[0],
      artistSize: artistSize[0],
      titlePosition: titlePos,
      artistPosition: artistPos,
      filterSettings: customFilters,
      overlayElements: [{ type: "glamour", effect: glamourEffect, duotoneColor }],
      renderedImageUrl: renderResult?.url || null,
      thumbnailUrl: renderResult?.url || null,
      aiPrompt: aiPrompt || aiEffectPrompt || null,
    });
  };

  const loadDesign = (design: any) => {
    setCurrentDesignId(design.id);
    setDesignName(design.name || "Untitled Design");
    if (design.titleText) setTitle(design.titleText);
    if (design.artistText) setArtist(design.artistText);
    if (design.titleSize) setTitleSize([design.titleSize]);
    if (design.artistSize) setArtistSize([design.artistSize]);
    if (design.titlePosition) setTitlePos(design.titlePosition as TextPosition);
    if (design.artistPosition) setArtistPos(design.artistPosition as TextPosition);
    if (design.templateId) {
      const t = TEMPLATES.find((t) => t.id === design.templateId);
      if (t) setTemplate(t);
    }
    if (design.fontId) {
      const f = FONTS.find((f) => f.id === design.fontId);
      if (f) setFont(f);
    }
    if (design.filterSettings && typeof design.filterSettings === "object") {
      setCustomFilters({
        brightness: (design.filterSettings as any).brightness ?? 100,
        contrast: (design.filterSettings as any).contrast ?? 100,
        saturation: (design.filterSettings as any).saturation ?? 100,
        blur: (design.filterSettings as any).blur ?? 0,
        sepia: (design.filterSettings as any).sepia ?? 0,
        grayscale: (design.filterSettings as any).grayscale ?? 0,
        hueRotate: (design.filterSettings as any).hueRotate ?? 0,
      });
      setSelectedFilter(FILTER_PRESETS[0]);
    }
    if (design.overlayElements && Array.isArray(design.overlayElements) && design.overlayElements.length > 0) {
      const eff = design.overlayElements[0];
      if (eff.effect) setGlamourEffect(eff.effect);
      if (eff.duotoneColor) setDuotoneColor(eff.duotoneColor);
    }
    if (design.backgroundImageUrl) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setUploadedImage(img);
      img.src = design.backgroundImageUrl;
    }
    toast({ description: `Loaded: ${design.name}` });
    setActiveTab("template");
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
    { id: "effects", label: "Effects", icon: Star },
    { id: "history", label: "History", icon: History },
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
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
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

              {activeTab === "effects" && (
                <motion.div key="effects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <Label className="text-sm">Glamour Effects</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {GLAMOUR_EFFECTS.map((eff) => (
                      <button
                        key={eff.id}
                        onClick={() => setGlamourEffect(eff.id)}
                        className={`py-2 px-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                          glamourEffect === eff.id
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-white/5 text-muted-foreground border border-transparent hover:border-white/10"
                        }`}
                        data-testid={`effect-${eff.id}`}
                      >
                        <eff.icon className="h-4 w-4" />
                        <span>{eff.name}</span>
                      </button>
                    ))}
                  </div>

                  {glamourEffect === "duotone" && (
                    <div className="space-y-2">
                      <Label className="text-xs">Duotone Color</Label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={duotoneColor}
                          onChange={(e) => setDuotoneColor(e.target.value)}
                          className="w-10 h-8 rounded cursor-pointer border border-white/10"
                          data-testid="input-duotone-color"
                        />
                        <Input
                          value={duotoneColor}
                          onChange={(e) => setDuotoneColor(e.target.value)}
                          className="bg-black/20 border-white/10 text-xs flex-1"
                          data-testid="input-duotone-hex"
                        />
                      </div>
                    </div>
                  )}

                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <Label className="text-sm flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      AI Effect Suggestions
                    </Label>
                    <Textarea
                      value={aiEffectPrompt}
                      onChange={(e) => setAiEffectPrompt(e.target.value)}
                      placeholder="Make it look cinematic and moody with a warm vintage feel..."
                      className="bg-black/20 border-white/10 min-h-[60px] resize-none text-sm"
                      data-testid="input-ai-effect-prompt"
                    />
                    <Button
                      onClick={handleSuggestEffects}
                      disabled={suggestEffectsMutation.isPending || !aiEffectPrompt.trim()}
                      size="sm"
                      className="w-full bg-primary/10 text-primary border border-primary/20 gap-2"
                      data-testid="button-suggest-effects"
                    >
                      {suggestEffectsMutation.isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...</>
                      ) : (
                        <><Sparkles className="h-3.5 w-3.5" /> Apply AI Effects</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={designName}
                      onChange={(e) => setDesignName(e.target.value)}
                      placeholder="Design name"
                      className="bg-black/20 border-white/10 text-sm flex-1"
                      data-testid="input-design-name"
                    />
                    <Button
                      onClick={handleSaveDesign}
                      disabled={saveDesignMutation.isPending || saveRenderMutation.isPending}
                      size="sm"
                      className="bg-primary text-black gap-1.5"
                      data-testid="button-save-design"
                    >
                      {saveDesignMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {savedDesigns.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No saved designs yet</p>
                    ) : (
                      savedDesigns.map((design: any) => (
                        <div
                          key={design.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                            currentDesignId === design.id
                              ? "border-primary/30 bg-primary/5"
                              : "border-white/5 bg-white/[0.02] hover:border-white/10"
                          }`}
                          data-testid={`design-item-${design.id}`}
                        >
                          {design.thumbnailUrl ? (
                            <img
                              src={design.thumbnailUrl}
                              alt={design.name}
                              className="w-10 h-10 rounded object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                              <Image className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0" onClick={() => loadDesign(design)}>
                            <p className="text-xs font-medium truncate">{design.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(design.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-400"
                            onClick={(e) => { e.stopPropagation(); deleteDesignMutation.mutate(design.id); }}
                            data-testid={`button-delete-design-${design.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative w-full max-w-[300px]">
              <div
                ref={previewRef}
                className="relative aspect-square rounded-xl border border-white/10 shadow-xl overflow-hidden touch-none select-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ cursor: dragging ? "grabbing" : "default" }}
                data-testid="canvas-cover-preview-wrapper"
              >
                <canvas
                  ref={canvasRef}
                  className="w-full h-full"
                  style={{ imageRendering: "auto" }}
                  data-testid="canvas-cover-preview"
                />
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center">
                <Badge variant="outline" className="bg-black/60 backdrop-blur-sm border-white/10 text-[9px] text-white/60">
                  <GripVertical className="h-2.5 w-2.5 mr-1" />
                  Drag text to reposition
                </Badge>
              </div>
            </div>
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
            {songId && (
              <Button
                className="w-full max-w-[300px] bg-green-600 hover:bg-green-700 text-white gap-1.5"
                onClick={() => applyToSongMutation.mutate()}
                disabled={applyToSongMutation.isPending}
                data-testid="button-apply-to-song"
              >
                {applyToSongMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Applying...</>
                ) : (
                  <><Save className="h-4 w-4" /> Apply to Song</>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}