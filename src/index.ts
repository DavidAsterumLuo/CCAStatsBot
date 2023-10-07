#! /usr/bin/env node

import { Message } from "discord.js";
import { statsCommand } from "./nxapi.js";
import configJson from '../config.json';

const { Client, GatewayIntentBits } = require('discord.js');

const prefix = '!';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
	],
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (message: Message) => {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;

	let command = message.content.split(" ")[0];
	command = command.slice(prefix.length);

	const args = message.content.slice(prefix.length).trim().split(/ +/g);

	if (command === "UploadStats") {
        let dm = await message.author.createDM().catch(() => {
            message.reply("We couldn't send you a DM, make sure you're allowing them!")
        });

        if (dm != null) {
			try {
				await statsCommand(dm);
			} catch (error) {
				console.log("An error occured:" + error);
			}
        }
	}
});

const botToken = configJson.token;
client.login(botToken);