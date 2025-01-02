import { IServerSpec } from '@intersystems-community/intersystems-servermanager';
import { AuthenticationSessionAccountInformation, Disposable } from 'vscode';

var serverMap = new Map<string, IServerSpec>();

export class Server extends Disposable {

	private _key: string;

	static get(serverName: string): IServerSpec| undefined {
		return serverMap.get(serverName);
	}

	static set(serverName: string, serverSpec: IServerSpec): void {
		serverMap.set(serverName, serverSpec);
	}

	constructor(serverSpec: IServerSpec) {
		super(() => {
			serverMap.delete(this._key);
		});

		this._key = serverSpec.name;
		serverMap.set(serverSpec.name, serverSpec);
	}
}
