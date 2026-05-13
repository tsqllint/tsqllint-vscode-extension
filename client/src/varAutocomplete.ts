"use strict";

import {
    ExtensionContext,
    languages,
    CompletionItem,
    CompletionItemKind,
    Range,
    WorkspaceEdit,
} from "vscode";

/**
 * Registers variable autocomplete and rename providers for SQL @variables.
 *
 * Autocomplete suggests @variables declared earlier in the document.
 * F2 rename renames all occurrences of the variable in the current file.
 *
 * To disable, comment out the registerVarAutocomplete() call in extension.ts.
 */
export function registerVarAutocomplete(context: ExtensionContext): void {
    // =========================================================
    // AUTOCOMPLETE - Variable completions for @variables
    // =========================================================
    const completionProvider = languages.registerCompletionItemProvider(
        ["sql", "mssql"],
        {
            provideCompletionItems(document, position) {
                const line = document.lineAt(position.line).text;

                const startMatch = line
                    .substring(0, position.character)
                    .match(/@[a-zA-Z_0-9]*$/);

                const endMatch = line
                    .substring(position.character)
                    .match(/^[a-zA-Z_0-9]*/);

                const startText = startMatch ? startMatch[0] : "@";
                const endText = endMatch ? endMatch[0] : "";

                // Only suggest variables declared before the cursor position.
                const currentWordStart = position.character - startText.length;
                const textBeforeCursor = document.getText(
                    new Range(0, 0, position.line, currentWordStart)
                );
                const vars = [...new Set(
                    (textBeforeCursor.match(/@[a-zA-Z_][a-zA-Z0-9_]*/g) || []),
                )];

                const current = startText.toLowerCase();

                return vars
                    .filter(v => v.toLowerCase().startsWith(current))
                    .map((v) => {
                        const item = new CompletionItem(
                            v,
                            CompletionItemKind.Variable,
                        );

                        item.range = new Range(
                            position.line,
                            position.character - startText.length,
                            position.line,
                            position.character + endText.length,
                        );

                        item.insertText = v;

                        return item;
                    });
            },
        },
        "@",
    );

    // =========================================================
    // F2 RENAME - Rename @variables with hidden @ UX
    // =========================================================
    const renameProvider = languages.registerRenameProvider(
        ["sql", "mssql"],
        {
            prepareRename(document, position) {
                const range = document.getWordRangeAtPosition(
                    position,
                    /@[a-zA-Z_][a-zA-Z0-9_]*/,
                );

                if (!range) {
                    return null;
                }

                const text = document.getText(range);

                // hide @ in rename UI
                return {
                    range: new Range(
                        range.start.translate(0, 1),
                        range.end,
                    ),
                    placeholder: text.substring(1),
                };
            },

            provideRenameEdits(document, position, newName) {
                const wordRange = document.getWordRangeAtPosition(
                    position,
                    /@[a-zA-Z_][a-zA-Z0-9_]*/,
                );

                if (!wordRange) {
                    return null;
                }

                const oldName = document.getText(wordRange);

                const finalName = newName.startsWith("@")
                    ? newName
                    : "@" + newName;

                const text = document.getText();

                const escaped = oldName.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&",
                );

                // "gi" for case-insensitive matching: T-SQL variable references are
                // case-insensitive (@myVar and @MYVAR are the same variable).
                // Note: this operates on raw document text, so occurrences inside
                // string literals or comments will also be renamed.
                const regex = new RegExp(escaped, "gi");

                const edit = new WorkspaceEdit();

                for (const match of text.matchAll(regex)) {
                    const start = document.positionAt(match.index);
                    const end = document.positionAt(match.index + oldName.length);

                    edit.replace(
                        document.uri,
                        new Range(start, end),
                        finalName,
                    );
                }

                return edit;
            },
        },
    );

    context.subscriptions.push(completionProvider);
    context.subscriptions.push(renameProvider);
}
