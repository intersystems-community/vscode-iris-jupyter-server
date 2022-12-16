import * as vscode from 'vscode';
import Fastify from 'fastify';
import * as FastifyWS from '@fastify/websocket';
import { KernelsApi } from './api/kernels';
import { MiscApi } from './api';
import { SessionsApi } from './api/sessions';
//import { ContentsApi } from './api/contents';


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
		//logger: true
	});

	// Websockets plugin
	fastify.register(FastifyWS.default);

	// Routes
	fastify.register(async (fastify) => {

		// Add this so fastify won't reject the empty-body POST that the Jupyter extension makes to /:serverNamespace/api/kernels/:kernelId/interrupt when
		// user requests interrupt of a running cell
		fastify.addContentTypeParser<string>('application/json', { parseAs: 'string' }, function (req, body, done) {
			try {
				if (body === '') {
					done(null, {});
				}
				done(null, JSON.parse(body));
			} catch (err: any) {
				err.statusCode = 400;
				done(err, undefined);
			}
		});

		KernelsApi.addRoutes(fastify);
		SessionsApi.addRoutes(fastify);
		// ContentsApi.addRoutes(fastify); // PROBABLY NOT NEEDED
		MiscApi.addRoutes(fastify);
	});

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

export function deactivate() {}
