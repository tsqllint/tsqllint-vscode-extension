"use strict";

import * as path from "path";
import { workspace, ExtensionContext, window, TextEdit, commands } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  const serverOptions: ServerOptions = {
    run : { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{scheme: "file", language: "sql"}],
    synchronize: {
      configurationSection: "tsqlLint",
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  client = new LanguageClient("tsqlLint", "TSQL Lint", serverOptions, clientOptions);
  client.registerProposedFeatures();

  function applyTextEdits(uri: string, documentVersion: number, edits: TextEdit[]) {
  const textEditor = window.activeTextEditor;
  if (textEditor && textEditor.document.uri.toString() === uri) {
    if (textEditor.document.version !== documentVersion) {
      window.showInformationMessage(
        `SqlLint fixes are outdated and can"t be applied to the document.`,
      );
    }
    textEditor.edit((mutator) => {
      for (const edit of edits) {
        mutator.replace(client.protocol2CodeConverter.asRange(edit.range), edit.newText);
      }
    }).then((success) => {
      if (!success) {
        window.showErrorMessage(
          "Failed to apply SqlLint fixes to the document. " +
          "Please consider opening an issue with steps to reproduce.",
        );
      }
    });
  }
}
  context.subscriptions.push(
    client.start(),
    commands.registerCommand("_tsql-lint.change", applyTextEdits),
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}