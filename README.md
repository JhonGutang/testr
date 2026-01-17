# Testr

A fast and efficient test runner for Visual Studio Code.

![Testr](https://img.shields.io/badge/VS%20Code-Extension-blue)
![Jest](https://img.shields.io/badge/Framework-Jest-green)
![PHPUnit](https://img.shields.io/badge/Framework-PHPUnit-blue)

## Features

- **Run all tests or individual tests** with a single click
- **Organized test suite tree** in the Test Explorer
- **Real-time status bar** showing test execution progress
- **Jest support** with automatic framework detection
- **PHPUnit support** for efficient PHP testing (Laravel compatible)

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Press `F5` to launch the Extension Development Host

## Usage

### Running Tests

1. Open a project with Jest tests
2. Open the Test Explorer (View → Testing)
3. Click the "Run" button to run all tests, or click on individual tests

### Keyboard Shortcuts

- `Ctrl+; Ctrl+A` - Run all tests
- `Ctrl+; Ctrl+C` - Run tests at cursor

## Project Structure

```
src/
├── extension.ts           # Extension entry point
├── types/                 # TypeScript type definitions
├── adapters/              # Framework-specific adapters
│   ├── jest/              # Jest adapter implementation
│   └── phpunit/           # PHPUnit adapter implementation
├── discovery/             # Test discovery components
├── execution/             # Test execution components
└── ui/                    # UI components (status bar)
```

## Documentation

- [Mental Model](docs/mental-model.md) - Architecture and key concepts
- [Test Orchestrator](docs/test-orchestrator.md) - How test orchestration works
- [PHPUnit Support](docs/phpunit.md) - Using Testr with PHP/Laravel

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Lint
npm run lint
```

## Rules

This project adheres to:

1. Strictly typed TypeScript code
2. Clean code principles (meaningful names)
3. Minimal comments (only for complex logic)

## Roadmap

- [ ] Vitest support
- [ ] Mocha support
- [ ] Custom test folder configuration
- [ ] Test coverage integration

## License

MIT
