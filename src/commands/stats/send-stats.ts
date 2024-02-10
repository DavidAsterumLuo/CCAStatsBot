#! /usr/bin/env node

import { match } from 'assert';
import { error } from 'console';
import { CommandInteraction, DMChannel, Message, Webhook, WebhookClient} from 'discord.js';
import { url } from 'inspector';
import { sep } from 'path';


const {webhookurl} = require('../../../config.json');
const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');

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
    // TODO improve dm with formating, use embeds
    let loadMessage = await dm.send("<a:SplatnetLoad:1163902704192585819> Please wait...");

    let applink = authUrlMessage.first()!.content;

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
    const username = dm.recipient?.displayName;
    const currentTime = new Date().toISOString();

    //fs.writeFile('FILE.txt', JSON.stringify(results), (err: NodeJS.ErrnoException) => {
    //    if (err) throw error;
    //    console.log("File saved!")
    //});

    // console.log(matches[0]);
    // console.log((await splatnet.getBattleHistoryDetail(matches[0].id)).data.vsHistoryDetail);

    // This is the header for the CSV file later
    let header = "SubmittedBy,SubmittedAt,MatchID,MatchDateTime,Timer,Map,Mode,Team 1 Score,Team2 Score,P1 Splashtag,P1 Weapon,P1 KA,P1 Assists,P1 Deaths,P1 Special,P1 #Specials,P1 Paint,P2 Splashtag,P2 Weapon,P2 KA,P2 Assists,P2 Deaths,P2 Special,P2 #Specials,P2 Paint,P3 Splashtag,P3 Weapon,P3 KA,P3 Assists,P3 Deaths,P3 Special,P3 #Specials,P3 Paint,P4 Splashtag,P4 Weapon,P4 KA,P4 Assists,P4 Deaths,P4 Special,P4 #Specials,P4 Paint,P5 Splashtag,P5 Weapon,P5 KA,P5 Assists,P5 Deaths,P5 Special,P5 #Specials,P5 Paint,P6 Splashtag,P6 Weapon,P6 KA,P6 Assists,P6 Deaths,P6 Special,P6 #Specials,P6 Paint,P7 Splashtag,P7 Weapon,P7 KA,P7 Assists,P7 Deaths,P7 Special,P7 #Specials,P7 Paint,P8 Splashtag,P8 Weapon,P8 KA,P8 Assists,P8 Deaths,P8 Special,P8 #Specials,P8 Paint \n";
    let csvString = ""
    // TODO create match selection logic
    let tmp = "";
    let selectionString = "";
    let index = 0;

    for (let session of sessions){
        let utcDateString = session.historyDetails.nodes[0].playedTime;
        let unixTimestamp = new Date(utcDateString).getTime() / 1000;
        selectionString += String(index) + ": " + "<t:" + unixTimestamp + ":D>" + "\n"
        index += 1;
    }
    await loadMessage.edit(selectionString);
    await dm.send("What day were the matches played?\n respond with `select [number]` \nexample: `select 2`");
    const filter = (m: Message) => m.content.startsWith("select");
    let selectionMessage = await dm.awaitMessages({ filter, max: 1, time: 600_000, errors: ['time'] }).catch(async (error) => {
        await dm.send("Response timeout. Please start the process over.");
        throw error;
    })
    let sessionSelection = selectionMessage.first()!.content.replace("select", "")
    sessionSelection = sessionSelection.replace(/\s/g, '');
    let sessionNumber = undefined
    try{
        sessionNumber = Number(sessionSelection);
    }catch{
        await dm.send("error! invalid argument")
        throw error
    }
    
    const check = sessions[sessionNumber];
    if (check == undefined){
        await dm.send("Invalid Index! Please start the process over.");
        return;
    }
    const matches = sessions[sessionNumber].historyDetails.nodes;
    // TODO change to dropdown?

    // Display all matches in the session
    tmp = "";
    selectionString = "";
    index = 0;
    for (let match of matches){
        tmp = "";
        tmp += match.vsStage.name + ", ";
        tmp += match.vsRule.name + ", ";
        tmp += match.judgement;
        selectionString += String(index) + ": " + tmp + "\n"
        index ++;
    }
    await dm.send(selectionString);


    // TODO improve selection command
    let matchIndex = null
    while (true){
        await dm.send("Select matches by responding with\n `select [numbers or ranges]` \nexample: `select 0,2,4-6`");
        // Let user select relevent matches
        selectionMessage = await dm.awaitMessages({ filter, max: 1, time: 600_000, errors: ['time'] }).catch(async (error) => {
            await dm.send("Response timeout. Please start the process over.");
            throw error;
        })        
        if (selectionMessage.first()!.content.toLowerCase() == 'quit'){
            await dm.send("Exiting");
            return;
        }
        let matchSelections = selectionMessage.first()!.content.replace("select", "");
        matchIndex = [...new Set(extractRangeFromString(matchSelections))]
        if (matchIndex == null || matchIndex.length == 0){
            await dm.send("Incorect Format! Please try again or type `quit`");
            continue
        }
        // console.log(matchIndex)
        break;
    }


    // store relevent matches in 'matches'


    for (let selectionIndex of matchIndex){
        let match = matches[selectionIndex];

        // TODO, Let the user retry the select command on failure
        if (match == undefined){
            await dm.send("Invalid Index! Please start the process over");
            return;
        } 
 
        let id = match.id;
        let timePlayed = match.playedTime;
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
        csvString += username + "," + currentTime + "," + id + "," + timePlayed + "," + duration + ","+ stage + "," + mode + "," + my_score + "," + their_score + "," + p1 + "," + p2 + "," + p3 + "," + p4 + "," + p5 + "," + p6 + "," + p7 + "," + p8 + "\n";
        // Format: SubmittedBy, SubmittedAt, matchID, MatchDateTime, Timer, Map, Mode, Team1(Winner), Team 1 Score, Team 2(Loser), Team2 Score, P1 Splashtag, P1 Weapon, P1 KA, P1 Assists, P1 Deaths, P1 Specials, P1 Paint, P2...

    }
    // console.log(csvString)
    // wait loadMessage.edit("Done!");
    const buffer = Buffer.from(header + csvString, "utf-8");
    //TODO maybe don't have the players download a file from the bot?
    await dm.send(
        {content: "Your data has been sent! here is the data for your own records!",
         files: [{ attachment: buffer, name: "data.csv"}]});

    //Append content to existing file
    const filePath = "CCA_Stats.csv"

    //Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err: NodeJS.ErrnoException) =>{
        if (err){
            console.log("file doesn't exist!")
            const writeStream = fs.createWriteStream(filePath, {flags: "a"});
            writeStream.write(header + csvString, 'utf-8', (err: NodeJS.ErrnoException) =>{
                if (err){
                    console.error("Appending Data Failed!", err);
                }
            })
        } else{
            console.log("file exists!")
            const writeStream = fs.createWriteStream(filePath, {flags: "a"});
            writeStream.write(csvString, 'utf-8', (err: NodeJS.ErrnoException) =>{
                if (err){
                    console.error("Appending Data Failed!", err);
                }
            })
        }
    })

    function extractRangeFromString(inputString : string){
        // Matches any number seperated by a non number or two numbers seperated by '-'
        const pattern = /(\d+)-(\d+)|(\d+)/g;

        // Detect matches
        const matches = inputString.match(pattern)
        
        if (matches){
            const rangeArray = [];
            // Loop through matches
            for (const match of matches){
                // Handle range
                if (match.includes('-')){
                    const [startNumber, endNumber] = match.split('-').map(Number);
                    rangeArray.push(...Array.from({ length: endNumber - startNumber + 1 }, (_, index) => startNumber + index));
                } else {
                    // Handle single number
                    rangeArray.push(parseInt(match))
                }
            }
            return rangeArray;
        }
        return null;
    }

    
    

    //Send to webhook on CCA server
/*    
for (let weburl of webhookurl){
        let webhook = new WebhookClient({url:weburl})
        webhook.send({
            files: [{
                attachment: buffer,
                name: username + "_" +Date.now() +".csv"
            }]
            })
            .then(console.log)
            .catch(console.error)
    }
*/
}
