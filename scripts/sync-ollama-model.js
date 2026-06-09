#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = process.cwd();
const OPENCODE_JSON = path.join(REPO_ROOT, 'opencode.json');

async function syncModel() {
  try {
    // 1. Get currently loaded model from Ollama
    const psRaw = execSync('curl -s http://localhost:11434/api/ps', { encoding: 'utf8' });
    const ps = JSON.parse(psRaw);
    
    if (!ps.models || ps.models.length === 0) {
      // Nothing loaded, maybe don't change or fallback to big-pickle
      return;
    }

    const loadedModel = ps.models[0].name; // e.g. "qwen2.5-coder:14b-64k"
    
    // 2. Read existing opencode.json
    let cfg = {};
    if (fs.existsSync(OPENCODE_JSON)) {
      cfg = JSON.parse(fs.readFileSync(OPENCODE_JSON, 'utf8'));
    }

    // 3. Update model field if it's different
    if (cfg.model !== loadedModel) {
      console.error(`[ollama-sync] Switching OpenCode model: ${cfg.model || 'none'} -> ${loadedModel}`);
      cfg.model = loadedModel;
      fs.writeFileSync(OPENCODE_JSON, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    }
  } catch (err) {
    console.error(`[ollama-sync] Failed to sync Ollama model: ${err.message}`);
  }
}

syncModel();
