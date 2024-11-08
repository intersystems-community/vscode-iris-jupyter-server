import * as serverManager from '@intersystems-community/intersystems-servermanager';
import { AuthenticationSessionAccountInformation, Disposable } from 'vscode';

// Server Manager interfaces

export interface ISuperServerSpec {
	host?: string;
	port: number;
}

export interface IServerSpec extends serverManager.IServerSpec {
	superServer?: ISuperServerSpec;
}

export function getAccount(serverSpec: IServerSpec): AuthenticationSessionAccountInformation | undefined {
	const accountId = serverSpec.username ? `${serverSpec.name}/${serverSpec.username.toLowerCase()}` : undefined;
	return accountId ? { id: accountId, label: '' } : undefined;
}

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
