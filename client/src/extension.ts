'use strict';

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

export function activate(context: ExtensionContext) {

	let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] }; 

	let serverOptions: ServerOptions = {
		run : { module: context.asAbsolutePath(path.join('server', 'server.js')), transport: TransportKind.ipc },
		debug: { module: context.asAbsolutePath(path.join('out/server/src', 'server.js')), transport: TransportKind.ipc, options: debugOptions }
	}

	let clientOptions: LanguageClientOptions = {
		documentSelector: [{scheme: 'file', language: 'sql'}],
		synchronize: {
			configurationSection: 'tsqllint',
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	}
	
	let disposable = new LanguageClient('tsqllint', 'TSQLLint', serverOptions, clientOptions).start();
	context.subscriptions.push(disposable);
}
