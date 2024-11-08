/* eslint-disable @typescript-eslint/naming-convention */
// Implementing enough of https://github.com/jupyter-server/jupyter_server/tree/main/jupyter_server

// We publish /:serverNamespace/* rather than /:server/:namespace/* because the VS Code Jupyter extension assumes any url containing /user/ indicates that
// the target is a Jupyter Hub. See https://github.com/microsoft/vscode-jupyter/blob/d52654ed850fba4ff241b4aa2e9f62cb082b3f71/src/kernels/jupyter/launcher/jupyterPasswordConnect.ts#L412-L419

import * as vscode from 'vscode';
import { FastifyInstance, FastifyRequest, RequestGenericInterface } from 'fastify';
import { IRISConnection } from './iris';
import * as serverManager from '@intersystems-community/intersystems-servermanager';
import { getAccount, IServerSpec, Server } from './server';
import { ServerNamespaceMgr } from './serverNamespaceMgr';
import { JupyterServerAPI } from './jupyterServerAPI';
import { logoutREST, makeRESTRequest } from './makeRESTRequest';
import { extensionUri, logChannel } from './extension';
import { Mutex } from 'async-mutex';

// Our interfaces
export interface ITarget {
	server: string,
	namespace: string,
	serverSpec?: IServerSpec
}

export interface IProcess extends JupyterServerAPI.IKernel {
	connection: IRISConnection,
	sessionName: string,
	executionCount: number
}

export interface IParams {
	serverNamespace: string // server:namespace
}

export interface IRequestGeneric extends RequestGenericInterface {
	Params: IParams,
	Body: string
}

// The Server Manager API handle
let serverManagerApi: any;

export abstract class ApiBase {

	private static mutex = new Mutex();
	static async getTarget(serverNamespace: string): Promise<ITarget> {
		return await ApiBase.mutex.runExclusive(async () => {

			const serverNamespaceMgr = ServerNamespaceMgr.get(serverNamespace);
			if (serverNamespaceMgr) {
				return serverNamespaceMgr.target;
			}

			const loadAndCompile = (async (serverSpec: IServerSpec, namespace: string): Promise<void> => {
				const fileUri = vscode.Uri.joinPath(extensionUri, 'server/src/PolyglotKernel/CodeExecutor.cls');
				const name = 'PolyglotKernel.CodeExecutor.cls';
				const content = (await vscode.workspace.fs.readFile(fileUri)).toString().split('\n').map((line) => line.replace('\r', ''));
				//const name = 'YJMpushed.int';
				//const content: string[] = ['ROUTINE YJMpushed [Type=INT]', 'YJMpushed ;stub', ' write "Hello"', ' quit'];
				let response = await makeRESTRequest(
					'PUT',
					serverSpec,
					{ apiVersion: 1, namespace, path: `/doc/${name}?ignoreConflict=1` },
					{ enc: false, content, mtime: 0 }
				);
				if (!response || ![200, 201].includes(response.status)) {
					throw new Error(`Bootstrap load failed: ${response?.data.status.summary}`);
				}
				response = await makeRESTRequest(
					'POST',
					serverSpec,
					{ apiVersion: 1, namespace, path: '/action/compile' },
					[name]
				);
				if (response?.status !== 200) {
					throw new Error(`Bootstrap compile failed: ${response?.data.status.summary}`);
				}
				return;
			});

			const resolveTarget = (async (): Promise<ITarget> => {
				const parts = serverNamespace.split(':');
				if (parts.length !== 2) {
					return { server: '', namespace: ''};
				}

				let serverName = parts[0].toLowerCase();
				let namespace = parts[1].toUpperCase();

				// Check existence of server-side support class, and install it if absent
				const checkNamespace = (async (serverSpec: IServerSpec) => {
					const runQuery = ((serverSpec: IServerSpec) => {
						return makeRESTRequest(
							'POST',
							serverSpec,
							{ apiVersion: 1, namespace, path: '/action/query' },
							{ query: 'SELECT PolyglotKernel.CodeExecutor_HostName() AS Host, PolyglotKernel.CodeExecutor_SuperServerPort() AS Port', parameters: [] }
						);
					});
					try {
						let response = await runQuery(serverSpec);
						if (response !== undefined) {
							if (response.data.result.content === undefined) {
								if (response.data.status?.errors[0]?.code !== 5540) {
									throw new Error(response.data.status.summary);
								}
								// Class is missing, so load and compile it, then re-run the query
								const choice = await vscode.window.showInformationMessage(`Polyglot.CodeExecutor class not found in ${serverSpec.name}:${namespace}. Load it now?`, { modal: true }, { title: 'Yes' }, { title: 'No', isCloseAffordance: true });
								if (choice?.title !== 'Yes') {
									throw new Error('Polyglot.CodeExecutor class not available');
								}
								await loadAndCompile(serverSpec, namespace);
								response = await runQuery(serverSpec);
								if (response?.data.result.content === undefined) {
									throw new Error(`Retry failed after class load: ${response?.data.status.summary ?? 'Unknown'}`);
								}
							}
							const host = serverSpec.superServer?.host ?? response.data.result.content[0].Host;
							const port = serverSpec.superServer?.port ?? response.data.result.content[0].Port;
							serverSpec.superServer = { host, port };
						}
					} catch (error) {
						throw error;
					} finally {
						await logoutREST(serverSpec);
					}
				});

				let serverSpec = Server.get(serverName);
				if (serverSpec) {
					if (!ServerNamespaceMgr.get(serverNamespace)) {
						await checkNamespace(serverSpec);
					}
					return { server: serverName, namespace, serverSpec };
				}
				if (serverName === '') {

					const getObjectScriptAPI = (async(): Promise<any> => {
						const targetExtension = vscode.extensions.getExtension("intersystems-community.vscode-objectscript");
						if (!targetExtension) {
						  return undefined;
						}
						if (!targetExtension.isActive) {
						  await targetExtension.activate();
						}
						const api = targetExtension.exports;

						if (!api) {
						  return undefined;
						}
						return api;
					});
					const osAPI = await getObjectScriptAPI();
					if (!osAPI) {
						throw new Error('Missing intersystems-community.vscode-objectscript API');
					}
					const osServer = osAPI.serverForUri();
					if (!osServer) {
						throw new Error('Missing objectscript.conn');
					}
					if (!osServer.active) {
						throw new Error('Disabled objectscript.conn');
					}
					serverSpec = {
						username: osServer.username,
						password: osServer.password,
						name: osServer.serverName,
						webServer: {
						  host: osServer.host,
						  port: osServer.port,
						  pathPrefix: osServer.pathPrefix,
						  scheme: osServer.scheme
						}
					};
					if (namespace === '') {
						namespace = osServer.namespace;
					}
					if (osServer.serverName) {
						serverName = osServer.serverName;
					}
				}
				if (!serverSpec) {
					if (typeof serverManagerApi === 'undefined') {
						let extension;
						extension = vscode.extensions.getExtension(serverManager.EXTENSION_ID);
						if (!extension) {
						// Maybe ask user for permission to install Server Manager
						await vscode.commands.executeCommand('workbench.extensions.installExtension', serverManager.EXTENSION_ID);
						extension = vscode.extensions.getExtension(serverManager.EXTENSION_ID);
						}
						if (!extension) {
							return { server: '', namespace: ''};
						}
						if (!extension.isActive) {
							await extension.activate();
						}
						serverManagerApi = extension.exports;
					}
					serverSpec = await serverManagerApi.getServerSpec(serverName) as serverManager.IServerSpec;
					if (!serverSpec) {
						return { server: serverName, namespace };
					}
					if (typeof serverSpec.password === 'undefined') {
						const scopes = [serverSpec.name, serverSpec.username || ''];
						const account = getAccount(serverSpec);
						let session = await vscode.authentication.getSession(serverManager.AUTHENTICATION_PROVIDER, scopes, { silent: true, account });
						if (!session) {
							session = await vscode.authentication.getSession(serverManager.AUTHENTICATION_PROVIDER, scopes, { createIfNone: true, account });
						}
						if (session) {
							serverSpec.username = session.scopes[1];
							serverSpec.password = session.accessToken;
						}
						else {
							throw new Error(`Cannot fetch credentials for server '${serverName}'`);
						}
					}
				}

				// Check existence of server-side support class, and install it if absent
				await checkNamespace(serverSpec);

				return { server: serverName, namespace, serverSpec };
			});

			const target = await resolveTarget();
			if (target.serverSpec) {
				if (!Server.get(serverNamespace)) {
					new Server(target.serverSpec);
				}
				new ServerNamespaceMgr(serverNamespace, target);
			}
			return target;
		});
	}

	static addRoutes(fastify: FastifyInstance) {
	}

}

export class MiscApi extends ApiBase {

	static addRoutes(fastify: FastifyInstance) {

		fastify.get('/:serverNamespace/hub/api', (request: FastifyRequest<IRequestGeneric>, reply) => {
			const { serverNamespace } = request.params;
			reply.code(404); // Comment this out if we want to to convince Jupyter extension it is talking to a Jupyter Hub (implementation of more of hub API would be required
			logChannel.debug(`/:serverNamespace/hub/api GET - reply code 404`);
			return {};
		});

		fastify.post('/:serverNamespace/hub/login', (request: FastifyRequest<IRequestGeneric>, reply) => {
			//TODO
			const { serverNamespace } = request.params;
			reply.code(501);
			return {
				"message": `TODO: /${serverNamespace}/hub/login`,
				"short_message": "TODO"
			};
		});

		fastify.get('/:serverNamespace/tree', (request: FastifyRequest<IRequestGeneric>, reply) => {
			// Convince Jupyter extension it doesn't need to provide a password when connecting to http://localhost:50773/:serverNamespace?token=
			return {};
		});

		fastify.get('/:serverNamespace/login', (request: FastifyRequest<IRequestGeneric>, reply) => {
			// TODO
			const { serverNamespace } = request.params;
			reply.code(501);
			return {
				"message": `TODO: /${serverNamespace}/login`,
				"short_message": "TODO"
			};
		});

		fastify.get('/:serverNamespace/logout', (request: FastifyRequest<IRequestGeneric>, reply) => {
			// TODO
			const { serverNamespace } = request.params;
			return {"info": `TODO: Successfully logged out of ${serverNamespace}.`};
		});


		fastify.get('/:serverNamespace/api/kernelspecs', async (request: FastifyRequest<IRequestGeneric>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			const noKernels = (message: string): any => {
				return {
					default: "none",
					kernelspecs: {
						"none": {
							name: "none",
							resources: {},
							spec: {
								language: "plaintext",
								display_name: `ERROR @ ${serverNamespace}`,
								argv: [`${message}`]
							}
						}
					},
				};
			};
			let target:ITarget;
			try {
				target = await ApiBase.getTarget(serverNamespace);
			} catch (error) {
				return noKernels(error as string);
			}
			if (!target?.serverSpec) {
				return noKernels(`Unknown target '${serverNamespace}'`);
			}
			if (!target.serverSpec.superServer?.port) {
				return noKernels('Missing superserver port number');
			}
			let irisConn: IRISConnection;
			let serverVersion: string;
			try {
				irisConn = new IRISConnection(target);
				serverVersion = irisConn.iris.getServerVersion();
				irisConn.dispose();
			} catch (error) {
				return noKernels(error as string);
			}

			const specs = new Map<string, any>();
			const addSpec = (name: string, language: string, display_name: string) => {
				specs.set(name, {
					name,
					resources: {},
					spec: {
						language,
						display_name,
						argv: [`${target.server}:${target.namespace}`],
						interrupt_mode: "message"
					}
				});
			};

			let dfltSpec = 'iris-sql';
			addSpec('iris-sql', 'sql', 'IRIS SQL');
			if ((await vscode.languages.getLanguages()).includes('objectscript-int')) {
				addSpec('iris-objectscript', 'objectscript-int', 'IRIS ObjectScript INT');
				dfltSpec = 'iris-objectscript';
			}
			const matchMajorVersion = serverVersion.match(/\) (\d+)/);
			if (matchMajorVersion && +(matchMajorVersion[1] ?? '0') >= 2022) {
				addSpec('iris-python', 'python', 'IRIS Python');
				dfltSpec = 'iris-python';
			}
			addSpec('iris-polyglot', 'iris-polyglot', 'Polyglot IRIS');

			const result = {
				default: dfltSpec,
				kernelspecs: Object.fromEntries(specs)
			};
			logChannel.debug(`/:serverNamespace/api/kernelspecs GET - result: ${JSON.stringify(result)}`);
			return result;
		});
	}
}
