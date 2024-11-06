import * as vscode from 'vscode';
import Fastify from 'fastify';
import * as FastifyWS from '@fastify/websocket';
import * as ServerManager from '@intersystems-community/intersystems-servermanager';
import { Jupyter, JupyterServer } from '@vscode/jupyter-extension';
import { KernelsApi } from './api/kernels';
import { MiscApi } from './api';
import { SessionsApi } from './api/sessions';
import { makeRESTRequest } from './makeRESTRequest';
//import { ContentsApi } from './api/contents';

export let extensionUri: vscode.Uri;
export let logChannel: vscode.LogOutputChannel;

let serverManagerApi: any;

export async function activate(context: vscode.ExtensionContext) {

	extensionUri = context.extensionUri;
	logChannel = vscode.window.createOutputChannel('IRIS Jupyter Server Proxy', { log: true});
	logChannel.info('Extension activated');

	const jupyterExt = vscode.extensions.getExtension<Jupyter>('ms-toolsai.jupyter');
	if (!jupyterExt) {
		throw new Error('Jupyter extension not installed');
	}
	if (!jupyterExt.isActive) {
		await jupyterExt.activate();
	}
	const serverManagerExt = vscode.extensions.getExtension(ServerManager.EXTENSION_ID);
	if (!serverManagerExt) {
		throw new Error('Server Manager extension not installed');
	}
	if (!serverManagerExt.isActive) {
	  await serverManagerExt.activate();
	}
    serverManagerApi = serverManagerExt.exports;

	// Create the Jupyter Server Proxy
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

	const serverCollection = jupyterExt.exports.createJupyterServerCollection(
		`${context.extension.id}:targets`,
		'IRIS Notebook Servers...',
		{
			provideJupyterServers: async () => {
				const servers: JupyterServer[] = [];
				const hosts = vscode.workspace.getConfiguration('iris-jupyter-server').get<{ enabled: boolean }[]>('hosts');
				if (typeof hosts === 'object' && hosts) {
					for (const key in hosts) {
						if (hosts[key].enabled === false) {
							continue;
						}
						servers.push(jupyterServer(key));
					}
				}
				return servers;
			},
			resolveJupyterServer: ((server: any) => server),
		}
	);
	context.subscriptions.push(serverCollection);

	// Command provider
	const ADD_HOST_COMMAND_LABEL = 'Add IRIS Notebook Host...';
	serverCollection.commandProvider = {
		provideCommands: () => {
			return [
				{
					label: ADD_HOST_COMMAND_LABEL,
					description: 'Configure an IRIS server:namespace as a Jupyter Notebook host',
					canBeAutoSelected: true,
				},
			];
		},
		handleCommand: async (command: any, token: any) => {
			if (command.label === ADD_HOST_COMMAND_LABEL) {

				const disposables: vscode.Disposable[] = [];
				const serverNamespace = await new Promise<string | undefined>(async (resolve, reject) => {

					const servers: ServerManager.IServerName[] = await serverManagerApi.getServerNames();
					const promisesOfEligibleServers = servers.map(async (server): Promise<ServerManager.IServerName | null> => {
						const serverSpec: ServerManager.IServerSpec | undefined = await serverManagerApi.getServerSpec(server.name);
						return (serverSpec?.superServer?.port === undefined)
							? null
							: { name: server.name, description: server.description, detail: `${serverSpec.superServer.host}:${serverSpec.superServer.port}` };
					});
					const eligibleServers = (await Promise.all(
						promisesOfEligibleServers
					)).filter((server): server is ServerManager.IServerName => server !== null);

					const quickPick = vscode.window.createQuickPick();
					disposables.push(quickPick);
					quickPick.title = 'Choose IRIS Server';
					quickPick.placeholder = 'Pick from your IRIS server definitions that specify a superserver port';
					quickPick.matchOnDescription = true;
					quickPick.items = eligibleServers.map((serverName) => ({ label: serverName.name, description: `${serverName.detail}${serverName.description ? ` - ${serverName.description}` : ''}` }));
					quickPick.buttons = [vscode.QuickInputButtons.Back];
					quickPick.onDidTriggerButton((e) => {
						if (e === vscode.QuickInputButtons.Back) {
							// The user has opted to go back to the previous UI in the workflow,
							// Returning `undefined` to Jupyter extension as part of `handleCommand`
							// will trigger Jupyter Extension to display the previous UI
							resolve(undefined);
							quickPick.hide();
						}
					}, disposables);
					quickPick.onDidHide(() => {
						// The user has opted to get out of this workflow,
						// Throwing cancellation error will exit the Kernel Picker completely.
						reject(new vscode.CancellationError());
					}, disposables);
					quickPick.onDidAccept(async () => {
						const serverName = quickPick.selectedItems[0].label;
						const serverSpec = await serverManagerApi.getServerSpec(serverName);
						if (!serverSpec) {
							vscode.window.showErrorMessage(`Server '${serverName}' is not defined`);
							return undefined;
						}

						const response = await makeRESTRequest("GET", serverSpec);
						if (response?.status !== 200) {
							vscode.window.showErrorMessage(`Server '${serverName}' is not available`);
							return undefined;
						} else {
							const namespaces = response.data.result.content.namespaces;
							if (namespaces.length === 0) {
								vscode.window.showErrorMessage(`No namespaces available to you on '${serverName}'`);
								return undefined;
							}
							//TODO choose from namespaces
							const serverNamespace = `${serverName}:${namespaces[0]}`;

							resolve(serverNamespace);
						}
					}, disposables);

					// Start the picker
					quickPick.show();
				}).finally(() => vscode.Disposable.from(...disposables).dispose());

				// Return server back to the Jupyter Extension.
				return serverNamespace ? jupyterServer(serverNamespace) : undefined;
			}
		},
	};

	function jupyterServer(serverNamespace: string): JupyterServer {
		return {
			id: `${context.extension.id}:${serverNamespace}`,
			label: serverNamespace,
			connectionInformation: {
				baseUrl: vscode.Uri.parse(`http://localhost:50773/${serverNamespace}`),
				token: '1',
			},
		};
	}
}

export function deactivate() {}
