/* eslint-disable @typescript-eslint/naming-convention */
import { FastifyInstance } from 'fastify';

export function addRoutes(fastify:FastifyInstance) {
	fastify.get('/api/kernelspecs', async (request, reply) => {
		return {
			"default": "iris",
			"kernelspecs": {
				"iris": {
					"name": "iris",
					"resources": {},
					"spec": {
						"language": "polyglot",
						"display_name": "IRIS polyglot",
						"argv": []
					}
				}
			},
		};
	});

	fastify.get('/api/kernels', async (request, reply) => {
		//TODO
		return [];
	});

	fastify.get('/api/sessions', async (request, reply) => {
		//TODO
		return [];
	});

	fastify.post('/api/sessions', async (request, reply) => {
		const { kernel, name, type} = JSON.parse(request.body as string);
		reply.code(501);
		return {
			"message": `TODO: create '${type}' session '${name}' with kernel '${kernel.name}'`,
			"short_message": "TODO"
		};
	});
}
