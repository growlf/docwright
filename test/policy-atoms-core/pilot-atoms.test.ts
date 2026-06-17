/**
 * Step 2 pilot atom tests — side-by-side equivalence.
 *
 * For each pilot atom, the same documents are fed to:
 *   (A) the atom check (via the check.js compiled artifact)
 *   (B) the equivalent TypeScript reimplementation of the old-path check
 *       (mirrors the bash logic in scripts/pre-commit.sh and .githooks/commit-msg)
 *
 * The test asserts: A.pass === B.pass for every test case.
 * If they diverge, the atom spec or the equivalence test is wrong — fix before retirement.
 */
import assert from 'assert';
import * as path from 'node:path';
import { resolve } from '../../src/policy-atoms-core/resolver.js';
import type { CheckContext, CheckResult } from '../../src/policy-atoms-core/schema.js';

const POLICIES_DIR = path.resolve(process.cwd(), 'policies');

// ---------------------------------------------------------------------------
// Old-path check reimplementations (TypeScript equivalents of bash logic)
// ---------------------------------------------------------------------------

function oldPath_commitFormat(message: string): boolean {
  const firstLine = message.split('\n')[0].replace(/\r$/, '');
  return /^(feat|fix|docs|refactor|test|chore|policy|decision): .+/.test(firstLine);
}

function oldPath_frontmatterValidate(filePath: string, fm: Record<string, unknown>): boolean {
  const PROPOSAL_FIELDS = ['title', 'author', 'created', 'tags', 'approved', 'created_by', 'assigned_to'];
  const PLAN_FIELDS     = ['title', 'status', 'author', 'created', 'proposal_source', 'priority', 'assigned_to'];

  const isProposal = /^proposals\/[^/]+\.md$/.test(filePath) && !filePath.includes('proposals/approved/');
  const isPlan     = /^plans\/[^/]+\.md$/.test(filePath) && !filePath.includes('plans/completed/');
  const fields     = isProposal ? PROPOSAL_FIELDS : isPlan ? PLAN_FIELDS : null;
  if (!fields) return true;
  return fields.every(f => {
    const v = fm[f];
    return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
  });
}

function oldPath_noWorkBeforeApproval(fm: Record<string, unknown>): boolean {
  const status   = fm['status'] as string | undefined;
  const assigned = fm['assigned_to'] as string | string[] | undefined;
  if (!status || !['approved', 'in-progress'].includes(status)) return true;
  const val = Array.isArray(assigned) ? assigned[0] : assigned;
  return !(!val || String(val).trim() === '' || String(val).trim().toLowerCase() === 'none');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ctx(overrides: Partial<CheckContext>): CheckContext {
  return {
    filePath: 'proposals/test.md',
    frontmatter: {},
    content: '',
    vaultRoot: process.cwd(),
    ...overrides,
  };
}

async function atomCheck(id: string, context: CheckContext): Promise<CheckResult> {
  const { atoms, errors } = await resolve([id], { policiesDir: POLICIES_DIR });
  if (errors.length) throw new Error(`resolve error: ${JSON.stringify(errors)}`);
  const atom = atoms[0];
  if (!atom.check) throw new Error(`atom ${id} has no compiled check.js`);
  return atom.check(context);
}

// ---------------------------------------------------------------------------
// commit-format
// ---------------------------------------------------------------------------

describe('pilot atom / commit-format (side-by-side)', () => {
  const cases: Array<{ msg: string; desc: string }> = [
    { msg: 'feat: add new feature',               desc: 'valid feat'          },
    { msg: 'fix: correct the bug',                desc: 'valid fix'           },
    { msg: 'docs: update readme',                 desc: 'valid docs'          },
    { msg: 'chore: bump dependency',              desc: 'valid chore'         },
    { msg: 'policy: enforce review gate',         desc: 'valid policy'        },
    { msg: 'decision: adopt direnv pattern',      desc: 'valid decision'      },
    { msg: 'feat: multi\nline body here',         desc: 'valid multiline'     },
    { msg: 'Added new feature',                   desc: 'no type prefix'      },
    { msg: 'feat:missing space',                  desc: 'no space after colon'},
    { msg: 'wip: work in progress',               desc: 'invalid type'        },
    { msg: 'Feat: capital type',                  desc: 'wrong case'          },
    { msg: '',                                    desc: 'empty message'       },
    { msg: 'feat: ',                              desc: 'empty description'   },
  ];

  for (const { msg, desc } of cases) {
    it(`"${desc}" — atom agrees with old-path`, async () => {
      const atomResult  = await atomCheck('commit-format', ctx({ content: msg }));
      const oldPass     = oldPath_commitFormat(msg);
      assert.strictEqual(atomResult.pass, oldPass, `divergence on "${desc}": atom=${atomResult.pass} old=${oldPass} message="${atomResult.message}"`);
    });
  }
});

// ---------------------------------------------------------------------------
// frontmatter-validate
// ---------------------------------------------------------------------------

describe('pilot atom / frontmatter-validate (side-by-side)', () => {
  const validProposalFm = {
    title: 'My Proposal', author: 'NetYeti', created: '2026-06-17',
    tags: ['tooling'], approved: false, created_by: 'NetYeti@phoenix', assigned_to: '',
  };
  const validPlanFm = {
    title: 'My Plan', status: 'draft', author: 'NetYeti', created: '2026-06-17',
    proposal_source: 'proposals/my-proposal', priority: 'high', assigned_to: 'NetYeti',
  };

  const cases: Array<{ filePath: string; fm: Record<string, unknown>; desc: string }> = [
    { filePath: 'proposals/my-proposal.md', fm: validProposalFm,                   desc: 'valid proposal' },
    { filePath: 'proposals/my-proposal.md', fm: { ...validProposalFm, title: '' }, desc: 'missing title' },
    { filePath: 'proposals/my-proposal.md', fm: { ...validProposalFm, tags: [] },  desc: 'empty tags array' },
    { filePath: 'proposals/my-proposal.md', fm: { ...validProposalFm, created_by: undefined }, desc: 'missing created_by' },
    { filePath: 'plans/my-plan.md',         fm: validPlanFm,                       desc: 'valid plan' },
    { filePath: 'plans/my-plan.md',         fm: { ...validPlanFm, status: '' },    desc: 'missing plan status' },
    { filePath: 'plans/my-plan.md',         fm: { ...validPlanFm, priority: undefined }, desc: 'missing priority' },
    { filePath: 'proposals/approved/x.md',  fm: {},                                desc: 'approved/ — skipped' },
    { filePath: 'plans/completed/x.md',     fm: {},                                desc: 'completed/ — skipped' },
    { filePath: 'docs/notes.md',            fm: {},                                desc: 'docs/ — skipped' },
  ];

  for (const { filePath, fm, desc } of cases) {
    it(`"${desc}" — atom agrees with old-path`, async () => {
      const atomResult = await atomCheck('frontmatter-validate', ctx({ filePath, frontmatter: fm }));
      const oldPass    = oldPath_frontmatterValidate(filePath, fm);
      assert.strictEqual(atomResult.pass, oldPass, `divergence on "${desc}": atom=${atomResult.pass} old=${oldPass} message="${atomResult.message}"`);
    });
  }
});

// ---------------------------------------------------------------------------
// no-work-before-approval
// ---------------------------------------------------------------------------

describe('pilot atom / no-work-before-approval (side-by-side)', () => {
  const cases: Array<{ fm: Record<string, unknown>; desc: string }> = [
    { fm: { status: 'in-progress', assigned_to: 'NetYeti' },    desc: 'in-progress with assignee' },
    { fm: { status: 'approved',    assigned_to: 'NetYeti' },    desc: 'approved with assignee'    },
    { fm: { status: 'draft',       assigned_to: '' },           desc: 'draft, no assignee'        },
    { fm: { status: 'waiting',     assigned_to: '' },           desc: 'waiting, no assignee'      },
    { fm: { status: 'in-progress', assigned_to: '' },           desc: 'in-progress, empty'        },
    { fm: { status: 'in-progress', assigned_to: 'None' },       desc: 'in-progress, None'         },
    { fm: { status: 'approved',    assigned_to: undefined },    desc: 'approved, undefined'       },
    { fm: { status: 'approved',    assigned_to: ['NetYeti'] },  desc: 'approved, array assignee'  },
    { fm: { status: 'approved',    assigned_to: [''] },         desc: 'approved, empty array'     },
    { fm: { status: 'completed',   assigned_to: '' },           desc: 'completed, no assignee'    },
  ];

  for (const { fm, desc } of cases) {
    it(`"${desc}" — atom agrees with old-path`, async () => {
      const atomResult = await atomCheck('no-work-before-approval', ctx({ filePath: 'plans/my-plan.md', frontmatter: fm }));
      const oldPass    = oldPath_noWorkBeforeApproval(fm);
      assert.strictEqual(atomResult.pass, oldPass, `divergence on "${desc}": atom=${atomResult.pass} old=${oldPass} message="${atomResult.message}"`);
    });
  }
});
