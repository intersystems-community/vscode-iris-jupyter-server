/* eslint-disable @typescript-eslint/naming-convention */
import { FastifyInstance, FastifyRequest } from "fastify";
import { ApiBase, IRequestGeneric, IParams } from "../api";
import { JupyterServerAPI } from "../jupyterServerAPI";
import { ServerNamespaceMgr } from "../serverNamespaceMgr";
import { IRISConnection } from '../iris';

interface IRequestSession extends IRequestGeneric {
	Params: {
		serverNamespace: string, // server:namespace
		sessionId: string
	}
}

export class SessionsApi extends ApiBase {

	static addRoutes(fastify: FastifyInstance) {

		fastify.get('/:serverNamespace/api/sessions', (request: FastifyRequest<IRequestGeneric>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			const result = ServerNamespaceMgr.get(serverNamespace)?.allSessions() || [];
			//logChannel.debug(`/:serverNamespace/api/sessions result: ${JSON.stringify(result)}`);
			return result;
		});

		fastify.post<{ Body: JupyterServerAPI.ISession, Params: IParams }>('/:serverNamespace/api/sessions', (request, reply) => {
			const { serverNamespace } = request.params;
			const serverNamespaceMgr = ServerNamespaceMgr.get(serverNamespace);
			if (!serverNamespaceMgr?.target.serverSpec) {
				reply.code(400);
				return {};
			}
			const target = serverNamespaceMgr.target;
			var session: JupyterServerAPI.ISession = request.body;
			const { name, kernel } = session;

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

			let irisConn: IRISConnection;
			try {
				irisConn = new IRISConnection(target);
			} catch (error) {
				reply.code(500);
				return {
					message: `Failed to start kernel process on ${serverNamespace} - ${(error as Error).message}`,
					"short_message": "KERNELSTART"
				};
			}

			reply.code(201);
			return serverNamespaceMgr.createSession(session, irisConn);
		});

		fastify.delete('/:serverNamespace/api/sessions/:sessionId', (request: FastifyRequest<IRequestSession>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			const sessionId = request.params.sessionId;
			reply.code(204);
			return;
		});
}
}
