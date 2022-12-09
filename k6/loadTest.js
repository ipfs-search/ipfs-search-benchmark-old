/*
K6 load test script for api.ipfs-search.com

See https://k6.io/docs/get-started/installation/ for setup of k6
 */

// init context: importing modules
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const PROTOCOL = __ENV.PROTOCOL || 'https'
const API_URL = __ENV.HOST || 'api.ipfs-search.com'
const LOG_FILE= __ENV.LOG_FILE || 'access.log'
const MAX_TIMEDIFF = __ENV.MAX_TIMEDIFF || 1 // s

// init context: define k6 options
export const options = {
	vus: 1,
	duration: '10s',
	thresholds: {
		http_req_failed: ['rate<0.01'], // http errors should be less than 1%
		http_req_duration: ['avg < 150', 'p(90) < 200', 'p(95) < 500', 'p(99) < 1000'],
	},
};

// init context: global variables
// logLines: process log lines into array of objects containing info like path, timecode, time Diff
const logLines = SharedArray('test paths', () => {
	const logFileContents = open(LOG_FILE);
	return logFileContents.split(/\r?\n/)
		.filter((line) => {
			const pass = (
				line
				&& !line.includes('/v1/nsfw/classify') && line.includes('GET')
				// caution must be take for log lines with malformed data (such as hack attempts)
				&& (line.includes('https://ipfs-search.com/')
					|| line.includes('http://ipfs-search.com.ipns.localhost:8080/'))
			)
			return pass
		})
		.map((line, index) => {
			// should be improved by using a regex matcher or something else that parses log lines
			// because the access logs have a layout reliant on brackets and quotes, not on spaces
			const splitLine = line.split(' ')
			// Times are logged in the 4th field like this: '[10/Oct/2022:07:13:49'
			// the opening square bracket and the first colon throw off the date parser
			const timestamp = splitLine[3].replace(':', ' ').slice(1)
			return {
				uid: splitLine[0],
				timestamp,
				path: splitLine[6],
				statusCode: splitLine[8],
				referer: splitLine[10].slice(1, splitLine[10].length - 1),
			}
		})
})

// generate a dictionary of chronological arrays of loglines per user ID
const users = logLines.reduce((users, line) => {
	if(users[line.uid]) {
		const previousTimestamp = users[line.uid][users[line.uid].length - 1].timestamp;
		const timeDiff = previousTimestamp ? line.timestamp - previousTimestamp : 0;
		let data = { timeDiff };
		// k6 does not recognize object spread operator ...
		Object.assign(data, line)
		users[line.uid].push(data);
	}
	else {
		users[line.uid] = [line];
	}
	return users;
}, {})

// Force the users in a fixed order array and map to array of arrays of actions.
// Order is based on the users' first timestamp.
const userLogs = SharedArray('user logs', () => {
	return Object.values(users).sort((v1, v2) => {
		return v1[0].timestamp - v2[0].timestamp;
	});
})

let userIndex = 0;

// Setup context
// export function setup() {
// }

// Teardown context
// export function teardown(data) {
// }

// VU context
export default function(data) {
	const userCalls = userLogs[userIndex % userLogs.length]
	userIndex++;
	console.log(exec.scenario.iterationInTest, userCalls[0].uid)
	for(const call of userCalls) {
		if(call.timeDiff) sleep(Math.min(call.timeDiff / 1000, MAX_TIMEDIFF))
		const res = http.get(`${PROTOCOL}://${API_URL}${call.path}`, {
			tags: {
				type: call.path.includes('metadata') ? 'metadata' : 'search',
			}
		});
		check(res, {
			'is status 200': (r) => r.status === 200,
		});
	}
}
