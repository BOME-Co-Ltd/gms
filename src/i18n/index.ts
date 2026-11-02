import en from './en.json';
import vi from './vi.json';

export type Locale = 'vi' | 'en';
export type Dictionary = typeof vi;

const dictionaries: Record<Locale, Dictionary> = {
  vi,
  en,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.vi;
}
