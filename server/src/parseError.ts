import { Range } from "vscode-languageserver/lib/main";

export const hello = () => 'Hello world!';

export interface ITsqlLintError {
    range: Range;
    message: string;
    rule: string;
}

export function parseErrors(docText: string, errorStrings: string[]): ITsqlLintError[] {
    const lines = docText.split("\n");
    const lineStarts = lines.map((line) => line.match(/^\s*/)[0].length);
    return errorStrings.map(parseError).filter(isValidError);
    function parseError(errorString: string): ITsqlLintError {
        const validationError: string[] = errorString.split(":");
        const positionStr: string = validationError[0].replace("(", "").replace(")", "");
        const positionArr: number[] = positionStr.split(",").map(Number);

        const line = positionArr[0] - 1;
        const colStart = lineStarts[line];
        const colEnd = lines[line].length;
        const range: Range = {
            start: {line, character: colStart},
            end: {line, character: colEnd},
        };
        return {
            range,
            message: validationError[2].trim(),
            rule: validationError[1].trim(),
        };
    }
}
function isValidError(error: ITsqlLintError): boolean {
    return error.range.start.line >= 0;
}
