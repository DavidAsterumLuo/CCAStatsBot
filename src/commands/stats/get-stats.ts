import { error } from 'console';
import {CommandInteraction, Webhook, WebhookClient, PermissionFlagsBits} from 'discord.js';
const {webhookurl} = require('../../../config.json');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('get-stats')
		.setDescription('Retrieves the current CSV for all stats.'),
	async execute(interaction: CommandInteraction) {
        for (let weburl of webhookurl){
            let webhook = new WebhookClient({url:weburl})
            webhook.send({
                files: [{
                    attachment: "CCA_Stats.csv",
                    name: "CCA_Stats" + "_" +Date.now() +".csv"
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