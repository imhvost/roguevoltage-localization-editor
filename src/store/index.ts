import { createGlobalState, useStorage } from '@vueuse/core';
import type { Translation } from '@/types';

export const useGlobalState = createGlobalState(() => {
  const translation = useStorage<Translation>('translation', {} as Translation);
  const lang = useStorage<string>('lang', '');
  const additionalLangs = useStorage<string[]>('additionalLangs', []);
  return {
    translation,
    lang,
    additionalLangs,
  };
});
