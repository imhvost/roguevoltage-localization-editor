<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue';
import { useFetch } from '@vueuse/core';
import JSZip from 'jszip';
import {
  fileNames,
  downloadBlob,
  languages,
  createBlobXMLFromDoc,
  base64ToUtf8,
  appendStringToSet,
} from '@/utils';
import type { Translation } from '@/types';
import { useGlobalState } from '@/store';
import AppButton from '@/components/AppButton.vue';
import { format } from 'date-fns';

const { translation, lang, additionalLangs, files, limits } = useGlobalState();

const strings = ref<Translation>({});
const activeTab = ref('*');

const baseLang = ref<string>('en');

const existedLangs = ref<string[]>([]);

const isProcess = ref(false);

const DOMparser = new DOMParser();

const getDocFromFiles = (fileName: string) => {
  const decodedString = base64ToUtf8(files.value[fileName]);
  const doc: Document = DOMparser.parseFromString(
    String(decodedString),
    'application/xml',
  );
  return doc;
};

const createTranslation = async () => {
  if (lang.value.length < 2) {
    alert('Enter the lang');
    return;
  }
  if (isProcessData.value) {
    return;
  }
  isProcessData.value = true;

  Object.keys(files.value).map(fileName => {
    const doc = getDocFromFiles(fileName);
    const sets = doc.documentElement.querySelectorAll('set');
    sets.forEach(set => {
      const setObj = strings.value[fileName]?.[set.id];
      if (!setObj) {
        return;
      }

      if (additionalLangs.value.length) {
        additionalLangs.value.map(el => {
          const stringAditional = set.querySelector(`string[lang="${el}"]`);
          if (stringAditional) {
            const str = stringAditional?.innerHTML || '';
            setObj[el] = str;
          }
        });
      }

      const storageStr = translation.value[fileName]?.[set.id]?.[lang.value];
      if (storageStr) {
        const checked =
          translation.value[fileName][set.id].checked === 'ok' ? 'ok' : '';
        setObj[lang.value] = storageStr;
        setObj.checked = checked;
        return;
      }
      const string = set.querySelector(`string[lang="${lang.value}"]`);
      if (string) {
        const str = string?.innerHTML || '';
        setObj[lang.value] = str;
      }
    });
  });

  document.querySelectorAll('.translation-base-string').forEach(el => {
    const fileName = el.getAttribute('data-file') || '';
    const setId = el.getAttribute('data-id') || '';
    const setObj = strings.value[fileName]?.[setId];

    if (!setObj || setObj[lang.value]) {
      return;
    }

    let str = el.textContent || '';
    str = str.replace(/ {2,}/g, ' ');
    setObj[lang.value] = str.trim();
    setObj.checked = '';
  });

  setTimeout(() => {
    translation.value = { ...strings.value };

    isProcessData.value = false;
  }, 400);
};

const getCheckedCount = (fileName: string) => {
  let count = 0;
  const sets = translation.value[fileName];
  if (sets) {
    Object.keys(sets).forEach(setId => {
      if (sets[setId].checked) {
        count++;
      }
    });
  }
  return count;
};

const downloadJson = async () => {
  const blob = new Blob([JSON.stringify(strings.value, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `${lang.value}.json`);
};

const uploadJson = async ($event: Event) => {
  const input = $event.currentTarget as HTMLInputElement;
  if (lang.value.length < 2) {
    input.value = '';
    alert('Enter the lang');
    return;
  }
  if (isProcess.value) {
    return;
  }
  isProcess.value = true;
  const filesList = input.files;
  if (!filesList || !filesList.length) {
    isProcess.value = false;
    return;
  }
  const file = filesList[0];
  const extension = file.name.split('.')[1];
  if (extension.toLowerCase() !== 'json') {
    input.value = '';
    alert('This is not .json file');
    isProcess.value = false;
    return;
  }

  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = async e => {
    const target = e.target;
    if (!target) {
      input.value = '';
      alert('FileReader error');
      isProcess.value = false;
      return;
    }
    try {
      translation.value = JSON.parse(target.result as string);
      createTranslation();
    } catch (error) {
      alert('Error parsing JSON');
      isProcess.value = false;
    }
  };
  input.value = '';
  isProcess.value = false;
};

const downloadTranslate = async () => {
  if (isProcessData.value) {
    return;
  }
  isProcessData.value = true;

  const xmls: Record<string, Blob> = {};

  Object.keys(files.value).map(fileName => {
    const doc = getDocFromFiles(fileName);

    if (fileName === 'localization.xml') {
      appendStringToSet(doc.querySelector('set'), '', lang.value);
      xmls[fileName] = createBlobXMLFromDoc(doc);
      return;
    }
    const sets = doc.documentElement.querySelectorAll('set');
    sets.forEach(set => {
      const traslatedObj = translation.value[fileName]?.[set.id];
      if (!traslatedObj) {
        console.error(fileName, set.id);
        return;
      }
      if (!traslatedObj[lang.value]) {
        console.warn(fileName, set.id);
        return;
      }
      appendStringToSet(set, traslatedObj[lang.value], lang.value);
    });
    xmls[fileName] = createBlobXMLFromDoc(doc);
  });

  const zip = new JSZip();
  Object.keys(xmls).forEach(key => {
    zip.file(key, xmls[key]);
  });
  const archive = await zip.generateAsync({ type: 'blob' });

  setTimeout(() => {
    downloadBlob(archive, 'roguevoltage-localization.zip');

    isProcessData.value = false;
  }, 400);
};

const isProcessData = ref(false);

const getDataFromFiles = () => {
  if (isProcessData.value) {
    return;
  }
  isProcessData.value = true;

  Object.keys(files.value).map(fileName => {
    const doc = getDocFromFiles(fileName);
    const sets = doc.documentElement.querySelectorAll('set');
    sets.forEach(set => {
      const stringEl = set.querySelector(`string[lang="${baseLang.value}"]`);

      let str = stringEl?.innerHTML || '';

      if (fileName === 'localization.xml' && !existedLangs.value.length) {
        set.querySelectorAll('string').forEach(el => {
          const lang = String(el.getAttribute('lang'));
          if (baseLang.value === lang) {
            return;
          }
          existedLangs.value.push(lang);
        });
      }

      if (str) {
        str = str.replace(
          /\$(.*?)\$/g,
          ' <span class="notranslate">$$$1$$</span> ',
        );
      }
      if (!str) {
        return;
      }

      if (!strings.value[fileName]) {
        strings.value[fileName] = {};
      }
      if (!strings.value[fileName][set.id]) {
        strings.value[fileName][set.id] = {};
      }

      strings.value[fileName][set.id][baseLang.value] = str;

      if (additionalLangs.value.length) {
        const setObj = strings.value[fileName]?.[set.id];
        if (!setObj) {
          return;
        }
        additionalLangs.value.map(el => {
          const stringAditional = set.querySelector(`string[lang="${el}"]`);
          if (stringAditional) {
            const str = stringAditional?.innerHTML || '';
            setObj[el] = str;
          }
        });
      }
    });
  });

  if (lang.value.length >= 2) {
    createTranslation();
  }
  isProcessData.value = false;
};

const isLimited = computed(() => {
  if (Number(limits.value.rest) < fileNames.length) {
    const limitTime =
      Number(limits.value.time) || Math.ceil(Date.now() + 60 * 60 * 1000);
    if (Date.now() > Number(limits.value.time || Date.now() > limitTime)) {
      return false;
    }
    return true;
  }
  return false;
});

watch(isLimited, () => {
  if (isLimited.value && !limits.value.time) {
    const limitTime = Math.ceil(Date.now() + 60 * 60 * 1000);
    limits.value.time = String(limitTime);
  }
});

const limitTime = computed(() => {
  if (limits.value.time) {
    const date = new Date(Number(limits.value.time));
    return format(date, 'MM/dd/yyyy, HH:mm:ss');
  }
  return '';
});

const fetchProcess = ref(false);

const getFilesFromGithub = async () => {
  if (isLimited.value) {
    alert(
      `Github api limit! Try later! ${limitTime.value ? 'At ' + limitTime.value : ''}`,
    );
    return;
  }
  if (fetchProcess.value) {
    return;
  }
  fetchProcess.value = true;
  const errors: string[] = [];
  files.value = {};
  for await (const fileName of fileNames) {
    limits.value.time = '';
    const { data, response, statusCode } = await useFetch(
      `https://api.github.com/repos/roguevoltage/localization/contents/${fileName}`,
    )
      .get()
      .json();
    if ([403, 429].includes(Number(statusCode.value))) {
      if (response.value?.headers) {
        limits.value.time =
          String(
            Number(response.value.headers.get('x-ratelimit-reset')) * 1000,
          ) || '';
        limits.value.rest =
          response.value.headers.get('x-ratelimit-remaining') || '';
      }
      alert(`Github API limit! Try later!`);
      fetchProcess.value = false;
      break;
    }
    if (response.value?.headers) {
      limits.value.rest =
        response.value.headers.get('x-ratelimit-remaining') || '';
    }
    if (!data?.value?.content) {
      errors.push(fileName);
      continue;
    }
    files.value[fileName] = data.value.content;
  }
  if (errors.length) {
    alert(`Errors in file: ${errors.join(', ')}`);
  }
  getDataFromFiles();
  fetchProcess.value = false;
};

onMounted(async () => {
  getDataFromFiles();
});

watch(additionalLangs, () => {
  if (activeTab.value !== '*') {
    getDataFromFiles();
  }
});
watch(lang, async () => {
  if (lang.value.length >= 2 && activeTab.value !== '*') {
    getDataFromFiles();
  }
});

const goToNextLine = ($event: Event, fileName: string, setId: string) => {
  const target = $event.currentTarget as HTMLElement;
  translation.value[fileName][setId].checked = 'ok';
  const textarea = target
    .closest('.translation-string')
    ?.nextElementSibling?.querySelector(
      '.translation-textarea',
    ) as HTMLTextAreaElement;
  textarea?.focus();
};

const setBad = ($event: Event, fileName: string, setId: string) => {
  const target = $event.currentTarget as HTMLElement;
  translation.value[fileName][setId].checked = '';
  const textarea = target
    .closest('.translation-string')
    ?.querySelector('.translation-textarea') as HTMLTextAreaElement;
  console.log(textarea);

  textarea?.focus();
};
</script>

<template>
  <main class="page-body">
    <div class="strings">
      <div
        class="translation-loading"
        v-if="isProcessData || fetchProcess"
      >
        Loading...
      </div>
      <div
        v-else-if="Object.keys(files).length && !fetchProcess"
        class="translation"
      >
        <div class="translation-files notranslate">
          <a
            href="#"
            :class="{ active: activeTab === '*' }"
            @click.prevent="activeTab = '*'"
          >
            <b>All</b>
          </a>
          <template v-for="(sets, fileName) in strings">
            <a
              v-if="fileName !== 'localization.xml'"
              :key="fileName"
              href="#"
              :class="{
                active: fileName === activeTab,
                done: getCheckedCount(fileName) === Object.keys(sets).length,
              }"
              @click.prevent="activeTab = fileName"
            >
              <span>{{ fileName.split('.').shift() }}</span>
              <i>
                <span>✓{{ getCheckedCount(fileName) }}</span> /
                {{ Object.keys(sets).length }}
              </i>
            </a>
          </template>
        </div>
        <div class="translation-strings">
          <template
            v-for="(sets, fileName) in strings"
            :key="fileName"
          >
            <div
              class="translation-tab"
              v-if="
                fileName !== 'localization.xml' &&
                (fileName === activeTab || activeTab === '*')
              "
            >
              <template v-for="(langs, setId, index) in sets">
                <div
                  v-if="langs[baseLang]"
                  :key="setId"
                  class="translation-string"
                  :data-index="index + 1"
                  :data-id="setId"
                  :class="{
                    'just-text': activeTab === '*',
                    checked: translation[fileName]?.[setId]?.checked,
                  }"
                >
                  <div class="translation-langs">
                    <div
                      v-if="activeTab !== '*'"
                      class="translation-id"
                    >
                      {{ setId }}
                    </div>
                    <div class="translation-base">
                      <div
                        class="translation-base-item translation-base-string"
                        v-html="langs[baseLang]"
                        :data-file="fileName"
                        :data-id="setId"
                        :data-lang="baseLang"
                      ></div>
                      <template v-if="activeTab !== '*'">
                        <template v-for="additionalLang in additionalLangs">
                          <div
                            v-if="langs[additionalLang]"
                            :key="additionalLang"
                            class="translation-base-item notranslate"
                            v-html="langs[additionalLang]"
                            :data-lang="additionalLang"
                          ></div>
                        </template>
                      </template>
                    </div>
                    <div
                      v-if="
                        translation[fileName]?.[setId]?.[lang] !== undefined &&
                        activeTab !== '*'
                      "
                      class="translation-my notranslate"
                      :data-lang="lang"
                    >
                      <textarea
                        class="translation-textarea"
                        contenteditable
                        v-model.trim="translation[fileName][setId][lang]"
                        @keydown.enter.exact.prevent="
                          goToNextLine($event, fileName, setId)
                        "
                      ></textarea>
                      <div class="translation-my-btns">
                        <AppButton
                          class="btn-red"
                          @click="setBad($event, fileName, setId)"
                          >⨯ Bad</AppButton
                        >
                        <AppButton
                          class="btn-green"
                          @click="goToNextLine($event, fileName, setId)"
                          :disabled="
                            translation[fileName][setId].checked === 'ok'
                          "
                          >✓ Good</AppButton
                        >
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="activeTab !== '*'"
                    class="translation-links notranslate"
                  >
                    <a
                      :href="`https://github.com/roguevoltage/localization/blob/main/${fileName}#${setId}`"
                      aria-label="Go to Github file"
                      title="Go to Github file"
                      target="_blank"
                      >Github
                    </a>
                  </div>
                </div></template
              >
            </div>
          </template>
        </div>
      </div>
      <div
        v-else
        class="no-files"
      >
        The files are missing... Download them from Github!
      </div>
    </div>
    <div class="sidebar notranslate">
      <AppButton
        @click="getFilesFromGithub"
        :disabled="isLimited"
        :class="{ 'btn-red': isLimited }"
      >
        <template v-if="isLimited"
          >Github api limit! Try later!
          <template v-if="limitTime"><br />At {{ limitTime }}</template>
        </template>
        <template v-else-if="fetchProcess">Fetching files...</template>
        <template v-else>
          {{ Object.keys(files).length ? 'Update' : 'Fetch' }}
          files from Github
        </template>
      </AppButton>
      <div
        class="languages-wrapp"
        v-if="Object.keys(files).length && !fetchProcess"
      >
        <div class="languages-title">Enter or select lang</div>
        <div class="languages">
          <input
            type="text"
            v-model="lang"
            placeholder="Enter lang"
            class="input"
          />
          <select
            v-model="lang"
            class="input"
          >
            <option
              value=""
              disabled
              selected
            >
              Select lang
            </option>
            <option
              :value="item"
              v-for="item in languages"
              :key="item"
            >
              &nbsp;&nbsp;{{ item }}&nbsp;&nbsp;
            </option>
          </select>
        </div>
      </div>
      <div
        class="languages-existed"
        v-if="existedLangs.length && Object.keys(files).length && !fetchProcess"
      >
        <div class="languages-title">Add additional langs</div>
        <div class="languages-existed-list">
          <label
            v-for="item in existedLangs"
            :key="item"
            class="checkbox-label"
          >
            <input
              type="checkbox"
              :value="item"
              v-model="additionalLangs"
              :disabled="item === lang"
            />
            <span>{{ item }}</span>
          </label>
        </div>
      </div>
      <AppButton
        @click="createTranslation"
        :disabled="lang.length < 2"
        class="btn-green"
        v-if="Object.keys(files).length && !fetchProcess"
      >
        <template v-if="existedLangs.includes(lang)"
          >Update translation</template
        >
        <template v-else>Create translation</template>
      </AppButton>
      <AppButton
        @click="downloadJson"
        :disabled="lang.length < 2"
        v-if="Object.keys(files).length && !fetchProcess"
      >
        <span>
          Download
          <b>{{ lang.length >= 2 ? lang : '' }}.json</b></span
        >
      </AppButton>
      <label
        class="upload"
        aria-label="Upload file"
        v-if="Object.keys(files).length && !fetchProcess"
      >
        <span>Upload <b>.json</b> file</span>
        <input
          @change="uploadJson"
          type="file"
        />
      </label>
      <AppButton
        @click="downloadTranslate"
        :disabled="lang.length < 2"
        class="btn-green"
        v-if="Object.keys(files).length && !fetchProcess"
      >
        Download your translate
      </AppButton>
    </div>
  </main>
</template>

<style>
.page-body {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 12px;
  height: 100dvh;
}

.strings {
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}

.translation-loading {
  margin: auto;
}

.translation {
  flex: auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.translation-files {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding-bottom: 12px;
  font-size: 12px;
  a {
    display: flex;
    align-items: center;
    padding: 2px 4px;
    border: solid 1px #ccc;
    color: inherit;
    text-decoration: none;
    gap: 4px;
    transition:
      border-color 0.4s,
      color 0.4s,
      background-color 0.4s;
    i {
      padding: 2px 4px 2px 2px;
      margin: -2px -2px -2px 0;
      background-color: #eee;
      color: #333;
      font-size: 10px;
      font-style: normal;
      transition:
        color 0.4s,
        background-color 0.4s;
      span {
        color: green;
        font-weight: 700;
      }
    }

    &:hover {
      border-color: #333;
    }
    &.active {
      border-color: #333;
      background-color: #333;
      color: #fff;
    }
    &.done {
      i {
        background-color: green;
        color: #fff;
        span {
          color: #fff;
        }
      }
    }
  }
}

.translation-strings {
  flex: auto;
  overflow-y: auto;
}

.translation-tab {
  display: grid;
  padding-right: 8px;
  gap: 2px;
}

.translation-string {
  &:not(.just-text) {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    padding: 8px 8px 8px 32px;
    position: relative;
    border-radius: 8px;
    transition:
      opacity 0.4s,
      background-color 0.4s;
    background-color: var(--color-white);
    &:before {
      content: attr(data-index);
      position: absolute;
      font-size: 12px;
      left: 8px;
      top: 8px;
    }
    &:after {
      content: '';
      position: absolute;
      inset: 0;
      border: dashed 2px #0037da;
      opacity: 0;
      pointer-events: none;
      will-change: opacity;
      transition: opacity 0.4s;
      border-radius: inherit;
    }
    &:hover,
    &:has(.translation-textarea:focus) {
      background-color: #eee;
      .translation-links {
        a {
          opacity: 1;
          pointer-events: auto;
          visibility: visible;
        }
      }
    }
    &:has(.translation-textarea:focus) {
      background-color: #91caff;
      &:after {
        opacity: 0.4;
      }
    }
    &.checked {
      background-color: #e2ffe2;
      &:after {
        opacity: 1;
        border-style: solid;
        border-color: #a4eba4;
      }
      & + & {
        margin-top: -4px;
      }
    }
  }
}

.translation-langs {
  display: flex;
  flex-direction: column;
}

.translation-id {
  font-size: 12px;
  background-color: #eee;
  padding: 2px;
  margin: 0 -2px 2px;
  border: solid 1px #ccc;
  align-self: start;
  font-size: 12px;
}

.translation-base {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.translation-base-item {
  position: relative;
  border-left: solid 24px transparent;
  background-color: var(--color-white);
  background-clip: padding-box;
  padding: 2px 4px;
  &:before {
    content: attr(data-lang);
    color: red;
    font-size: 12px;
    position: absolute;
    width: 24px;
    left: -24px;
    top: 0;
  }
}

.translation-my {
  padding-left: 20px;
  position: relative;
  margin-top: 4px;
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr auto;
  &:before {
    content: attr(data-lang);
    color: green;
    font-size: 12px;
    position: absolute;
    left: 0;
    top: 0;
  }
}

.translation-textarea {
  width: 100%;
  outline: solid 1px;
  min-height: calc(8px + 2lh);
  padding: 4px;
  outline: solid 2px transparent;
  outline-offset: 1px;
  border: solid 1px var(--color-link);
  display: block;
  font: inherit;
  resize: vertical;
  background-color: #fff;
  transition:
    border-color 0.4s,
    background-color 0.4s;
  &:focus {
    border-color: var(--color-link-hover);
  }
}

.translation-my-btns {
  display: flex;
  gap: 4px;
  align-self: center;
}

.translation-links {
  a {
    display: flex;
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
    will-change: opacity;
    transition:
      opacity 0.4s,
      visibility 0.4s;
  }
}

.sidebar {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-left: solid var(--color-border);
}

.languages {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.languages-existed {
  margin-top: 12px;
}

.languages-existed-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
  &:has([disabled]) {
    opacity: 0.6;
    pointer-events: none;
  }
  input {
    cursor: pointer;
  }
}

.input {
  width: 100%;
  height: 32px;
  padding: 0 4px;
  font: inherit;
  min-height: 0;
  &[multiple] {
    height: 3lh;
  }
}

.upload {
  margin-top: auto;
  padding: 24px 12px;
  border: dashed 2px;
  position: relative;
  text-align: center;
  input {
    position: absolute;
    left: 0;
    top: 0;
    border-radius: inherit;
    cursor: pointer;
    opacity: 0;
    font-size: 0;
    width: 100%;
    height: 100%;
    z-index: 6;
    &::-webkit-file-upload-button,
    &::file-selector-button {
      display: none;
      appearance: none;
    }
  }
}

.no-files {
  background-color: var(--color-red);
  margin: auto;
  padding: 4px 8px;
  border-radius: 4px;
  color: var(--color-white);
}
</style>
