/* eslint-disable @typescript-eslint/naming-convention */
// Implementing enough of https://github.com/jupyter-server/jupyter_server/tree/main/jupyter_server

// We publish /:serverNamespace/* rather than /:server/:namespace/* because the VS Code Jupyter extension assumes any url containing /user/ indicates that
// the target is a Jupyter Hub. See https://github.com/microsoft/vscode-jupyter/blob/d52654ed850fba4ff241b4aa2e9f62cb082b3f71/src/kernels/jupyter/launcher/jupyterPasswordConnect.ts#L412-L419

import * as vscode from 'vscode';
import { FastifyInstance, FastifyRequest, RequestGenericInterface, RouteGenericInterface } from 'fastify';
import { IRISConnection } from './iris';
import * as serverManager from '@intersystems-community/intersystems-servermanager';
import { IServerSpec, Server } from './server';
import { ServerNamespaceMgr } from './serverNamespaceMgr';
import { JupyterServerAPI } from './jupyterServerAPI';

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

export interface IRouteGeneric extends RouteGenericInterface {
	Params: {
		serverNamespace: string // server:namespace
	},

	Body: string
}

export interface IRequestGeneric extends RequestGenericInterface {
	Params: {
		serverNamespace: string // server:namespace
	},

	Body: string
}

// The Server Manager API handle
let serverManagerApi: any;

export abstract class ApiBase {

	static async getTarget(serverNamespace: string): Promise<ITarget> {
		const serverNamespaceMgr = ServerNamespaceMgr.get(serverNamespace);
		if (serverNamespaceMgr) {
			return serverNamespaceMgr.target;
		}

		const resolveTarget = (async (): Promise<ITarget> => {
			const parts = serverNamespace.split(':');
			const namespace = parts[1].toUpperCase();
			if (parts.length === 2) {
				const serverName = parts[0].toLowerCase();
				let serverSpec = Server.get(serverName);
				if (serverSpec) {
					return { server: serverName, namespace, serverSpec };
				}
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
				if (serverManagerApi && serverManagerApi.getServerSpec) {
					serverSpec = await serverManagerApi.getServerSpec(serverName) as serverManager.IServerSpec;
					if (!serverSpec) {
						return { server: serverName, namespace };
					}
					if (typeof serverSpec.password === 'undefined') {
					const scopes = [serverSpec.name, serverSpec.username || ''];
					let session = await vscode.authentication.getSession(serverManager.AUTHENTICATION_PROVIDER, scopes, { silent: true });
					if (!session) {
						session = await vscode.authentication.getSession(serverManager.AUTHENTICATION_PROVIDER, scopes, { createIfNone: true });
					}
					if (session) {
						serverSpec.username = session.scopes[1];
						serverSpec.password = session.accessToken;
					}
					}
					const server = new Server(serverSpec);
					Server.set(serverName, serverSpec);
					return { server: serverName, namespace, serverSpec };
				}
				return { server: serverName, namespace };
			}
			return { server: '', namespace: ''};
		});
		const target = await resolveTarget();
		if (target.serverSpec) {
			if (!Server.get(serverNamespace)) {
				new Server(target.serverSpec);
			}
			new ServerNamespaceMgr(serverNamespace, target);
		}
		return target;
	}

	static addRoutes(fastify: FastifyInstance) {
	}

}

export class MiscApi extends ApiBase {

	static addRoutes(fastify:FastifyInstance) {

		fastify.get('/:serverNamespace/hub/api', (request: FastifyRequest<IRequestGeneric>, reply) => {
			const { serverNamespace } = request.params;
			reply.code(404); // Comment this out if we want to to convince Jupyter extension it is talking to a Jupyter Hub (implementation of more of hub API would be required)
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
			const target = await ApiBase.getTarget(serverNamespace);
			if (!target?.serverSpec) {
				return noKernels(`Unknown target '${request.params.serverNamespace}'`);
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

			return {
				default: dfltSpec,
				kernelspecs: Object.fromEntries(specs)
			};
		});
	}
}
