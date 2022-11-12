
// Our version of Jupyter Server API types
export namespace JupyterServerAPI {

	export interface IKernel {
		name: string,
		id?: string,
		lastActivity?: string,
		connections?: number,
		executionState?: string
	}

	export interface ISession {
		id: string,
		name: string,
		type: string,
		path: string,
		kernel: IKernel,
	}
}
