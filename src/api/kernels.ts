import { FastifyInstance, FastifyRequest } from "fastify";
import * as FastifyWS from "@fastify/websocket";
import * as nteract from "@nteract/messaging";
import { ApiBase, IRequestGeneric, IRouteGeneric } from "../api";
import { JupyterServerAPI } from "../jupyterServerAPI";
import { ServerNamespaceMgr } from "../serverNamespaceMgr";
import { v4 as uuid } from 'uuid';
import console = require("console");


interface IRequestKernel extends IRequestGeneric {
	Params: {
		serverNamespace: string, // server:namespace
		kernelId: string
	}
}

interface IRequestChannels extends IRequestKernel {
	Querystring: {
		session_id: string;
	}
}

interface IRouteKernel extends IRouteGeneric {
	Params: {
		serverNamespace: string, // server:namespace
		kernelId: string
	}
}

interface IRouteChannels extends IRouteKernel {
	Querystring: {
		session_id: string;
	}
}

export class KernelsApi extends ApiBase {

	static addRoutes(fastify: FastifyInstance) {

		fastify.get('/:serverNamespace/api/kernels', async (request: FastifyRequest<IRequestGeneric>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			await this.getTarget(serverNamespace);
			const result = ServerNamespaceMgr.get(serverNamespace)?.allKernels() || [];
			//console.log(`/:serverNamespace/api/kernels result: ${JSON.stringify(result)}`);
			return result;
		});

		fastify.post('/:serverNamespace/api/kernels', async (request: FastifyRequest<IRequestGeneric>, reply) => {
			// TODO
			const { server, namespace } = await this.getTarget(request.params.serverNamespace);

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

		// Websocket handler for /api/kernels/:kernelId
		fastify.get('/:serverNamespace/api/kernels/:kernelId',
			{ websocket: true },
			(connection: FastifyWS.SocketStream, request: any) => {
				const serverNamespace = request.params.serverNamespace;
				const kernelId = request.params.kernelId;
				console.log(`TODO - WSget for kernelId '${kernelId}' on '${serverNamespace}'`);

				connection.socket.on('message', (message) => {
					console.log(`kernel '${kernelId}' socket received message`);
				});
				return;
			}
		);

		// Websocket handler for /api/kernels/:kernelId/channels
		fastify.get('/:serverNamespace/api/kernels/:kernelId/channels',
			{ websocket: true },
			(connection: FastifyWS.SocketStream, request: FastifyRequest<IRequestChannels>) => {
				const serverNamespace = request.params.serverNamespace;
				const kernelId = request.params.kernelId;
				const clientSessionId = request.query.session_id;
				console.log(`WSget for kernelId '${kernelId}' channels on '${serverNamespace}'`);

				// Cutting a corner here. If we want to support kernel restart we will need to assign a dedicated uuid each time the process
				// servicing kernelId restarts, because the kernelId won't change but the session property of the header object within its messages must change.
				const kernelSessionId = kernelId;

				connection.socket.on('message', (rawData) => {
					console.log(`WS message arrived: ${rawData.toString('utf8')}`);
					let message: nteract.JupyterMessage = JSON.parse(rawData.toString('utf8'));

					const sendStatus = (status: string) => {
						const msg = nteract.createMessage('status', { parent_header: message.header, content: { 'execution_state': status } });
						msg.header.session = kernelSessionId;
						msg.header.username = 'iris-jupyter-server';
						connection.socket.send(JSON.stringify(msg), { fin: true }, () => {
							console.log(` > kernel '${kernelId}' socket message sent, channel ${msg.channel}, type ${msg.header.msg_type}, status ${status}: ${JSON.stringify(msg)}`);
						});
					};

					const sendResult = (output: string) => {
						const msg = nteract.createMessage('execute_result', {
							parent_header: message.header,
							content: {
								execution_count: 0, //TODO
								data: {
									'text/plain': output
								}
							}
						});
						msg.header.session = kernelSessionId;
						msg.header.username = 'iris-jupyter-server';
						connection.socket.send(JSON.stringify(msg), { fin: true }, () => {
							console.log(` > kernel '${kernelId}' socket message sent, channel ${msg.channel}, type ${msg.header.msg_type}: ${JSON.stringify(msg)}`);
						});
					};

					/*
					const broadcast = (msg: nteract.JupyterMessage) => {
						const originalChannel = msg.channel;
						msg.channel = 'iopub';
						const outString = JSON.stringify(msg);
						connection.socket.send(outString, { fin: true }, () => {
							console.log(` > kernel '${kernelId}' socket message was broadcast on IOPub: ${outString}`);
						});
						msg.channel = originalChannel;
					};
					*/

					console.log(` < kernel '${kernelId}' socket message received, channel ${message.channel}, type ${message.header.msg_type} message=${JSON.stringify(message)}`);

					sendStatus('busy');

					//broadcast(message);

					let reply: any;
					if (message.channel === 'shell') {
						switch (message.header.msg_type) {
							case 'kernel_info_request':
								reply = nteract.createMessage('kernel_info_reply', {
									parent_header: message.header,
									content: {
										status: 'ok',
										protocol_version: '5.2',
										implementation: 'iris-jupyter-server',
										implementation_version: '0.0.1',
										language_info: {
											name: 'iris-polyglot',
											version: '0.0.1'
										},
										banner: '(a fake kernel banner)',
										help_links: []
									}
								});
								break;

							case 'execute_request':
								sendResult((message.content.code as string).toUpperCase());
								reply = nteract.createMessage('execute_reply', {
									parent_header: message.header,
									content: {
										'status': 'ok',
										'execution_count': 0 //TODO
									}
								});
								break;

							default:
								break;
						}
					}
					else if (message.channel === 'iopub') {
						switch (message.header.msg_type) {
							case 'iopub':
								break;

							default:
								break;
						}
					}

					if (reply) {
						reply.header.session = kernelSessionId;
						reply.header.username = 'iris-jupyter-server';
						connection.socket.send(JSON.stringify(reply), { fin: true }, () => {
							console.log(` > Sent reply: ${JSON.stringify(reply)}`);
							sendStatus('idle');
						});
					}
					else {
						sendStatus('idle');
					}

				});
				return;
			}
		);
	}
}
