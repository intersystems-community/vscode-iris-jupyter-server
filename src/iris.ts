import { Disposable } from 'vscode';
import { ITarget } from './api';
import { logChannel } from './extension';
const irisNative = require('../intersystems-iris-native');

export class IRISConnection extends Disposable{
	public connection: any;
	public iris: any;
	constructor(target: ITarget) {
		super(() => {
			logChannel.debug(`IRISConnection disposed`);
			this.connection?.close();
		});
		const connectionInfo = {
			host: target.serverSpec?.superServer?.host ?? target.serverSpec?.webServer.host,
			port: target.serverSpec?.superServer?.port,
			ns: target.namespace,
			user: target.serverSpec?.username,
			pwd: target.serverSpec?.password,
			sharedmemory: false,
			timeout: 2000
		};

		this.connection = irisNative.createConnection(connectionInfo);

		if (this.connection) {
			this.iris = this.connection.createIris();
		}

		if (this.iris) {
			try {
				const initObject = JSON.parse(this.iris.classMethodValue('PolyglotKernel.CodeExecutor', 'Init'));
				logChannel.debug(`IRISConnection Init: ${JSON.stringify(initObject)}`);
			} catch (error) {
				logChannel.debug(`IRISConnection Init failed: ${error}`);
			}
		}
	}
}
