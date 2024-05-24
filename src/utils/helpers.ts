export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const createBlobXMLFromDoc = (doc: Document) => {
  const serializer = new XMLSerializer();
  let docString = serializer.serializeToString(doc);
  docString = docString.replace(/\s+xmlns(:\w+)?="[^"]*"/g, '');
  return new Blob([docString], { type: 'application/xml' });
};

export const base64ToUtf8 = (base64: string) => {
  const binaryString = atob(base64);
  const byteArray = Uint8Array.from(binaryString, char => char.charCodeAt(0));
  return new TextDecoder().decode(byteArray);
};

export const appendStringToSet = (
  set: Element | null,
  textContent: string,
  lang: string,
) => {
  if (!set) {
    return;
  }
  const existedString = set.querySelector(`string[lang="${lang}"]`);
  if (existedString) {
    existedString.textContent = textContent;
    return;
  }
  const string = document.createElement('string');
  string.setAttribute('lang', lang);
  string.textContent = textContent;
  const tabNode = document.createTextNode('\t\t');
  const nlNode = document.createTextNode('\n');
  set.appendChild(tabNode);
  set.appendChild(string);
  set.appendChild(nlNode);
};
