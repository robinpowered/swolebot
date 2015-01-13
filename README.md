# swolebot
A Slack bot for keeping your team fit through open pull requests.

!['swolebot in action'](http://robinpowered.s3.amazonaws.com/misc/swolebot.png)

# Why?

We @robinpowered wanted to stay healthy, so we started doing pushups based on open PR\`s we have.

# How to set this up?

Clone
```
git clone git@github.com:robinpowered/swolebot.git
```

Create Heroku
```
heroku create
```
Configure Heroku environment variables:

```
SLACK_API_TOKEN - required
GITHUB_API_TOKEN - required
REPOS - required. Uses comma-separated format. Eg. 'rails/rails,robinpowered'. You can specify repo, or whole ORG.
SLACK_CHANNEL - required. Defaults to #general
SLACK_ICON - An URL to Swolebot avatar, if you do not like default one
SLACK_USERNAME - Meh. Default: Swolebot
RATIO - Open PR to pushups ratio. Formula: open_PRs * ratio. Default: 2
HOURS - On what hours this should run. Defaults to 11,14,17. Format: Comma-separated values
TIMEZONE - set your TZ. Any valid momentjs TZ will do. Defaults to "America/New_York"
```

Push to Heroku
```
git push heroku master
```

__P.S. Don\`t worry, this will only run on workdays!__

Be fit!
