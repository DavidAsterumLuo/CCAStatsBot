#! /usr/bin/env node

import { match } from 'assert';
import { error, timeStamp } from 'console';
import { CommandInteraction, DMChannel, Message, Webhook, WebhookClient, range} from 'discord.js';
import { url } from 'inspector';
import { sep } from 'path';
import { isQuestionDotToken, versionMajorMinor } from 'typescript';
import { exec } from 'child_process';
import { FORMERR } from 'dns';

const {webhookurl} = require('../../../config.json');
const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');



module.exports = {
	data: new SlashCommandBuilder()
		.setName('register-players')
		.setDescription('Starts the process to register a player in our stats system.'),
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
    console.log(authorisedparams)
    // TODO PRIORITY FIX THE ANDROID BUG
    const token = await auth.getSessionToken(authorisedparams);
 

    return {na_session_token: token.session_token, loadMessage: loadMessage};
};

async function statsCommand(dm: DMChannel) {
    let nxapi = await import('nxapi');

    nxapi.addUserAgent('ccastatsbot/1.0.0 (+https://github.com/Candygoblen123/CCAStatsBot)');
    let welcomeMessage = await dm.send(
`Thank you for registering with the CCA Stats Team!
Before starting this process, please be sure to have played a private battle *With only the teammates you wish to register*
If you wish to continue send \`continue\` Otherwise send anything else`
    ); 
    if (
    await dm.awaitMessages({max: 1, time: 15000, errors: ['time'] })
    .then(collected => {
        const userResponse = collected.first()?.content?.toLowerCase();

        if (userResponse?.toLowerCase() === 'continue') {
            welcomeMessage.delete();
        } else {
            dm.send('quiting');
            return -1;
        }
    })
    .catch((error) => {
        dm.send('Bot Timed Out, Quiting');
        return -1
    }) == -1){
        return;
    }
    await dm.send('Please enter the teamname you registered with excatly');
    const teamName = await dm.awaitMessages({ max: 1, time: 600_000, errors: ['time'] }).catch(async (error) => {
        await dm.send("Response timeout. Please start the process over.");
        throw error;
    })
    await dm.send('please confirm by entering your teamname again')
    const teamNameConfirm = await dm.awaitMessages({ max: 1, time: 600_000, errors: ['time'] }).catch(async (error) => {
        await dm.send("Response timeout. Please start the process over.");
        throw error;
    })
    console.log(teamName.first()?.content)
    console.log(teamNameConfirm.first()?.content)
    if (teamName.first()?.content !== teamNameConfirm.first()?.content){
        await dm.send("Team names don't match, please start the process over");
        return;
    }
    const {na_session_token, loadMessage} = await getNintendoAccountSessionToken(dm).catch(async (error) =>{
        await dm.send("An error Has occurred!: " + error +"\n Currently Mobile is not supported due to some URL issues" +"\n@Asterum if you need help with this error");
        throw error;
    });
    let coralApi = await import('nxapi/coral');
    const nso = await coralApi.default.createWithSessionToken(na_session_token).catch(async (error) => {
        await dm.send("Could not authenticate with Nintendo: " + error + "\n @Asterum if you need help with this error");
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

    // This is the header for the CSV file later
    let header = 'SubmittedBy,SubmittedAt,UUID,Splashtag,Teamname\n';
    let csvString = ""
    let tmp = "";
    let selectionString = "";
    let index = 0;

    for (let session of sessions){
        let utcDateString = session.historyDetails.nodes[session.historyDetails.nodes.length - 1].playedTime;
        let unixTimestamp = new Date(utcDateString).getTime() / 1000;
        let recentDateString = session.historyDetails.nodes[0].playedTime;
        let unixRecentDate = new Date(recentDateString).getTime() / 1000;
        selectionString += String(index) + ": " + "<t:"+ unixRecentDate + ">" + " - " + "<t:" + unixTimestamp + ">" + "\n"
        index += 1;
    }
    await loadMessage.edit(selectionString);
    await dm.send("When was the match played?\n respond with `select [number]` \nexample: `select 0`");
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
    //TODO add discord timestamp and score to matches
    for (let match of matches){
        let utcDateString = match.playedTime;
        let unixTimestamp = new Date(utcDateString).getTime() / 1000;
        tmp = "";
        tmp += match.vsRule.name + " on ";
        tmp += match.vsStage.name + " at ";
        tmp += "<t:" + unixTimestamp + "> score was "
        let details = (await splatnet.getBattleHistoryDetail(match.id)).data.vsHistoryDetail;
        tmp += details.myTeam.result?.score + " - "
        tmp += details.otherTeams[0].result?.score
        selectionString += String(index) + ": " + tmp + "\n"
        if(index % 10 == 0 && index != 0){
            dm.send(selectionString);
            tmp = "";
            selectionString = "";
        }
        index ++;
    }
    dm.send(selectionString + "\nEnd of session")


    // TODO improve selection command
    let matchIndex = null
    while (true){
        await dm.send("Select match by responding with\n `select [number]` \nexample: `select 0`");
        // Let user select relevent matches
        selectionMessage = await dm.awaitMessages({ filter, max: 1, time: 600_000, errors: ['time'] }).catch(async (error) => {
            await dm.send("Response timeout. Please start the process over.");
            throw error;
        })        
        if (selectionMessage.first()!.content.toLowerCase() == 'select quit'){
            await dm.send("Exiting");
            return;
        }
        let matchSelections = selectionMessage.first()!.content.replace("select", "");
        matchIndex = [...new Set(extractRangeFromString(matchSelections))]
        if (matchIndex == null || matchIndex.length != 1){
            await dm.send("Incorect Format! Please try again or type `select quit`");
            continue
        }
        // console.log(matchIndex)
        break;
    }

    // obtaining uuid from player.id
    function get_uuid(playerID: string){
        const regex = /:(u-.*$)/;
        const match = atob(playerID).match(regex);
        if (match){
            return match[match.length-1];
        }return '';
    }
    

    // store relevent matches in 'matches'
    for (let selectionIndex of matchIndex){
        let match = matches[selectionIndex];

        if (match == undefined){
            await dm.send("Invalid Index! Please start the process over");
            return;
        } 
    
        let id = match.id;
        let details = (await splatnet.getBattleHistoryDetail(id)).data.vsHistoryDetail;

        let yourTeamDeets = details.myTeam.players.map(player => {
            return '"' + get_uuid(player.id) + '"'+ "," + '"' + player.name + "#" + player.nameId + '"'});
                // console.log(yourTeamDeets[0]);
        
        //TODO Oh fuck this shit *SHOULDNT* break if people have commas in their names
        let p1 = '';
        let p2 = '';
        let p3 = '';
        let p4 = '';
        let p5 = '';
        let p6 = '';
        let p7 = '';
        let p8 = '';
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
            return '"' + get_uuid(player.id) + '"'+ "," + '"' + player.name + "#" + player.nameId + '"'});
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
        for (let player of [p1,p2,p3,p4,p5,p6,p7,p8]){
            if (player != ''){
                csvString += '"' + username + '"' + "," + currentTime + "," + player + "," +'"'+ teamName.first()?.content +'"'+"\n"
            }
        }
        // Format: SubmittedBy, SubmittedAt, UUID, Splashtag, Teamname
    }
    // console.log(csvString)
    // wait loadMessage.edit("Done!");
    const buffer = Buffer.from(header + csvString, "utf-8");

    //Append content to existing file
    const filePath = "Players.csv"
    
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

    // Write to input.csv
//    const inputFile = "input.csv";
//    fs.writeFile(inputFile, header + csvString, 'utf-8', (err: any) => {
//        if (err){
//            console.error("failed to write to input.csv:", err);
//        } else{
//            console.log("input.csv writen");
//            // Run python script
//            exec('python TransformToPerPlayer.py', (error, stdout, stderr) => {
//                if (error) {
//                    console.error('error running TransformToPerPlayer.py', error);
//                } else {
//                    console.log('TransformToPerPlayer.py run successfully.');
//                }
//            })
//        }
//    })



    await dm.send(
        {content: "Your data has been sent!, You can verify what players we have recieved in the csv!",
     files: [{attachment: buffer, name: "data.csv"}]
    });


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

    
    

    //Send to webhook on CCA server (backup files)

for (let weburl of webhookurl){
        let webhook = new WebhookClient({url:weburl})
        webhook.send({
            content:"User: " + username + " Registered Players at " + "<t:" + Math.floor(new Date().getTime()/1000) + ":F> " + "Timestamp: " + currentTime,
            files: [{
                attachment: buffer,
                name: username + "_" +Date.now() + "_Backup" +".csv"
            }]
            })
            .then()
            .catch(console.error)
    }

}
