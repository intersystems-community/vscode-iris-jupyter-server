/* eslint-disable @typescript-eslint/naming-convention */
// Implementing enough of https://github.com/jupyter-server/jupyter_server/tree/main/jupyter_server

// We publish /:serverNamespace/* rather than /:server/:namespace/* because the VS Code Jupyter extension assumes any url containing /user/ indicates that
// the target is a Jupyter Hub. See https://github.com/microsoft/vscode-jupyter/blob/d52654ed850fba4ff241b4aa2e9f62cb082b3f71/src/kernels/jupyter/launcher/jupyterPasswordConnect.ts#L412-L419

import * as vscode from 'vscode';
import * as serverManager from '@intersystems-community/intersystems-servermanager';
import { FastifyInstance, FastifyRequest, RequestGenericInterface } from 'fastify';
import { IRISConnection } from './iris';

// Server Manager interfaces

export interface ISuperServerSpec {
	host?: string;
	port: number;
}

export interface IServerSpec extends serverManager.IServerSpec {
	superServer?: ISuperServerSpec;
}

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

// The Server Manager API handle
let serverManagerApi: any;

let serverSpecMap: Map<string, IServerSpec>;

async function getTarget(serverNamespace: string): Promise<ITarget> {
	const parts = serverNamespace.split(':');
	const namespace = parts[1].toUpperCase();
	if (parts.length === 2) {
		const serverName = parts[0].toLowerCase();
		let serverSpec = serverSpecMap.get(serverName);
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
			serverSpec = await serverManagerApi.getServerSpec(serverName);
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
			serverSpecMap.set(serverName, serverSpec);
			return { server: serverName, namespace, serverSpec };
		  }
		return { server: serverName, namespace };
	}
	return { server: '', namespace: ''};
}

export async function addRoutes(fastify:FastifyInstance) {

	serverSpecMap = new Map<string, IServerSpec>;

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
		const target = await getTarget(request.params.serverNamespace);
		if (!target?.serverSpec) {
			reply.code(400);
			return {};
		}
		const irisConn = new IRISConnection(target);

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
		// TODO
		//const { server, namespace } = await getTarget(request.params.serverNamespace);
		return [];
	});

	fastify.get('/:serverNamespace/api/sessions', async (request: FastifyRequest<IRequestGeneric>, reply) => {
		// TODO
		//const { server, namespace } = await getTarget(request.params.serverNamespace);
		return [];
	});


	fastify.register(async (fastify, opts) => {

		interface IKernel {
			name: string
		}

		interface ISessionsRequest {
			kernel: IKernel,
			name: string,
			type: string
		}

		fastify.post('/:serverNamespace/api/sessions', async (request: FastifyRequest<IRequestGeneric>, reply) => {
			const { serverNamespace } = request.params;
			const target = await getTarget(serverNamespace);
			const { server, namespace, serverSpec } = target;
			if (!server) {
				reply.code(400);
				return {};
			}
			var payload: ISessionsRequest;
			try {
				payload = JSON.parse(request.body);
			}
			catch (error) {
				reply.code(400);
				return {};
			}
			const { kernel, name, type} = payload;

			const irisConn = new IRISConnection(target);
			const serverVersion = irisConn.iris.getServerVersion();

			reply.code(501);
			return {
				"message": `TODO - In '${namespace}' on '${server}' (${serverVersion}) create '${type}' session '${name}' using kernel '${kernel.name}'`,
				"short_message": "TODO"
			};
		});
	});
}
