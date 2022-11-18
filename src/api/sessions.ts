import { FastifyInstance, FastifyRequest } from "fastify";
import { ApiBase, IRequestGeneric } from "../api";
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
			console.log(`/:serverNamespace/api/sessions result: ${JSON.stringify(result)}`);
			return result;
		});

		fastify.post('/:serverNamespace/api/sessions', (request: FastifyRequest<IRequestGeneric>, reply) => {
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
		});

		fastify.delete('/:serverNamespace/api/sessions/:sessionId', (request: FastifyRequest<IRequestSession>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			const sessionId = request.params.sessionId;
			reply.code(204);
			return;
		});
}
}
