"use strict";

import {
  createConnection, Diagnostic, DiagnosticSeverity, IConnection, InitializeResult, IPCMessageReader,
  IPCMessageWriter, TextDocument, TextDocuments} from "vscode-languageserver";

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

const connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

// let workspaceRoot: string;
connection.onInitialize((/*params*/): InitializeResult => {
  // workspaceRoot = params.rootPath;
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      codeActionProvider: true,
    },
  };
});

connection.onCodeAction(getCommands);

documents.onDidChangeContent((change) => {
  ValidateBuffer(change.document);
});

const toolsHelper: TSQLLintRuntimeHelper = new TSQLLintRuntimeHelper(applicationRoot.dir);

function LintBuffer(fileUri: string, callback: ((error: Error, result: string[]) => void)): void {

  toolsHelper.TSQLLintRuntime().then((toolsPath: string) => {
    let childProcess: ChildProcess;

    if (os.type() === "Darwin") {
      childProcess = spawn(`${toolsPath}/osx-x64/TSQLLint.Console`, [fileUri]);
    } else if (os.type() === "Linux") {
      childProcess = spawn(`${toolsPath}/linux-x64/TSQLLint.Console`, [fileUri]);
    } else if (os.type() === "Windows_NT") {
      if (os.type() === "Windows_NT") {
        if (process.arch === "ia32") {
          childProcess = spawn(`${toolsPath}/win-x86/TSQLLint.Console.exe`, [fileUri]);
        } else if (process.arch === "x64") {
          childProcess = spawn(`${toolsPath}/win-x64/TSQLLint.Console.exe`, [fileUri]);
        } else {
          throw new Error(`Invalid Platform: ${os.type()}, ${process.arch}`);
        }
      }
    } else {
      throw new Error(`Invalid Platform: ${os.type()}, ${process.arch}`);
    }

    let result: string;
    childProcess.stdout.on("data", (data: string) => {
      result += data;
    });

    childProcess.stderr.on("data", (data: string) => {
      console.log(`stderr: ${data}`);
    });

    childProcess.on("close", () => {
      const list: string[] = result.split("\n");
      const resultsArr: string[] = new Array();

      list.forEach((element) => {
        const index = element.indexOf("(");
        if (index > 0) {
          resultsArr.push(element.substring(index, element.length - 1));
        }
      });

      callback(null, resultsArr);
    });
  }).catch((error: Error) => {
    throw error;
  });
}

function TempFilePath(textDocument: TextDocument) {
  const ext = path.extname(textDocument.uri) || ".sql";
  const name = uid.sync(18) + ext;
  return path.join(os.tmpdir(), name);
}

function ValidateBuffer(textDocument: TextDocument): void {
  const tempFilePath: string = TempFilePath(textDocument);
  fs.writeFileSync(tempFilePath, textDocument.getText());

  LintBuffer(tempFilePath, (error: Error, lintErrorStrings: string[]) => {
    if (error) {
      registerFileErrors(textDocument, []);
      throw error;
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
    fs.unlinkSync(tempFilePath);
  });
}

connection.listen();
