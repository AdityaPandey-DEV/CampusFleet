import fs from 'fs';
import path from 'path';

const TRANSLATIONS_FILE = path.join(process.cwd(), 'src', 'lib', 'translations.ts');
const TARGET_DIRS = [
  path.join(process.cwd(), 'src', 'app'),
  path.join(process.cwd(), 'src', 'components')
];

// 1. Extract English dictionary
let content = fs.readFileSync(TRANSLATIONS_FILE, 'utf-8');
const enMatch = content.match(/en:\s*\{([^}]+)\}/);
if (!enMatch) {
  console.error('Could not find English dictionary block.');
  process.exit(1);
}

const enBlock = enMatch[1];
const enDict = {};
const enRegex = /([a-zA-Z0-9_]+)\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
let match;
while ((match = enRegex.exec(enBlock)) !== null) {
  enDict[match[1]] = match[2];
}

console.log(`Loaded ${Object.keys(enDict).length} keys from English dictionary.`);

// Sort keys by length of the English text descending to replace longer phrases first
const sortedKeys = Object.keys(enDict).sort((a, b) => enDict[b].length - enDict[a].length);

// 2. Helper to recursively get all .tsx files
function getAllTsxFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllTsxFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = TARGET_DIRS.flatMap(dir => getAllTsxFiles(dir));
console.log(`Found ${allFiles.length} .tsx files to scan.`);

let modifiedFilesCount = 0;

// 3. Process each file
for (const file of allFiles) {
  let fileContent = fs.readFileSync(file, 'utf-8');
  let originalContent = fileContent;
  let hasReplacements = false;

  for (const key of sortedKeys) {
    const text = enDict[key];
    
    // Skip very short generic words to avoid breaking code (like "open", "date")
    if (text.length <= 3) continue;

    // Pattern 1: JSX Text nodes. Example: >Dashboard< or > Dashboard <
    // Uses lookbehind and lookahead to ensure it's between tags, allowing whitespace
    const jsxTextRegex = new RegExp(`>(\\s*)${escapeRegExp(text)}(\\s*)<`, 'g');
    if (jsxTextRegex.test(fileContent)) {
      fileContent = fileContent.replace(jsxTextRegex, `>$1{t('${key}')}$2<`);
      hasReplacements = true;
    }

    // Pattern 2: Placeholder attributes. Example: placeholder="Search"
    const placeholderRegex = new RegExp(`placeholder="${escapeRegExp(text)}"`, 'g');
    if (placeholderRegex.test(fileContent)) {
      fileContent = fileContent.replace(placeholderRegex, `placeholder={t('${key}')}`);
      hasReplacements = true;
    }

    // Pattern 3: Label attributes. Example: label="Dashboard"
    const labelRegex = new RegExp(`label="${escapeRegExp(text)}"`, 'g');
    if (labelRegex.test(fileContent)) {
      fileContent = fileContent.replace(labelRegex, `label={t('${key}')}`);
      hasReplacements = true;
    }
    
    // Pattern 4: title attributes. Example: title="Settings"
    const titleRegex = new RegExp(`title="${escapeRegExp(text)}"`, 'g');
    if (titleRegex.test(fileContent)) {
      fileContent = fileContent.replace(titleRegex, `title={t('${key}')}`);
      hasReplacements = true;
    }
  }

  if (hasReplacements) {
    // 4. Inject imports and hooks if not present
    if (!fileContent.includes("useTranslation")) {
      // Add import safely at the very top of the file
      const importStatement = `import { useTranslation } from "@/components/common/LanguageProvider";\n`;
      fileContent = importStatement + fileContent;
    }

    // Safely inject hook into standard functional components, ONLY if it doesn't already have one
    if (!fileContent.includes("useTranslation()")) {
      // Match export function or export default function
      const componentRegex = /(export\s+(?:default\s+)?(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/;
      
      if (componentRegex.test(fileContent)) {
        fileContent = fileContent.replace(componentRegex, `$1\n  const { t } = useTranslation();`);
      } else {
        // Handle arrow functions: const MyComponent = () => {
        const arrowRegex = /(const\s+[A-Za-z0-9_]+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{)/;
        if (arrowRegex.test(fileContent)) {
          fileContent = fileContent.replace(arrowRegex, `$1\n  const { t } = useTranslation();`);
        }
      }
    }

    if (originalContent !== fileContent) {
      fs.writeFileSync(file, fileContent, 'utf-8');
      console.log(`Updated: ${path.relative(process.cwd(), file)}`);
      modifiedFilesCount++;
    }
  }
}

console.log(`\nComplete! Modified ${modifiedFilesCount} files.`);
console.log(`NOTE: Please run 'npm run build' to check for any TypeScript errors.`);
console.log(`You may need to manually fix components that have multiple returns or unconventional structures.`);

function escapeRegExp(string) {
  return string.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
