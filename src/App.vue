<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useFetch } from '@vueuse/core';
import { languages } from '@/languages';
import JSZip from 'jszip';
import { files, downloadBlob } from '@/utils';
import type { Translation } from '@/types';
import { useGlobalState } from '@/store';

const { translation, lang, additionalLangs } = useGlobalState();

const strings = ref<Translation>({});
const activeTab = ref('*');

const baseLang = ref<string>('en');

const existedLangs = ref<string[]>([]);

const isProcess = ref(false);

const xmls = ref<Record<string, Blob>>({});
const parser = new DOMParser();
const serializer = new XMLSerializer();

const createTranslation = async () => {
  if (lang.value.length < 2) {
    alert('Enter the lang');
    return;
  }
  if (isProcess.value) {
    return;
  }
  isProcess.value = true;

  if (additionalLangs.value.length || lang.value) {
    for await (const fileName of files) {
      const { data } = await useFetch(`/roguevoltage-localization/${fileName}`)
        .get()
        .text();
      const doc: Document = parser.parseFromString(
        String(data.value),
        'application/xml',
      );
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

        if (lang.value) {
          const storageStr =
            translation.value[fileName]?.[set.id]?.[lang.value];
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
        }
      });
    }
  }

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

  translation.value = { ...strings.value };

  isProcess.value = false;
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

const appendString = (set: Element | null, textContent: string) => {
  if (!set) {
    return;
  }
  const existedString = set.querySelector(`string[lang="${lang.value}"]`);
  if (existedString) {
    existedString.textContent = textContent;
    return;
  }
  const string = document.createElement('string');
  string.setAttribute('lang', lang.value);
  string.textContent = textContent;
  const tabNode = document.createTextNode('\t\t');
  const nlNode = document.createTextNode('\n');
  set.appendChild(tabNode);
  set.appendChild(string);
  set.appendChild(nlNode);
};

const createBlobXML = (doc: Document) => {
  let docString = serializer.serializeToString(doc);
  docString = docString.replace(/\s+xmlns(:\w+)?="[^"]*"/g, '');
  return new Blob([docString], { type: 'application/xml' });
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
      // xmls.value = {};
      // for await (const fileName of files) {
      //   const { data } = await useFetch(
      //     `/roguevoltage-localization/${fileName}`,
      //   )
      //     .get()
      //     .text();
      //   const doc: Document = parser.parseFromString(
      //     String(data.value),
      //     'application/xml',
      //   );
      //   if (fileName === 'localization.xml') {
      //     appendString(doc.querySelector('set'), '');
      //     xmls.value[fileName] = createBlobXML(doc);
      //     continue;
      //   }
      //   const sets = doc.documentElement.querySelectorAll('set');
      //   sets.forEach(set => {
      //     const traslatedObj = obj.find(
      //       o => o.file === fileName && o.id === set.id,
      //     );
      //     if (!traslatedObj) {
      //       console.error(fileName, set.id);
      //       return;
      //     }
      //     if (!traslatedObj[lang.value]) {
      //       console.warn(fileName, set.id);
      //       return;
      //     }
      //     appendString(set, traslatedObj[lang.value]);
      //   });
      //   xmls.value[fileName] = createBlobXML(doc);
      // }
      // const zip = new JSZip();
      // Object.keys(xmls.value).forEach(key => {
      //   zip.file(key, xmls.value[key]);
      // });
      // const archive = await zip.generateAsync({ type: 'blob' });
      // downloadBlob(archive, 'roguevoltage-localization.zip');
    } catch (error) {
      alert('Error parsing JSON');
      isProcess.value = false;
    }
  };
  input.value = '';
  isProcess.value = false;
};

const isProcessData = ref(false);

const getDataFromFiles = async () => {
  if (isProcessData.value) {
    return;
  }
  isProcessData.value = true;
  for await (const fileName of files) {
    const { data } = await useFetch(`/roguevoltage-localization/${fileName}`)
      .get()
      .text();
    if (!data) {
      continue;
    }
    const doc: Document = parser.parseFromString(
      String(data.value),
      'application/xml',
    );
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
  }
  if (lang.value.length >= 2) {
    await createTranslation();
  }
  isProcessData.value = false;
};

onMounted(getDataFromFiles);

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
  const string = translation.value[fileName][setId];
  string.checked = 'ok';
  const textarea = target
    .closest('.translation-string')
    ?.nextElementSibling?.querySelector(
      '.translation-textarea',
    ) as HTMLTextAreaElement;
  textarea?.focus();
};

const goToPrevLine = ($event: Event) => {
  const target = $event.currentTarget as HTMLElement;
  const textarea = target
    .closest('.translation-string')
    ?.previousElementSibling?.querySelector(
      '.translation-textarea',
    ) as HTMLTextAreaElement;
  textarea?.focus();
};
</script>

<template>
  <main>
    <div class="strings">
      <div
        class="translation-loading"
        v-if="isProcessData"
      >
        Loading...
      </div>
      <div
        v-else
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
                  :class="{
                    'just-text': activeTab === '*',
                    checked: translation[fileName]?.[setId]?.checked,
                  }"
                >
                  <div class="translation-langs">
                    <div class="translation-id">#{{ setId }}</div>
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
                        @keydown.shift.enter.prevent="goToPrevLine"
                      ></textarea>
                      <div class="translation-my-btns">
                        <button
                          class="btn btn-red"
                          @click="translation[fileName][setId].checked = ''"
                        >
                          ⨯ Bad
                        </button>
                        <button
                          class="btn btn-green"
                          @click="goToNextLine($event, fileName, setId)"
                          :disabled="
                            translation[fileName][setId].checked === 'ok'
                          "
                        >
                          ✓ Good
                        </button>
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
    </div>
    <div class="btns notranslate">
      <div class="languages-wrapp">
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
      <div class="languages-existed">
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
      <button
        @click="createTranslation"
        :disabled="lang.length < 2"
        class="btn"
      >
        Create translation
      </button>
      <button
        @click="downloadJson"
        :disabled="lang.length < 2"
        class="btn"
      >
        Download <b>{{ lang.length >= 2 ? lang : '' }}.json</b>
      </button>
      <label
        class="upload"
        aria-label="Upload file"
      >
        <span>Upload <b>.json</b> file</span>
        <input
          @change="uploadJson"
          type="file"
        />
      </label>
    </div>
  </main>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-width: 480px;
  color: #333;
}

main {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 12px;
  height: 100dvh;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    'Open Sans',
    'Helvetica Neue',
    sans-serif;
  font-size: 14px;
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
  gap: 8px;
}

.translation-string {
  &:not(.just-text) {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    padding: 8px 8px 8px 32px;
    position: relative;
    transition:
      opacity 0.4s,
      background-color 0.4s;
    background-color: #fff;
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
      border: dashed 2px #e86528;
      opacity: 0;
      pointer-events: none;
      will-change: opacity;
      transition: opacity 0.4s;
    }
    &:hover,
    &:has(.translation-textarea:focus) {
      z-index: 1;
      &:after {
        opacity: 1;
      }
      .translation-links {
        a {
          opacity: 1;
          pointer-events: auto;
          visibility: visible;
        }
      }
    }
    &:has(.translation-textarea:focus) {
      z-index: 2;
      background-color: rgb(232, 101, 40, 0.1);
    }
    &.checked {
      background-color: #e2ffe2;
      &:after {
        opacity: 1;
        border-style: solid;
        border-color: #a4eba4;
      }
    }
    &.checked + &.checked {
      margin-top: -10px;
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
  margin: -2px;
  border: solid 1px #ccc;
  align-self: start;
  font-size: 12px;
}

.translation-base-item {
  position: relative;
  padding-left: 24px;
  &:before {
    content: attr(data-lang);
    color: red;
    font-size: 12px;
    position: absolute;
    left: 0;
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
  border: solid 1px blue;
  display: block;
  font: inherit;
  resize: vertical;
  background-color: #fff;
  transition:
    outline-color 0.4s,
    background-color 0.4s;
  &:focus {
    outline-color: rgb(123, 123, 255);
  }
}

.translation-my-btns {
  display: flex;
  gap: 4px;
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

.btns {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

button {
  cursor: pointer;
  padding: 8px 12px;
  font: inherit;
  &[disabled] {
    pointer-events: none;
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
</style>
