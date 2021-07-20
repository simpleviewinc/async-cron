# async-cron
Simple cron job runner for Node that handles async functions and uses a `Mutex` that keeps the same job from running more than once simultaneously.

# Installation

```
npm install @simpleview/async-cron
```

# Example

```js
const { Job } = require("@simpleview/async-cron");

const job = new Job({
	schedule : "*/5 * * * * *"
}, async function() {
	const results = await doSomething();
	return someResult;
});

// Required: Handle errors, or they will be black-holed resulting in not knowing that your crons are failing
job.on("error", function(e) {
	console.log("Cron Error", e);
});

// Not required: if you care about the returned result from a cronJob, you can do something with it here
job.on("result", function(result) {
	
});

// Starts the job running the background
job.start();
```

## Error Handling

If your job errors, the error will be blackholed unless you subscribe to the error handler.

```js
job.on("error", function(e) {
	// do something with the error
});
```

If you want to differentiate errors from the job running from code errors, you can check the error `code`.

```js
const { Job, E_RUNNING } = require("@simpleview/async-cron");

const job = new Job(...args...);

job.on("error", function(e) {
	if (e.code === E_RUNNING) {
		console.log("Still running!");
	} else {
		console.log("An actual code problem!");
	}
});
```

# Package API

## Job

`Job` represents a single cron job.

* args
	* schedule - `string` - The schedule in [cron-parser](https://www.npmjs.com/package/cron-parser) syntax.
* fn - `function` or `async function` - The function that will execute your job. It should either run fully synchronously, or be an async method/promise-based method. Do not utilize callbacks here, or else the async locking mechanism will not function properly. When this function returns, the job must be complete.

### Job.start()

Starts the job running in the background.

### Job.stop()

Stops the job. This will not halt functions that are currently executing at this very moment, but it will present new runs from queuing up.

### Job.run()

Manually executes the job. If the job errors, then this will throw, this includes throwing if the job is currently executing.

```js
const result = await job.run();
```

### Job.isRunning()

Check if the job is currently running.

```js
const isRunning = job.isRunning();
```

## E_RUNNING

Symbol reference for `error.code` when an `Error` is thrown due to an a job already running. See error handling.