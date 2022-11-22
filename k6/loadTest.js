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
const LOG_FILE=__ENV.LOG_FILE || 'paths.txt'

// init context: global variables
const testPaths = SharedArray('test paths', () => {
	const logFileContents = open(LOG_FILE);
	return logFileContents.split(/\r?\n/)
})

// init context: define k6 options
export const options = {
	vus: 1,
	duration: '10s',
	thresholds: {
		http_req_failed: ['rate<0.01'], // http errors should be less than 1%
		http_req_duration: ['avg < 150', 'p(90) < 200', 'p(95) < 500', 'p(99) < 1000'],
	},
};

let line = 0;

export function setup() {
}

export default function(data) {
	const path = testPaths[line++]
	if(line = testPaths.length - 1) line = 0;
	console.log(path)
	const res = http.get(`${PROTOCOL}://${API_URL}${path}`, {
		tags: {
			type: path.includes('metadata') ? 'metadata' : 'search',
		}
	});
	check(res, {
		'is status 200': (r) => r.status === 200,
	});
	sleep(1)
}


export function teardown(data) {
}
