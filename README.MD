[![Build Status](https://travis-ci.org/nathan-boyd/tsqllint-vscode-extension.svg?branch=master)](https://travis-ci.org/nathan-boyd/tsqllint-vscode-extension)

# TSQLLint VS Code Extension

TSQLLint is a tool for describing, identifying, and reporting on undesirable patterns in TSQL scripts. This extension provides this functionality within VS Code.

## Installation

This extension may be installed from within VS Code or the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=tsqllint.tsqllint) of from the Extensions dialog in VS Code.

## Usage

After installation, this extension will activate when any .sql file is opened within VS Code. Potetial problems will be underlined in red and details will be available by hovering over the underline.

![Usage Example](images/usage-animation.gif?raw=true)

## Creating custom configurations

Configure tsqllint by creating a config file called ".tsqllintrc" in your $HOME directory in OSX or %HOMEPATH% directory in Windows.

Rules may be set to "off", "warning", or "error".

```json
{
    "rules": {
        "concat-strings": "error",
        "conditional-begin-end": "error",
        "cross-database-transaction": "error",
        "data-compression": "error",
        "data-type-length": "error",
        "disallow-cursors": "error",
        "full-text": "error",
        "information-schema": "error",
        "keyword-capitalization": "error",
        "linked-server": "error",
        "multi-table-alias": "error",
        "non-sargable": "error",
        "object-property": "error",
        "print-statement": "error",
        "schema-qualify": "error",
        "select-star": "error",
        "semicolon-termination": "error",
        "set-ansi": "error",
        "set-nocount": "error",
        "set-quoted-identifier": "error",
        "set-transaction-isolation-level": "error",
        "set-variable": "error",
        "upper-lower": "error"
    }
}
```

## Disabling Rules with Inline Comments

To temporarily disable rule warnings in a script, use comments in the following format:

```sql
/* tsqllint-disable */

SELECT * FROM FOO;

/* tsqllint-enable */
```

You can also disable or enable warnings for specific rules:

```sql
/* tsqllint-disable select-star */

SELECT * FROM FOO;

/* tsqllint-enable select-star */
```

To disable warnings for the entire script, place a /* tsqllint-disable */ comment at the top of the file:

```sql
/* tsqllint-disable */

SELECT * FROM FOO;
```

To disable specific rule warnings for the entire script place a comment similar to the following at the top of the file:

```sql
/* tsqllint-disable select-star */

SELECT * FROM FOO;
```

## Plugins

You can extend the base functionality of TSQLLint by creating a custom plugin. TSQLLint plugins are .Net assemblies that implement the IPlugin interface from TSQLLint.Common.

Details on plugin development may be found in the [TSQLLint](https://github.com/tsqllint/tsqllint#plugins) documentation
