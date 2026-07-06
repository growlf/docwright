import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateIssuesFromDeliverables } from '../../src/mcp/lib/issue-generation';
import { setRepoRoot } from '../../src/mcp/lib/paths';

describe('Issue generation from deliverables', () => {
  const tmpDir = path.join(__dirname, '../../test-tmp-issues');

  before(() => {
    setRepoRoot(tmpDir);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'issues'), { recursive: true });
  });

  after(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('generates no issues for empty deliverables', () => {
    const result = generateIssuesFromDeliverables(
      'test-plan.md',
      'plans/test-plan.md',
      [],
    );
    assert.deepStrictEqual(result, []);
  });

  it('generates one issue per deliverable', () => {
    const deliverables = [
      { title: 'First deliverable', description: 'Details' },
      { title: 'Second deliverable' },
    ];

    const result = generateIssuesFromDeliverables(
      'test-plan.md',
      'plans/test-plan.md',
      deliverables,
    );

    assert.strictEqual(result.length, 2);
    assert.ok(result[0].startsWith('issues/'));
    assert.ok(result[1].startsWith('issues/'));
  });

  it('populates issue frontmatter with plan references', () => {
    const deliverables = [
      { title: 'Test deliverable', description: 'Test description' },
    ];

    const result = generateIssuesFromDeliverables(
      'my-plan.md',
      'plans/my-plan.md',
      deliverables,
    );

    const issuePath = path.join(tmpDir, result[0]);
    const content = fs.readFileSync(issuePath, 'utf8');

    assert.ok(content.includes('plan: my-plan.md'));
    assert.ok(content.includes('cross_link: plans/my-plan.md'));
    assert.ok(content.includes('status: new'));
    assert.ok(content.includes('title: Test deliverable'));
  });

  it('includes acceptance criteria in generated issues', () => {
    const deliverables = [
      {
        title: 'Deliverable with criteria',
        acceptance_criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'],
      },
    ];

    const result = generateIssuesFromDeliverables(
      'test-plan.md',
      'plans/test-plan.md',
      deliverables,
    );

    const issuePath = path.join(tmpDir, result[0]);
    const content = fs.readFileSync(issuePath, 'utf8');

    assert.ok(content.includes('## Acceptance Criteria'));
    assert.ok(content.includes('- [ ] Criterion 1'));
    assert.ok(content.includes('- [ ] Criterion 2'));
    assert.ok(content.includes('- [ ] Criterion 3'));
  });

  it('avoids filename collisions', () => {
    // Pre-create an issue
    fs.writeFileSync(
      path.join(tmpDir, 'issues/collaboration-test.md'),
      'existing issue',
    );

    const deliverables = [
      { title: 'Test', description: 'First' },
      { title: 'Test', description: 'Second - should get a different filename' },
    ];

    const result = generateIssuesFromDeliverables(
      'test-plan.md',
      'plans/test-plan.md',
      deliverables,
    );

    assert.strictEqual(result.length, 2);
    assert.notStrictEqual(result[0], result[1]);
  });

  it('skips deliverables without title', () => {
    const deliverables = [
      { title: 'Valid deliverable' },
      { description: 'Missing title' } as any,
      { title: 'Another valid' },
    ];

    const result = generateIssuesFromDeliverables(
      'test-plan.md',
      'plans/test-plan.md',
      deliverables,
    );

    assert.strictEqual(result.length, 2);
  });

  it('generates issue filename from deliverable title', () => {
    const deliverables = [
      { title: 'Add real-time collaboration with WebSockets' },
    ];

    const result = generateIssuesFromDeliverables(
      'test-plan.md',
      'plans/test-plan.md',
      deliverables,
    );

    const filename = path.basename(result[0]);
    assert.ok(filename.includes('collaboration'));
    assert.ok(filename.includes('websocket'));
  });
});
