// ═══════════════════════════════════════════════════════════
//  PersonaSelector — pick and manage AI personas (FEAT-007)
// ═══════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Plus, Trash2 } from "lucide-react";
import { getPersonas, createPersona, deletePersona } from "@/lib/api";
import type { Persona } from "@/lib/api";

interface Props {
  activePersonaId: string | null;
  onSelect: (personaId: string | null) => void;
}

const DEFAULT_PERSONAS: Persona[] = [
  {
    id: "general",
    name: "General Assistant",
    description: "Helpful, harmless, and honest AI assistant",
    system_prompt: "You are a helpful, harmless, and honest AI assistant.",
    icon: "🤖",
  },
  {
    id: "coder",
    name: "Code Expert",
    description: "Expert programmer and software architect",
    system_prompt:
      "You are an expert programmer. Write clean, efficient, well-documented code. Explain your choices. Follow best practices.",
    icon: "💻",
  },
  {
    id: "creative",
    name: "Creative Writer",
    description: "Imaginative storyteller and wordsmith",
    system_prompt:
      "You are an imaginative creative writer. Help with stories, poetry, and creative content. Use vivid language.",
    icon: "✍️",
  },
  {
    id: "analyst",
    name: "Data Analyst",
    description: "Expert in data analysis and insights",
    system_prompt:
      "You are a data analyst. Help interpret data, create visualizations, and provide insights.",
    icon: "📊",
  },
];

export default function PersonaSelector({ activePersonaId, onSelect }: Props) {
  const [personas, setPersonas] = useState<Persona[]>(DEFAULT_PERSONAS);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Load personas from backend
  useEffect(() => {
    getPersonas()
      .then((loaded) => {
        if (loaded.length > 0) setPersonas([...DEFAULT_PERSONAS, ...loaded]);
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const active = personas.find((p) => p.id === activePersonaId) ?? personas[0];

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    const id = newName.toLowerCase().replace(/\s+/g, "-");
    const persona: Persona = {
      id,
      name: newName.trim(),
      description: "Custom persona",
      system_prompt: newPrompt.trim(),
      icon: "🎭",
    };
    try {
      await createPersona(persona);
      setPersonas((prev) => [...prev, persona]);
      onSelect(id);
      setNewName("");
      setNewPrompt("");
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create persona:", err);
    }
  }, [newName, newPrompt, onSelect]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deletePersona(id);
        setPersonas((prev) => prev.filter((p) => p.id !== id));
        if (activePersonaId === id) onSelect(null);
      } catch (err) {
        console.error("Failed to delete persona:", err);
      }
    },
    [activePersonaId, onSelect]
  );

  return (
    <div ref={ref} className="relative">
      {/* Selector button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                   bg-evon-card border border-evon-border hover:border-evon-accent/30
                   transition-colors w-full text-left"
        aria-label="Select AI persona"
        aria-expanded={open}
      >
        <span className="text-base">{active.icon}</span>
        <span className="flex-1 truncate text-evon-text">{active.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-evon-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-evon-card border border-evon-border rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {personas.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  p.id === activePersonaId
                    ? "bg-evon-accent/10 text-evon-accent"
                    : "hover:bg-evon-surface text-evon-text"
                }`}
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
              >
                <span className="text-base">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-evon-muted truncate">{p.description}</div>
                </div>
                {!DEFAULT_PERSONAS.some((d) => d.id === p.id) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.id);
                    }}
                    className="p-1 rounded hover:bg-red-500/10 text-evon-muted hover:text-red-400"
                    aria-label={`Delete persona ${p.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Create new */}
          <div className="border-t border-evon-border">
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-3 py-2 w-full text-sm text-evon-accent hover:bg-evon-surface transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create custom persona
              </button>
            ) : (
              <div className="p-3 space-y-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Persona name"
                  className="w-full px-3 py-1.5 text-sm bg-evon-surface border border-evon-border rounded-lg
                             text-evon-text placeholder:text-evon-muted focus:outline-none focus:border-evon-accent"
                  autoFocus
                />
                <textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="System prompt for this persona..."
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm bg-evon-surface border border-evon-border rounded-lg
                             text-evon-text placeholder:text-evon-muted focus:outline-none focus:border-evon-accent resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || !newPrompt.trim()}
                    className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-evon-accent text-white
                               hover:bg-evon-accent-dim disabled:opacity-40 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowCreate(false);
                      setNewName("");
                      setNewPrompt("");
                    }}
                    className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-evon-surface text-evon-muted
                               hover:text-evon-text border border-evon-border transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
