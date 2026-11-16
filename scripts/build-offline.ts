import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { build } from 'vite';

async function buildOfflineSingleFile() {
  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, 'dist-offline');

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  console.log('Building EcoPredict standalone offline HTML bundle...');

  await build({
    root: rootDir,
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
    define: {
      'import.meta.env.VITE_OFFLINE_BUNDLE': JSON.stringify('true'),
    },
    build: {
      outDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: () => true,
      minify: 'esbuild',
      rollupOptions: {
        input: path.resolve(rootDir, 'index.html'),
        output: {
          format: 'iife',
          name: 'EcoPredictOfflineApp',
          inlineDynamicImports: true,
          entryFileNames: 'bundle.js',
          assetFileNames: 'bundle.[ext]',
        },
      },
    },
  });

  const htmlPath = path.join(outDir, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf-8');

  // Inline CSS
  const cssPath = path.join(outDir, 'bundle.css');
  if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    html = html.replace(
      /<link[^>]+rel=["']stylesheet["'][^>]*>/gi,
      () => `<style>${cssContent}</style>`
    );
  }

  // Replace module script tag with classic inline IIFE script for universal file:// compatibility
  const jsPath = path.join(outDir, 'bundle.js');
  if (!fs.existsSync(jsPath)) {
    throw new Error('Expected bundle.js was not generated.');
  }
  let jsContent = fs.readFileSync(jsPath, 'utf-8').replace(/<\/script/gi, '<\\/script');

  // Safety fallback: inline any remaining image assets emitted into dist-offline
  for (const file of fs.readdirSync(outDir)) {
    if (/\.(jpg|jpeg|png|webp|svg)$/i.test(file)) {
      const ext = path.extname(file).slice(1).toLowerCase();
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const b64 = fs.readFileSync(path.join(outDir, file)).toString('base64');
      jsContent = jsContent.split(`./${file}`).join(`data:${mime};base64,${b64}`);
      jsContent = jsContent.split(file).join(`data:${mime};base64,${b64}`);
    }
  }

  // Remove Vite-injected module script tags in head/body and inject inline script at end of body
  html = html.replace(/<script[^>]*src=["'][^"']*bundle\.js["'][^>]*><\/script>/gi, '');
  html = html.replace(/<link[^>]*rel=["']icon["'][^>]*>/gi, '');
  html = html.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '');
  html = html.replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/gi, '');

  // Inline logo favicon as base64
  const logoFile = path.resolve(rootDir, 'src/assets/images/ecopredict_logo_1794735323792.jpg');
  if (fs.existsSync(logoFile)) {
    const logoB64 = fs.readFileSync(logoFile).toString('base64');
    html = html.replace(
      '</head>',
      () => `<link rel="icon" type="image/jpeg" href="data:image/jpeg;base64,${logoB64}" />\n</head>`
    );
  }

  html = html.replace(
    '</body>',
    () => `<script id="ecopredict-offline-bundle">${jsContent}</script>\n</body>`
  );

  const publicDir = path.resolve(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const publicTarget = path.join(publicDir, 'ecopredict-offline.html');
  const rootTarget = path.join(rootDir, 'ecopredict-offline.html');

  fs.writeFileSync(publicTarget, html, 'utf-8');
  fs.writeFileSync(rootTarget, html, 'utf-8');

  fs.rmSync(outDir, { recursive: true, force: true });

  const sizeMb = (Buffer.byteLength(html, 'utf-8') / (1024 * 1024)).toFixed(2);
  console.log(`Generated standalone offline file: ecopredict-offline.html (${sizeMb} MB)`);
}

buildOfflineSingleFile().catch((err) => {
  console.error('Offline build failed:', err);
  process.exit(1);
});
