import i18n from 'i18next';
import type { TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ru from './locales/ru.json';

export const resources = { en: { translation: en }, ru: { translation: ru } } as const;
export type InterfaceLanguage = keyof typeof resources;

const LANGUAGE_KEY = 'tunjik.language';
const DESCRIPTION_SELECTOR = 'meta[name="description"]';

function applyDocumentLanguage(language: InterfaceLanguage, translate: TFunction) {
  document.documentElement.lang = language;
  document.title = translate('meta.documentTitle', { defaultValue: 'Пружинки' });
  document
    .querySelector<HTMLMetaElement>(DESCRIPTION_SELECTOR)
    ?.setAttribute('content', translate('meta.documentDescription'));
}

function getInitialLanguage(): InterfaceLanguage {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch {
    // Use the browser's language if storage is unavailable.
  }
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

i18n.on('languageChanged', (language) => {
  if (language === 'en' || language === 'ru') applyDocumentLanguage(language, i18n.t.bind(i18n));
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Language remains available in memory for this session.
  }
});

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'ru',
  supportedLngs: ['ru', 'en'],
  interpolation: { escapeValue: false },
  returnNull: false,
}).then(() => {
  applyDocumentLanguage(i18n.resolvedLanguage === 'en' ? 'en' : 'ru', i18n.t.bind(i18n));
});

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: typeof resources.en;
  }
}

export default i18n;
