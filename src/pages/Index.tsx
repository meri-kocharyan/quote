import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDisplayLines, parseQuoteText } from "@/lib/quoteUtils";

interface Quote {
  id: string;
  raw_text: string;
  speaker_count: number;
  date_added: string;
}

interface Suggestion {
  id: string;
  raw_text: string;
  speaker_count: number;
  date_submitted: string;
}

const ADMIN_PASSWORD = "iloveluffy";

const Index = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState<string>("any");
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [lastQuoteId, setLastQuoteId] = useState<string | null>(null);
  const [names, setNames] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Admin panel state
  const [pendingSortField, setPendingSortField] = useState<"speakers" | "date">("date");
  const [pendingSortAsc, setPendingSortAsc] = useState(false);
  const [pendingFilterCount, setPendingFilterCount] = useState<string>("all");
  const [manageSortField, setManageSortField] = useState<"speakers" | "date">("date");
  const [manageSortAsc, setManageSortAsc] = useState(false);
  const [manageFilterCount, setManageFilterCount] = useState<string>("all");
  const [editingQuote, setEditingQuote] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const fetchQuotes = useCallback(async () => {
    const { data } = await supabase
      .from("quotes")
      .select("*")
      .order("date_added", { ascending: false });
    if (data) setQuotes(data);
  }, []);

  const fetchSuggestions = useCallback(async () => {
    const { data } = await supabase
      .from("suggestions")
      .select("*")
      .order("date_submitted", { ascending: false });
    if (data) setSuggestions(data);
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    if (isAdmin) fetchSuggestions();
  }, [isAdmin, fetchSuggestions]);

  const filteredQuotes = quotes.filter((q) => {
    if (filter === "any") return true;
    if (filter === "6+") return q.speaker_count >= 6;
    return q.speaker_count === parseInt(filter);
  });

  const getCounts = () => {
    const counts: Record<string, number> = { any: quotes.length };
    for (let i = 1; i <= 5; i++) {
      counts[String(i)] = quotes.filter((q) => q.speaker_count === i).length;
    }
    counts["6+"] = quotes.filter((q) => q.speaker_count >= 6).length;
    return counts;
  };

  const counts = getCounts();

  const generateQuote = () => {
    if (filteredQuotes.length === 0) return;
    if (filteredQuotes.length === 1) {
      setCurrentQuote(filteredQuotes[0]);
      setLastQuoteId(filteredQuotes[0].id);
      return;
    }
    let candidate: Quote;
    do {
      candidate = filteredQuotes[Math.floor(Math.random() * filteredQuotes.length)];
    } while (candidate.id === lastQuoteId);
    setCurrentQuote(candidate);
    setLastQuoteId(candidate.id);
  };

  const handleFilterChange = (val: string) => {
    setFilter(val);
    setLastQuoteId(null);
    setCurrentQuote(null);
  };

  const userNames = names
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n !== "");

  // Password prompt
  const handleAdminClick = () => {
    if (isAdmin) {
      setIsAdmin(false);
      return;
    }
    setShowPasswordPrompt(true);
    setPassword("");
    setPasswordError(false);
    setTimeout(() => passwordInputRef.current?.focus(), 50);
  };

  const handlePasswordSubmit = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowPasswordPrompt(false);
    } else {
      setPasswordError(true);
      setTimeout(() => {
        setShowPasswordPrompt(false);
        setPasswordError(false);
      }, 2000);
    }
  };

  // Close popup on outside click
  useEffect(() => {
    if (!showPasswordPrompt) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPasswordPrompt(false);
        setPasswordError(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPasswordPrompt]);

  // Admin actions
  const approveSuggestion = async (s: Suggestion) => {
    const parsed = parseQuoteText(s.raw_text);
    await supabase.from("quotes").insert({
      raw_text: s.raw_text,
      speaker_count: parsed.speaker_count,
      character_names: parsed.placeholderSpeakers,
    });
    await supabase.from("suggestions").delete().eq("id", s.id);
    fetchQuotes();
    fetchSuggestions();
  };

  const deleteSuggestion = async (id: string) => {
    await supabase.from("suggestions").delete().eq("id", id);
    fetchSuggestions();
  };

  const deleteQuote = async (id: string) => {
    await supabase.from("quotes").delete().eq("id", id);
    fetchQuotes();
    if (currentQuote?.id === id) setCurrentQuote(null);
  };

  const startEditQuote = (q: Quote) => {
    setEditingQuote(q.id);
    setEditText(q.raw_text);
  };

  const saveEditQuote = async () => {
    if (!editingQuote) return;
    const parsed = parseQuoteText(editText);
    await supabase.from("quotes").update({
      raw_text: editText,
      speaker_count: parsed.speaker_count,
      character_names: parsed.placeholderSpeakers,
    }).eq("id", editingQuote);
    setEditingQuote(null);
    fetchQuotes();
  };

  // Sort/filter helpers for admin
  const sortItems = <T extends { speaker_count: number; date_submitted?: string; date_added?: string }>(
    items: T[],
    field: "speakers" | "date",
    asc: boolean,
    dateKey: "date_submitted" | "date_added"
  ): T[] => {
    return [...items].sort((a, b) => {
      if (field === "speakers") {
        return asc ? a.speaker_count - b.speaker_count : b.speaker_count - a.speaker_count;
      }
      const da = new Date((a as any)[dateKey]).getTime();
      const db = new Date((b as any)[dateKey]).getTime();
      return asc ? da - db : db - da;
    });
  };

  const filterByCount = <T extends { speaker_count: number }>(items: T[], f: string): T[] => {
    if (f === "all") return items;
    if (f === "6+") return items.filter((i) => i.speaker_count >= 6);
    return items.filter((i) => i.speaker_count === parseInt(f));
  };

  const displayedSuggestions = sortItems(
    filterByCount(suggestions, pendingFilterCount),
    pendingSortField,
    pendingSortAsc,
    "date_submitted"
  );

  const displayedManageQuotes = sortItems(
    filterByCount(quotes, manageFilterCount),
    manageSortField,
    manageSortAsc,
    "date_added"
  );

  const renderQuoteLines = (raw: string) => {
    const lines = getDisplayLines(raw, userNames);
    return (
      <div className="space-y-1">
        {lines.map((line, i) => (
          <div key={i}>
            {line.speaker ? (
              <>
                <span className="font-bold">{line.speaker}:</span>
                <span>{line.text}</span>
              </>
            ) : (
              <span>{line.text}</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderRawQuoteLines = (raw: string) => {
    const lines = raw.split("\n").filter((l) => l.trim());
    return (
      <div className="space-y-1">
        {lines.map((line, i) => {
          const colonIdx = line.indexOf(":");
          if (colonIdx > 0) {
            return (
              <div key={i}>
                <span className="font-bold">{line.substring(0, colonIdx)}:</span>
                <span>{line.substring(colonIdx + 1)}</span>
              </div>
            );
          }
          return <div key={i}>{line}</div>;
        })}
      </div>
    );
  };

  const SortControls = ({
    sortField,
    sortAsc,
    filterCount,
    onToggleSort,
    onFilterChange,
  }: {
    sortField: "speakers" | "date";
    sortAsc: boolean;
    filterCount: string;
    onToggleSort: (field: "speakers" | "date") => void;
    onFilterChange: (val: string) => void;
  }) => (
    <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
      <button
        onClick={() => onToggleSort("speakers")}
        className="underline-offset-2 hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans"
      >
        sort by speakers {sortField === "speakers" ? (sortAsc ? "↑" : "↓") : ""}
      </button>
      <button
        onClick={() => onToggleSort("date")}
        className="underline-offset-2 hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans"
      >
        sort by date {sortField === "date" ? (sortAsc ? "↑" : "↓") : ""}
      </button>
      <select
        value={filterCount}
        onChange={(e) => onFilterChange(e.target.value)}
        className="border border-foreground bg-background text-foreground px-2 py-1 text-sm font-sans"
      >
        <option value="all">all</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={String(n)}>{n}</option>
        ))}
        <option value="6+">6+</option>
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6 sm:p-12">
      <div className="mx-auto max-w-[800px] border border-foreground p-8 sm:p-12 relative">
        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-8 font-serif">
          Incorrect Quote Generator
        </h1>

        {/* Speaker Count Selector */}
        <div className="mb-6">
          <select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="border border-foreground bg-background text-foreground px-3 py-1.5 text-sm font-sans mr-3"
          >
            <option value="any">any ({counts.any})</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {n} ({counts[String(n)]})
              </option>
            ))}
            <option value="6+">6+ ({counts["6+"]})</option>
          </select>
        </div>

        {/* Generate Button */}
        <div className="mb-8">
          <button
            onClick={generateQuote}
            className="border border-foreground bg-background text-foreground px-4 py-1.5 text-sm cursor-pointer hover:bg-foreground hover:text-background transition-colors font-sans"
          >
            get quote
          </button>
        </div>

        {/* Name Replacement Field */}
        <div className="mb-8">
          <label className="block text-sm mb-2 text-foreground">
            replace person a, person b, etc. with names (one per line):
          </label>
          <textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder={"Mario\nLuigi\nPeach"}
            className="w-full border border-foreground bg-background text-foreground p-3 text-sm font-sans resize-vertical min-h-[80px] placeholder:text-muted-foreground"
            rows={3}
          />
        </div>

        {/* Quote Display */}
        <div className="mb-8 min-h-[60px]">
          {currentQuote ? (
            renderQuoteLines(currentQuote.raw_text)
          ) : filteredQuotes.length === 0 ? (
            <p className="text-foreground">
              no quotes yet, want to{" "}
              <a href="/submit" className="underline hover:no-underline text-foreground">
                submit some?
              </a>
            </p>
          ) : null}
        </div>

        {/* Admin Panel */}
        {isAdmin && (
          <div className="mb-8">
            <div className="border-t border-foreground my-8" />

            {/* PENDING SUGGESTIONS */}
            <h2 className="text-lg font-bold text-foreground mb-4 font-serif">
              PENDING SUGGESTIONS
            </h2>
            <SortControls
              sortField={pendingSortField}
              sortAsc={pendingSortAsc}
              filterCount={pendingFilterCount}
              onToggleSort={(f) => {
                if (pendingSortField === f) setPendingSortAsc(!pendingSortAsc);
                else { setPendingSortField(f); setPendingSortAsc(true); }
              }}
              onFilterChange={setPendingFilterCount}
            />
            {displayedSuggestions.length === 0 ? (
              <p className="text-muted-foreground text-sm mb-6">no pending suggestions</p>
            ) : (
              <div className="space-y-0 mb-6">
                {displayedSuggestions.map((s, idx) => (
                  <div key={s.id}>
                    {idx > 0 && (
                      <div className="mx-2.5 border-t border-separator my-4" />
                    )}
                    <div className="mb-2">{renderRawQuoteLines(s.raw_text)}</div>
                    <div className="text-sm text-muted-foreground mb-2">
                      ({s.speaker_count} speakers) {new Date(s.date_submitted).toLocaleDateString()}
                    </div>
                    <div className="flex gap-3 text-sm">
                      <button
                        onClick={() => approveSuggestion(s)}
                        className="hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans"
                      >
                        [approve]
                      </button>
                      <button
                        onClick={() => deleteSuggestion(s.id)}
                        className="hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans"
                      >
                        [delete]
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-foreground my-8" />

            {/* MANAGE QUOTES */}
            <h2 className="text-lg font-bold text-foreground mb-4 font-serif">
              MANAGE QUOTES
            </h2>
            <div className="mb-3">
              <button
                onClick={() => {
                  setEditingQuote("new");
                  setEditText("");
                }}
                className="hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans underline-offset-2"
              >
                add new
              </button>
            </div>
            <SortControls
              sortField={manageSortField}
              sortAsc={manageSortAsc}
              filterCount={manageFilterCount}
              onToggleSort={(f) => {
                if (manageSortField === f) setManageSortAsc(!manageSortAsc);
                else { setManageSortField(f); setManageSortAsc(true); }
              }}
              onFilterChange={setManageFilterCount}
            />

            {editingQuote === "new" && (
              <div className="mb-6 border border-foreground p-4">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full border border-foreground bg-background text-foreground p-3 text-sm font-sans resize-vertical min-h-[100px] mb-3"
                  rows={5}
                />
                <div className="flex gap-3 text-sm">
                  <button
                    onClick={async () => {
                      if (!editText.trim()) return;
                      const parsed = parseQuoteText(editText);
                      await supabase.from("quotes").insert({
                        raw_text: editText,
                        speaker_count: parsed.speaker_count,
                        character_names: parsed.placeholderSpeakers,
                      });
                      setEditingQuote(null);
                      fetchQuotes();
                    }}
                    className="hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans"
                  >
                    [save]
                  </button>
                  <button
                    onClick={() => setEditingQuote(null)}
                    className="hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans"
                  >
                    [cancel]
                  </button>
                </div>
              </div>
            )}

            {displayedManageQuotes.length === 0 ? (
              <p className="text-muted-foreground text-sm">no quotes</p>
            ) : (
              <div className="space-y-0">
                {displayedManageQuotes.map((q, idx) => (
                  <div key={q.id}>
                    {idx > 0 && (
                      <div className="mx-2.5 border-t border-separator my-4" />
                    )}
                    {editingQuote === q.id ? (
                      <div className="mb-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full border border-foreground bg-background text-foreground p-3 text-sm font-sans resize-vertical min-h-[100px] mb-3"
                          rows={5}
                        />
                        <div className="flex gap-3 text-sm">
                          <button onClick={saveEditQuote} className="hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans">[save]</button>
                          <button onClick={() => setEditingQuote(null)} className="hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans">[cancel]</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-2">{renderRawQuoteLines(q.raw_text)}</div>
                        <div className="text-sm text-muted-foreground mb-2">
                          ({q.speaker_count} speakers) {new Date(q.date_added).toLocaleDateString()}
                        </div>
                        <div className="flex gap-3 text-sm">
                          <button onClick={() => startEditQuote(q)} className="hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans">[edit]</button>
                          <button onClick={() => deleteQuote(q.id)} className="hover:underline bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans">[delete]</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="text-right mb-2">
          <a
            href="/submit"
            className="text-foreground text-sm no-underline hover:underline"
          >
            submit quote
          </a>
        </div>

        {/* Hidden Admin Trigger */}
        <div className="text-right">
          <button
            onClick={handleAdminClick}
            className={`bg-background border-none cursor-pointer p-0 text-sm font-sans ${
              isAdmin
                ? "text-foreground"
                : "text-background hover:text-foreground"
            }`}
          >
            {isAdmin ? "admin" : "a"}
          </button>
        </div>

        {/* Password Prompt */}
        {showPasswordPrompt && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div
              ref={popupRef}
              className="border border-foreground bg-background p-6 max-w-xs w-full"
            >
              {passwordError ? (
                <p className="text-foreground text-sm">incorrect</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <label className="text-sm text-foreground">password:</label>
                    <input
                      ref={passwordInputRef}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                      className="border border-foreground bg-background text-foreground px-2 py-1 text-sm font-sans flex-1"
                    />
                  </div>
                  <div className="flex gap-4 text-sm">
                    <button
                      onClick={handlePasswordSubmit}
                      className="border border-foreground bg-background text-foreground px-3 py-1 cursor-pointer text-sm font-sans hover:bg-foreground hover:text-background transition-colors"
                    >
                      submit
                    </button>
                    <button
                      onClick={() => setShowPasswordPrompt(false)}
                      className="bg-background border-none cursor-pointer p-0 text-foreground text-sm font-sans hover:underline"
                    >
                      cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
