/* eslint-disable @typescript-eslint/naming-convention */
// Derived from
//  https://github.com/intersystems-community/intersystems-servermanager/blob/3e1fdbf66f40111767eb7b4ab8be42656187a7b9/src/makeRESTRequest.ts

import axios, { AxiosResponse } from "axios";
import * as https from "https";
import * as vscode from "vscode";
import { IServerSpec } from "@intersystems-community/intersystems-servermanager";
import { logChannel } from "./extension";


interface IServerSession {
	serverName: string;
	username: string;
	cookies: string[];
}

export const serverRESTSessions = new Map<string, IServerSession>();

interface IAtelierRESTEndpoint {
	apiVersion: number;
	namespace: string;
	path: string;
}

function updateCookies(oldCookies: string[], newCookies: string[]): string[] {
	newCookies.forEach((cookie) => {
		const [cookieName] = cookie.split("=");
		const index = oldCookies.findIndex((el) => el.startsWith(cookieName));
		if (index >= 0) {
			oldCookies[index] = cookie;
		} else {
			oldCookies.push(cookie);
		}
	});
	return oldCookies;
}

function getCookies(server: IServerSpec): string[] {
	return serverRESTSessions.get(server.name)?.cookies ?? [];
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

	// Get the cookies
	let cookies: string[] = getCookies(server);

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
						"Cookie": cookies.join(" ")
					},
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
					method,
					headers: {
						"Cookie": cookies.join(" ")
					},
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
							method,
							url: encodeURI(url),
							withCredentials: true,
						},
					);
				}
			}
		}

		cookies = updateCookies(cookies, respdata.headers['set-cookie'] || []);

		// Only store the session for a serverName the first time because subsequent requests
		// to a server with no username defined must not lose initially-recorded username
		const session = serverRESTSessions.get(server.name);
		if (!session) {
			serverRESTSessions.set(server.name, { serverName: server.name, username: server.username || '', cookies });
		} else {
			serverRESTSessions.set(server.name, { ...session, cookies });
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

	if (!serverRESTSessions.get(server.name)) {
		return;
	}

	// Create the HTTPS agent
	const httpsAgent = new https.Agent({ rejectUnauthorized: vscode.workspace.getConfiguration("http").get("proxyStrictSSL") });

	// Get the cookies
	let cookies: string[] = getCookies(server);

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
				method: "HEAD",
				headers: {
					"Cookie": cookies.join(" ")
				},
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
