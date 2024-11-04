/* eslint-disable @typescript-eslint/naming-convention */
import { FastifyInstance, FastifyRequest } from "fastify";
import * as FastifyWS from "@fastify/websocket";
import * as nteract from "@nteract/messaging";
import { ApiBase, IRequestGeneric } from "../api";
import { JupyterServerAPI } from "../jupyterServerAPI";
import { ServerNamespaceMgr } from "../serverNamespaceMgr";
import console = require("console");
import json5 = require("json5");
import { logChannel } from "../extension";

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

export class KernelsApi extends ApiBase {

	static addRoutes(fastify: FastifyInstance) {

		fastify.get('/:serverNamespace/api/kernels', (request: FastifyRequest<IRequestGeneric>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			const result = ServerNamespaceMgr.get(serverNamespace)?.allKernels() || [];
			//logChannel.debug(`/:serverNamespace/api/kernels GET - result: ${JSON.stringify(result)}`);
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

		fastify.get('/:serverNamespace/api/kernels/:kernelId', (request: FastifyRequest<IRequestKernel>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			const kernelId = request.params.kernelId;
			const kernel = ServerNamespaceMgr.get(serverNamespace)?.getKernel(kernelId);
			if (!kernel) {
				reply.code(404);
				return;
			}

			reply.code(200);
			return kernel;
		});

		fastify.delete('/:serverNamespace/api/kernels/:kernelId', (request: FastifyRequest<IRequestKernel>, reply) => {
			// TODO
			const serverNamespace = request.params.serverNamespace;
			const kernelId = request.params.kernelId;
			const kernel = ServerNamespaceMgr.get(serverNamespace)?.getKernel(kernelId);
			if (!kernel) {
				reply.code(404);
				return;
			}

			//TODO Delete
			reply.code(404);
			return;

			reply.code(204);
			return kernel;
		});

		fastify.post('/:serverNamespace/api/kernels/:kernelId/interrupt', (request: FastifyRequest<IRequestKernel>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			const kernelId = request.params.kernelId;
			logChannel.debug(`TODO - interrupt for kernelId '${kernelId}' on '${serverNamespace}'`);

			const process = ServerNamespaceMgr.get(serverNamespace)?.getProcess(kernelId);
			if (!process) {
				reply.code(404);
				return;
			}

			//TODO - Blocked by Node.js Native API not being async
			const jobNumber = process.connection.iris.classMethodValue('%SYSTEM.SYS', 'ProcessID');
			const result = process.connection.iris.classMethodValue('%SYSTEM.Process', 'Terminate', jobNumber);
			if (result === 1) {
				reply.code(204);
			}
			else {
				reply.code(404);
			}
			return;
		});

		fastify.post('/:serverNamespace/api/kernels/:kernelId/restart', (request: FastifyRequest<IRequestKernel>, reply) => {
			const serverNamespace = request.params.serverNamespace;
			const kernelId = request.params.kernelId;
			logChannel.debug(`TODO - restart for kernelId '${kernelId}' on '${serverNamespace}'`);

			const kernel = ServerNamespaceMgr.get(serverNamespace)?.getKernel(kernelId);
			if (!kernel) {
				reply.code(404);
				return;
			}

			const newKernelId = ServerNamespaceMgr.get(serverNamespace)?.restartKernel(kernelId);
			if (!newKernelId) {
				reply.code(404);
				return;
			}
			reply.code(200);
			return ServerNamespaceMgr.get(serverNamespace)?.getKernel(newKernelId);
		});

		// Websocket handler for /api/kernels/:kernelId/channels
		// Provides https://jupyter-client.readthedocs.io/en/stable/messaging.html as JSON over a websocket
		fastify.get('/:serverNamespace/api/kernels/:kernelId/channels',
			{ websocket: true },
			(socket: FastifyWS.WebSocket, request: FastifyRequest<IRequestChannels>) => {
				const serverNamespace = request.params.serverNamespace;
				const kernelId = request.params.kernelId;
				const clientSessionId = request.query.session_id;
				logChannel.debug(`WSget for kernelId '${kernelId}' channels on '${serverNamespace}'`);

				// Cutting a corner here. If we want to support kernel restart we will need to assign a dedicated uuid each time the process
				// servicing kernelId restarts, because the kernelId won't change but the session property of the header object within its messages must change.
				const kernelSessionId = kernelId;

				socket.on('message', (rawData: any) => {
					const rawBuffer = Buffer.from(rawData);
					// See https://jupyter-server.readthedocs.io/en/latest/developers/websocket-protocols.html#v1-kernel-websocket-jupyter-org-protocol
					const offsetCount = rawBuffer.readUInt32LE(0);
					const offsets: number[] = [];
					for (let i = 1; i <= offsetCount; i ++) {
						offsets.push(rawBuffer.readUInt32LE(i * 8));
					}
					const buffers: Buffer[] = [];
					for (let i = 5; i < (offsetCount - 1); i ++) {
						const start = offsets[i];
						const end = offsets[i + 1];
						buffers.push(rawBuffer.slice(start, end));
					}
					let messageObj: nteract.JupyterMessage = {
						channel: rawBuffer.toString('utf8', offsets[0], offsets[1]),
						header: JSON.parse(rawBuffer.toString('utf8', offsets[1], offsets[2])),
						parent_header: JSON.parse(rawBuffer.toString('utf8', offsets[2], offsets[3])),
						metadata: JSON.parse(rawBuffer.toString('utf8', offsets[3], offsets[4])),
						content: JSON.parse(rawBuffer.toString('utf8', offsets[4], offsets[5])),
						buffers
					};

					const sendMessage = (msg: nteract.JupyterMessage, newStatus?: string) => {
						const offsetCount = 5 + (msg.buffers?.length || 0);
						const offsetsBuffer = Buffer.alloc((offsetCount + 1) * 8);
						let offset = (offsetCount + 1) * 8;
						offsetsBuffer.writeUInt32LE(offsetCount + 1, 0);

						let chunkNumber = 0;
						let chunk = msg.channel;
						let outString = chunk;
						offset += Buffer.byteLength(chunk);
						offsetsBuffer.writeUInt32LE(offset, ++chunkNumber * 8);

						chunk = JSON.stringify(msg.header);
						outString += chunk;
						offset += Buffer.byteLength(chunk);
						offsetsBuffer.writeUInt32LE(offset, ++chunkNumber * 8);

						chunk = JSON.stringify(msg.parent_header);
						outString += chunk;
						offset += Buffer.byteLength(chunk);
						offsetsBuffer.writeUInt32LE(offset, ++chunkNumber * 8);

						chunk = JSON.stringify(msg.metadata);
						outString += chunk;
						offset += Buffer.byteLength(chunk);
						offsetsBuffer.writeUInt32LE(offset, ++chunkNumber * 8);

						chunk = JSON.stringify(msg.content);
						outString += chunk;
						offset += Buffer.byteLength(chunk);
						offsetsBuffer.writeUInt32LE(offset, ++chunkNumber * 8);

						for (const buffer of msg.buffers || []) {
							if (buffer instanceof ArrayBuffer) {
								outString += buffer;
								offset += buffer.byteLength;
							} else {
								outString += buffer.buffer;
								offset += buffer.buffer.byteLength;
							}
							offsetsBuffer.writeUInt32LE(offset, ++chunkNumber * 8);
						}

						socket.send(offsetsBuffer + outString, () => {
							logChannel.debug(` > kernel '${kernelId}' socket message sent, channel ${msg.channel}, type ${msg.header.msg_type}: ${JSON.stringify(msg)}`);
							if (newStatus) {
								sendStatus(newStatus);
							}
						});
					};

					const sendStatus = (status: string) => {
						const msg = nteract.createMessage('status', { parent_header: messageObj.header, content: { 'execution_state': status } });
						msg.header.session = kernelSessionId;
						msg.header.username = 'iris-jupyter-server';
						sendMessage(msg);
					};

					const sendResult = (output: string, executionCount: number) => {

						// Default output format is plain text
						const data = {'text/plain': output};

						// Special case for plotly output - see https://github.com/plotly/plotly.py/issues/4030
						// which gives us a Python string representation of the Figure object, not a true JSON one
						const rePlotly = /^\{'(application\/vnd\.plotly\.v1\+json)':(.+)\}/;
						const matchPlotly = output.match(rePlotly);
						if (matchPlotly) {
							let content = matchPlotly[2];

							// Make the Python string representation of booleans conform to JSON's
							content = content.replace(/': True/g, '\': true');
							content = content.replace(/': False/g, '\': false');

							// Leverage JSON5's acceptance of singlequotes to normalize to doublequotes
							content = JSON.stringify(json5.parse(content));

							// Add it
							Object.assign(data, {[matchPlotly[1]]: content});
						}
						else if (output.match(/^\{"/)) {
							// Looks like JSON
							// TODO: add example of Python library which produces this sort of output
							const fnProcess = (text: string) => {
								const jsonOutput = JSON.parse(text);

								// Add root objects that could be JSON-formatted strings
								Object.keys(jsonOutput)
								.filter((key) => key.endsWith('+json'))
								.forEach((key) => Object.assign(data, {[key]: jsonOutput[key]}));
							};
							try {
								fnProcess(output);
							} catch (error: any) {
								logChannel.debug(`Failed to parse output as JSON: ${error.message}`);
							}
						}
						const msg = nteract.createMessage('execute_result', {
							parent_header: messageObj.header,
							content: {
								execution_count: executionCount,
								data,
								metadata: {}
							}
						});
						msg.header.session = kernelSessionId;
						msg.header.username = 'iris-jupyter-server';
						sendMessage(msg);
					};

					const sendError = (text: string) => {
						const msg = nteract.createMessage('error', {
							parent_header: messageObj.header,
							content: {
								ename: 'errName (does this appear?)',
								evalue: 'error message (does this appear?)',
								// Can use colours in the traceback lines; see https://en.wikipedia.org/wiki/ANSI_escape_code#Colors for numbers
								traceback: [`\u001b[1;31m${text}\u001b[1;39m`]
							}
						});
						msg.header.session = kernelSessionId;
						msg.header.username = 'iris-jupyter-server';
						sendMessage(msg);
					};

					/*
					const broadcast = (msg: nteract.JupyterMessage) => {
						const originalChannel = msg.channel;
						msg.channel = 'iopub';
						sendMessage(msg);
						msg.channel = originalChannel;
					};
					*/

					logChannel.debug(` < kernel '${kernelId}' socket message received, channel ${messageObj.channel}, type ${messageObj.header.msg_type} message=${JSON.stringify(messageObj)}`);

					//sendStatus('busy');

					////broadcast(message);

					let reply: any;
					if (messageObj.channel === 'shell') {
						switch (messageObj.header.msg_type) {
							case 'kernel_info_request':
								reply = nteract.createMessage('kernel_info_reply', {
									parent_header: messageObj.header,
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

								const process = ServerNamespaceMgr.get(serverNamespace)?.getProcess(kernelId);
								const irisConn = process?.connection;
								if (!irisConn) {
									sendError('No connection');
									reply = nteract.createMessage('execute_reply', {
										parent_header: messageObj.header,
										content: {
											'status': 'error',
											'execution_count': 0
										}
									});
									break;
								}

								let language = 'cos';
								let code: string = messageObj.content.code;
								switch (process.name) {
									case 'iris-python':
										language = 'python';
										break;

									case 'iris-sql':
										language = 'sql';
										break;

									case 'iris-objectscript':
										language = 'cos';
										break;

									case 'iris-polyglot':
										const codeLines = code.split('\n');
										const magic = codeLines.shift()?.trim().toLowerCase();
										switch (magic) {
											case '%%python':
												language = 'python';
												code = codeLines.join('\n');
												break;

											case '%%sql':
												language = 'sql';
												code = codeLines.join('\n');
												break;

											case '%%objectscript':
												language = 'cos';
												code = codeLines.join('\n');
												break;

											default:
												language = 'cos';
												break;
										}
										break;

									default:
										break;
								}

								// stdin experiment (blocked by Node.js native interface not being async)
								/*
								if (message.content.allow_stdin) {
									const inputMsg = nteract.createMessage('input_request', {content: { prompt: 'Dummy input prompt triggered by stdin experiment', password: false}});
									inputMsg.header.session = kernelSessionId;
									inputMsg.header.username = 'iris-jupyter-server';
									inputMsg.parent_header = message.header;
									sendMessage(inputMsg);
								}
								*/

								const result = JSON.parse(irisConn.iris.classMethodValue('PolyglotKernel.CodeExecutor', 'CodeResult', code, language));

								if (!result.status) {
									sendError(result.out);
									reply = nteract.createMessage('execute_reply', {
										parent_header: messageObj.header,
										content: {
											status: 'error',
											execution_count: ++process.executionCount
										}
									});
									break;
								}

								sendResult(result.out, ++process.executionCount);
								reply = nteract.createMessage('execute_reply', {
									parent_header: messageObj.header,
									content: {
										status: 'ok',
										execution_count:  process.executionCount
									}
								});
								break;

							case 'complete_request':
								//TODO if we can and want to
								break;

							default:
								break;
						}
					}
					else if (messageObj.channel === 'control') {
						// Either the Jupyter extension doesn't use the control channel yet (December 2022),
						// or we don't get these messages because the nteract messaging package we use implements too early a version of
						// the Jupyter Messaging API.
						switch (messageObj.header.msg_type) {
							case 'shutdown_request':
								break;

							case 'interrupt_request':
								break;

							default:
								break;
						}
					}
					else if (messageObj.channel === 'iopub') {
						switch (messageObj.header.msg_type) {
							case 'iopub':
								break;

							default:
								break;
						}
					}
					else if (messageObj.channel === 'stdin') {
						switch (messageObj.header.msg_type) {
							case 'input_reply':
								break;

							default:
								break;
						}
					}

					if (reply) {
						reply.header.session = kernelSessionId;
						reply.header.username = 'iris-jupyter-server';
						//sendMessage(reply, 'idle');
					}
					else {
						//sendStatus('idle');
					}

				});

				socket.on('error', (error) => {
					logChannel.debug(`WSget for kernelId '${kernelId}' channels on '${serverNamespace}' error: ${JSON.stringify(error)}`);
				});
				return;
			}
		);
	}
}
