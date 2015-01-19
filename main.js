var Slack = require('slack-node');
var async = require('async');
var GitHubApi = require("github");
var pluralize = require('pluralize');
var moment = require('moment');
var CronJob = require('cron').CronJob;
var format = require('util').format;
var q = require('q');

var apiToken = process.env.SLACK_API_TOKEN;
var githubApiToken = process.env.GITHUB_API_TOKEN;
var channel = process.env.SLACK_CHANNEL || "#general";
var slackIcon = process.env.SLACK_ICON || "http://4.bp.blogspot.com/-9TT2oDIQ00k/TqVViEko4HI/AAAAAAAAADU/svUOHDxP6UM/s1600/T-rex-hates-push-ups.jpg";
var slackUsername = process.env.SLACK_USERNAME || "Swolebot";
var messageTemplate = "@channel: %s! %s";
var ratio = process.env.RATIO || 1;
var hours = (typeof process.env.HOURS !== 'undefined') ? process.env.HOURS.split(',') : [11, 14, 17];
var timezone = process.env.TIMEZONE || "America/New_York";
var runInWeekends = (process.env.WEEKENDS) || false;
var repos, exercises;

var funMessages = [
	'Keep Pumping!',
	ucFirst(slackUsername) + ' :heart: you.',
	'Karma++.',
	'Just a few to go.',
	'Muscles++',
	'Sweat away those pounds.',
	'Do you like me?',
	'`undefined is not a function`.',
	'Abort, Retry, Fail?',
	'Kernel Panic',
	':heart::cat2:?',
	':clap::clap',
	'Go play some :basketball:',
	'With :heart: from :moon:',
	'Make some :tea: today.',
	getRandSlackUserName.bind(undefined, '%s did those faster than you did.'),
	getRandSlackUserName.bind(undefined, '%s dont you cheat on me.'),
	getRandSlackUserName.bind(undefined, '%s does double this time.'),
	getRandSlackUserName.bind(undefined, 'Exept %s. They are free this time.'),
	getRandSlackUserName.bind(undefined, '%s does not like jumping.'),
	getRandSlackUserName.bind(undefined, '%s, did you just leveled up?.'),
	getRandSlackUserName.bind(undefined, '%s did those faster than you did.')
];

if (process.env.EXERCISES) {
	var tmp = process.env.EXERCISES.split(',');
	var good = {};
	if (process.env.EXERCISES.indexOf(':') > -1) {
		exercises = {};
		tmp.forEach(function (section) {
			var items = section.split(':');
			exercises[items[0]] = parseFloat(items[1]);
		});
	} else {
		exercises = tmp;
	}
} else {
	exercises = {
		situp: 1,
		pushup: 1.5,
		jump: 2
	};
}

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

function getRandSlackUserName(msg) {
	return getChannelID(channel).then(function (id) {
		return q.ninvoke(slack, 'api', "channels.info", {
			channel: id
		});
	}).then(function (resp) {
		var user = resp.channel.members[rand(resp.channel.members.length, 0) - 1];
		return q.ninvoke(slack, 'api', "users.info", {
			user: user
		});
	}).then(function (user) {
		var name;
		user = user.user;
		if (user.real_name) {
			name = user.real_name;
		} else {
			name = '@' + user.name;
		}
		if (msg) {
			return format(msg, name);
		}
		return name;
	});
}

function getChannelID(name) {
	if (name.indexOf('#') !== 0) {
		return q.when(name);
	}
	return q.ninvoke(slack, 'api', "channels.list").then(function (resp) {
		var id = '';
		resp.channels.forEach(function (channel) {
			if (channel.name === name.substr(1)) {
				id = channel.id;
			}
		});
		return id;
	});
}

function ucFirst(str) {
	return str.substr(0, 1).toUpperCase() + str.substr(1);
}

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
		var num = data.length;
		var now = new Date().getTime();
		data.forEach(function (pr) {
			if (moment(pr.created_at).add(5, 'days').format('x') < now) {
				num++;
			}
		});
		return num;
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

function rand(upTo, min) {
	if (min === undefined) {
		min = 1;
	}
	return Math.ceil((Math.random() * Math.ceil(upTo)) + Math.ceil(min));
}

function compileExercise(amount) {
	var rands = {}, left = amount, messages = [], collection;
	if (Array.isArray(exercises)) {
		collection = exercises;
	} else {
		collection = Object.keys(exercises);
	}
	collection.forEach(function (name, i) {
		if (i === collection.length - 1) {
			rands[name] = left;
			return;
		}
		var rnd = rand(amount / Math.pow(collection.length, 2), amount / ((collection.length - 1) * 2));
		left -= rnd;
		rands[name] = rnd;
	});
	Object.keys(rands).forEach(function (name) {
		var amount = rands[name];
		if (exercises[name]) {
			amount = Math.floor(amount * exercises[name]);
		}
		if (amount >= 1) {
			messages.push(pluralize(name, amount, true));
		}
	});

	return messages.join(', ');
}

function getFunMessage() {
	var rnd = rand(funMessages.length - 1, 0);
	var msg = funMessages[rnd];
	if (typeof msg !== 'function') {
		return msg;
	}
	return msg();
}

function run() {
	console.log('Started!');
	getRepos().then(function (data) {
		var arr = [], exclude = [];
		data.forEach(function (items) {
			if (Array.isArray(items)) {
				arr = arr.concat(items);
			} else if (items.indexOf('!') === 0){
				exclude.push(items.substr(1));
			} else {
				arr.push(items);
			}
		});
		// We want to make sure, that we will make no more pushups than we 'want'
		return arr.filter(function(item, pos) {
			return arr.indexOf(item) === pos && arr.lastIndexOf(item) === pos && exclude.indexOf(item) === -1;
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
		if (!ratio && Array.isArray(exercises)) {
			amount = amount * ratio;
		}
		return [compileExercise(amount), getFunMessage()];
	}).spread(function(exercises, message) {
		return postMessage(format(messageTemplate, exercises, (exercises.length > 0) ? message : ''));
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
