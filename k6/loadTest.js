/*
K6 load test script for api.ipfs-search.com

See https://k6.io/docs/get-started/installation/ for setup of k6

To run, use:
$ k6 run loadTest.js

typical flags:
create 1000 virtual users:
--vus 1000

run for 60s:
--duration 60s

environnment variables:
K6_VUS: # of virtual users, default 1, alternative for --vus flag
K6_DURATION: script running duration, default '10s', alterative for --duration flag
PROTOCOL: http or https, default https
HOST: host address of API, default 'api.ipfs-search.com'
LOG_FILE: log file to take paths from. Default: 'paths.txt'

 */


// init context: importing modules
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';

const PROTOCOL = __ENV.PROTOCOL || 'https'
const API_URL = __ENV.HOST || 'api.ipfs-search.com'
const LOG_FILE= __ENV.LOG_FILE || 'access.log'
const MAX_TIMEDIFF = __ENV.MAX_TIMEDIFF || 2 // s

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
let previousTimestamp;
const users = logLines.reduce((users, line) => {
	const timeDiff = previousTimestamp ? line.timestamp - previousTimestamp : 0;
	previousTimestamp = line.timestamp;
	// For some reason k6 does not recognize object spread operator ...
	let data = { timeDiff };
	Object.assign(data, line)
	if(users[line.uid]) {
		users[line.uid].push(data);
	}
	else {
		// timeDiff should be set to 0 here
		users[line.uid] = [data];
	}
	return users;
}, {})

// setup context
// export function setup() {
// }

// VU context
export default function(data) {
	const userArray = Object.keys(users);
	const userCalls = users[userArray[Math.floor(Math.random() * userArray.length)]]
	console.log(userCalls[0].uid)
	for(const call of userCalls) {
		sleep(Math.min(call.timeDiff / 1000, MAX_TIMEDIFF))
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


export function teardown(data) {
}
