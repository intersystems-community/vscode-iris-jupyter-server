// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import Fastify from 'fastify';
import * as api from './api';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "iris-jupyter-server" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('iris-jupyter-server.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Jupyter server proxy for InterSystems IRIS!');
	});

	context.subscriptions.push(disposable);

	const fastify = Fastify({
		logger: true
	});

	// Define a simple endpoint
	fastify.get('/', async (request, reply) => {
		return { hello: 'world' };
	});

	api.addRoutes(fastify);

	// Run the server, listening only on loopback interface
	const start = async () => {
		try {
			await fastify.listen({ port: 50773 });
		} catch (err) {
			fastify.log.error(err);
		}
	};
	start();

}

// This method is called when your extension is deactivated
export function deactivate() {}
