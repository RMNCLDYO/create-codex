# AGENTS.md

{{#RUNTIME}}
{{#HAS_FRAMEWORK}}{{FRAMEWORK}} project using {{RUNTIME}}{{/HAS_FRAMEWORK}}{{^HAS_FRAMEWORK}}{{RUNTIME}} project{{/HAS_FRAMEWORK}}{{#HAS_PACKAGE_MANAGER}} with {{PACKAGE_MANAGER}}{{/HAS_PACKAGE_MANAGER}}.
{{/RUNTIME}}
{{#INSTALL_COMMAND}}

## Setup commands

- Install deps: `{{INSTALL_COMMAND}}`{{#DEV_COMMAND}}
- Start dev: `{{DEV_COMMAND}}`{{/DEV_COMMAND}}{{#BUILD_COMMAND}}
- Build: `{{BUILD_COMMAND}}`{{/BUILD_COMMAND}}{{#TEST_COMMAND}}
- Run tests: `{{TEST_COMMAND}}`{{/TEST_COMMAND}}

## Development workflow

1. Write code following standards below{{#TEST_COMMAND}}
2. Run tests: `{{TEST_COMMAND}}`{{/TEST_COMMAND}}{{#BUILD_COMMAND}}
3. Build: `{{BUILD_COMMAND}}`{{/BUILD_COMMAND}}
4. Review before commit
{{/INSTALL_COMMAND}}{{^INSTALL_COMMAND}}

## Instructions

1. Create clear file structure and naming
2. Write code following standards below
3. Test functionality manually
4. Review and refactor before commit
{{/INSTALL_COMMAND}}

## Code standards

- **Files**: Clear names, logical organization
- **Functions**: Under 50 lines, single responsibility
- **Variables**: Descriptive names, no abbreviations
- **Logic**: Early returns, avoid deep nesting
- **Errors**: Handle explicitly, fail gracefully
- **Comments**: Explain why, not what
- **Testing**: Write tests for new functionality
- **Dependencies**: Keep minimal, justify additions

## Best practices

- Start with working code, then optimize
- Delete dead code immediately
- One logical change per commit
- Document complex business logic
- Use consistent formatting
- Validate inputs and sanitize outputs

## Boundaries

- Never commit secrets or API keys
- Don't delete files without explicit instruction
- No sudo commands or system modifications
- Ask before installing new dependencies
- Preserve existing configuration files
{{#PROJECT_PATH}}

## Project context

Path: {{PROJECT_PATH}}{{#HAS_GIT}}
Git: {{VERSION_CONTROL}}{{/HAS_GIT}}
{{/PROJECT_PATH}}
