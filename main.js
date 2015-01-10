var koa = require('koa');
var Slack = require('slack-node');
var async = require('async');
var GitHubApi = require("github");
var app = koa();

var apiToken = process.env.SLACK_API_TOKEN;
var githubApiToken = process.env.GITHUB_API_TOKEN;
var channel = process.env.SLACK_CHANNEL || "#general";

var repos = [
	'robinpowered/robin-dashboard',
	'jutaz/deploy'
];
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
		username: "Swolebot",
		link_names: 1,
		icon_url: "http://4.bp.blogspot.com/-9TT2oDIQ00k/TqVViEko4HI/AAAAAAAAADU/svUOHDxP6UM/s1600/T-rex-hates-push-ups.jpg"
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

getRepos(function (err, data) {
	var arr = [];
	data.forEach(function (items) {
		if (Array.isArray(items)) {
			arr = arr.concat(items);
		} else {
			arr.push(items);
		}
	});
	console.log(arr);
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
		postMessage("@channel: " + amount + " pushups!", function () {
			console.log("done!");
		});
	});
});

app.listen(process.env.PORT || 3000);
