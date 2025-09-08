# create-codex

AGENTS.md setup that just works. Bootstrap every project with the open standard for AI coding agents. One command, zero headaches.

[![version](https://img.shields.io/npm/v/create-codex.svg?label=version&color=brightgreen)](https://www.npmjs.com/package/create-codex)
[![downloads](https://img.shields.io/npm/dm/create-codex.svg?label=downloads&color=blue)](https://www.npmjs.com/package/create-codex)
[![package size](https://img.shields.io/npm/unpacked-size/create-codex?label=package%20size&color=yellow)](https://www.npmjs.com/package/create-codex)
[![license](https://img.shields.io/badge/license-MIT-red.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
npm create codex
```

*Adds **local** AGENTS.md file to your project. ZERO dependencies, ZERO overhead.*

## Installation Options

### Package Managers

```bash
npm create codex               # npm
pnpm create codex              # pnpm  
bun create codex               # bun
yarn create codex              # yarn
```

### Flags

```bash
npm create codex --dry-run     # Preview files
npm create codex --help        # All options
```

### Shortcuts

```bash
npx create-codex                # Direct execution
npx create-codex my-project     # Create in specific directory
```

## Programmatic Usage

### Installation

```bash
npm i create-codex
```

### Usage

```typescript
import { init } from 'create-codex';

await init('./my-project');
```

## Features

### Universal Compatibility

- **Works everywhere**: Codex, Cursor, Aider, Jules, Zed, Windsurf, Continue, and more
- **Open standard**: AGENTS.md is supported by 20k+ projects
- **Zero lock-in**: One file that works with any AI coding agent

### Intelligent Project Detection

- **Runtime detection**: Node.js, Python, Rust, Go, Java, C/C++, TypeScript, Bun
- **Framework detection**: React, Next.js, Vue, Angular, Svelte, Express, FastAPI
- **Package manager detection**: npm, yarn, pnpm, bun, pip, poetry, uv
- **Git integration**: Repository URL, branch information, user details

### Production-Ready

- **Atomic operations**: SHA256 verification and safe file writes
- **Automatic backups**: Timestamped backups of existing files
- **Template rendering**: Smart conditionals and variable substitution

### Smart AGENTS.md Generation

- **Setup commands**: Install, dev, build, test commands for your stack
- **Code standards**: Language-specific best practices and conventions
- **Development workflow**: Optimized step-by-step process
- **Safety boundaries**: Security constraints and operational limits
- **Project context**: Path, Git info, and environment details

## FAQ

<details>
<summary><strong>Is it safe to run?</strong></summary>

Yes. It only creates an AGENTS.md file, never modifies your code. Each file operation uses SHA256 checksums and creates timestamped backups.

```bash
# If something goes wrong, backups are here:
ls .create-codex-backup-*
```

</details>

<details>
<summary><strong>How do I remove it?</strong></summary>

Delete the AGENTS.md file:

```bash
rm AGENTS.md
```

Your original code stays untouched.
</details>

<details>
<summary><strong>What are the requirements?</strong></summary>

- Node.js 20+
- Any AI coding agent that supports AGENTS.md

That's it. No global installs, no dependencies.
</details>

<details>
<summary><strong>Does it work with my tools?</strong></summary>

It auto-detects:

- **Package managers**: npm, yarn, pnpm, bun, pip, poetry, uv  
- **Languages**: JavaScript, TypeScript, Python, Go, Rust, Java, C/C++
- **Frameworks**: React, Vue, Next.js, Express, FastAPI, etc.

Can't find your tool? It falls back to sensible defaults.
</details>

<details>
<summary><strong>What files does it create?</strong></summary>

Creates 1 file:

```
AGENTS.md                   # Project-specific instructions for AI agents
```

Future versions may support additional configuration in `.codex/` directory.

</details>

## Security

This project follows security best practices:

- All dependencies are audited and kept up-to-date
- Code is scanned with CodeQL and other security tools
- OpenSSF Scorecard certified
- Signed releases with build provenance

Report security issues: [SECURITY.md](SECURITY.md)

## Contributing

Contributions welcome! Please read [SECURITY.md](SECURITY.md) first, then:

1. Fork the repo
2. Create a feature branch
3. Run `npm run validate` before committing
4. Submit a pull request

## Links

[**Issues**](https://github.com/RMNCLDYO/create-codex/issues) • [**Changelog**](https://github.com/RMNCLDYO/create-codex/blob/main/CHANGELOG.md) • [**AGENTS.md Docs**](https://agents.md) • [**Security**](SECURITY.md)

## License

MIT © [RMNCLDYO](https://github.com/RMNCLDYO)