const { setTimeout } = require("node:timers/promises");
const { CronJob } = require("cron");
const archiveUrl = async (config, url) => {
	const accessKey = config.get("API_INTERNET_ARCHIVE_ACCESS_KEY");
	const secretKey = config.get("API_INTERNET_ARCHIVE_SECRET_KEY");

	const response = await fetch("https://web.archive.org/save", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
			Authorization: `LOW ${accessKey}:${secretKey}`
		},
		body: new URLSearchParams({
			url,
			if_not_archived_within: "5d",
			capture_screenshot: "on",
			skip_first_archive: "on",
			delay_wb_availability: "on"
		}).toString()
	});

	return await response.json();
}

require("./db-creds.js");

(async () => {
	const core = await import("supi-core");
	const Query = new core.Query({
		user: process.env.MARIA_USER,
		password: process.env.MARIA_PASSWORD,
		host: process.env.MARIA_HOST,
		connectionLimit: process.env.MARIA_CONNECTION_LIMIT
	});

	const configData = await Query.getRecordset(rs => rs
		.select("*")
		.from("data", "Config"));

	core.Config.load(configData);

	const job = new CronJob("0 0 0 * * 1", async () => {
		const done = new Set();
		const originNotes = await Query.getRecordset(rs => rs
			.select("Notes")
			.from("data", "Origin")
			.where("Notes %*like* OR Notes %*like*", "http://", "https://")
			.flat("Notes"));
		const suggestionTexts = await Query.getRecordset(rs => rs
			.select("Text")
			.from("data", "Suggestion")
			.where("Text %*like* OR Text %*like*", "http://", "https://")
			.flat("Text"));

		const data = [
			...originNotes,
			...suggestionTexts
		];

		const regex = /(https?:\/\/.+?)(\s|$)/g;
		for (const note of data) {
			for (const match of note.matchAll(regex)) {
				const link = match[1];
				if (done.has(link)) {
					continue;
				}

				try {
					const json = await archiveUrl(core.Config, match[1]);
					console.log("Result", match, json);
					done.add(link);
				}
				catch (e) {
					console.error("Couldn't archive", { match, e });
				}

				await setTimeout(60_000);
			}
		}
	});

	job.start();

	globalThis.job = { job };
})();
