# ipfs-search-benchmark
Collection of benchmarks for ipfs-search

## K6

### loadTest.js
Takes an API access log file, splits out all user actions per ip address, filters internal healthchecks, and recreates for one K6 VU the behaviour of that ip address, including time intervals.
Intervals are by default cut to 1s in case of long delays between user actions.

To run, use:
```
$ k6 run loadTest.js
```

#### typical flags:

create 1000 virtual users: `--vus 1000`

run for 60s: `--duration 60s`

#### environnment variables:

`PROTOCOL`: http or https, default `https`

`HOST`: host address of API, default: `api.ipfs-search.com`

`LOG_FILE`: path to log file. Default: `access.log`

`MAX_TIMEDIFF`: The maximum time (in seconds) between 2 calls of the same user. Default: 1
