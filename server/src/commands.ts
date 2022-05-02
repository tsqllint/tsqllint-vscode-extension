import * as server from "vscode-languageserver";
import { Command, Position, CodeActionParams } from "vscode-languageserver-protocol/node";
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ITsqlLintError } from "./parseError";

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
    const lines = file.getText().split("\n");
    commandStore[file.uri] = errors.map(toDiagnosticCommands);
    function toDiagnosticCommands(error: ITsqlLintError): IDiagnosticCommands {
        const {start, end} = error.range;
        
        // Prevent crashing by making sure there are still at least this many lines.
        if(lines.length <= start.line){
            return null;
        }
        
        const space = lines[start.line].match(/^\s*/)[0];
        return {
            error,
            fileVersion: file.version,
            disableLine: getDisableEdit(),
        };
        function getDisableEdit(): IEdit[] {
            const { rule } = error;
            const line = lines[start.line];
            return [{
                range: {start: {...start, character: 0}, end},
                newText: `${space}/* tsqllint-disable ${rule} */\n${line}\n${space}/* tsqllint-enable ${rule} */\n`,
            }];
        }
    }
}

export function getCommands(params: CodeActionParams): Command[] {
    const commands = findCommands(params.textDocument.uri, params.range);
    return [
        ...getDisableCommands(),
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
            if (a.line !== b.line) {
                return a.line - b.line;
            }
            return a.character - b.character;
        }
    }
    function getDisableCommands(): Command[] {
        return [
            ...commands.map(toDisableCommand),
            ...commands.map(toDisableForFileCommand),
        ];
        function toDisableCommand(command: IDiagnosticCommands) {
            return server.Command.create(
                    `Disable: ${command.error.rule} for this line`,
                    "_tsql-lint.change",
                    params.textDocument.uri,
                    command.fileVersion,
                    command.disableLine,
                );
        }
        function toDisableForFileCommand(command: IDiagnosticCommands) {
            const pos = {line: 0, character: 0};
            const edit: IEdit =  {
                range: {start: pos, end: pos},
                newText: `/* tsqllint-disable ${command.error.rule} */\n`,
            };

            return server.Command.create(
                `Disable: ${command.error.rule} for this file`,
                "_tsql-lint.change",
                params.textDocument.uri,
                command.fileVersion,
                [edit],
            );
        }
    }
}
