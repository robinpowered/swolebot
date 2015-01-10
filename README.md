# swolebot
A slack bot for keeping your team fit

# Why?

We @robinpowered wanted to stay healthy, so we started doing pushups based on open PR\`s we have.

# How to set this up?

Clone
```
git clone git@github.com:jutaz/swolebot.git
```

Create Heroku
```
heroku create
```
Configure Heroku environment variables:

```
SLACK_API_TOKEN - required
GITHUB_API_TOKEN - required
SLACK_CHANNEL - required. Defaults to #general
SLACK_ICON - An URL to Swolebot avatar, if you do not like default ones
SLACK_USERNAME - Meh. Default: Swolebot
RATIO - Open PR to pushups ratio. Formula: open_PRs * ratio. Default: 2
HOURS - On what hours this should run. Defaults to 11,14,20. Format: Comma-separated values
TIMEZONE - set your TZ. Any valid momentjs TZ will do. Defaults to "America/New_York"

```

Push to Heroku
```
git push heroku master
```

__P.S. Don\`t worry, this will only run on workdays!__

Be fit!
