# PHPUnit Support

Testr provides first-class support for PHPUnit, with a focus on seamless integration with Laravel applications.

## Prerequisites

- PHP installed and available in your system PATH
- `phpunit` installed in your project (via Composer)

## Features

- **Automatic Detection**: Testr automatically detects PHPUnit projects by looking for `phpunit.xml` or `phpunit.xml.dist` files.
- **Test Discovery**: Automatically finds tests following the `*Test.php` naming convention.
- **Detailed Reporting**: Parses JUnit XML output to provide accurate pass/fail/skip status, execution time, and error messages.
- **Laravel Compatible**: Designed to work out-of-the-box with standard Laravel directory structures.

## Configuration

Testr works with your existing `phpunit.xml` configuration. No additional extension configuration is required.

It expects the standard project structure:
```
my-laravel-app/
├── app/
├── tests/
│   ├── Unit/
│   │   └── ExampleTest.php
│   └── Feature/
│       └── ExampleTest.php
├── phpunit.xml
└── vendor/
    └── bin/
        └── phpunit
```

## How it Works

1. **Discovery**: Testr scans your workspace for `*Test.php` files, excluding `node_modules` and `vendor`.
2. **Parsing**: It uses regex-based parsing to identify test classes and methods (`test*` methods or `@test` annotations).
3. **Execution**: When running tests, Testr executes the `vendor/bin/phpunit` binary.
   - It uses the `--log-junit` argument to generate a temporary XML report.
   - It parses this XML report to update the Test Explorer UI.

## Troubleshooting

- **Tests not appearing**: Ensure your test files end in `Test.php` and extend `PHPUnit\Framework\TestCase`.
- **Execution fails**: Check the "Testr" output channel in VS Code for detailed logs.
