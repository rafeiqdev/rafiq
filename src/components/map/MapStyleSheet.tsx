import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal';
import { AppIcon } from '../AppIcon';
import type { IconName } from '../AppIcon';

/** The four map looks offered in the sheet — Apple-Maps-style "Map Modes". */
export type MapMode = 'explore' | 'threeD' | 'satellite' | 'transit';

export const MAP_MODES: MapMode[] = ['explore', 'threeD', 'satellite', 'transit'];

const MODE_ICON: Record<MapMode, IconName> = {
  explore: 'compass',
  threeD: 'building',
  satellite: 'globe',
  transit: 'bus',
};

/**
 * A little CSS "map snippet" for each card, echoing the thumbnails in Apple's
 * Map Modes sheet. Pure gradients + a few strokes — no image assets, so it
 * stays crisp on every screen and adds no network cost.
 */
const MODE_PREVIEW: Record<MapMode, string> = {
  explore: 'linear-gradient(135deg,#e9eef6 0%,#dfe7f2 45%,#cbd8ea 100%)',
  threeD: 'linear-gradient(150deg,#24457e 0%,#1a3a6b 55%,#12294d 100%)',
  satellite: 'linear-gradient(150deg,#213a2c 0%,#2f5140 50%,#1c3a4a 100%)',
  transit: 'linear-gradient(135deg,#e9eef6 0%,#e2e8f3 100%)',
};

/**
 * The "Map Modes" bottom sheet — the phone-only look/feel picker for the map.
 *
 * A port of Apple Maps' Map Modes panel into Rafiq's identity: the dark navy
 * surface and cream text are the brand's, and the toggles light up in Rafiq
 * blue rather than iOS green. Choices apply LIVE — the map updates as you tap,
 * the way the native panel does — so there is no separate "apply" step.
 */
export function MapStyleSheet({
  mode,
  traffic,
  labels,
  onMode,
  onTraffic,
  onLabels,
  onClose,
}: {
  mode: MapMode;
  traffic: boolean;
  labels: boolean;
  onMode: (m: MapMode) => void;
  onTraffic: (v: boolean) => void;
  onLabels: (v: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal onClose={onClose} labelId="map-style-title" maxWidth="max-w-md" mobileSheet showClose={false}>
      <div className="flex w-full flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-navy-dark text-cream shadow-float md:rounded-3xl md:border">
        {/* grab handle, native-sheet feel */}
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <h2 id="map-style-title" className="text-lg font-extrabold text-cream">
            {t('map.modes.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-cream transition-colors hover:bg-white/20"
          >
            <AppIcon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* mode cards */}
        <div className="grid grid-cols-4 gap-2.5 px-5 pb-1">
          {MAP_MODES.map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onMode(m)}
                aria-pressed={active}
                className="group flex flex-col items-center gap-2 focus:outline-none"
              >
                <span
                  className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl transition-all ${
                    active
                      ? 'ring-2 ring-navy-light ring-offset-2 ring-offset-navy-dark'
                      : 'ring-1 ring-white/10 group-hover:ring-white/25'
                  }`}
                  style={{ background: MODE_PREVIEW[m] }}
                >
                  {/* faint road/route strokes for a hint of "map" texture */}
                  <span className="pointer-events-none absolute inset-0 opacity-60">
                    <span className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rotate-[-24deg] bg-white/25" />
                    <span className="absolute left-0 right-0 top-1/3 h-[2px] rotate-[18deg] bg-white/15" />
                  </span>
                  <AppIcon
                    name={MODE_ICON[m]}
                    className={`relative h-5 w-5 ${m === 'explore' || m === 'transit' ? 'text-navy' : 'text-cream'}`}
                  />
                </span>
                <span
                  className={`text-center text-[11px] font-bold leading-tight ${
                    active ? 'text-cream' : 'text-cream/60'
                  }`}
                >
                  {t(`map.modes.${m}`)}
                </span>
              </button>
            );
          })}
        </div>

        {/* toggles */}
        <div className="mx-5 mb-5 mt-4 overflow-hidden rounded-2xl bg-white/[0.06]">
          <ToggleRow
            icon="navigation"
            label={t('map.modes.traffic')}
            checked={traffic}
            onChange={onTraffic}
          />
          <div className="mx-4 h-px bg-white/10" />
          <ToggleRow
            icon="languages"
            label={t('map.modes.labels')}
            hint={mode === 'satellite' ? undefined : t('map.modes.labelsHint')}
            checked={labels}
            onChange={onLabels}
          />
        </div>
      </div>
    </Modal>
  );
}

/** One labelled iOS-style switch. On = Rafiq blue track, white knob. */
function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start transition-colors hover:bg-white/[0.04]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <AppIcon name={icon} className="h-5 w-5 shrink-0 text-cream/70" />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-cream">{label}</span>
          {hint && <span className="block text-[11px] text-cream/50">{hint}</span>}
        </span>
      </span>
      <span
        className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-navy-light' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-md transition-all duration-200 ${
            checked ? 'start-[25px]' : 'start-[3px]'
          }`}
        />
      </span>
    </button>
  );
}
