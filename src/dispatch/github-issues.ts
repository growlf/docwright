/**
 * github-issues.ts — GitHub Issues + Projects (v2) client.
 *
 * Foundation for moving dev-issue tracking out of the vault
 * ([[plans/plan-pivot-issue-tracking-to-github-issues-projects-break-the-self-hosting-cyclic-reference]]).
 * ADDITIVE: built + unit-tested here (Step 1); wired into capture/status/migration
 * in later steps. No VS Code deps (dispatch invariant). Reads are cached and
 * degrade to cached/empty when unconfigured or GitHub is unreachable — a read
 * must never throw into a request path. Writes surface their errors.
 *
 * Auth: a least-privilege token from the environment (issues + projects scope on
 * the one repo). Nothing here writes to the vault or reads secrets from disk.
 */

const API = 'https://api.github.com';

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  /** GH Project v2 node id — optional until the board exists (Step 2). */
  projectId?: string;
}

export interface GitHubIssue {
  number: number;
  nodeId: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  url: string;
}

export interface CreateIssueInput {
  title: string;
  body: string;
  labels?: string[];
}

/** A Project v2 field resolved by name (Step 2 schema — see docs/github-project-schema.md). */
export interface ProjectField {
  id: string;
  name: string;
  dataType: string; // TEXT | NUMBER | SINGLE_SELECT | DATE | ...
  options?: Array<{ id: string; name: string }>;
}

/** A Project item with its linked issue + field values keyed by field name. */
export interface ProjectItemDetail {
  itemId: string;
  issue: {
    number: number;
    title: string;
    body: string;
    state: 'open' | 'closed';
    url: string;
    labels: string[];
  } | null;
  fields: Record<string, string | number>;
}

/** Minimal shape of the global fetch — injectable so tests need no network. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<any>; text(): Promise<string> }>;

export class GitHubError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'GitHubError';
  }
}

/**
 * Resolve config from the environment. Returns null when not fully configured so
 * callers can fall back to the local issue store (during the additive/flagged phase).
 *   DOCWRIGHT_GH_REPO="owner/repo"  DOCWRIGHT_GH_TOKEN (or GITHUB_TOKEN)  DOCWRIGHT_GH_PROJECT_ID
 */
export function githubConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GitHubConfig | null {
  const token = env.DOCWRIGHT_GH_TOKEN || env.GITHUB_TOKEN;
  const slug = env.DOCWRIGHT_GH_REPO;
  if (!token || !slug || !slug.includes('/')) return null;
  const [owner, repo] = slug.split('/', 2);
  if (!owner || !repo) return null;
  return { owner, repo, token, projectId: env.DOCWRIGHT_GH_PROJECT_ID || undefined };
}

function mapIssue(raw: any): GitHubIssue {
  return {
    number: raw.number,
    nodeId: raw.node_id,
    title: String(raw.title ?? ''),
    body: String(raw.body ?? ''),
    state: raw.state === 'closed' ? 'closed' : 'open',
    labels: Array.isArray(raw.labels) ? raw.labels.map((l: any) => (typeof l === 'string' ? l : l?.name)).filter(Boolean) : [],
    url: String(raw.html_url ?? ''),
  };
}

export class GitHubClient {
  private cache = new Map<string, { at: number; data: unknown }>();
  private ttlMs: number;
  private now: () => number;

  constructor(
    private cfg: GitHubConfig,
    private fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
    opts: { ttlMs?: number; now?: () => number } = {},
  ) {
    this.ttlMs = opts.ttlMs ?? 60_000;
    // Injectable clock keeps cache-expiry tests deterministic.
    this.now = opts.now ?? (() => Date.now());
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'docwright',
    };
  }

  private async rest(method: string, path: string, body?: unknown): Promise<any> {
    const res = await this.fetchImpl(`${API}${path}`, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new GitHubError(`GitHub ${method} ${path} -> HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`, res.status);
    }
    return res.json();
  }

  private async graphql(query: string, variables: Record<string, unknown>): Promise<any> {
    const res = await this.fetchImpl(`${API}/graphql`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new GitHubError(`GitHub GraphQL -> HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`, res.status);
    }
    const json = await res.json();
    if (json.errors?.length) throw new GitHubError(`GitHub GraphQL: ${json.errors.map((e: any) => e.message).join('; ')}`);
    return json.data;
  }

  /** Cached read that degrades to the last cached value (or fallback) on error. */
  private async cachedRead<T>(key: string, load: () => Promise<T>, fallback: T): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.data as T;
    try {
      const data = await load();
      this.cache.set(key, { at: this.now(), data });
      return data;
    } catch {
      // Degrade read-only: serve a stale cache entry if we have one, else the fallback.
      return hit ? (hit.data as T) : fallback;
    }
  }

  // ── Issues (REST) ──────────────────────────────────────────────────────────

  /** Open issues in the repo (cached, degrades to [] / stale). */
  async listOpenIssues(): Promise<GitHubIssue[]> {
    const { owner, repo } = this.cfg;
    return this.cachedRead(`issues:${owner}/${repo}:open`, async () => {
      const raw = await this.rest('GET', `/repos/${owner}/${repo}/issues?state=open&per_page=100`);
      // /issues also returns PRs; filter them out.
      return (Array.isArray(raw) ? raw : []).filter((r: any) => !r.pull_request).map(mapIssue);
    }, []);
  }

  /** All issues in the given state (paginated, cached, degrades to []). Reconcile source
   *  for migration — must include closed issues so mirrored/resolved ones aren't re-created. */
  async listIssues(state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
    const { owner, repo } = this.cfg;
    return this.cachedRead(`issues:${owner}/${repo}:${state}:all`, async () => {
      const all: GitHubIssue[] = [];
      for (let page = 1; page <= 20; page++) {
        const raw = await this.rest('GET', `/repos/${owner}/${repo}/issues?state=${state}&per_page=100&page=${page}`);
        const arr = Array.isArray(raw) ? raw : [];
        all.push(...arr.filter((r: any) => !r.pull_request).map(mapIssue));
        if (arr.length < 100) break; // last page
      }
      return all;
    }, []);
  }

  /** Full-text/issue search for dedup (cached per-query, degrades to []). */
  async searchIssues(query: string): Promise<GitHubIssue[]> {
    const { owner, repo } = this.cfg;
    const q = `repo:${owner}/${repo} is:issue ${query}`;
    return this.cachedRead(`search:${q}`, async () => {
      const data = await this.rest('GET', `/search/issues?q=${encodeURIComponent(q)}&per_page=50`);
      return (data.items ?? []).filter((r: any) => !r.pull_request).map(mapIssue);
    }, []);
  }

  /** Create an issue (write — errors surface). */
  async createIssue(input: CreateIssueInput): Promise<GitHubIssue> {
    const { owner, repo } = this.cfg;
    const raw = await this.rest('POST', `/repos/${owner}/${repo}/issues`, {
      title: input.title,
      body: input.body,
      labels: input.labels ?? [],
    });
    return mapIssue(raw);
  }

  /** Patch an issue's title/body/state/labels (write). */
  async updateIssue(number: number, patch: Partial<Pick<GitHubIssue, 'title' | 'body' | 'state'>> & { labels?: string[] }): Promise<GitHubIssue> {
    const { owner, repo } = this.cfg;
    const raw = await this.rest('PATCH', `/repos/${owner}/${repo}/issues/${number}`, patch);
    return mapIssue(raw);
  }

  async addLabels(number: number, labels: string[]): Promise<void> {
    const { owner, repo } = this.cfg;
    await this.rest('POST', `/repos/${owner}/${repo}/issues/${number}/labels`, { labels });
  }

  // ── Project v2 (GraphQL) ─────────────────────────────────────────────────────

  /** Add an issue (by node id) to the configured Project; returns the project item id. */
  async addIssueToProject(issueNodeId: string): Promise<string> {
    if (!this.cfg.projectId) throw new GitHubError('no projectId configured (DOCWRIGHT_GH_PROJECT_ID)');
    const data = await this.graphql(
      `mutation($project:ID!,$content:ID!){ addProjectV2ItemById(input:{projectId:$project,contentId:$content}){ item{ id } } }`,
      { project: this.cfg.projectId, content: issueNodeId },
    );
    return data.addProjectV2ItemById.item.id;
  }

  /** Set a single-select Project field (e.g. Status) on a project item. */
  async setProjectSingleSelectField(itemId: string, fieldId: string, optionId: string): Promise<void> {
    if (!this.cfg.projectId) throw new GitHubError('no projectId configured');
    await this.graphql(
      `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item{ id } } }`,
      { p: this.cfg.projectId, i: itemId, f: fieldId, o: optionId },
    );
  }

  /** Set a text Project field (e.g. reported_dates serialized) on a project item. */
  async setProjectTextField(itemId: string, fieldId: string, text: string): Promise<void> {
    if (!this.cfg.projectId) throw new GitHubError('no projectId configured');
    await this.graphql(
      `mutation($p:ID!,$i:ID!,$f:ID!,$t:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{text:$t}}){ projectV2Item{ id } } }`,
      { p: this.cfg.projectId, i: itemId, f: fieldId, t: text },
    );
  }

  /** List the Project's items (cached, degrades to []). Node ids + linked issue numbers. */
  async listProjectItems(): Promise<Array<{ itemId: string; issueNumber: number | null }>> {
    if (!this.cfg.projectId) return [];
    return this.cachedRead(`project:${this.cfg.projectId}:items`, async () => {
      const data = await this.graphql(
        `query($p:ID!){ node(id:$p){ ... on ProjectV2 { items(first:100){ nodes { id content { ... on Issue { number } } } } } } }`,
        { p: this.cfg.projectId },
      );
      const nodes = data?.node?.items?.nodes ?? [];
      return nodes.map((n: any) => ({ itemId: n.id, issueNumber: n.content?.number ?? null }));
    }, []);
  }

  /** Resolve the Project's fields by name (cached, degrades to empty map). */
  async getProjectFields(): Promise<Map<string, ProjectField>> {
    if (!this.cfg.projectId) return new Map();
    return this.cachedRead(`project:${this.cfg.projectId}:fields`, async () => {
      const data = await this.graphql(
        `query($p:ID!){ node(id:$p){ ... on ProjectV2 { fields(first:50){ nodes {
           __typename
           ... on ProjectV2FieldCommon { id name dataType }
           ... on ProjectV2SingleSelectField { id name dataType options { id name } }
         } } } } }`,
        { p: this.cfg.projectId },
      );
      const nodes = data?.node?.fields?.nodes ?? [];
      const map = new Map<string, ProjectField>();
      for (const n of nodes) {
        if (!n?.name) continue;
        map.set(n.name, { id: n.id, name: n.name, dataType: n.dataType, options: n.options });
      }
      return map;
    }, new Map<string, ProjectField>());
  }

  /** Full board read: items with linked-issue content + field values by name.
   *  Cursor-paginated (no silent cap — the parity gate needs every item), cached, degrades to []. */
  async listProjectItemsDetailed(): Promise<ProjectItemDetail[]> {
    if (!this.cfg.projectId) return [];
    return this.cachedRead(`project:${this.cfg.projectId}:detailed`, async () => {
      const nodes: any[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 50; page++) {
        const data: any = await this.graphql(
          `query($p:ID!,$after:String){ node(id:$p){ ... on ProjectV2 { items(first:100,after:$after){
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              content { __typename ... on Issue { number title body state url labels(first:20){ nodes { name } } } }
              fieldValues(first:50){ nodes {
                __typename
                ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
                ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { name } } }
                ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
                ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } }
              } }
            } } } } }`,
          { p: this.cfg.projectId, after: cursor },
        );
        const items = data?.node?.items;
        nodes.push(...(items?.nodes ?? []));
        if (!items?.pageInfo?.hasNextPage) break;
        cursor = items.pageInfo.endCursor;
      }
      return nodes.map((n: any): ProjectItemDetail => {
        const c = n.content ?? {};
        const fields: Record<string, string | number> = {};
        for (const fv of (n.fieldValues?.nodes ?? [])) {
          const fname = fv?.field?.name;
          if (!fname) continue;
          if (fv.text != null) fields[fname] = fv.text;
          else if (fv.number != null) fields[fname] = fv.number;
          else if (fv.name != null) fields[fname] = fv.name; // single-select option name
          else if (fv.date != null) fields[fname] = fv.date;
        }
        return {
          itemId: n.id,
          issue: c.__typename === 'Issue' ? {
            number: c.number,
            title: String(c.title ?? ''),
            body: String(c.body ?? ''),
            state: c.state === 'CLOSED' || c.state === 'closed' ? 'closed' : 'open',
            url: String(c.url ?? ''),
            labels: (c.labels?.nodes ?? []).map((l: any) => l?.name).filter(Boolean),
          } : null,
          fields,
        };
      });
    }, []);
  }

  /** Set a NUMBER Project field on a project item. */
  async setProjectNumberField(itemId: string, fieldId: string, value: number): Promise<void> {
    if (!this.cfg.projectId) throw new GitHubError('no projectId configured');
    await this.graphql(
      `mutation($p:ID!,$i:ID!,$f:ID!,$n:Float!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{number:$n}}){ projectV2Item{ id } } }`,
      { p: this.cfg.projectId, i: itemId, f: fieldId, n: value },
    );
  }

  /**
   * Set a Project field by its schema name, resolving id/type (and option id for
   * single-selects). Lets capture/migration say `setProjectFieldByName(item,'Lifecycle','new')`
   * without hard-coding field ids (portable if the board is recreated).
   */
  async setProjectFieldByName(itemId: string, fieldName: string, value: string | number): Promise<void> {
    const fields = await this.getProjectFields();
    const f = fields.get(fieldName);
    if (!f) throw new GitHubError(`Project has no field named '${fieldName}'`);
    if (f.dataType === 'SINGLE_SELECT') {
      const opt = (f.options ?? []).find(o => o.name === String(value));
      if (!opt) throw new GitHubError(`Project field '${fieldName}' has no option '${value}'`);
      await this.setProjectSingleSelectField(itemId, f.id, opt.id);
    } else if (f.dataType === 'NUMBER') {
      await this.setProjectNumberField(itemId, f.id, Number(value));
    } else {
      await this.setProjectTextField(itemId, f.id, String(value));
    }
  }

  /** Add a comment to an issue (write — errors surface). */
  async addComment(number: number, body: string): Promise<void> {
    const { owner, repo } = this.cfg;
    await this.rest('POST', `/repos/${owner}/${repo}/issues/${number}/comments`, { body });
  }
}
