import { Command, TextDocument, Position } from "vscode-languageserver/lib/main";
import { CodeActionParams } from "vscode-languageserver-protocol/lib/main";
import { ITsqlLintError } from "./parseError";
import * as server from "vscode-languageserver";


interface IEdit {
    range: {start: server.Position, end: server.Position};
    newText: string;
}
interface IDiagnosticCommands {
    error: ITsqlLintError;
    fileVersion: number;
    disableLine: IEdit[];
}
const commandStore: {[fileUri: string]: IDiagnosticCommands[]} = {};

export function registerFileErrors(file: TextDocument, errors: ITsqlLintError[]) {
    const lines = file.getText().split('\n');
    commandStore[file.uri] = errors.map(toDiagnosticCommands);
    function toDiagnosticCommands(error: ITsqlLintError): IDiagnosticCommands {
        const {start, end} = error.range;
        const space = lines[start.line].match(/^\s*/)[0];
        return {
            error,
            fileVersion: file.version,
            disableLine: getDisableEdit(),
        };
        function getDisableEdit(): IEdit[] {
            return [{
                range: {start: {...start, character: 0}, end},
                newText: `${space}/* tsqllint-disable ${error.rule} */\n${lines[start.line]}\n${space}/* tsqllint-enable ${error.rule} */\n`
            }];
        }
    }
}

export function getCommands(params: CodeActionParams): Command[] {
    const commands = findCommands(params.textDocument.uri, params.range);
    return [
        ...getDisableCommands(commands),
        // TODO fix/fixall commands
        // TODO documentation commands
    ];
    function findCommands(fileUri: string, {start, end}: server.Range): IDiagnosticCommands[] {
        const fileCommands = commandStore[fileUri] || [];
        return fileCommands.filter(({error}): boolean => {
            const eStart = error.range.start;
            const eEnd = error.range.end;
            if (comparePos(eEnd, start) < 0) {
                return false;
            }
            if (comparePos(eStart, end) > 0) {
                return false;
            }
            return true;
        });
        function comparePos(a: Position, b: Position) {
            if (a.line != b.line) {
                return a.line - b.line;
            }
            return a.character - b.character;
        }
    }
    function getDisableCommands(commands: IDiagnosticCommands[]): Command[] {
        return [
            ...commands.map(toDisableCommand),
            ...commands.map(toDisableForFileCommand),
        ];
        function toDisableCommand(commands: IDiagnosticCommands) {
            return server.Command.create(
                    `Disable: ${commands.error.rule} for this line`,
                    "_tsql-lint.change",
                    params.textDocument.uri,
                    commands.fileVersion,
                    commands.disableLine
                );
        }
        function toDisableForFileCommand(commands: IDiagnosticCommands) {
            const pos = {line: 0, character: 0};
            const edit: IEdit =  {
                range: {start: pos, end: pos},
                newText: `/* tsqllint-disable ${commands.error.rule} */\n`
            };

            return server.Command.create(
                `Disable: ${commands.error.rule} for this file`,
                "_tsql-lint.change",
                params.textDocument.uri,
                commands.fileVersion,
                [edit]
            );
        }
    }
}
