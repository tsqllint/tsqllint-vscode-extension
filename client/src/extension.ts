'use strict';

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import * as vscode from "vscode";


export function activate(context: ExtensionContext) {

	let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] }; 

	let serverModule = context.asAbsolutePath(path.join('./server/out/src', 'server.js'));

	let serverOptions: ServerOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	}

	let clientOptions: LanguageClientOptions = {
		documentSelector: [{scheme: 'file', language: 'sql'}],
		synchronize: {
			configurationSection: 'tsqllint',
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	}
	
	let client = new LanguageClient('tsqllint', 'TSQLLint', serverOptions, clientOptions);
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
		vscode.commands.registerCommand("_tsql-lint.change", applyTextEdits)
	);
}


