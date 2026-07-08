/** A wrap of toggle chips for multi-selecting ids (categories / services / areas). */
export function TagPicker({
  options,
  selected,
  onToggle,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              on ? 'border-navy bg-navy text-white' : 'border-cream-dark text-navy/70 hover:bg-cream'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
