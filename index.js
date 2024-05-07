const { setTimeout } = require("node:timers/promises");
const archiveUrl = async (url) => {
	await fetch("https://web.archive.org/save", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
			Authorization: `LOW ${sb.Config.get("API_INTERNET_ARCHIVE_ACCESS_KEY")}:${sb.Config.get("API_INTERNET_ARCHIVE_SECRET_KEY")}`
		},
		body: new URLSearchParams({
			url,
			capture_screenshot: "on",
			if_not_archived_within: "7d",
			skip_first_archive: "on",
			delay_wb_availability: "on"
		}).toString()
	});
}

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

export const definition = {
	name: "web-archive-link-archiver",
	expression: "0 0 0 * * 1",
	description: "Archives all links found in the Origin and Suggestion tables via Internet Archive",
	code: (async function archiveTrainsTweets () {
		const originNotes = await core.Query.getRecordset(rs => rs
			.select("Notes")
			.from("data", "Origin")
			.where("Notes %*like* OR Notes %*like*", "http://", "https://")
			.flat("Notes")
		);
		const suggestionTexts = await core.Query.getRecordset(rs => rs
			.select("Text")
			.from("data", "Suggestion")
			.where("Text %*like* OR Text %*like*", "http://", "https://")
			.flat("Text")
		);

		const data = [
			...originNotes,
			...suggestionTexts,
		];

		const regex = /(https?:\/\/.+?)(\s|$)/g;
		for (const note of data) {
			for (const match of note.matchAll(regex)) {
				await archiveUrl(match[1]);
				await setTimeout(6000);
			}
		}
	})
};
