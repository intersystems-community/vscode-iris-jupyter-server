import * as vscode from 'vscode';
import Fastify from 'fastify';
import * as FastifyWS from '@fastify/websocket';
import { KernelsApi } from './api/kernels';
import { MiscApi } from './api';
import { SessionsApi } from './api/sessions';
//import { ContentsApi } from './api/contents';

export let extensionUri: vscode.Uri;
export let logChannel: vscode.LogOutputChannel;

export function activate(context: vscode.ExtensionContext) {

	extensionUri = context.extensionUri;
	logChannel = vscode.window.createOutputChannel('IRIS Jupyter Server Proxy', { log: true});
	logChannel.info('Extension activated');

	const fastify = Fastify({
		//logger: true
	});

	// Websockets plugin
	fastify.register(FastifyWS.default);

	// Routes
	fastify.register(async (fastify) => {

		// Add this so fastify won't reject the empty-body POST that the Jupyter extension makes
		// to /:serverNamespace/api/kernels/:kernelId/interrupt and .../restart when
		// user requests interrupt / restart of a running kernel
		fastify.addContentTypeParser<string>('application/json', { parseAs: 'string' }, function (req, body, done) {
			try {
				if (body === '') {
					done(null, {});
				}
				else {
					done(null, JSON.parse(body));
				}
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
		const port = 50773;
		try {
			await fastify.listen({ port });
			logChannel.info(`Listening on port ${port}`);
		} catch (err) {
			fastify.log.error(err);
			logChannel.error(err as Error);
		}
	};
	start();

}

export function deactivate() {}
