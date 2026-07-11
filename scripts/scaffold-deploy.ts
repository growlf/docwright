#!/usr/bin/env tsx
/**
 * scaffold-deploy.ts — generate an image-based DocWright deployment directory
 * for ANY vault path. Writes docker-compose.prod.yml + a filled .env + app.env
 * (from the tracked templates) into the target dir. Edits NO tracked repo file;
 * only writes into the deploy directory. (live-ai/image-based-deployment step 3.1)
 *
 * Usage:
 *   npx tsx scripts/scaffold-deploy.ts --dir /srv/docwright-acme --vault /srv/acme-vault \
 *     [--port 5173] [--image ghcr.io/growlf/docwright:latest] [--force]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

function usage() {
  console.log(`Usage: npx tsx scripts/scaffold-deploy.ts --dir <deploy-dir> --vault <vault-path> [options]

Generate an image-based DocWright deployment directory (nothing DocWright-owned
lives in it — just .env, app.env, and the compose file; the app is the image).

Options:
  --dir     Target deployment directory to create/populate (required)
  --vault   Host path to the vault mounted at /vault (required)
  --port    Host port to publish (default: 5173)
  --image   Image ref; pin by digest in production (default: ghcr.io/growlf/docwright:latest)
  --force   Overwrite an existing .env / app.env (default: never clobber secrets)
  --help    Show this help
`);
}

function inferDocWrightPath(): string {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  return path.resolve(scriptDir, '..');
}

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { usage(); process.exit(0); }

  const dir = arg(args, '--dir');
  const vault = arg(args, '--vault');
  const port = arg(args, '--port') || '5173';
  const image = arg(args, '--image') || 'ghcr.io/growlf/docwright:latest';
  const force = args.includes('--force');

  if (!dir || !vault) { usage(); console.error('ERROR: --dir and --vault are required.'); process.exit(1); }

  const dw = inferDocWrightPath();
  const composeSrc = path.join(dw, 'docker-compose.prod.yml');
  const appEnvSrc = path.join(dw, 'app.env.example');
  for (const f of [composeSrc, appEnvSrc]) {
    if (!fs.existsSync(f)) { console.error(`ERROR: missing template ${f} (is this a DocWright checkout?)`); process.exit(1); }
  }

  const vaultAbs = path.resolve(vault);
  if (!fs.existsSync(vaultAbs)) console.warn(`WARNING: vault path does not exist yet: ${vaultAbs}`);

  const deployDir = path.resolve(dir);
  fs.mkdirSync(deployDir, { recursive: true });

  // compose file (copied verbatim)
  fs.copyFileSync(composeSrc, path.join(deployDir, 'docker-compose.prod.yml'));

  // .env — compose interpolation vars (image / vault / host port)
  const envPath = path.join(deployDir, '.env');
  if (fs.existsSync(envPath) && !force) {
    console.warn(`SKIP .env (exists; use --force to overwrite): ${envPath}`);
  } else {
    fs.writeFileSync(envPath,
      `# DocWright deployment — compose interpolation vars.\n` +
      `DOCWRIGHT_IMAGE=${image}\n` +
      `VAULT_PATH=${vaultAbs}\n` +
      `PORT=${port}\n`);
  }

  // app.env — container runtime config (from the tracked example; edit before go-live)
  const appEnvPath = path.join(deployDir, 'app.env');
  if (fs.existsSync(appEnvPath) && !force) {
    console.warn(`SKIP app.env (exists; use --force to overwrite): ${appEnvPath}`);
  } else {
    fs.copyFileSync(appEnvSrc, appEnvPath);
  }

  console.log(`\n✅ Scaffolded DocWright deployment in ${deployDir}\n`);
  console.log(`Files: docker-compose.prod.yml, .env, app.env`);
  console.log(`\nNext steps:`);
  console.log(`  1. Edit ${appEnvPath}`);
  console.log(`     - AUTH_MODE + LOCAL_AUTH_* (or forgejo) for access control`);
  console.log(`     - ORIGIN=<the URL users will hit>  (required for login form POSTs)`);
  console.log(`     - OPENCODE_URL + OPENCODE_SERVER_PASSWORD for AI features`);
  console.log(`  2. cd ${deployDir}`);
  console.log(`  3. docker compose -f docker-compose.prod.yml up -d`);
  console.log(`  4. Update later with: docker compose -f docker-compose.prod.yml pull && up -d`);
  console.log(`\n(Pin DOCWRIGHT_IMAGE to a digest in .env for reproducible production deploys.)\n`);
}

main();
