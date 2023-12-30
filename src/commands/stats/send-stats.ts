#! /usr/bin/env node

import { match } from 'assert';
import { CommandInteraction, DMChannel, Message } from 'discord.js';
import { sep } from 'path';
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('send-stats')
		.setDescription('Starts the process to send in stats from your match.'),
	async execute(interaction: CommandInteraction) {
		let dm = await interaction.user.createDM().catch(() => {
            interaction.reply({ content: 'We failed to send you a DM, so make sure you are allowing them!', ephemeral: true });
        });
        if (dm != null) {
            let task = statsCommand(dm);
            interaction.reply({ content: 'Check your DMs!', ephemeral: true });
            await task;
        }
	},
};

async function getNintendoAccountSessionToken(dm: DMChannel): Promise<{na_session_token: string, loadMessage: Message}> {
    let naApi = await import('nxapi/nintendo-account');
    let auth = naApi.NintendoAccountSessionAuthorisation.create("71b963c1b7b6d119", "openid user user.birthday user.mii user.screenName");

    await dm.send({
        content: "Navigate to " + auth.authorise_url + " and right click Select this person -> `Copy link` and paste it here",
        files: [{ attachment: 'resources/lib_nso_example.png'}],
    });

    const filter = (m: Message) => m.content.startsWith("npf71b963c1b7b6d119://auth")
    let authUrlMessage = await dm.awaitMessages({ filter, max: 1, time: 600_000, errors: ['time'] }).catch(async (error) => {
        await dm.send("Response timeout. Please start the process over.")
        throw error;
    })

    let loadMessage = await dm.send("<a:SplatnetLoad:1163902704192585819> Please wait...");

    let applink = authUrlMessage.first()!.content

    const authorisedurl = new URL(applink);
    const authorisedparams = new URLSearchParams(authorisedurl.hash.substring(1));

    const token = await auth.getSessionToken(authorisedparams);

    return {na_session_token: token.session_token, loadMessage: loadMessage};
};

async function statsCommand(dm: DMChannel) {
    let nxapi = await import('nxapi');

    nxapi.addUserAgent('ccastatsbot/1.0.0 (+https://github.com/Candygoblen123/CCAStatsBot)');

    const {na_session_token, loadMessage} = await getNintendoAccountSessionToken(dm);
    let coralApi = await import('nxapi/coral');
    const nso = await coralApi.default.createWithSessionToken(na_session_token).catch(async (error) => {
        await dm.send("Could not authenticate with Nintendo: " + error + "\nPlease wait an hour, then try again.");
        throw error;
    });
    let coral = nso.nso;
    let coral_auth_data = nso.data;

    let splatnet3Api = await import('nxapi/splatnet3');
    let auth_data = await splatnet3Api.default.createWithCoral(coral, coral_auth_data.user);

    let splatnet = auth_data.splatnet;

    const results = await splatnet.getPrivateBattleHistories();

    const sessions = results.data.privateBattleHistories.historyGroups.nodes;

    const matches = sessions[0].historyDetails.nodes;
    // console.log(matches[0]);
    // console.log((await splatnet.getBattleHistoryDetail(matches[0].id)).data.vsHistoryDetail);
    let csvString = "Timer, Map, Mode, Team 1 Score, Team2 Score, P1 Splashtag, P1 Weapon, P1 KA, P1 Assists, P1 Deaths, P1 Special, P1 #Specials, P1 Paint, P2 Splashtag, P2 Weapon, P2 KA, P2 Assists, P2 Deaths, P2 Special, P2 #Specials, P2 Paint, P3 Splashtag, P3 Weapon, P3 KA, P3 Assists, P3 Deaths, P3 Special,P3 #Specials, P3 Paint, P4 Splashtag, P4 Weapon, P4 KA, P4 Assists, P4 Deaths, P4 Special, P4 #Specials, P4 Paint, P5 Splashtag, P5 Weapon, P5 KA, P5 Assists, P5 Deaths, P5 Special, P5 #Specials, P5 Paint, P6 Splashtag, P6 Weapon, P6 KA, P6 Assists, P6 Deaths, P6 Special, P6 #Specials, P6 Paint, P7 Splashtag, P7 Weapon, P7 KA, P7 Assists, P7 Deaths, P7 Special, P7 #Specials, P7 Paint, P8 Splashtag, P8 Weapon, P8 KA, P8 Assists, P8 Deaths, P8 Special, P8 #Specials, P8 Paint \n";
    // TODO create match selection logic

    // Display first 15 matches
    let tmp = "";
    let selectionString = "";
    let index = 0;
    for (let match of matches){
        if (index == 15){
            break;
        }
        tmp = "";
        tmp += match.vsStage.name + ", ";
        tmp += match.vsRule.name + ", ";
        tmp += match.judgement;
        selectionString += String(index) + ": " + tmp + "\n"
        index ++;
    }
    await loadMessage.edit(selectionString);
    await dm.send("Select matches by responding with 'select (comma seperated numbers)' \nexample: select 0,2,3");
    // Let user select relevent matches
    const filter = (m: Message) => m.content.startsWith("select");
    let selectionMessage = await dm.awaitMessages({ filter, max: 1, time: 600_000, errors: ['time'] }).catch(async (error) => {
        await dm.send("Response timeout. Please start the process over.");
        throw error;
    })
    
    let matchSelections = selectionMessage.first()!.content.replace("select", "")
    matchSelections = matchSelections.replace(/\s/g, '');
    const regex = /^\d+(,\d+)*$/;

    if (regex.test(matchSelections) == false){
        await dm.send("message not in correct format, please try again")
    }
    const matchIndex = matchSelections.split(',').map(Number);
    console.log(matchIndex)

    // store relevent matches in 'matches'



    for (let selectionIndex of matchIndex){
        let match = matches[0]
        try {
            match = matches[selectionIndex]
        } catch (error) {
            await dm.send("Invalid Index! Please check index")
            throw error
        }
        let id = match.id;
        // let timePlayed = match.playedTime;
        let mode = match.vsRule.name;
        let stage = match.vsStage.name;
        // let result = match.judgement;
        let details = (await splatnet.getBattleHistoryDetail(id)).data.vsHistoryDetail;
        let my_score = details.myTeam.result?.score
        let their_score = details.otherTeams[0].result?.score
        let duration = Math.floor(details.duration / 60) + ":" + String(details.duration % 60).padStart(2, "0")
        let yourTeamDeets = details.myTeam.players.map(player => {
            return player.name +"#"+ player.nameId + "," + player.weapon.name + "," +
                player.result?.kill + "," + player.result?.death + "," +
                player.result?.assist + "," + player.weapon.specialWeapon.name +
                "," + player.result?.special + "," + player.paint;
        });
        // console.log(yourTeamDeets[0]);
        let p1 = ',,,,,,,';
        let p2 = ',,,,,,,';
        let p3 = ',,,,,,,';
        let p4 = ',,,,,,,';
        let p5 = ',,,,,,,';
        let p6 = ',,,,,,,';
        let p7 = ',,,,,,,';
        let p8 = ',,,,,,,';
        if (typeof(yourTeamDeets[0]) != 'undefined'){
            p1 = yourTeamDeets[0];
        }
        if (typeof(yourTeamDeets[1]) != 'undefined'){
            p2 = yourTeamDeets[1];
        }
        if (typeof(yourTeamDeets[2]) != 'undefined'){
            p3 = yourTeamDeets[2];
        }
        if (typeof(yourTeamDeets[3]) != 'undefined'){
            p4 = yourTeamDeets[3];
        }
        let theirTeamDeets = details.otherTeams[0].players.map(player => {
            return player.name +"#"+ player.nameId + "," + player.weapon.name + "," +
                player.result?.kill + "," + player.result?.death + "," +
                player.result?.assist + "," + player.weapon.specialWeapon.name +
                "," + player.result?.special + "," + player.paint;
        });
        if (typeof(theirTeamDeets[0]) != 'undefined'){
            p5 = theirTeamDeets[0];
        }
        if (typeof(theirTeamDeets[1]) != 'undefined'){
            p6 = theirTeamDeets[1];
        }
        if (typeof(theirTeamDeets[2]) != 'undefined'){
            p7 = theirTeamDeets[2];
        }
        if (typeof(theirTeamDeets[3]) != 'undefined'){
            p8 = theirTeamDeets[3];
        }
        // TODO add team names, reference the python script
        csvString += duration + ","+ stage + "," + mode + "," + my_score + "," + their_score + "," + p1 + "," + p2 + "," + p3 + "," + p4 + "," + p5 + "," + p6 + "," + p7 + "," + p8 + "\n";
        // Format: Timer, Map, Mode, Team1(Winner), Team 1 Score, Team 2(Loser), Team2 Score, P1 Splashtag, P1 Weapon, P1 KA, P1 Assists, P1 Deaths, P1 Specials, P1 Paint, P2...

    }
    // console.log(csvString)
    // wait loadMessage.edit("Done!");
    const buffer = Buffer.from(csvString, "utf-8");
    //TODO maybe don't have the players download a file from the bot?
    await dm.send(
        {content: "Here's your data file!",
         files: [{ attachment: buffer, name: "data.csv"}]});
}