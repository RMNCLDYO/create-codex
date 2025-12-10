# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-12-10

### Fixed

- Remove duplicate devDependencies entries in package.json that caused CI failures

### Changed

- Bump @types/node from 24.5.2 to 24.10.2
- Bump packageManager from npm@11.6.0 to npm@11.7.0

## [0.1.0] - 2025-09-07

### Added

- AGENTS.md generation following the open standard
- Auto-detection of project runtime, framework, and package manager
- Smart command detection (install, dev, build, test) from package.json
- Template variables with conditional rendering support
- Atomic file operations with SHA256 verification
- Automatic timestamped backups of existing files
- Optional .codex directory support for future extensibility
- Support for custom prompts in .codex/prompts/
- Production-ready TypeScript implementation

[0.1.1]: https://github.com/RMNCLDYO/create-codex/releases/tag/v0.1.1
[0.1.0]: https://github.com/RMNCLDYO/create-codex/releases/tag/v0.1.0
