---
"@vercel/workflow-core": patch
---

allow to configure the server port. otherwise, a port exposed from the current pid will be used.

The configuration is done by using a stringified JSON in env vars.

In case the port is not assigned, we will try to grab the port from the pids,
and will choose the lowest exposed port, assuming random ports are in the 5-digit range--while the main server ports are usually in the 4-digit range like 3000.
