import { Disposable } from "vscode";
import { ITarget } from "./api";
import { JupyterServerAPI } from "./jupyterServerAPI";
import { v4 as uuid } from 'uuid';

var serverNamespaceMgrMap = new Map<string, ServerNamespaceMgr>();

export class ServerNamespaceMgr extends Disposable {

	static get(serverNamespace: string): ServerNamespaceMgr | undefined {
		return serverNamespaceMgrMap.get(serverNamespace);
	}

	static all(): ServerNamespaceMgr[] {
		return Array.from(serverNamespaceMgrMap.values());
	}

	static allKeys(): string[] {
		return Array.from(serverNamespaceMgrMap.keys());
	}

	private _key: string;
	private _kernelMap = new Map<string, JupyterServerAPI.IKernel>();
	private _sessionMap = new Map<string, JupyterServerAPI.ISession>();

	public target: ITarget;

	allKernels(): JupyterServerAPI.IKernel[] {
		return Array.from(this._kernelMap.values());
	}

	getKernel(id: string): JupyterServerAPI.IKernel | undefined {
		return this._kernelMap.get(id);
	}

	allSessions(): JupyterServerAPI.ISession[] {
		return Array.from(this._sessionMap.values());
	}

	getSession(name: string): JupyterServerAPI.ISession | undefined {
		return this._sessionMap.get(name);
	}

	createSession(session: JupyterServerAPI.ISession): JupyterServerAPI.ISession {
		console.log(`TODO@ServerNamespaceMgr: create '${session.type}' type session with name '${session.name}' for path '${session.path}' with a '${session.kernel.name}' kernel`);
		//session.id = uuid();
		session.id = session.name;
		session.kernel.id = session.id;
		session.kernel.connections = 0;
		session.kernel.execution_state = 'idle';

		/*
		session.kernel.info = {
			'status': 'ok',
			'implementation': 'iris-jupyter-server',
			'implementation_version': '0.0.1',
			'language_info': {
				'name': 'iris-polyglot',
				'version': '0.0.1'
			},
			'banner': '(a fake kernel banner)'
		};
		*/

		this._sessionMap.set(session.name, session);
		this._kernelMap.set(session.kernel.id, session.kernel);
		return session;
	}

	constructor(serverNamespace: string, target: ITarget) {
		super(() => {
			serverNamespaceMgrMap.delete(this._key);
		});
		this._key = serverNamespace;
		this.target = target;
		serverNamespaceMgrMap.set(this._key, this);
	}
}
