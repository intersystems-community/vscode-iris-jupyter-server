
// Our version of Jupyter Server API types
export namespace JupyterServerAPI {

	export interface IKernel {
		name: string,
		id?: string,
		last_activity?: string,
		connections?: number,
		execution_state?: string,

		//info: any
	}

	export interface ISession {
		id: string,
		name: string,
		type: string,
		path: string,
		kernel: IKernel,
	}
}
