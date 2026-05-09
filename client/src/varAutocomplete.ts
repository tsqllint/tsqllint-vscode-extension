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
 * For the fellow maintainers:
 * 
 * Register `variable autocomplete and rename` providers for SQL `@variables`
 * 
 * Case example:
 * ```sql
 * DECLARE \@something VARCHAR(10)
 * DECLARE \@someone VARCHAR(10)
 * DECLARE \@nothing VARCHAR(10)
 * 
 * -- some random queries
 * SELECT \@some -- expected: will suggest \@something and \@someone
 * 
 * -- lets say you select \@someone , pressing F2 (refactor/rename)
 * -- will rename all variables in current document with same name.
 * ```
 * 
 * Comment out the function call in [extension.ts] `activate()` to disable 
 * this feature in case this do break something and you don't have so much
 * time to fix.
 * 
 * after all, this is just a sugar add-on, nice to keep AS LONG AS the main
 * extension feature doesn't break. I tested and it works fine locally, but
 * doesn't guarantee it's fully safe for the publishing. (tbh still figuring
 * out what some other parts of the code are doing. this ext is amazing!) --ideeyn
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

                /// NOTE: this one will suggest all in entire document, dont care is it BEFORE or AFTER cursor.
                /// scanning entire document:
                // const text = document.getText();
                // const vars = [...new Set((text.match(/@[a-zA-Z_][a-zA-Z0-9_]*/g) || []))];

                /// NOTE: this one only suggest what is BEFORE CURSOR.
                /// only consider text before the current word:
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

                const regex = new RegExp(escaped, "g");

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
