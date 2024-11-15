/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import Fastify from 'fastify';
import * as FastifyWS from '@fastify/websocket';
import * as ServerManager from '@intersystems-community/intersystems-servermanager';
import { Jupyter, JupyterServer, JupyterServerCommand } from '@vscode/jupyter-extension';
import { KernelsApi } from './api/kernels';
import { MiscApi } from './api';
import { SessionsApi } from './api/sessions';
import { makeRESTRequest } from './makeRESTRequest';
//import { ContentsApi } from './api/contents';

interface IHosts {
	[key: string]: { enabled: boolean };
}

export let extensionUri: vscode.Uri;
export let logChannel: vscode.LogOutputChannel;

let serverManagerApi: ServerManager.ServerManagerAPI;
let jupyterApi: any;
let jupyterKernelService: any;

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
	jupyterApi = jupyterExt.exports;

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
	const started = await new Promise<boolean>(async (resolve) => {
		const port = 50773;
		const displayName = context.extension.packageJSON.displayName;
		try {
			await fastify.listen({ port });
			logChannel.info(`${displayName} is listening on local port ${port}`);
			resolve(true);
		} catch (err) {
			fastify.log.error(err);
			logChannel.error(err as Error);
			vscode.window.showErrorMessage(`Failed to start ${displayName} on local port ${port} (${(err as Error).message})`);
			resolve(false);
		}
	});
	if (!started) {
		return;
	}

	// Add ourself as type of server
	const serverCollection = jupyterExt.exports.createJupyterServerCollection(
		`${context.extension.id}:targets`,
		'IRIS Notebook Servers...',
		{
			provideJupyterServers: () => {
				const servers: JupyterServer[] = [];
				const hosts = vscode.workspace.getConfiguration('iris-jupyter-server', vscode.window.activeNotebookEditor?.notebook.uri).get<{ enabled: boolean }[]>('hosts');
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
			resolveJupyterServer: (async (server: JupyterServer) => {
				if (server.connectionInformation) {
					return server;
				}
				const serverNamespace = server.id.split(':').slice(-2).join(':');
				return jupyterServer(serverNamespace);
			}),
		}
	);
	context.subscriptions.push(serverCollection);

	// Add commands to the bottom of our list of servers (aka IRIS Notebook Hosts)
	const ADD_USER_HOST_COMMAND_LABEL = 'Add IRIS Notebook Host...';
	const ADD_WORKSPACE_HOST_COMMAND_LABEL = 'Add IRIS Notebook Host for Workspace...';
	const ADD_FOLDER_HOST_COMMAND_LABEL = 'Add IRIS Notebook Host for Notebook\'s Folder...';
	serverCollection.commandProvider = {
		provideCommands: () => {
			const commands: JupyterServerCommand[] = [];
			commands.push({
				label: ADD_USER_HOST_COMMAND_LABEL,
				canBeAutoSelected: true,
				description: 'User-level setting',
			});
			if (vscode.workspace.workspaceFile) {
				const fileName = vscode.workspace.workspaceFile.path.split('/').pop();
				const caption = fileName?.endsWith('.code-workspace') ? fileName : 'Untitled';
				commands.push({
					label: ADD_WORKSPACE_HOST_COMMAND_LABEL,
					description: `Workspace-level setting (${caption})`,
				});
			}
			const activeNotebookUri = vscode.window.activeNotebookEditor?.notebook.uri;
			if (activeNotebookUri) {
				const folder = vscode.workspace.getWorkspaceFolder(activeNotebookUri);
				if (folder) {
					commands.push({
						label: ADD_FOLDER_HOST_COMMAND_LABEL,
						description: `Folder-level setting (${folder.name})`,
					});
				}
			}
			return commands;
		},
		handleCommand: async (command: any, token: any) => {
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
					}
				}, disposables);
				const didHide = quickPick.onDidHide(() => {
					// The user has opted to get out of this workflow,
					// Throwing cancellation error will exit the Kernel Picker completely.
					reject(new vscode.CancellationError());
				}, disposables);
				quickPick.onDidAccept(() => {
					didHide.dispose(); // No longer need to listen for the hide event
					resolve(quickPick.selectedItems[0].label);
				}, disposables);

				// Start the picker
				quickPick.show();
			})
			.then(async (serverName) => {
				if (serverName === undefined) {
					return;
				}
				return await new Promise<string | undefined>(async (resolve, reject) => {
					const serverSpec = await serverManagerApi.getServerSpec(serverName);
					if (serverSpec === undefined) {
						vscode.window.showErrorMessage(`Server '${serverName}' is not defined`);
						resolve(undefined);
						return;
					}
					if (typeof serverSpec.password === 'undefined') {
						const scopes = [serverSpec.name, serverSpec.username || ''];
						const account = serverManagerApi.getAccount(serverSpec);
						let session = await vscode.authentication.getSession(ServerManager.AUTHENTICATION_PROVIDER, scopes, { silent: true, account });
						if (!session) {
							session = await vscode.authentication.getSession(ServerManager.AUTHENTICATION_PROVIDER, scopes, { createIfNone: true, account });
						}
						if (session) {
							serverSpec.username = session.scopes[1];
							serverSpec.password = session.accessToken;
						}
					}

					const response = await makeRESTRequest("GET", serverSpec);
					if (response?.status !== 200) {
						vscode.window.showErrorMessage(`Server '${serverName}' is not available`);
						resolve(undefined);
					}
					else {
						const namespaces = response.data.result.content.namespaces;
						if (namespaces.length === 0) {
							vscode.window.showErrorMessage(`No namespaces available to you on '${serverName}'`);
							resolve(undefined);
						}
						const namespace = await vscode.window.showQuickPick(namespaces, { placeHolder: `Choose a namespace on '${serverName}'` });
						if (namespace === undefined) {
							// Throwing cancellation error will exit the Kernel Picker completely.
							reject(new vscode.CancellationError());
						}
						resolve(`${serverName}:${namespace}`);
					}
				});
			})
			.finally(() => vscode.Disposable.from(...disposables).dispose());

			if (serverNamespace) {

				// Ensure support class is installed
				await KernelsApi.getTarget(serverNamespace);

				// Add to the configuration if not already there
				const inspectedSetting = vscode.workspace.getConfiguration('iris-jupyter-server', vscode.window.activeNotebookEditor?.notebook.uri).inspect<IHosts>('hosts') || { key: 'iris-jupyter-server.hosts' };

				// Add to the appropriate configuration if not already there, or if disabled
				let higherLevels = '';
				switch (command.label) {
					case ADD_USER_HOST_COMMAND_LABEL:
						higherLevels = 'workspace-level or folder-level';
						inspectedSetting.globalValue = inspectedSetting.globalValue || {};
						if (!inspectedSetting.globalValue[serverNamespace]?.enabled) {
							inspectedSetting.globalValue[serverNamespace] = { enabled: true };
							await vscode.workspace.getConfiguration('iris-jupyter-server').update('hosts', inspectedSetting.globalValue, vscode.ConfigurationTarget.Global);
						}
						break;

					case ADD_WORKSPACE_HOST_COMMAND_LABEL:
						higherLevels = 'folder-level';
						inspectedSetting.workspaceValue = inspectedSetting.workspaceValue || {};
						if (!inspectedSetting.workspaceValue[serverNamespace]?.enabled) {
							inspectedSetting.workspaceValue[serverNamespace] = { enabled: true };
							await vscode.workspace.getConfiguration('iris-jupyter-server').update('hosts', inspectedSetting.workspaceValue, vscode.ConfigurationTarget.Workspace);
						}
						break;

					case ADD_FOLDER_HOST_COMMAND_LABEL:
						inspectedSetting.workspaceFolderValue = inspectedSetting.workspaceFolderValue || {};
						if (!inspectedSetting.workspaceFolderValue[serverNamespace]?.enabled) {
							inspectedSetting.workspaceFolderValue[serverNamespace] = { enabled: true };
							await vscode.workspace.getConfiguration('iris-jupyter-server').update('hosts', inspectedSetting.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder);
						}
						break;

					default:
						vscode.window.showErrorMessage(`Unhandled command: ${command.label}`, { modal: true });
						break;
				}
				const hosts = vscode.workspace.getConfiguration('iris-jupyter-server', vscode.window.activeNotebookEditor?.notebook.uri).get<{ enabled: boolean }[]>('hosts');
				if (typeof hosts === 'object' && hosts) {
					for (const key in hosts) {
						if (key === serverNamespace && hosts[key].enabled === false) {
							vscode.window.showErrorMessage(`Added host '${serverNamespace}' cannot be used because it is masked by a disabled ${higherLevels} definition.`, { modal: true });

							// Abort kernel selection instead of backtracking to previous pick step
							throw new vscode.CancellationError();
						}
					}
				}

			}

			// Return target back to the Jupyter Extension.
			return serverNamespace ? jupyterServer(serverNamespace) : undefined;
		},
	};


	// Return the JupyterServer object for a given server:NAMESPACE
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
