# ipfs-search-benchmark
Collection of benchmarks for ipfs-search

## filter log files:
with an access.log file of the api, run the following to generate a paths file for the test:

```
grep "https://ipfs-search.com/" access.log | cut -d ' ' -f 7 > paths.txt
```
