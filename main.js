var Slack = require('slack-node');
var async = require('async');
var GitHubApi = require("github");
var CronJob = require('cron').CronJob;
var format = require('util').format;
var q = require('q');

var apiToken = process.env.SLACK_API_TOKEN;
var githubApiToken = process.env.GITHUB_API_TOKEN;
var channel = process.env.SLACK_CHANNEL || "#general";
var slackIcon = process.env.SLACK_ICON || "http://4.bp.blogspot.com/-9TT2oDIQ00k/TqVViEko4HI/AAAAAAAAADU/svUOHDxP6UM/s1600/T-rex-hates-push-ups.jpg";
var slackUsername = process.env.SLACK_USERNAME || "Swolebot";
var messageTemplate = "@channel: %s pushups!";
var ratio = process.env.RATIO || 2;
var hours = (typeof process.env.HOURS !== 'undefined') ? process.env.HOURS.split(',') : [11, 14, 17];
var timezone = process.env.TIMEZONE || "America/New_York";
var runInWeekends = (process.env.WEEKENDS) || false;
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

function postMessage(message, callback) {
	return q.ninvoke(slack, 'api', "chat.postMessage", {
		channel: channel,
		text: message,
		username: slackUsername,
		link_names: 1,
		icon_url: slackIcon
	});
}

function githubCall(isOrg, user, prev, page) {
	var params = {
		per_page: 100,
		type: isOrg ? 'member' : 'owner',
		page: page
	};
	if (isOrg) {
		params.org = user;
	} else {
		params.user = user;
	}
	if (!prev) {
		prev = [];
		page = 0;
	}
	return q.ninvoke(github.repos, (isOrg) ? 'getFromOrg' : 'getFromUser', params).then(function (data) {
		var repos = data.map(function (repo) {
			return repo.full_name;
		});
		if (repos.length === 100) { // Assume we go to next page
			page = ++page;
			return githubCall(isOrg, user, prev.concat(repos), page);
		}
		return prev.concat(repos);
	});
}

function getPRs(user, repo, callback) {
	return q.ninvoke(github.pullRequests, 'getAll', {
		user: user,
		repo: repo,
		state: 'open',
		per_page: 100
	}).then(function (data) {
		return data.length;
	});
}

function isOrg(username, callback) {
	return q.ninvoke(github.user, 'getFrom', {
		user: username
	}).then(function (data) {
		return (data.type === 'Organization');
	});
}

function getRepos() {
	return q.ninvoke(async, 'map', repos, function (repo, cb) {
		if (repo.indexOf('/') > -1) {
			return cb(null, repo);
		}
		return isOrg(repo).then(function (isOrg) {
			return githubCall(isOrg, repo);
		}).then(cb.bind(cb, null));
	});
}

function run() {
	console.log('Started!');
	getRepos().then(function (data) {
		var arr = [];
		data.forEach(function (items) {
			if (Array.isArray(items)) {
				arr = arr.concat(items);
			} else {
				arr.push(items);
			}
		});
		// We want to make sure, that we will make no more pushups than we 'want'
		return arr.filter(function(item, pos) {
			return arr.indexOf(item) === pos && arr.lastIndexOf(item) === pos;
		});
	}).then(function (arr) {
		return q.ninvoke(async, 'map', arr, function (data, callback) {
			var str = data.split('/');
			getPRs(str[0], str[1]).then(function (nums) {
				callback(null, nums);
			});
		});
	}).then(function (data) {
		var amount = 0;
		data.forEach(function (num) {
			amount += num;
		});
		amount = amount * ratio;
		return postMessage(format(messageTemplate, amount));
	}).then(function () {
		console.log("Done!");
	}).catch(function (err) {
		console.error(err);
	});
}

// Start the timer!
hours.forEach(function (hour) {
	new CronJob({
		cronTime: '00 00 ' + hour + ' * * ' + ((runInWeekends) ? '*' : '1-5'),
		onTick: run,
		start: true,
		timeZone: timezone
	});
});
