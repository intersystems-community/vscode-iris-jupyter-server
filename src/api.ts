/* eslint-disable @typescript-eslint/naming-convention */
// Implementing enough of https://github.com/jupyter-server/jupyter_server/tree/main/jupyter_server

// We publish /:serverNamespace/* rather than /:server/:namespace/* because the VS Code Jupyter extension assumes any url containing /user/ indicates that
// the target is a Jupyter Hub. See https://github.com/microsoft/vscode-jupyter/blob/d52654ed850fba4ff241b4aa2e9f62cb082b3f71/src/kernels/jupyter/launcher/jupyterPasswordConnect.ts#L412-L419

import * as vscode from 'vscode';
import { FastifyInstance, FastifyRequest, RequestGenericInterface } from 'fastify';
import { IRISConnection } from './iris';
import * as serverManager from '@intersystems-community/intersystems-servermanager';
import { IServerSpec, Server } from './server';
import { JupyterServerAPI } from './jupyterServerAPI';
import { ServerNamespaceMgr } from './serverNamespaceMgr';

// Our interfaces
export interface ITarget {
	server: string,
	namespace: string,
	serverSpec?: IServerSpec
}

interface IRequestGeneric extends RequestGenericInterface {
	Params: {
		serverNamespace: string // server:namespace
	},

	Body: string
}

interface IRequestKernel extends IRequestGeneric {
	Params: {
		serverNamespace: string, // server:namespace
		kernelId: string
	}
}

// The Server Manager API handle
let serverManagerApi: any;

async function getTarget(serverNamespace: string): Promise<ITarget> {
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

export async function addRoutes(fastify:FastifyInstance) {

	fastify.get('/:serverNamespace/hub/api', async (request: FastifyRequest<IRequestGeneric>, reply) => {
		const { serverNamespace } = request.params;
		reply.code(404); // Comment this out if we want to to convince Jupyter extension it is talking to a Jupyter Hub (implementation of more of hub API would be required)
		return {};
	});

	fastify.post('/:serverNamespace/hub/login', async (request: FastifyRequest<IRequestGeneric>, reply) => {
		//TODO
		const { serverNamespace } = request.params;
		reply.code(501);
		return {
			"message": `TODO: /${serverNamespace}/hub/login`,
			"short_message": "TODO"
		};
	});

	fastify.get('/:serverNamespace/tree', async (request: FastifyRequest<IRequestGeneric>, reply) => {
		// Convince Jupyter extension it doesn't need to provide a password when connecting to http://localhost:50773/:serverNamespace?token=
		return {};
	});

	fastify.get('/:serverNamespace/login', async (request: FastifyRequest<IRequestGeneric>, reply) => {
		// TODO
		const { serverNamespace } = request.params;
		reply.code(501);
		return {
			"message": `TODO: /${serverNamespace}/login`,
			"short_message": "TODO"
		};
	});

	fastify.get('/:serverNamespace/logout', async (request: FastifyRequest<IRequestGeneric>, reply) => {
		// TODO
		const { serverNamespace } = request.params;
		return {"info": `TODO: Successfully logged out of ${serverNamespace}.`};
	});


	fastify.get('/:serverNamespace/api/kernelspecs', async (request: FastifyRequest<IRequestGeneric>, reply) => {
		const serverNamespace = request.params.serverNamespace;
		const noKernels = (message: string): any => {
			return {
				"default": "none",
				"kernelspecs": {
					"none": {
						"name": "none",
						"resources": {},
						"spec": {
							"language": "plaintext",
							"display_name": `ERROR @ ${serverNamespace}`,
							"argv": [`${message}`]
						}
					}
				},
			};
		};
		const target = await getTarget(serverNamespace);
		if (!target?.serverSpec) {
			return noKernels(`Unknown target '${request.params.serverNamespace}'`);
		}
		let irisConn: IRISConnection;
		let serverVersion: string;
		try {
			irisConn = new IRISConnection(target);
			serverVersion = irisConn.iris.getServerVersion();
		} catch (error) {
			return noKernels(error as string);
		}

		const { server, namespace } = target;
		return {
			"default": "iris-polyglot",
			"kernelspecs": {
				"iris-polyglot": {
					"name": "iris-polyglot",
					"resources": {},
					"spec": {
						"language": "iris-polyglot",
						"display_name": `Polyglot IRIS`,
						"argv": [`${server}:${namespace}`]
					}
				},
				"iris-objectscript": {
					"name": "iris-objectscript",
					"resources": {},
					"spec": {
						"language": "objectscript-int",
						"display_name": "IRIS ObjectScript INT",
						"argv": [`${server}:${namespace}`]
					}
				},
				"iris-python": {
					"name": "iris-python",
					"resources": {},
					"spec": {
						"language": "python",
						"display_name": "IRIS Python",
						"argv": [`${server}:${namespace}`]
					}
				},
				"iris-sql": {
					"name": "iris-sql",
					"resources": {},
					"spec": {
						"language": "sql",
						"display_name": "IRIS SQL",
						"argv": [`${server}:${namespace}`]
					}
				}
			},
		};
	});

	fastify.get('/:serverNamespace/api/kernels', async (request: FastifyRequest<IRequestGeneric>, reply) => {
		const serverNamespace = request.params.serverNamespace;
		await getTarget(serverNamespace);
		return ServerNamespaceMgr.get(serverNamespace)?.allKernels() || [];
	});

	fastify.post('/:serverNamespace/api/kernels', async (request: FastifyRequest<IRequestGeneric>, reply) => {
		// TODO
		const { server, namespace } = await getTarget(request.params.serverNamespace);

		var payload: JupyterServerAPI.IKernel;
		try {
			payload = JSON.parse(request.body);
		}
		catch (error) {
			reply.code(400);
			return {};
		}

		const { name } = payload;
		reply.code(501);
		return {
			"message": `TODO - In '${namespace}' on '${server}' start a '${name}' kernel`,
			"short_message": "TODO"
		};
	});

	fastify.get('/:serverNamespace/api/kernels/:kernelId', async (request: FastifyRequest<IRequestKernel>, reply) => {
		const serverNamespace = request.params.serverNamespace;
		const kernelId = request.params.kernelId;
		return ServerNamespaceMgr.get(serverNamespace)?.getKernel(kernelId);
	});

	fastify.get('/:serverNamespace/api/sessions', async (request: FastifyRequest<IRequestGeneric>, reply) => {
		// TODO
		//const { server, namespace } = await getTarget(request.params.serverNamespace);
		return [];
	});


	fastify.register(async (fastify, opts) => {

		fastify.post('/:serverNamespace/api/sessions', async (request: FastifyRequest<IRequestGeneric>, reply) => {
			const { serverNamespace } = request.params;
			const serverNamespaceMgr = ServerNamespaceMgr.get(serverNamespace);
			if (!serverNamespaceMgr?.target.serverSpec) {
				reply.code(400);
				return {};
			}
			const target = serverNamespaceMgr.target;
			var session: JupyterServerAPI.ISession;
			try {
				session = JSON.parse(request.body);
			}
			catch (error) {
				reply.code(400);
				return {};
			}
			const { name, type, path, kernel } = session;

			const existingSession = serverNamespaceMgr?.getSession(name);
			if (existingSession) {
				reply.code(201);
				return existingSession;
			}

			const { server, namespace, serverSpec } = target;
			if (kernel.name === 'none') {
				const message = serverSpec
					? `Namespace '${namespace}' on server '${server}' cannot run kernels. Check hover tip on kernel selector for more information.`
					: `Server '${server}' not defined.`;
				reply.code(500);
				return {
					message,
					"short_message": "NOKERNELS"
				};
			}

			reply.code(201);
			return serverNamespaceMgr.createSession(session);

			/*

			const irisConn = new IRISConnection(target);
			const serverVersion = irisConn.iris.getServerVersion();
			console.log(`TODO: POST@api/sessions - In '${namespace}' on '${server}' (${serverVersion}) create '${type}' session '${name}' for path '${path}' using kernel '${kernel.name}'`);

			const result = JSON.parse(irisConn.iris.classMethodValue('PolyglotKernel.CodeExecutor', 'CodeResult', 'write $zversion', 'cos'));

			reply.code(501);
			return {
				"message": `TODO - In '${namespace}' on '${server}' (${serverVersion}) create '${type}' session '${name}' for path '${path}' using kernel '${kernel.name}'`
					+ `\nCodeResult status: ${result.status}\n${result.out}`
					,
				"short_message": "TODO"
			};
			*/
		});
	});
}
