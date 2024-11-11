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
import { getAccount } from './server';
//import { ContentsApi } from './api/contents';

interface IHosts {
	[key: string]: { enabled: boolean };
}

export let extensionUri: vscode.Uri;
export let logChannel: vscode.LogOutputChannel;

let serverManagerApi: any;
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
				return await new Promise<string | undefined>(async (resolve, reject) => {
					const serverSpec = await serverManagerApi.getServerSpec(serverName);
					if (!serverSpec) {
						vscode.window.showErrorMessage(`Server '${serverName}' is not defined`);
						resolve(undefined);
					}
					if (typeof serverSpec.password === 'undefined') {
						const scopes = [serverSpec.name, serverSpec.username || ''];
						const account = getAccount(serverSpec);
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


	// The command we add to the Server Manager tree at the namespace level
	context.subscriptions.push(vscode.commands.registerCommand('iris-jupyter-server.intersystems-servermanager.newNotebook', async (serverTreeItem) => {
        const idArray: string[] = serverTreeItem.id.split(':');
        const serverId = idArray[1];
        const namespace = idArray[3];
		const serverNamespace = `${serverId}:${namespace}`;
		let firstCall = false;

		if (!jupyterKernelService) {
			firstCall = true;
			jupyterKernelService = await jupyterApi.getKernelService();
			if (!jupyterKernelService) {
				vscode.window.showErrorMessage('Cannot access jupyterApi.getKernelService() - try using VS Code Insiders');
				return;
			}
			jupyterKernelService.onDidChangeKernelSpecifications(() => {
				console.log('Kernel specs changed');
			});
		}

		await vscode.commands.executeCommand('ipynb.newUntitledIpynb');
        const nbEditor = vscode.window.activeNotebookEditor;
        if (!nbEditor) {
            return;
        }
		const nbUri = nbEditor.notebook.uri;

		const SECONDS_TO_WAIT = 5;
		if (firstCall) {
			const waitMessageCell = new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, `Please wait ${SECONDS_TO_WAIT} seconds while your first IRIS notebook initializes...`, 'markdown');
			const workspaceEdit = new vscode.WorkspaceEdit();
			workspaceEdit.set(nbUri, [new vscode.NotebookEdit(new vscode.NotebookRange(0, nbEditor.notebook.cellCount), [waitMessageCell])]);
			await vscode.workspace.applyEdit(workspaceEdit);
			await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Waiting ${SECONDS_TO_WAIT} seconds for IRIS Notebook Servers to be ready...` }, async (progress) => {
				for (let i = 0; i < SECONDS_TO_WAIT; i++) {
					progress.report({ increment: Math.ceil(100 / SECONDS_TO_WAIT) });
					await new Promise(resolve => setTimeout(resolve, 1_000));
				}
			});
		}

		const kernelConnectionMetadataArray = await jupyterKernelService.getKernelSpecifications();

		// What to find
		const kind = 'startUsingRemoteKernelSpec';
		const baseUrl = jupyterServer(serverNamespace).connectionInformation?.baseUrl?.toString(true) || '';
		const kernelSpecName = 'iris-objectscript';

		// Find it
		const kernelConnectionMetadata = kernelConnectionMetadataArray.find((item: any) => item.kind === kind && item.baseUrl === baseUrl && item.kernelSpec.name === kernelSpecName);
		if (!kernelConnectionMetadata) {

			const hosts = vscode.workspace.getConfiguration('iris-jupyter-server').get<IHosts>('hosts') || {};
			if (!hosts[serverNamespace]?.enabled) {
				const serverSpec = await serverManagerApi.getServerSpec(serverId);
				if (!serverSpec?.superServer?.port) {
					const errorMessageCell = new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, `To operate as an IRIS Notebook Host the **${serverId}** server definition requires its superserver port number.`, 'markdown');
					const workspaceEdit = new vscode.WorkspaceEdit();
					workspaceEdit.set(nbUri, [new vscode.NotebookEdit(new vscode.NotebookRange(0, nbEditor.notebook.cellCount), [errorMessageCell])]);
					await vscode.workspace.applyEdit(workspaceEdit);
					return;
				}
				await vscode.workspace.getConfiguration('iris-jupyter-server').update('hosts', { ...hosts, [serverNamespace]: { enabled: true } }, vscode.ConfigurationTarget.Global);
			}


			const mdMessage =
`# First Time Use on ${serverNamespace} 
The IRIS Notebook Host **${serverNamespace}** must initially be accessed from the notebook kernel picker.

## Instructions
1. Click the button in the top right of this notebook, captioned either **Select Kernel** or **Detecting Kernels**.
2. If the next picker is titled 'Select Kernel' choose **IRIS Notebook Servers...**. Otherwise choose **Select Another Kernel...**, then choose **IRIS Notebook Servers...** from that picker.
4. Choose **${serverNamespace}** from the picker titled 'Select a Jupyter Server'.
5. When the picker titled 'Select a Kernel from ${serverNamespace}' is populated wait a couple of seconds, then press the 'Esc' key while focus is on its input field.
6. Back on the INTERSYSTEMS: SERVERS view click again on the **New Notebook** button of the **${namespace}** namespace folder under the **${serverId}** server.

You can then close and discard the original notebook containing these instructions.
`;
			const waitMessageCell = new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, mdMessage, 'markdown');
			const workspaceEdit = new vscode.WorkspaceEdit();
			workspaceEdit.set(nbUri, [new vscode.NotebookEdit(new vscode.NotebookRange(0, nbEditor.notebook.cellCount), [waitMessageCell])]);
			await vscode.workspace.applyEdit(workspaceEdit);
			return;
		}
        await jupyterApi.openNotebook(nbUri, kernelConnectionMetadata.id);
		const welcomeMessageCell = new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, `New IRIS ObjectScript notebook connected to **${serverNamespace}**`, 'markdown');
		const infoCell = new vscode.NotebookCellData(vscode.NotebookCellKind.Code, ' WRITE "Process ", $JOB, " in namespace ", $NAMESPACE, " on server ", $SYSTEM, " (", $ZVERSION, ")",!', 'objectscript-int');
		const workspaceEdit = new vscode.WorkspaceEdit();
		workspaceEdit.set(nbUri, [new vscode.NotebookEdit(new vscode.NotebookRange(0, nbEditor.notebook.cellCount), [welcomeMessageCell, infoCell])]);
		await vscode.workspace.applyEdit(workspaceEdit);
		await vscode.commands.executeCommand('notebook.execute');
	}));

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
