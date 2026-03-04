<p align="center"><strong>test-ctx</strong></p>
<p align="center">
<i>Stop your AI from hallucinating business logic</i></p>

`test-ctx` turns your existing test suite into a strict rulebook that AI coding agents must obey. It scans your tests, extracts the hidden architectural invariants, and writes them into a single `test-ctx.md` file you can feed directly to any AI.

### The Problem: AI knows syntax but ignores business constraints

Modern AI coding tools (Cursor, Claude Code, Copilot, Windsurf, etc.) are excellent at syntax, refactors, and boilerplate. But they are blind to your project-specific rules:

- Which tables are forbidden to mutate.
- Which services are allowed to talk to which.
- What invariants must never be broken (idempotency, permissions, validation, limits).

Those rules usually live in tests, tribal knowledge, and scattered docs, not in a single machine-readable place. As a result, AI agents:

- Propose destructive database migrations.
- Bypass validation or auth flows.
- Introduce cross-module coupling that your architecture explicitly forbids.

### The Solution: A CLI that extracts invariants from tests

`test-ctx` is a CLI that:

- Discovers your test files.
- Sends structured summaries of those tests to an LLM.
- Extracts business rules and architectural constraints, not just "function should exist"-style trivia.
- Consolidates them into a curated `test-ctx.md` rulebook, grouped by domain.

You then plug `test-ctx.md` into your AI tools so they behave like a senior engineer who knows your project's non-negotiables.

---

### Quick Start

#### 1. Installation

**Option A: Clone and link globally (Recommended)**
This allows you to run the `test-ctx` command in any project on your machine.
```bash
git clone https://github.com/dr-alberto/test-ctx.git
cd test-ctx
npm install
npm run build
npm link
```

**Option B: Run directly via npx**
Run it on-demand without cloning the repository:
```bash
npx github:dr-alberto/test-ctx
```

#### 2. Environment variables

Set **exactly one** provider API key in your environment (or `.env`):

- **OpenRouter (can be used for free models)**  
  OpenRouter exposes multiple models, including free options like `deepseek/deepseek-r1-0528:free`, so you can try `test-ctx` **without spending money**:
  ```bash
  export OPEN_ROUTER_API_KEY=your_openrouter_key
  ```

- **OpenAI**  
  ```bash
  export OPENAI_API_KEY=your_openai_key
  ```

- **Anthropic**  
  ```bash
  export ANTHROPIC_API_KEY=your_anthropic_key
  ```

Optionally set a default model:

```bash
# Example defaults
export DEFAULT_MODEL=gpt-4o-mini                            # OpenAI
export DEFAULT_MODEL=claude-3-5-haiku-20241022              # Anthropic
export DEFAULT_MODEL=deepseek/deepseek-r1-0528:free         # OpenRouter (free)
```

#### 3. Running the tool

From your target project's root directory (assuming you used Option A to `npm link`):

```bash
# Basic usage
test-ctx

# Point at a specific root directory of tests
test-ctx --root ./src

# Include code snippets from tests in the LLM input
test-ctx --include-code
```
*(Note: If you are using Option B, replace `test-ctx` with `npx github:dr-alberto/test-ctx` in the commands above).*

`test-ctx` will:

1. Discover tests (e.g., `**/*.test.*`, `**/*.spec.*`).
2. Extract test descriptions (and optionally snippets).
3. Call the configured LLM to infer rules.
4. Consolidate everything into `test-ctx.md` in your current working directory.

On success you will see:

```text
Success! Extracted test rules to test-ctx.md.
Next Step: Add this file to your AI's context (e.g., copy its contents into .cursorrules, reference it in CLAUDE.md, or simply @ tag it in your AI chat).
```


---

### How to Use with AI Agents (Crucial)

The generated `test-ctx.md` file is your source of truth for AI agents. The core idea is to make every agent read it before touching your codebase.

- **Cursor**  
  - Add the contents of `test-ctx.md` to `.cursorrules`, or  
  - Keep `test-ctx.md` in your repo and `@test-ctx.md` in chats when asking for non-trivial changes.

- **Claude Code**  
  - Create or update `CLAUDE.md` in your repo.  
  - Paste the contents of `test-ctx.md` into that file (or a dedicated `docs/test-ctx.md` and reference it in `CLAUDE.md`).  
  - In chat, tell Claude: "Always obey the rules from `test-ctx.md` in this repo."

- **Copilot**  
  - Store `test-ctx.md` in your repo.  
  - Reference it from `copilot-instructions.md` or other Copilot config, telling it to read and obey those rules.

- **Generic case**  
  - Paste the contents of `test-ctx.md` into a system or initial message.  
  - Or upload it as a file and say: "These are the hard project rules. Reject any change that violates them."

Whenever your test suite evolves, re-run `test-ctx` to regenerate `test-ctx.md`, and keep your AI instructions in sync with reality.

---

### The A/B Test: "Delete inactive users"

We asked an AI agent to write a script to delete inactive users in a project that strictly forbids deletions on the `auth` schema.

**❌ Without test-ctx (The AI hallucinates a destructive query):**
> *AI Output:* "Sure! Here is the PostgreSQL function to delete those users..."
> \`\`\`sql
> delete from auth.users u where u.last_sign_in_at < v_cutoff;
> \`\`\`
> *(Result: The AI writes code that violates core database security constraints).*

**✅ With test-ctx (The AI reads the rules and refuses):**
> *AI Output:* "**This cannot be implemented as requested.** Your project rules explicitly state: *'Block DELETE operations on any table in auth schema'*. So any utility that issues a DELETE against auth.* tables would violate the project’s hard rules. What you *can* do instead is implement a soft-delete/deactivation..."
> *(Result: The AI acts like a Senior Engineer, rejects the bad architecture, and proposes the correct pattern).*

---

### Roadmap

`test-ctx` is currently an MVP, but the vision is to build the ultimate Context Hub for AI Engineers. 

- [x] **Core Extraction Engine:** Parse JS/TS test files (Jest, Vitest) and extract business invariants.
- [x] **LLM Consolidation:** Filter out noise and format strictly as actionable AI instructions.
- [ ] **Multi-Language Support:** Add AST parsers for Python (PyTest), Go (`testing`), Rust, and Ruby (RSpec).
- [ ] **CI/CD Automation (GitHub Action):** Automatically regenerate and commit the `test-ctx.md` file whenever tests are added or modified in a PR.
- [ ] **Smart Delta Updates:** Only parse test files that have changed since the last run to save LLM API costs.
- [ ] **Got a suggestion?**: Open an issue!

---

### License

`test-ctx` is open source and released under the **MIT License**.

