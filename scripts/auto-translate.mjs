import fs from 'fs';
import path from 'path';

const TRANSLATIONS_FILE = path.join(process.cwd(), 'src', 'lib', 'translations.ts');

const TARGET_LANGUAGES = ['hi', 'pa', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml'];

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function translateText(text, targetLang) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const json = await res.json();
    return json[0][0][0];
  } catch (error) {
    console.error(`Error translating "${text}" to ${targetLang}:`, error.message);
    return text; // Fallback to english
  }
}

async function main() {
  console.log('Reading translations.ts...');
  let content = fs.readFileSync(TRANSLATIONS_FILE, 'utf-8');

  // 1. Extract English dictionary keys and values
  const enMatch = content.match(/en:\s*\{([^}]+)\}/);
  if (!enMatch) {
    console.error('Could not find English dictionary block.');
    process.exit(1);
  }

  const enBlock = enMatch[1];
  const enDict = {};
  
  // Parse English keys and values
  // Handles format: key: "value",
  const enRegex = /([a-zA-Z0-9_]+)\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let match;
  while ((match = enRegex.exec(enBlock)) !== null) {
    enDict[match[1]] = match[2];
  }

  console.log(`Found ${Object.keys(enDict).length} keys in English dictionary.`);

  let contentUpdated = content;

  // 2. Process each target language
  for (const lang of TARGET_LANGUAGES) {
    console.log(`\nProcessing language: ${lang}`);
    
    // Find the language block
    const langRegex = new RegExp(`${lang}:\\s*\\{([^}]+)\\}`, 's');
    const langMatch = contentUpdated.match(langRegex);
    
    if (!langMatch) {
      console.warn(`Could not find dictionary block for ${lang}. Skipping.`);
      continue;
    }

    const langBlock = langMatch[1];
    const langDict = {};
    
    const kvRegex = /([a-zA-Z0-9_]+)\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    let kvMatch;
    while ((kvMatch = kvRegex.exec(langBlock)) !== null) {
      langDict[kvMatch[1]] = kvMatch[2];
    }

    const missingKeys = Object.keys(enDict).filter(key => !langDict.hasOwnProperty(key));
    
    if (missingKeys.length === 0) {
      console.log(`  All keys are already translated.`);
      continue;
    }

    console.log(`  Found ${missingKeys.length} missing keys. Translating...`);
    
    let appendedTranslations = '';
    
    for (const key of missingKeys) {
      const enText = enDict[key];
      console.log(`    Translating [${key}]: "${enText}" ...`);
      
      const translated = await translateText(enText, lang);
      // Escape quotes
      const escapedTranslated = translated.replace(/"/g, '\\"');
      appendedTranslations += `    ${key}: "${escapedTranslated}",\n`;
      
      await sleep(300); // Be nice to the free API
    }
    
    // Inject into the file before the closing brace of the language block
    const updatedLangBlock = langBlock.replace(/(\s*)$/, `\n${appendedTranslations}$1`);
    contentUpdated = contentUpdated.replace(langMatch[0], `${lang}: {${updatedLangBlock}}`);
  }

  // 3. Save back
  if (content !== contentUpdated) {
    fs.writeFileSync(TRANSLATIONS_FILE, contentUpdated, 'utf-8');
    console.log('\nSuccess: Updated translations.ts with auto-translated strings!');
  } else {
    console.log('\nNo changes needed.');
  }
}

main().catch(console.error);
