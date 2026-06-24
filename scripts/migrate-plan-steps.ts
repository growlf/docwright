/**
 * migrate-plan-steps.ts
 *
 * Migrates active plan files in plans/ (non-recursive) to:
 *   1. Add Issue and Branch columns to Implementation Steps tables
 *   2. Add a Parallelism Map section after Implementation Steps
 *   3. Add github_epic: null to frontmatter
 *
 * Run from repo root:
 *   npx tsx scripts/migrate-plan-steps.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// isAlreadyMigrated
// ---------------------------------------------------------------------------

/**
 * Returns true if any line inside the Implementation Steps section
 * contains a table cell with the word "Issue" (case-insensitive).
 */
function isAlreadyMigrated(content: string): boolean {
  const lines = content.split("\n");
  let inSection = false;

  for (const line of lines) {
    // Enter section on ## Implementation Steps
    if (/^## Implementation Steps/i.test(line)) {
      inSection = true;
      continue;
    }
    // Exit section on any other ## heading (not ###)
    if (inSection && /^## /.test(line) && !/^### /.test(line)) {
      break;
    }
    if (!inSection) continue;

    // Check table lines for | Issue | cell (case-insensitive)
    if (line.startsWith("|")) {
      const cells = line.split("|").map((c) => c.trim().toLowerCase());
      if (cells.includes("issue")) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// getStepNumbers
// ---------------------------------------------------------------------------

/**
 * Scans the Implementation Steps section and collects all positive integer
 * step numbers from the first cell of table data rows.
 * ## resets the section scan, ### does not.
 */
function getStepNumbers(content: string): number[] {
  const lines = content.split("\n");
  let inSection = false;
  const steps = new Set<number>();

  for (const line of lines) {
    if (/^## Implementation Steps/i.test(line)) {
      inSection = true;
      continue;
    }
    // A bare ## (not ###) that is NOT "## Implementation Steps" ends the section
    if (inSection && /^## /.test(line) && !/^### /.test(line)) {
      break;
    }
    if (!inSection) continue;

    if (line.startsWith("|")) {
      const cells = line.split("|");
      // cells[0] is empty (before leading |), cells[1] is first cell
      if (cells.length >= 2) {
        const firstCell = cells[1].trim();
        const n = parseInt(firstCell, 10);
        if (!isNaN(n) && n > 0 && String(n) === firstCell) {
          steps.add(n);
        }
      }
    }
  }

  return Array.from(steps).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// addIssueColumns
// ---------------------------------------------------------------------------

/**
 * Adds | Issue | Branch | columns to each Implementation Steps table.
 *
 * Rules per line (only inside ## Implementation Steps section):
 *  - HEADER row  : starts with |, has cells 'Action' and 'Status' but NOT 'Issue' → extend
 *  - HEADER row  : already has 'Issue' → mark needExtend=false, leave unchanged
 *  - SEPARATOR   : starts with |, all interior cells are /^[\s-]+$/ → extend when needExtend
 *  - DATA row    : starts with |, first interior cell is a positive integer → extend when needExtend
 *
 * ## heading (not ###) resets inSection and needExtend.
 */
function addIssueColumns(content: string): string {
  if (isAlreadyMigrated(content)) return content;

  const lines = content.split("\n");
  const result: string[] = [];
  let inSection = false;
  let needExtend = false;

  for (const line of lines) {
    // Detect ## Implementation Steps
    if (/^## Implementation Steps/i.test(line)) {
      inSection = true;
      needExtend = false;
      result.push(line);
      continue;
    }

    // Detect ## heading (not ###) that ends the section
    if (/^## /.test(line) && !/^### /.test(line)) {
      inSection = false;
      needExtend = false;
      result.push(line);
      continue;
    }

    // ### headings: don't reset section, reset needExtend so the next table
    // header triggers a fresh decision
    if (/^### /.test(line)) {
      needExtend = false;
      result.push(line);
      continue;
    }

    if (!inSection || !line.startsWith("|")) {
      result.push(line);
      continue;
    }

    // We are in the section and this line starts with |
    const cells = line.split("|");
    // cells[0] == '' (before leading |), cells[last] == '' (after trailing |)
    // Interior cells: cells[1] .. cells[cells.length - 2]
    const interior = cells.slice(1, -1).map((c) => c.trim());
    const interiorLower = interior.map((c) => c.toLowerCase());

    const hasAction = interiorLower.includes("action");
    const hasStatus = interiorLower.includes("status");
    const hasIssue = interiorLower.includes("issue");

    // TABLE HEADER that already has Issue
    if (hasAction && hasStatus && hasIssue) {
      needExtend = false;
      result.push(line);
      continue;
    }

    // TABLE HEADER that needs extending
    if (hasAction && hasStatus && !hasIssue) {
      const trimmed = line.trimEnd();
      // Replace the trailing | with ' | Issue | Branch |'
      const extended = trimmed.replace(/\|$/, "| Issue | Branch |");
      needExtend = true;
      result.push(extended);
      continue;
    }

    // SEPARATOR row: all interior cells match /^[\s-]+$/
    const isSeparator =
      interior.length > 0 && interior.every((c) => /^[\s-]+$/.test(c));
    if (isSeparator && needExtend) {
      const trimmed = line.trimEnd();
      const extended = trimmed.replace(/\|$/, "| --- | --- |");
      result.push(extended);
      continue;
    }

    // DATA row: first interior cell is a positive integer
    if (needExtend && interior.length >= 1) {
      const firstCell = interior[0];
      const n = parseInt(firstCell, 10);
      const isDataRow = !isNaN(n) && n > 0 && String(n) === firstCell;
      if (isDataRow) {
        const trimmed = line.trimEnd();
        // em dash U+2014
        const extended = trimmed.replace(/\|$/, "| — | — |");
        result.push(extended);
        continue;
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

// ---------------------------------------------------------------------------
// addParallelismMap
// ---------------------------------------------------------------------------

/**
 * Inserts a ## Parallelism Map section after the Implementation Steps section.
 * Finds the next ## heading after Implementation Steps ends and inserts before it.
 * If none found, appends at end of file.
 */
function addParallelismMap(content: string): string {
  if (content.includes("## Parallelism Map")) return content;

  const stepNumbers = getStepNumbers(content);
  if (stepNumbers.length === 0) return content;

  // Build the section text
  const rows = stepNumbers
    .map((n) => `| ${n} | — | — | |`)
    .join("\n");

  const section = [
    "## Parallelism Map",
    "",
    "Steps that share no overlapping files can be worked simultaneously on separate `feat/` branches.",
    "Fill in Depends On and Parallel With based on reviewing the step details above.",
    "",
    "| Step | Depends On | Parallel With | Notes |",
    "| --- | --- | --- | --- |",
    rows,
  ].join("\n");

  const lines = content.split("\n");

  // Find where Implementation Steps section begins
  let inSection = false;
  let sectionStarted = false;
  let insertIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^## Implementation Steps/i.test(line)) {
      inSection = true;
      sectionStarted = true;
      continue;
    }

    // Once we've entered Implementation Steps, look for the next ## heading
    if (sectionStarted && inSection && /^## /.test(line) && !/^### /.test(line)) {
      insertIdx = i;
      break;
    }
  }

  if (!sectionStarted) {
    // No Implementation Steps section found — return unchanged
    return content;
  }

  if (insertIdx === -1) {
    // No subsequent ## heading — append at end
    const trimmed = content.trimEnd();
    return trimmed + "\n\n" + section + "\n";
  }

  // Insert before the heading at insertIdx, with surrounding blank lines
  // Ensure there's a blank line before the new section
  const before = lines.slice(0, insertIdx);
  const after = lines.slice(insertIdx);

  // Trim any trailing blank lines from 'before' then add our section
  while (before.length > 0 && before[before.length - 1].trim() === "") {
    before.pop();
  }

  const inserted = [...before, "", section, "", ...after];
  return inserted.join("\n");
}

// ---------------------------------------------------------------------------
// addGithubEpicFrontmatter
// ---------------------------------------------------------------------------

/**
 * Adds 'github_epic: null' as the last line before the closing --- of the
 * frontmatter block. If already present, returns content unchanged.
 */
function addGithubEpicFrontmatter(content: string): string {
  if (content.includes("github_epic:")) return content;

  // Frontmatter is between first '---\n' and second '---\n'
  const firstDash = content.indexOf("---\n");
  if (firstDash === -1) return content;

  const searchFrom = firstDash + 4; // skip past the opening ---\n
  const secondDash = content.indexOf("---\n", searchFrom);
  if (secondDash === -1) return content;

  // Insert 'github_epic: null\n' immediately before the closing ---
  const before = content.slice(0, secondDash);
  const after = content.slice(secondDash);
  return before + "github_epic: null\n" + after;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const plansDir = path.join(process.cwd(), "plans");

  if (!fs.existsSync(plansDir)) {
    console.error(`plans/ directory not found at ${plansDir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(plansDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();

  if (mdFiles.length === 0) {
    console.log("No .md files found in plans/");
    return;
  }

  let updatedCount = 0;
  let upToDateCount = 0;

  for (const filename of mdFiles) {
    const filePath = path.join(plansDir, filename);
    const original = fs.readFileSync(filePath, "utf8");

    let content = original;
    const changes: string[] = [];

    // 1. Add Issue / Branch columns
    const afterColumns = addIssueColumns(content);
    if (afterColumns !== content) {
      changes.push("columns");
      content = afterColumns;
    }

    // 2. Add Parallelism Map
    const afterMap = addParallelismMap(content);
    if (afterMap !== content) {
      changes.push("map");
      content = afterMap;
    }

    // 3. Add github_epic frontmatter
    const afterEpic = addGithubEpicFrontmatter(content);
    if (afterEpic !== content) {
      changes.push("epic");
      content = afterEpic;
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`  updated  ${filename}  [${changes.join(", ")}]`);
      updatedCount++;
    } else {
      console.log(`  ok       ${filename}`);
      upToDateCount++;
    }
  }

  console.log("");
  console.log(
    `${updatedCount} file${updatedCount !== 1 ? "s" : ""} updated, ${upToDateCount} already up to date`
  );
}

main();
