"use strict";

import { createConnection, Diagnostic, DiagnosticSeverity, ProposedFeatures, InitializeResult, TextDocuments, TextDocumentSyncKind, TextDocumentContentChangeEvent, TextEdit, RequestHandler, TextDocumentWillSaveEvent, HandlerResult } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ChildProcess } from "child_process";
import { getCommands, registerFileErrors } from "./commands";
import { ITsqlLintError, parseErrors } from "./parseError";
import TSQLLintRuntimeHelper from "./TSQLLintToolsHelper";

import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as uid from "uid-safe";

const applicationRoot = path.parse(process.argv[1]);

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

documents.listen(connection);

// let workspaceRoot: string;
connection.onInitialize((/*params*/): InitializeResult => {
  // workspaceRoot = params.rootPath;
  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        save: true,
        willSaveWaitUntil: true,
        willSave: true,
        change: TextDocumentSyncKind.Incremental
      },
      codeActionProvider: true,
    },
  };
});

connection.onCodeAction(getCommands);

documents.onDidChangeContent(async change => {
  await ValidateBuffer(change.document, null);
});

async function getTextEdit(d: TextDocument): Promise<TextEdit[]> {
  var test = await ValidateBuffer(d, true);

  return [{
    range: {
      start: {
        line: 0,
        character: 0
      },
      end: {
        line: 10000,
        character: 0
      }
    },
    newText: test
  }];
}

documents.onWillSaveWaitUntil(e => getTextEdit(e.document))

const toolsHelper: TSQLLintRuntimeHelper = new TSQLLintRuntimeHelper("D:\\dev\\git\\tsqllint\\source\\TSQLLint\\bin\\Debug\\netcoreapp5.0");

async function LintBuffer(fileUri: string, shouldFix: boolean): Promise<string[]> {

  var toolsPath = await toolsHelper.TSQLLintRuntime();

  let childProcess: ChildProcess;

  let args = [fileUri];

  if (shouldFix) {
    args.push('-x');
  }

  if (os.type() === "Darwin") {
    childProcess = spawn(`${toolsPath}/osx-x64/TSQLLint.Console ${shouldFix ? '-x' : ''}`, args);
  } else if (os.type() === "Linux") {
    childProcess = spawn(`${toolsPath}/linux-x64/TSQLLint.Console ${shouldFix ? '-x' : ''}`, args);
  } else if (os.type() === "Windows_NT") {
    if (os.type() === "Windows_NT") {
      if (process.arch === "ia32") {
        childProcess = spawn(`${toolsPath}/win-x86/TSQLLint.Console.exe ${shouldFix ? '-x' : ''}`, args);
      } else if (process.arch === "x64") {
        toolsPath = 'D:\\dev\\git\\tsqllint\\source\\TSQLLint\\bin\\Debug\\netcoreapp5.0\\TSQLLint.exe';
        childProcess = spawn(`${toolsPath}`, args);
      } else {
        throw new Error(`Invalid Platform: ${os.type()}, ${process.arch}`);
      }
    }
  } else {
    throw new Error(`Invalid Platform: ${os.type()}, ${process.arch}`);
  }

  let resultsArr = [];

  for await (const data of childProcess.stdout) {
    const value = data.toString();
    const index = value.indexOf("(");
    if (index > 0) {
      resultsArr.push(value.substring(index, value.length - 1));
    }
  }

  for await (const data of childProcess.stderr) {
    console.log(`stderr: ${data}`);
  }

  await new Promise( (resolve, reject) => {
    childProcess.on('close', resolve);
  });

  return resultsArr;
}

function TempFilePath(textDocument: TextDocument) {
  const ext = path.extname(textDocument.uri) || ".sql";
  const name = uid.sync(18) + ext;
  return path.join(os.tmpdir(), name);
}

async function ValidateBuffer(textDocument: TextDocument, shouldFix: boolean): Promise<string> {
  const tempFilePath: string = TempFilePath(textDocument);
  fs.writeFileSync(tempFilePath, textDocument.getText());

  let lintErrorStrings;
  try {
    lintErrorStrings = await LintBuffer(tempFilePath, shouldFix);
  }
  catch (error) {
    registerFileErrors(textDocument, []);
    throw error;
  }

  if(!lintErrorStrings) {
    return;
  }

  const errors = parseErrors(textDocument.getText(), lintErrorStrings);
  registerFileErrors(textDocument, errors);
  const diagnostics = errors.map(toDiagnostic);

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  function toDiagnostic(lintError: ITsqlLintError): Diagnostic {
    return {
      severity: DiagnosticSeverity.Error,
      range: lintError.range,
      message: lintError.message,
      source: `TSQLLint: ${lintError.rule}`,
    };
  }

  let updated = null;

  if (shouldFix) {
    updated = fs.readFileSync(tempFilePath).toString();
  }

  fs.unlinkSync(tempFilePath);

  return updated;
}

connection.listen();
