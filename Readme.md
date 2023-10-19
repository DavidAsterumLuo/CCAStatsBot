# CCA Stats Bot

To run, create a `config.json` file in the root of the project with the following format:

```json
{
	"token": "your-token-goes-here",
	"clientId": "your-application-id-goes-here",
	"guildId": "your-server-id-goes-here"
}
```
You can run `node deploy-commands.js` to update the slash commands on discord.
Then run `npm start` to start the bot. You can run `npx tsc` to compile the bot without starting it.