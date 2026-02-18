import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Edit, Save, X, Loader2, Music, GripVertical, ChevronDown, ChevronRight,
} from "lucide-react";
import type { GenreStyle } from "@shared/schema";
import { STYLE_KIT_GENRES } from "@shared/schema";

const GENRE_LABELS: Record<string, string> = {
  bachata: "Bachata",
  bolero: "Bolero",
  merengue: "Merengue",
  salsa: "Salsa",
  cumbia: "Cumbia",
  vallenato: "Vallenato",
  reggaeton: "Reggaeton",
  latin_pop: "Latin Pop",
  son: "Son",
  mambo: "Mambo",
  cha_cha_cha: "Cha-Cha-Chá",
  guaracha: "Guaracha",
  dembow: "Dembow",
  plena: "Plena",
  bomba: "Bomba",
  punta: "Punta",
  champeta: "Champeta",
  tropical: "Tropical",
  afrobeat: "Afrobeat",
  jazz: "Jazz",
  rock: "Rock",
  pop: "Pop",
  r_and_b: "R&B",
  hip_hop: "Hip Hop",
  edm: "EDM",
  k_pop: "K-Pop",
  synthwave: "Synthwave",
  house: "House",
  soul: "Soul",
  country: "Country",
  blues: "Blues",
  indie: "Indie",
  classical: "Classical",
  funk: "Funk",
  drum_and_bass: "Drum & Bass",
};

const COMMON_INSTRUMENTS = [
  "bongo", "conga", "guira", "timbal", "campanas",
  "requinto", "segunda_guitarra", "bajo", "piano", "pad",
  "violines", "chelos", "voz_principal", "duo_voz", "coros",
  "accordion", "tambora", "saxophone", "trumpet", "maracas",
  "claves", "cowbell", "tres_cubano", "contrabajo", "guitarra_acustica",
  "dembow_beat", "808_bass", "hi_hats", "synth_lead",
];

interface StyleForm {
  genre: string;
  name: string;
  slug: string;
  description: string;
  promptHint: string;
  baseInstruments: string[];
  extraInstruments: string[];
  displayOrder: number;
  isActive: boolean;
}

const emptyForm: StyleForm = {
  genre: "bachata",
  name: "",
  slug: "",
  description: "",
  promptHint: "",
  baseInstruments: [],
  extraInstruments: [],
  displayOrder: 0,
  isActive: true,
};

function slugify(text: string): string {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function GenreStylesTab() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<StyleForm>({ ...emptyForm });
  const [expandedGenres, setExpandedGenres] = useState<Set<string>>(new Set(["bachata", "bolero", "merengue"]));
  const [instrumentInput, setInstrumentInput] = useState("");
  const [extraInstrumentInput, setExtraInstrumentInput] = useState("");

  const { data: styles = [], isLoading } = useQuery<GenreStyle[]>({
    queryKey: ["/api/genre-styles"],
  });

  const createMutation = useMutation({
    mutationFn: (data: StyleForm) => apiRequest("POST", "/api/genre-styles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/genre-styles"] });
      toast({ title: "Estilo creado" });
      setCreating(false);
      setForm({ ...emptyForm });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StyleForm> }) =>
      apiRequest("PATCH", `/api/genre-styles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/genre-styles"] });
      toast({ title: "Estilo actualizado" });
      setEditing(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/genre-styles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/genre-styles"] });
      toast({ title: "Estilo eliminado" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const stylesByGenre = styles.reduce<Record<string, GenreStyle[]>>((acc, s) => {
    if (!acc[s.genre]) acc[s.genre] = [];
    acc[s.genre].push(s);
    return acc;
  }, {});

  const genresWithStyles = Object.keys(stylesByGenre).sort();

  const toggleGenre = (genre: string) => {
    const next = new Set(expandedGenres);
    if (next.has(genre)) next.delete(genre);
    else next.add(genre);
    setExpandedGenres(next);
  };

  const startEdit = (style: GenreStyle) => {
    setEditing(style.id);
    setForm({
      genre: style.genre,
      name: style.name,
      slug: style.slug,
      description: style.description || "",
      promptHint: style.promptHint || "",
      baseInstruments: style.baseInstruments || [],
      extraInstruments: style.extraInstruments || [],
      displayOrder: style.displayOrder || 0,
      isActive: style.isActive ?? true,
    });
  };

  const addInstrument = (type: "base" | "extra") => {
    const input = type === "base" ? instrumentInput : extraInstrumentInput;
    const key = type === "base" ? "baseInstruments" : "extraInstruments";
    if (!input.trim()) return;
    const val = slugify(input.trim());
    if (val && !form[key].includes(val)) {
      setForm({ ...form, [key]: [...form[key], val] });
    }
    if (type === "base") setInstrumentInput("");
    else setExtraInstrumentInput("");
  };

  const removeInstrument = (type: "base" | "extra", instr: string) => {
    const key = type === "base" ? "baseInstruments" : "extraInstruments";
    setForm({ ...form, [key]: form[key].filter(i => i !== instr) });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="genre-styles-tab">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-genre-styles-title">Estilos de Genero (Tocadas)</h2>
          <p className="text-sm text-muted-foreground">Define sub-estilos y tocadas por genero para el panel de creacion</p>
        </div>
        <Button
          onClick={() => { setCreating(true); setForm({ ...emptyForm }); }}
          disabled={creating}
          data-testid="button-create-genre-style"
        >
          <Plus className="h-4 w-4 mr-1" /> Nuevo Estilo
        </Button>
      </div>

      {creating && (
        <Card data-testid="card-create-genre-style">
          <CardHeader>
            <CardTitle className="text-base">Crear Nuevo Estilo</CardTitle>
          </CardHeader>
          <CardContent>
            <StyleFormUI
              form={form}
              setForm={setForm}
              instrumentInput={instrumentInput}
              setInstrumentInput={setInstrumentInput}
              extraInstrumentInput={extraInstrumentInput}
              setExtraInstrumentInput={setExtraInstrumentInput}
              addInstrument={addInstrument}
              removeInstrument={removeInstrument}
              onSave={() => createMutation.mutate(form)}
              onCancel={() => setCreating(false)}
              saving={createMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      <div className="text-sm text-muted-foreground">
        {styles.length} estilos en {genresWithStyles.length} generos
      </div>

      {genresWithStyles.map(genre => (
        <Card key={genre} data-testid={`card-genre-group-${genre}`}>
          <CardHeader className="cursor-pointer py-3" onClick={() => toggleGenre(genre)}>
            <div className="flex items-center gap-2">
              {expandedGenres.has(genre)
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
              }
              <CardTitle className="text-base">
                {GENRE_LABELS[genre] || genre}
              </CardTitle>
              <Badge variant="secondary">{stylesByGenre[genre].length}</Badge>
            </div>
          </CardHeader>
          {expandedGenres.has(genre) && (
            <CardContent className="pt-0 space-y-3">
              {stylesByGenre[genre]
                .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                .map(style => (
                  <div
                    key={style.id}
                    className="border rounded-md p-3 space-y-2"
                    data-testid={`card-genre-style-${style.id}`}
                  >
                    {editing === style.id ? (
                      <StyleFormUI
                        form={form}
                        setForm={setForm}
                        instrumentInput={instrumentInput}
                        setInstrumentInput={setInstrumentInput}
                        extraInstrumentInput={extraInstrumentInput}
                        setExtraInstrumentInput={setExtraInstrumentInput}
                        addInstrument={addInstrument}
                        removeInstrument={removeInstrument}
                        onSave={() => updateMutation.mutate({ id: style.id, data: form })}
                        onCancel={() => setEditing(null)}
                        saving={updateMutation.isPending}
                        isEdit
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium" data-testid={`text-style-name-${style.id}`}>{style.name}</span>
                            <Badge variant="outline" className="text-xs">{style.slug}</Badge>
                            {!style.isActive && <Badge variant="destructive" className="text-xs">Inactivo</Badge>}
                            <Badge variant="secondary" className="text-xs">#{style.displayOrder}</Badge>
                          </div>
                          {style.description && (
                            <p className="text-sm text-muted-foreground mt-1">{style.description}</p>
                          )}
                          {style.promptHint && (
                            <p className="text-xs text-muted-foreground mt-1 italic">Prompt: {style.promptHint}</p>
                          )}
                          <div className="flex gap-1 flex-wrap mt-2">
                            {(style.baseInstruments || []).map(instr => (
                              <Badge key={instr} variant="default" className="text-xs">{instr}</Badge>
                            ))}
                            {(style.extraInstruments || []).map(instr => (
                              <Badge key={instr} variant="outline" className="text-xs">{instr}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(style)} data-testid={`button-edit-style-${style.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Eliminar estilo "${style.name}"?`)) {
                                deleteMutation.mutate(style.id);
                              }
                            }}
                            data-testid={`button-delete-style-${style.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </CardContent>
          )}
        </Card>
      ))}

      {genresWithStyles.length === 0 && !creating && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay estilos definidos todavia.</p>
            <p className="text-sm">Crea tu primer estilo para empezar a personalizar tus generos.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StyleFormUI({
  form,
  setForm,
  instrumentInput,
  setInstrumentInput,
  extraInstrumentInput,
  setExtraInstrumentInput,
  addInstrument,
  removeInstrument,
  onSave,
  onCancel,
  saving,
  isEdit = false,
}: {
  form: StyleForm;
  setForm: (f: StyleForm) => void;
  instrumentInput: string;
  setInstrumentInput: (v: string) => void;
  extraInstrumentInput: string;
  setExtraInstrumentInput: (v: string) => void;
  addInstrument: (type: "base" | "extra") => void;
  removeInstrument: (type: "base" | "extra", instr: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Genero</label>
          <select
            className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            value={form.genre}
            onChange={e => setForm({ ...form, genre: e.target.value })}
            disabled={isEdit}
            data-testid="select-genre"
          >
            {STYLE_KIT_GENRES.map(g => (
              <option key={g} value={g}>{GENRE_LABELS[g] || g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre</label>
          <Input
            value={form.name}
            onChange={e => {
              const name = e.target.value;
              setForm({ ...form, name, slug: isEdit ? form.slug : slugify(name) });
            }}
            placeholder="ej: Majao"
            data-testid="input-style-name"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Slug</label>
          <Input
            value={form.slug}
            onChange={e => setForm({ ...form, slug: e.target.value })}
            placeholder="ej: majao"
            data-testid="input-style-slug"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripcion</label>
          <Textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Descripcion del estilo..."
            className="resize-none"
            rows={2}
            data-testid="input-style-description"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Prompt Hint (para IA)</label>
          <Textarea
            value={form.promptHint}
            onChange={e => setForm({ ...form, promptHint: e.target.value })}
            placeholder="ej: Ritmo de majao con tambora y guira rapida..."
            className="resize-none"
            rows={2}
            data-testid="input-style-prompt-hint"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Orden</label>
          <Input
            type="number"
            value={form.displayOrder}
            onChange={e => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
            data-testid="input-style-order"
          />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
              className="rounded"
              data-testid="checkbox-style-active"
            />
            <span className="text-sm">Activo</span>
          </label>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Instrumentos Base</label>
        <div className="flex gap-1 flex-wrap mb-2">
          {form.baseInstruments.map(instr => (
            <Badge key={instr} variant="default" className="text-xs gap-1">
              {instr}
              <button onClick={() => removeInstrument("base", instr)} className="ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={instrumentInput}
            onChange={e => setInstrumentInput(e.target.value)}
            placeholder="Agregar instrumento..."
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addInstrument("base"); } }}
            className="flex-1"
            list="common-instruments-list"
            data-testid="input-base-instrument"
          />
          <Button size="sm" variant="outline" onClick={() => addInstrument("base")} data-testid="button-add-base-instrument">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <datalist id="common-instruments-list">
          {COMMON_INSTRUMENTS.map(i => <option key={i} value={i} />)}
        </datalist>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Instrumentos Extra (Orquestacion opcional)</label>
        <div className="flex gap-1 flex-wrap mb-2">
          {form.extraInstruments.map(instr => (
            <Badge key={instr} variant="outline" className="text-xs gap-1">
              {instr}
              <button onClick={() => removeInstrument("extra", instr)} className="ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={extraInstrumentInput}
            onChange={e => setExtraInstrumentInput(e.target.value)}
            placeholder="Agregar instrumento extra..."
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addInstrument("extra"); } }}
            className="flex-1"
            list="common-instruments-list"
            data-testid="input-extra-instrument"
          />
          <Button size="sm" variant="outline" onClick={() => addInstrument("extra")} data-testid="button-add-extra-instrument">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={onSave}
          disabled={saving || !form.name.trim() || !form.slug.trim()}
          data-testid="button-save-style"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          {isEdit ? "Guardar" : "Crear"}
        </Button>
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-style">
          <X className="h-4 w-4 mr-1" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
