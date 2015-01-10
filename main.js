var koa = require('koa');
var Slack = require('slack-node');
var async = require('async');
var GitHubApi = require("github");
var CronJob = require('cron').CronJob;
var format = require('util').format;
var app = koa();

var apiToken = process.env.SLACK_API_TOKEN;
var githubApiToken = process.env.GITHUB_API_TOKEN;
var channel = process.env.SLACK_CHANNEL || "#general";
var slackIcon = process.env.SLACK_ICON || "http://4.bp.blogspot.com/-9TT2oDIQ00k/TqVViEko4HI/AAAAAAAAADU/svUOHDxP6UM/s1600/T-rex-hates-push-ups.jpg";
var slackUsername = process.env.SLACK_USERNAME || "Swolebot";
var messageTemplate = "@channel: %s pushups!";
var ratio = process.env.RATIO || 2;
var hours = (typeof process.env.HOURS !== undefined) ? process.env.HOURS.split(',') : [11, 14, 20];
var timezone = process.env.TIMEZONE || "America/New_York";
var repos;

if (process.env.REPOS) {
	repos = process.env.REPOS.split(',');
} else {
	repos = []; // You may want to define repos here also.
}

var slack = new Slack(apiToken);
var github = new GitHubApi({
	version: "3.0.0",
	debug: false,
	protocol: "https"
});

github.authenticate({
	type: "oauth",
	token: githubApiToken
});

app.use(function *(){
	this.body = 'Its alive!';
});

function postMessage(message, callback) {
	slack.api("chat.postMessage", {
		channel: channel,
		text: message,
		username: slackUsername,
		link_names: 1,
		icon_url: slackIcon
	}, callback);
}

function githubCall(user, cb, prev, page) {
	github.repos.getFromUser({
		user: user,
		per_page: 100,
		type: 'owner',
		page: page
	}, function (err, data) {
		var repos = data.map(function (repo) {
			return repo.full_name;
		});
		if (prev) {
			repos = prev.concat(repos);
		}
		if (repos.length === 100) { // Assume we go to next page
			if (!page) {
				page = 0;
			}
			githubCall(user, cb, repos, page++);
			return;
		}
		cb(null, repos);
	});
}

function getPRs(user, repo, callback) {
	github.pullRequests.getAll({
		user: user,
		repo: repo,
		state: 'open',
		per_page: 100
	}, function (err, data) {
		callback(data.length);
	});
}

function getRepos(callback) {
	var ret = [];

	async.map(repos, function (repo, cb) {
		if (repo.indexOf('/') > -1) {
			cb(null, repo);
		} else {
			githubCall(repo, cb);
		}
	}, callback);
}

hours.forEach(function (hour) {//1-5
	job = new CronJob({
		cronTime: '00 05 ' + hour + ' * * *',
		onTick: run,
		start: false,
		timeZone: timezone
	});
	job.start();
});

function run() {
	console.log('started');
	getRepos(function (err, data) {
		var arr = [];
		data.forEach(function (items) {
			if (Array.isArray(items)) {
				arr = arr.concat(items);
			} else {
				arr.push(items);
			}
		});
		async.map(arr, function (data, callback) {
			var str = data.split('/');
			getPRs(str[0], str[1], function (nums) {
				callback(null, nums);
			});
		}, function (err, data) {
			var amount = 0;
			data.forEach(function (num) {
				amount += num;
			});
			amount = amount * ratio;
			postMessage(format(messageTemplate, amount), function () {
				console.log("Done!");
			});
		});
	});
}

app.listen(process.env.PORT || 3000);
