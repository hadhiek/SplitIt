import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const frontendRoot = process.cwd();
const publicRoot = join(frontendRoot, 'public', 'ocr');
const requiredFiles = [
  join(publicRoot, 'tesseract.esm.min.js'),
  join(publicRoot, 'worker.min.js'),
  join(publicRoot, 'lang', 'eng.traineddata.gz'),
  join(publicRoot, 'core', 'tesseract-core.wasm.js'),
  join(publicRoot, 'core', 'tesseract-core-simd.wasm.js'),
];

if (requiredFiles.every(existsSync)) {
  console.log('[receipt-ocr] Local OCR assets already exist.');
  process.exit(0);
}

const tempRoot = mkdtempSync(join(tmpdir(), 'splitit-ocr-'));
const npmCli = process.env.npm_execpath;
const runNpm = (args) => {
  if (npmCli) {
    execFileSync(process.execPath, [npmCli, ...args], { cwd: tempRoot, stdio: 'inherit' });
  } else {
    execFileSync('npm', args, { cwd: tempRoot, stdio: 'inherit' });
  }
};
const extract = (archive, destination) => {
  mkdirSync(destination, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', destination], { stdio: 'inherit' });
};

try {
  console.log('[receipt-ocr] Preparing self-hosted Tesseract.js assets...');
  for (const packageName of [
    'tesseract.js@6.0.1',
    'tesseract.js-core@6.1.2',
    '@tesseract.js-data/eng@1.0.0',
  ]) {
    runNpm(['pack', packageName]);
  }

  const archives = readdirSync(tempRoot).filter((name) => name.endsWith('.tgz'));
  const findArchive = (prefix) => {
    const match = archives.find((name) => name.startsWith(prefix));
    if (!match) throw new Error('Could not download OCR package: ' + prefix);
    return join(tempRoot, match);
  };

  const tesseractDir = join(tempRoot, 'tesseract');
  const coreDir = join(tempRoot, 'core');
  const languageDir = join(tempRoot, 'language');
  extract(findArchive('tesseract.js-6.0.1'), tesseractDir);
  extract(findArchive('tesseract.js-core-6.1.2'), coreDir);
  extract(findArchive('tesseract.js-data-eng-1.0.0'), languageDir);

  const tesseractPackage = join(tesseractDir, 'package');
  const corePackage = join(coreDir, 'package');
  const languagePackage = join(languageDir, 'package');

  mkdirSync(publicRoot, { recursive: true });
  mkdirSync(join(publicRoot, 'core'), { recursive: true });
  mkdirSync(join(publicRoot, 'lang'), { recursive: true });

  for (const file of ['tesseract.esm.min.js', 'worker.min.js']) {
    const source = join(tesseractPackage, 'dist', file);
    if (!existsSync(source)) throw new Error('Missing Tesseract.js asset: ' + file);
    copyFileSync(source, join(publicRoot, file));
  }

  const coreFiles = readdirSync(corePackage).filter((file) => /\.(?:js|wasm)$/.test(file));
  for (const file of coreFiles) {
    copyFileSync(join(corePackage, file), join(publicRoot, 'core', file));
  }
  if (!coreFiles.some((file) => file === 'tesseract-core-simd.wasm.js')) {
    throw new Error('The SIMD OCR core is missing from the Tesseract.js package.');
  }

  const trainedData = join(languagePackage, '4.0.0_best_int', 'eng.traineddata.gz');
  if (!existsSync(trainedData)) throw new Error('English OCR language data was not found in its npm package.');
  copyFileSync(trainedData, join(publicRoot, 'lang', 'eng.traineddata.gz'));

  console.log('[receipt-ocr] Local worker, WASM cores, and English model are ready.');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
