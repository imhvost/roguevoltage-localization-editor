import { createGlobalState, useStorage } from '@vueuse/core';
import type { Translation, Limits } from '@/types';

export const useGlobalState = createGlobalState(() => {
  const translation = useStorage<Translation>('translation', {} as Translation);
  const lang = useStorage<string>('lang', '');
  const additionalLangs = useStorage<string[]>('additionalLangs', []);
  const files = useStorage<Record<string, string>>('files', {});
  const limits = useStorage<Limits>('limits', {} as Limits);
  return {
    translation,
    lang,
    additionalLangs,
    files,
    limits,
  };
});
