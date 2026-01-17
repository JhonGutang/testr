export const PHPUNIT_CONFIG_FILES = [
    'phpunit.xml',
    'phpunit.xml.dist'
] as const;

export const PHPUNIT_TEST_PATTERNS = [
    '**/*Test.php'
] as const;

export const PHPUNIT_TEST_DIRECTORIES = [
    'tests/Unit',
    'tests/Feature',
    'tests'
] as const;

export const PHPUNIT_BIN_PATHS = {
    vendor: 'vendor/bin/phpunit',
    artisan: 'php artisan test',
    fallback: 'phpunit'
} as const;

export const PHPUNIT_CLI_ARGS = {
    filter: '--filter',
    logJson: '--log-json',
    testdox: '--testdox'
} as const;
