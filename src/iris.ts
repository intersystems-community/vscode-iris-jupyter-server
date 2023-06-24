import { Disposable } from 'vscode';
import { ITarget } from './api';
import { logChannel } from './extension';
const irisNative = require('../intersystems-iris-native');

export class IRISConnection extends Disposable{
	public connection: any;
	public iris: any;
	public initObject: any;
	constructor(target: ITarget) {
		super(() => {
			logChannel.trace(`IRISConnection disposed`);
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
				this.initObject = JSON.parse(this.iris.classMethodValue('PolyglotKernel.CodeExecutor', 'Init'));
				logChannel.trace(`IRISConnection Init: ${JSON.stringify(this.initObject)}`);
			} catch (error) {
				logChannel.trace(`IRISConnection Init failed: ${error}`);
			}
		}
	}
}
