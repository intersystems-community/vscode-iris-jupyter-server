// Derived from
//  https://github.com/intersystems-community/intersystems-servermanager/blob/3e1fdbf66f40111767eb7b4ab8be42656187a7b9/src/makeRESTRequest.ts

import axios, { AxiosResponse } from "axios";
import axiosCookieJarSupport from "axios-cookiejar-support";
import * as https from "https";
import tough = require("tough-cookie");
import * as vscode from "vscode";
import { IServerSpec } from "@intersystems-community/intersystems-servermanager";
import { logChannel } from "./extension";

axiosCookieJarSupport(axios);

interface IServerSession {
	serverName: string;
	username: string;
	cookieJar: tough.CookieJar;
}

export const serverRESTSessions = new Map<string, IServerSession>();

interface IAtelierRESTEndpoint {
	apiVersion: number;
	namespace: string;
	path: string;
}

/**
 * Make a REST request to an InterSystems server.
 *
 * @param method The REST method.
 * @param server The server to send the request to.
 * @param endpoint Optional endpoint object. If omitted the request will be to /api/atelier/
 * @param data Optional request data. Usually passed for POST requests.
 */
export async function makeRESTRequest(
	method: "HEAD" | "GET" | "PUT" | "POST",
	server: IServerSpec,
	endpoint?: IAtelierRESTEndpoint,
	data?: any,
): Promise<AxiosResponse | undefined> {

	// Create the HTTPS agent
	const httpsAgent = new https.Agent({ rejectUnauthorized: vscode.workspace.getConfiguration("http").get("proxyStrictSSL") });

	let cookieJar = serverRESTSessions.get(server.name)?.cookieJar;
	if (!cookieJar) {
		cookieJar = new tough.CookieJar();
	}

	// Build the URL
	let url = server.webServer.scheme + "://" + server.webServer.host + ":" + String(server.webServer.port);
	const pathPrefix = server.webServer.pathPrefix;
	if (pathPrefix && pathPrefix !== "") {
		url += pathPrefix;
	}
	url += "/api/atelier/";
	if (endpoint) {
		url += "v" + String(endpoint.apiVersion) + "/" + endpoint.namespace + endpoint.path;
	}

	// Make the request
	try {
		let respdata: AxiosResponse;
		if (data !== undefined) {
			// There is a data payload
			respdata = await axios.request(
				{
					httpsAgent,
					data,
					headers: {
						"Content-Type": "application/json",
					},
					jar: cookieJar,
					method,
					url: encodeURI(url),
					validateStatus: (status) => {
						return status < 500;
					},
					withCredentials: true,
				},
			);
			if (respdata.status === 401) {
				if (typeof server.username !== "undefined" && typeof server.password !== "undefined") {
					// Either we had no cookies or they expired, so resend the request with basic auth
					respdata = await axios.request(
						{
							httpsAgent,
							auth: {
								password: server.password,
								username: server.username,
							},
							data,
							headers: {
								"Content-Type": "application/json",
							},
							jar: cookieJar,
							method,
							url: encodeURI(url),
							withCredentials: true,
						},
					);
				}
			}
		} else {
			// No data payload
			respdata = await axios.request(
				{
					httpsAgent,
					jar: cookieJar,
					method,
					url: encodeURI(url),
					validateStatus: (status) => {
						return status < 500;
					},
					withCredentials: true,
				},
			);
			if (respdata.status === 401) {
				if (typeof server.username !== "undefined" && typeof server.password !== "undefined") {
					// Either we had no cookies or they expired, so resend the request with basic auth
					respdata = await axios.request(
						{
							httpsAgent,
							auth: {
								password: server.password,
								username: server.username,
							},
							jar: cookieJar,
							method,
							url: encodeURI(url),
							withCredentials: true,
						},
					);
				}
			}
		}

		// Only store the session for a serverName the first time because subsequent requests to a server with no username defined must not lose initially-recorded username
		if (!serverRESTSessions.get(server.name)) {
			serverRESTSessions.set(server.name, { serverName: server.name, username: server.username || '', cookieJar });
		}
		return respdata;
	} catch (error) {
		logChannel.error(error as Error);
		return undefined;
	}
}

/**
 * Attempt to log out of our session on an InterSystems server.
 *
 * @param server The spec of the server to send the request to.
 */
export async function logoutREST(server: IServerSpec) {

	const cookieJar = serverRESTSessions.get(server.name)?.cookieJar;
	if (!cookieJar) {
		return;
	}

	// Create the HTTPS agent
	const httpsAgent = new https.Agent({ rejectUnauthorized: vscode.workspace.getConfiguration("http").get("proxyStrictSSL") });

	// Build the URL
	let url = server.webServer.scheme + "://" + server.webServer.host + ":" + String(server.webServer.port);
	const pathPrefix = server.webServer.pathPrefix;
	if (pathPrefix && pathPrefix !== "") {
		url += pathPrefix;
	}
	url += "/api/atelier/?CacheLogout=end";

	// Make the request but don't do anything with the response or any errors
	try {
		await axios.request(
			{
				httpsAgent,
				jar: cookieJar,
				method: "HEAD",
				url: encodeURI(url),
				validateStatus: (status) => {
					return status < 500;
				},
				withCredentials: true,
			},
		);
	} catch (error) {
		logChannel.error(error as Error);
	}
	serverRESTSessions.delete(server.name);
}
