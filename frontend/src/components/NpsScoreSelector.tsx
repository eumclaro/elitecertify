import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Tooltip, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    selectedBg: 'bg-red-50 border border-red-200',
    hover: 'hover:bg-red-50 hover:border-red-200',
    number: 'text-red-600',
    tooltip: 'Não recomendaria',
    tooltipClass: 'bg-red-600 text-white',
    tooltipArrow: 'fill-red-600',
    feedback: 'text-red-600',
  },
  passive: {
    Face: NeutralFace,
    selectedBg: 'bg-yellow-50 border border-yellow-200',
    hover: 'hover:bg-yellow-50 hover:border-yellow-200',
    number: 'text-yellow-600',
    tooltip: 'Não fez diferença relevante',
    tooltipClass: 'bg-amber-500 text-slate-900',
    tooltipArrow: 'fill-amber-500',
    feedback: 'text-yellow-600',
  },
  promoter: {
    Face: PromoterFace,
    selectedBg: 'bg-green-50 border border-green-200',
    hover: 'hover:bg-green-50 hover:border-green-200',
    number: 'text-green-600',
    tooltip: 'Recomendaria com certeza',
    tooltipClass: 'bg-green-600 text-white',
    tooltipArrow: 'fill-green-600',
    feedback: 'text-green-600',
  },
};

export default function NpsScoreSelector({ value, onChange }: NpsScoreSelectorProps) {
  const selectedCat = value !== null ? getCategory(value) : null;
  const feedbackText = selectedCat ? CATEGORY_STYLES[selectedCat].tooltip : null;
  const feedbackColor = selectedCat ? CATEGORY_STYLES[selectedCat].feedback : 'text-muted-foreground';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-4 sm:flex sm:justify-between gap-2">
          {[...Array(11)].map((_, i) => {
            const cat = getCategory(i);
            const styles = CATEGORY_STYLES[cat];
            const isSelected = value === i;
            const { Face } = styles;
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onChange(i)}
                    className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl border font-bold transition-colors duration-150
                      ${isSelected
                        ? styles.selectedBg
                        : `border-muted bg-background ${styles.hover}`
                      }`}
                  >
                    <span className={`transition-transform duration-150 ${isSelected ? 'scale-110' : ''}`}>
                      <Face />
                    </span>
                    <span className={`text-sm font-black ${isSelected ? styles.number : 'text-muted-foreground'}`}>
                      {i}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content
                    side="top"
                    sideOffset={6}
                    className={`z-50 rounded-md px-3 py-1.5 text-xs font-medium animate-in fade-in-0 zoom-in-95 ${styles.tooltipClass}`}
                  >
                    {styles.tooltip}
                    <TooltipPrimitive.Arrow className={styles.tooltipArrow} />
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </Tooltip>
            );
          })}
        </div>

        <p className={`text-center text-sm font-medium transition-colors duration-200 mt-4 ${feedbackColor}`}>
          {feedbackText ?? 'Selecione uma nota de 0 a 10'}
        </p>
      </div>
    </TooltipProvider>
  );
}
