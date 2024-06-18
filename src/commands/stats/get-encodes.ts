import { error } from 'console';
import {CommandInteraction, Webhook, WebhookClient, PermissionFlagsBits} from 'discord.js';
const {webhookurl} = require('../../../config.json');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('get-encodes')
		.setDescription('Retrieves the current CSV for player encodes.'),
	async execute(interaction: CommandInteraction) {
        for (let weburl of webhookurl){
            let webhook = new WebhookClient({url:weburl})
            webhook.send({
                content:'Encodes Request at ' + "<t:" + Math.floor(new Date().getTime()/1000) + ":F>",
                files: [{
                    attachment: "Players.csv",
                    name: "Encodes" + "_" +Date.now() +".csv"
                }]
                })
                .then((result) => {
                    console.log(result);
                    interaction.reply({ content: 'file sent to webhook!', ephemeral: true });
                })
                .catch((error) =>{
                    console.error(error);
                    interaction.reply({ content: 'Somthing went Wrong!' + error, ephemeral: true });
                })
        }
	},
};