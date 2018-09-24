"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hello = function () { return 'Hello world!'; };
function parseErrors(docText, errorStrings) {
    var lines = docText.split("\n");
    var lineStarts = lines.map(function (line) { return line.match(/^\s*/)[0].length; });
    return errorStrings.map(parseError).filter(isValidError);
    function parseError(errorString) {
        var validationError = errorString.split(":");
        var positionStr = validationError[0].replace("(", "").replace(")", "");
        var positionArr = positionStr.split(",").map(Number);
        var line = positionArr[0] - 1;
        var colStart = lineStarts[line];
        var colEnd = lines[line].length;
        var range = {
            start: { line: line, character: colStart },
            end: { line: line, character: colEnd },
        };
        return {
            range: range,
            message: validationError[2].trim(),
            rule: validationError[1].trim(),
        };
    }
}
exports.parseErrors = parseErrors;
function isValidError(error) {
    return error.range.start.line >= 0;
}
