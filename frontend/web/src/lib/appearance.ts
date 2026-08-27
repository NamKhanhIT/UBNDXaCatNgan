export interface AppearanceSettings {
  font: 'Be Vietnam Pro' | 'Roboto' | 'Inter';
  density: 'comfortable' | 'compact';
  theme: 'govt-red' | 'classic-blue';
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  font: 'Be Vietnam Pro',
  density: 'comfortable',
  theme: 'govt-red',
};

export function applyAppearanceToDom(settings: AppearanceSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;

  root.setAttribute('data-font', settings.font);
  root.setAttribute('data-density', settings.density);
  root.setAttribute('data-theme', settings.theme);

  if (body) {
    body.setAttribute('data-font', settings.font);
    body.setAttribute('data-density', settings.density);
    body.setAttribute('data-theme', settings.theme);
  }
}

export function loadAndApplyAppearance() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('ubnd_appearance_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      applyAppearanceToDom({ ...DEFAULT_APPEARANCE, ...parsed });
    } else {
      applyAppearanceToDom(DEFAULT_APPEARANCE);
    }
  } catch {
    applyAppearanceToDom(DEFAULT_APPEARANCE);
  }
}
