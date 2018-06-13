"use strict";

import * as path from "path";
import { ExtensionContext, workspace } from "vscode";
import * as vscode from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient";

export function activate(context: ExtensionContext) {

  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
  const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));

  const serverOptions: ServerOptions = {
    run : { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{scheme: "file", language: "sql"}],
    synchronize: {
      configurationSection: "tsqllint",
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  const client = new LanguageClient("tsqllint", "TSQLLint", serverOptions, clientOptions);
  client.registerProposedFeatures();

  function applyTextEdits(uri: string, documentVersion: number, edits: vscode.TextEdit[]) {
  const textEditor = vscode.window.activeTextEditor;
  if (textEditor && textEditor.document.uri.toString() === uri) {
    if (textEditor.document.version !== documentVersion) {
      vscode.window.showInformationMessage(
        `SqlLint fixes are outdated and can't be applied to the document.`,
      );
    }
    textEditor.edit((mutator) => {
      for (const edit of edits) {
        mutator.replace(client.protocol2CodeConverter.asRange(edit.range), edit.newText);
      }
    }).then((success) => {
      if (!success) {
        vscode.window.showErrorMessage(
          "Failed to apply SqlLint fixes to the document. " +
          "Please consider opening an issue with steps to reproduce.",
        );
      }
    });
  }
}
  context.subscriptions.push(
    client.start(),
    vscode.commands.registerCommand("_tsql-lint.change", applyTextEdits),
  );
}
