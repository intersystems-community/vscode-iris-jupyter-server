import { Disposable } from "vscode";
import { IProcess, ITarget } from "./api";
import { JupyterServerAPI } from "./jupyterServerAPI";
import { v4 as uuid } from 'uuid';
import { IRISConnection } from "./iris";

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
	private _augmentedKernelMap = new Map<string, IProcess>();
	private _sessionMap = new Map<string, JupyterServerAPI.ISession>();

	public target: ITarget;

	allKernels(): JupyterServerAPI.IKernel[] {
		return Array.from<JupyterServerAPI.IKernel>(this._augmentedKernelMap.values());
	}

	getKernel(id: string): JupyterServerAPI.IKernel | undefined {
		return this._augmentedKernelMap.get(id);
	}

	getProcess(id: string): IProcess | undefined {
		return this._augmentedKernelMap.get(id);
	}

	allSessions(): JupyterServerAPI.ISession[] {
		return Array.from(this._sessionMap.values());
	}

	getSession(name: string): JupyterServerAPI.ISession | undefined {
		return this._sessionMap.get(name);
	}

	createSession(session: JupyterServerAPI.ISession, connection:IRISConnection): JupyterServerAPI.ISession {
		console.log(`ServerNamespaceMgr: create '${session.type}' type session with name '${session.name}' for path '${session.path}' with a '${session.kernel.name}' kernel`);

		session.id = uuid();
		session.kernel.id = uuid();
		session.kernel.connections = 1;
		session.kernel.execution_state = 'idle';

		this._sessionMap.set(session.name, session);
		this._augmentedKernelMap.set(session.kernel.id, { ...session.kernel, connection, sessionName: session.name, executionCount: 0 });
		return session;
	}

	restartKernel(kernelId: string): string {
		console.log(`ServerNamespaceMgr: restart kernel ${kernelId}`);

		const process = this._augmentedKernelMap.get(kernelId);
		if (!process) {
			return '';
		}

		process.connection.dispose();
		process.connection = new IRISConnection(this.target);

		const sessionName = process.sessionName;
		if (!sessionName) {
			return '';
		}

		const session = this._sessionMap.get(sessionName);
		if (!session) {
			return '';
		}
		session.kernel.connections = 1;
		session.kernel.execution_state = 'idle';
		process.executionCount = 0;

		return kernelId;
	}

	constructor(serverNamespace: string, target: ITarget) {
		super(() => {
			serverNamespaceMgrMap.delete(this._key);
			this._augmentedKernelMap.forEach((process) => {
				process.connection.dispose();
			});
		});
		this._key = serverNamespace;
		this.target = target;
		serverNamespaceMgrMap.set(this._key, this);
	}
}
