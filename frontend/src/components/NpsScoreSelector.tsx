interface NpsScoreSelectorProps {
  value: number | null;
  onChange: (score: number) => void;
}

const DetractorFace = () => (
  <svg viewBox="0 0 100 100" className="w-8 h-8">
    <circle cx="50" cy="50" r="50" fill="#e53e3e"/>
    <circle cx="35" cy="38" r="6" fill="#1a1a1a"/>
    <circle cx="65" cy="38" r="6" fill="#1a1a1a"/>
    <path d="M 30 68 Q 50 52 70 68" stroke="#1a1a1a" strokeWidth="5" fill="none" strokeLinecap="round"/>
  </svg>
);

const NeutralFace = () => (
  <svg viewBox="0 0 100 100" className="w-8 h-8">
    <circle cx="50" cy="50" r="50" fill="#ecc94b"/>
    <circle cx="35" cy="38" r="6" fill="#1a1a1a"/>
    <circle cx="65" cy="38" r="6" fill="#1a1a1a"/>
    <line x1="30" y1="65" x2="70" y2="65" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"/>
  </svg>
);

const PromoterFace = () => (
  <svg viewBox="0 0 100 100" className="w-8 h-8">
    <circle cx="50" cy="50" r="50" fill="#38a169"/>
    <circle cx="35" cy="38" r="6" fill="#1a1a1a"/>
    <circle cx="65" cy="38" r="6" fill="#1a1a1a"/>
    <path d="M 30 58 Q 50 78 70 58" stroke="#1a1a1a" strokeWidth="5" fill="none" strokeLinecap="round"/>
  </svg>
);

const getCategory = (score: number): 'detractor' | 'passive' | 'promoter' => {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
};

const CATEGORY_STYLES = {
  detractor: {
    Face: DetractorFace,
    ring: 'ring-4 ring-red-500',
    hover: 'hover:border-red-400 hover:bg-red-50',
    label: 'text-red-500',
    border: 'border-red-500',
    number: 'text-red-600',
  },
  passive: {
    Face: NeutralFace,
    ring: 'ring-4 ring-yellow-400',
    hover: 'hover:border-yellow-300 hover:bg-yellow-50',
    label: 'text-amber-500',
    border: 'border-yellow-400',
    number: 'text-yellow-600',
  },
  promoter: {
    Face: PromoterFace,
    ring: 'ring-4 ring-green-500',
    hover: 'hover:border-green-400 hover:bg-green-50',
    label: 'text-emerald-500',
    border: 'border-green-500',
    number: 'text-green-600',
  },
};

export default function NpsScoreSelector({ value, onChange }: NpsScoreSelectorProps) {
  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-4 sm:flex sm:justify-between gap-2">
        {[...Array(11)].map((_, i) => {
          const cat = getCategory(i);
          const styles = CATEGORY_STYLES[cat];
          const isSelected = value === i;
          const { Face } = styles;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl border-2 font-bold transition-all duration-150
                ${isSelected
                  ? `${styles.border} ${styles.ring} bg-background shadow-lg`
                  : `border-muted bg-background ${styles.hover}`
                }`}
            >
              <span className={`transition-transform duration-150 ${isSelected ? 'scale-125' : ''}`}>
                <Face />
              </span>
              <span className={`text-sm font-black ${isSelected ? styles.number : 'text-muted-foreground'}`}>
                {i}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest px-1">
        <span className={CATEGORY_STYLES.detractor.label}>← Não recomendaria</span>
        <span className={CATEGORY_STYLES.passive.label}>Não fez diferença relevante</span>
        <span className={CATEGORY_STYLES.promoter.label}>Recomendaria com certeza →</span>
      </div>
    </div>
  );
}
