/**
 * Vite Plugin: Service Worker Builder + Precache Manifest Generator
 *
 * 1. Compiles the service worker from TypeScript
 * 2. Generates a list of all static assets
 * 3. Injects the precache manifest into the service worker
 */
import { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';
import { build } from 'esbuild';

interface PrecachePluginOptions {
  /** Output directory (default: 'dist') */
  outDir?: string;
  /** Service worker source file */
  swSource?: string;
  /** Service worker output filename (default: 'service-worker.js') */
  swFileName?: string;
  /** File extensions to precache */
  includeExtensions?: string[];
  /** Files to exclude from precaching */
  excludePatterns?: RegExp[];
}

const defaultOptions: Required<PrecachePluginOptions> = {
  outDir: 'dist',
  swSource: 'src/routes/service-worker.ts',
  swFileName: 'service-worker.js',
  includeExtensions: ['.js', '.css', '.html', '.json', '.png', '.svg', '.ico', '.woff', '.woff2'],
  excludePatterns: [
    /q-manifest\.json$/,        // Qwik internal manifest
    /bundle-graph\.json$/,      // Build info
    /sitemap\.xml$/,            // SEO file
    /service-worker\.js$/,      // Don't cache SW itself
    /q-data\.json$/,            // SSR data
  ],
};

function getAllFiles(dir: string, baseDir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, baseDir, files);
    } else {
      // Convert to URL path (relative to dist root)
      const relativePath = '/' + path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push(relativePath);
    }
  }

  return files;
}

export function precachePlugin(options: PrecachePluginOptions = {}): Plugin {
  const opts = { ...defaultOptions, ...options };

  return {
    name: 'vite-plugin-sw-precache',
    apply: 'build',

    async closeBundle() {
      const distPath = path.resolve(process.cwd(), opts.outDir);
      const swSourcePath = path.resolve(process.cwd(), opts.swSource);
      const swOutputPath = path.join(distPath, opts.swFileName);

      if (!fs.existsSync(distPath)) {
        console.warn('[sw-precache] Dist directory not found, skipping');
        return;
      }

      if (!fs.existsSync(swSourcePath)) {
        console.warn('[sw-precache] Service worker source not found:', swSourcePath);
        return;
      }

      // Step 1: Compile the service worker
      console.log('[sw-precache] Compiling service worker...');
      try {
        await build({
          entryPoints: [swSourcePath],
          outfile: swOutputPath,
          bundle: true,
          minify: true,
          format: 'iife',
          target: 'es2020',
          platform: 'browser',
        });
        console.log('[sw-precache] Service worker compiled successfully');
      } catch (error) {
        console.error('[sw-precache] Failed to compile service worker:', error);
        return;
      }

      // Step 2: Get all files in dist for precaching
      const allFiles = getAllFiles(distPath, distPath);

      // Filter files based on extensions and exclude patterns
      const filesToPrecache = allFiles.filter(file => {
        const ext = path.extname(file).toLowerCase();

        // Must have allowed extension
        if (!opts.includeExtensions.includes(ext)) {
          return false;
        }

        // Must not match exclude patterns
        for (const pattern of opts.excludePatterns) {
          if (pattern.test(file)) {
            return false;
          }
        }

        return true;
      });

      console.log(`[sw-precache] Found ${filesToPrecache.length} files to precache`);

      // Step 3: Inject the manifest at the beginning of the service worker
      const manifestCode = `const PRECACHE_MANIFEST=${JSON.stringify(filesToPrecache)};`;
      let swContent = fs.readFileSync(swOutputPath, 'utf-8');
      swContent = manifestCode + swContent;
      fs.writeFileSync(swOutputPath, swContent);

      console.log('[sw-precache] Precache manifest injected into service worker');
      console.log('[sw-precache] Precached files:', filesToPrecache.length);
    },
  };
}
