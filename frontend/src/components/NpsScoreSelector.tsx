interface NpsScoreSelectorProps {
  value: number | null;
  onChange: (score: number) => void;
}

const getCategory = (score: number): 'detractor' | 'passive' | 'promoter' => {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
};

const CATEGORY_STYLES = {
  detractor: {
    emoji: '😢',
    selected: 'bg-red-500 border-red-500 text-white',
    hover: 'hover:border-red-400 hover:bg-red-50',
    label: 'text-red-500',
  },
  passive: {
    emoji: '😐',
    selected: 'bg-amber-400 border-amber-400 text-white',
    hover: 'hover:border-amber-300 hover:bg-amber-50',
    label: 'text-amber-500',
  },
  promoter: {
    emoji: '😊',
    selected: 'bg-emerald-500 border-emerald-500 text-white',
    hover: 'hover:border-emerald-400 hover:bg-emerald-50',
    label: 'text-emerald-500',
  },
};

export default function NpsScoreSelector({ value, onChange }: NpsScoreSelectorProps) {
  return (
    <div className="space-y-4 pt-2">
      {/* Score buttons */}
      <div className="grid grid-cols-4 sm:flex sm:justify-between gap-2">
        {[...Array(11)].map((_, i) => {
          const cat = getCategory(i);
          const styles = CATEGORY_STYLES[cat];
          const isSelected = value === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl border-2 font-bold transition-all duration-150
                ${isSelected
                  ? `${styles.selected} shadow-lg`
                  : `border-muted bg-background ${styles.hover}`
                }`}
            >
              <span className={`text-xl transition-transform duration-150 ${isSelected ? 'scale-125' : ''}`}>
                {styles.emoji}
              </span>
              <span className={`text-sm font-black ${isSelected ? '' : 'text-muted-foreground'}`}>
                {i}
              </span>
            </button>
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest px-1">
        <span className={CATEGORY_STYLES.detractor.label}>← Detratores (0–6)</span>
        <span className={CATEGORY_STYLES.passive.label}>Neutros (7–8)</span>
        <span className={CATEGORY_STYLES.promoter.label}>Promotores (9–10) →</span>
      </div>
    </div>
  );
}
