"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const { webhookurl } = require('../../../config.json');
const { SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('get-stats')
        .setDescription('Retrieves the current CSV for all stats.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        for (let weburl of webhookurl) {
            let webhook = new discord_js_1.WebhookClient({ url: weburl });
            webhook.send({
                content: 'Stats Request at ' + "<t:" + Math.floor(new Date().getTime() / 1000) + ":F>",
                files: [{
                        attachment: "CCA_Stats.csv",
                        name: "CCA_Stats" + "_" + Date.now() + ".csv"
                    }]
            })
                .then((result) => {
                console.log(result);
                interaction.editReply({ content: 'file sent to webhook!' });
            })
                .catch((error) => {
                console.error(error);
                interaction.reply({ content: 'Somthing went Wrong!' + error });
            });
        }
    },
};
