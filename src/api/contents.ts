/* eslint-disable @typescript-eslint/naming-convention */
import { FastifyInstance, FastifyRequest } from "fastify";
import { ApiBase, IRequestGeneric } from "../api";
import { logChannel } from "../extension";

interface IRequestContents extends IRequestGeneric {
	Params: {
		serverNamespace: string, // server:namespace
		path: string
	}
}

export class ContentsApi extends ApiBase {

	// NOT YET CALLED from activate()
	static addRoutes(fastify: FastifyInstance) {

		// See https://petstore.swagger.io/?url=https://raw.githubusercontent.com/jupyter/jupyter_server/master/jupyter_server/services/api/api.yaml#/contents

		// Create a new file in the specified path
		fastify.post('/:serverNamespace/api/contents', (request: FastifyRequest<IRequestGeneric>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			logChannel.debug(`/:serverNamespace/api/contents POST request, body=${request.body}`);
			const bodyObj = JSON.parse(request.body);
			reply.code(201);
			const datetimeNow = 'now'; //TODO
			const newFilename = 'untitled1.ipynb';
			return {
				name: newFilename,
				path: newFilename,
				type: 'notebook',
				created: datetimeNow,
				last_modified: datetimeNow,
				content: '{}',
				mimetype: null,
				format: 'json'
			};
		});

		// Rename a file or directory without re-uploading content
		fastify.patch('/:serverNamespace/api/contents/:path(.*)', (request: FastifyRequest<IRequestContents>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			const path = request.params.path;
			logChannel.debug(`/:serverNamespace/api/contents PATCH request, body=${request.body}`);
			const bodyObj = JSON.parse(request.body);
			reply.code(200);
			const datetimeNow = 'now'; //TODO
			const name = (bodyObj.path as string).split('/').pop();
			return {
				name,
				path: bodyObj.path,
				type: 'notebook',
				created: datetimeNow,
				last_modified: datetimeNow,
				content: '{}',
				mimetype: null,
				format: 'json'
			};
		});

		// Delete a file in the given path
		fastify.delete('/:serverNamespace/api/contents/:path(.*)', (request: FastifyRequest<IRequestContents>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			const path = request.params.path;
			logChannel.debug(`/:serverNamespace/api/contents DELETE request for ${path}`);
			reply.code(200);
			return;
		});
	}
}
