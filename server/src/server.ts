'use strict';

import {
	IPCMessageReader, IPCMessageWriter, createConnection, IConnection, TextDocuments, TextDocument,
	Diagnostic, DiagnosticSeverity, InitializeResult, TextDocumentPositionParams, CompletionItem,
	CompletionItemKind
} from 'vscode-languageserver';

import TSQLLintRuntimeHelper from './TSQLLintToolsHelper';
import { ChildProcess } from 'child_process';

const path = require("path");
const spawn = require('child_process').spawn;
const os = require('os')
const fs = require('fs')

const applicationRoot = path.parse(process.argv[1])

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	return {
		capabilities: {
			textDocumentSync: documents.syncKind
		}
	}
});

function getTempFilePath(textDocument: TextDocument) {
	let lintFilePath: string = textDocument.uri.split('file://')[1];
	let lintFileName: string = path.basename(lintFilePath);
	let tempFilePath: string = `${os.tmpdir()}/${lintFileName}.tmp`;
	return tempFilePath;
}

documents.onDidChangeContent((change) => {
	ValidateBuffer(change.document);
});

documents.onDidClose((change) => {
	let tempFilePath: string = getTempFilePath(change.document);
	fs.unlinkSync(tempFilePath)
})

let toolsHelper: TSQLLintRuntimeHelper = new TSQLLintRuntimeHelper(applicationRoot.dir)

function LintBuffer(fileUri: string, callback: ((error: Error, result: string[]) => void)): void {

	toolsHelper.TSQLLintRuntime().then((toolsPath: string) => {
		let childProcess: ChildProcess;

		if (os.type() === 'Darwin') {
			childProcess = spawn(`${toolsPath}/osx-x64/TSQLLint.Console`, [fileUri])
		} else if (os.type() === 'Linux') {
			childProcess = spawn(`${toolsPath}/linux-x64/TSQLLint.Console`, [fileUri])
		} else if (os.type() === 'Windows_NT') {
			if (os.type() === 'Windows_NT') {
				if (process.arch === 'ia32') {
					childProcess = spawn(`${toolsPath}/win-x86/TSQLLint.Console.exe`, [fileUri])
				} else if (process.arch === 'x64') {
					childProcess = spawn(`${toolsPath}/win-x64/TSQLLint.Console.exe`, [fileUri])
				} else {
					throw new Error(`Invalid Platform: ${os.type()}, ${process.arch}`)
				}
			}
		} else {
			throw new Error(`Invalid Platform: ${os.type()}, ${process.arch}`)
		}

		let result: string;
		childProcess.stdout.on('data', (data: string) => {
			result += data;
		});

		childProcess.stderr.on('data', (data: string) => {
			console.log(`stderr: ${data}`);
		});

		childProcess.on('close', () => {
			let list: string[] = result.split("\n");
			let resultsArr: string[] = new Array();

			list.forEach(function (element) {
				var index = element.indexOf('(');
				if (index > 0) {
					resultsArr.push(element.substring(index, element.length - 1));
				}
			});

			callback(null, resultsArr)
		});
	}).catch((error: Error) => {
		throw error
	})
}

function ValidateBuffer(textDocument: TextDocument): void {
	let tempFilePath: string = getTempFilePath(textDocument);
	fs.writeFileSync(tempFilePath, textDocument.getText());

	let diagnostics: Diagnostic[] = [];
	LintBuffer(tempFilePath, (error: Error, validateionErrors: string[]) => {
		if (error) {
			throw error;
		}

		for (var i = 0; i < validateionErrors.length; i++) {
			let validationError: string[] = validateionErrors[i].split(':');
			let positionStr: string = validationError[0].replace('(', '').replace(')', '');
			let positionArr: number[] = positionStr.split(',').map(Number);
			let lineNumber: number = positionArr[0] - 1;

			if(0 > lineNumber){
				return;
			}

			let line: string = textDocument.getText().split('\n')[lineNumber];
			if(undefined === line){
				line = textDocument.getText();
			}

			let lineStart: number = 0;
			const regex = /^(\s)*/g;
			let regexResults: RegExpExecArray;
			if ((regexResults = regex.exec(line)) !== null) {
				lineStart = regexResults[0].length;
			}

			diagnostics.push({
				severity: DiagnosticSeverity.Error,
				range: {
					start: { line: lineNumber, character: lineStart },
					end: { line: lineNumber, character: line.length }
				},
				message: `${validationError[2].trim()}`,
				source: `TSQLLint: ${validationError[1].trim()}`
			});
		}

		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
	})
}

connection.listen();