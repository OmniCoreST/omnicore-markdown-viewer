// Builds libs/tscircuit/tscircuit-bundle.js as a single self-contained IIFE
// that exposes window.Tscircuit. Run manually after bumping tscircuit deps:
//
//   node scripts/build-tscircuit-bundle.js
//
// The committed bundle is what ships in production builds; the source deps in
// node_modules/@tscircuit/* and react/react-dom are devDependencies only.
//
// devDependency notes:
//   - @tscircuit/eval: TSX → Circuit JSON compiler (used directly in bundle)
//   - circuit-to-svg, circuit-json: Circuit JSON → SVG (used directly)
//   - @tscircuit/schematic-viewer, react, react-dom: NOT used by the bundle
//     directly, but kept as devDeps to pin compatible transitive versions in
//     node_modules. Removing them breaks the install graph (kicad-component-converter,
//     sucrase, comlink, etc. become unresolvable).

const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const projectRoot = path.resolve(__dirname, '..');
const entry = path.join(projectRoot, 'libs', 'tscircuit', 'bundle-entry.tsx');
const outFile = path.join(projectRoot, 'libs', 'tscircuit', 'tscircuit-bundle.js');

// Stub modules pulled in transitively by tscircuit but not needed for schematic
// rendering (PCB copper pour, 3D model rendering). Replacing them with named
// no-op exports keeps the imports resolvable; touching any of these features at
// runtime would throw, but a schematic view never reaches that code.
const stubModules = ['manifold-3d', 'manifold-3d/lib/wasm.js'];

// Named exports the consumer modules pull in. Listed exhaustively because
// esbuild can't infer named exports from a Proxy — they have to be statically
// declared.
const stubExports = [
  'Manifold',
  'CrossSection',
  'getManifoldModule',
  'getManifoldModuleSync',
  'setupManifold',
  'Mesh',
  'FillRule',
  'JoinType',
];

const stubPlugin = {
  name: 'stub-unused-tscircuit-deps',
  setup(build) {
    const stubFilter = new RegExp(
      `^(${stubModules.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`
    );
    build.onResolve({ filter: stubFilter }, (args) => ({
      path: args.path,
      namespace: 'tscircuit-stub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'tscircuit-stub' }, () => {
      const named = stubExports
        .map(
          (name) =>
            `export const ${name} = new Proxy(function(){}, { get(){return ${name};}, apply(){throw new Error("manifold-3d stub: ${name}() called — schematic view does not need 3D/PCB features");}, construct(){throw new Error("manifold-3d stub: new ${name}() — schematic view does not need 3D/PCB features");} });`
        )
        .join('\n');
      return {
        contents: `${named}\nexport default { ${stubExports.join(', ')} };`,
        loader: 'js',
      };
    });
  },
};

async function main() {
  const start = Date.now();
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: outFile,
    format: 'iife',
    platform: 'browser',
    target: ['chrome116'],
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    loader: {
      '.js': 'jsx',
      '.tsx': 'tsx',
      '.ts': 'ts',
    },
    jsx: 'automatic',
    plugins: [stubPlugin],
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'globalThis',
    },
    logLevel: 'info',
    metafile: true,
  });

  const sizeMb = (fs.statSync(outFile).size / (1024 * 1024)).toFixed(2);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nBundle: ${outFile}`);
  console.log(`Size:   ${sizeMb} MB`);
  console.log(`Built in ${elapsed}s`);

  // Write a small metadata file so we know which versions were bundled.
  // Read package.json files directly to avoid `exports` field restrictions.
  const readPkg = (name) =>
    JSON.parse(fs.readFileSync(path.join(projectRoot, 'node_modules', name, 'package.json'), 'utf8'));
  const evalPkg = readPkg('@tscircuit/eval');
  const svgPkg = readPkg('circuit-to-svg');
  const circuitJsonPkg = readPkg('circuit-json');
  const meta = {
    builtAt: new Date().toISOString(),
    sizeBytes: fs.statSync(outFile).size,
    versions: {
      '@tscircuit/eval': evalPkg.version,
      'circuit-to-svg': svgPkg.version,
      'circuit-json': circuitJsonPkg.version,
    },
  };
  fs.writeFileSync(
    path.join(projectRoot, 'libs', 'tscircuit', 'bundle-meta.json'),
    JSON.stringify(meta, null, 2) + '\n'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
