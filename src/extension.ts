import * as vscode from 'vscode';
import Fastify from 'fastify';
import * as FastifyWS from '@fastify/websocket';
import { KernelsApi } from './api/kernels';
import { MiscApi } from './api';
import { SessionsApi } from './api/sessions';
//import { ContentsApi } from './api/contents';

export let extensionUri: vscode.Uri;

export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Extension "iris-jupyter-server" is activating');
	extensionUri = context.extensionUri;

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
