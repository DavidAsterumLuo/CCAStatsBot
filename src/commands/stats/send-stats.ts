#! /usr/bin/env node

import { match } from 'assert';
import { error, timeStamp } from 'console';
import { CommandInteraction, DMChannel, Message, Webhook, WebhookClient, range} from 'discord.js';
import { url } from 'inspector';
import { sep } from 'path';
import { versionMajorMinor } from 'typescript';
import { exec } from 'child_process';
import { FORMERR } from 'dns';

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
    console.log(authorisedparams)
    // TODO PRIORITY FIX THE ANDROID BUG
    const token = await auth.getSessionToken(authorisedparams);
 

    return {na_session_token: token.session_token, loadMessage: loadMessage};
};

async function statsCommand(dm: DMChannel) {
    let nxapi = await import('nxapi');

    nxapi.addUserAgent('ccastatsbot/1.0.0 (+https://github.com/Candygoblen123/CCAStatsBot)');

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

    //Read in RosterFile    
    let playerTeamMap: { [key: string]: string } = {};

    fs.readFile('rosters.txt', 'utf8', (err: any, data: string) => {
      if (err) {
        console.error('Error reading the file:', err);
        return;
      }
      // Parse the JSON data into a TypeScript object
      playerTeamMap = JSON.parse(data);
    });
          // Example usage: mapping a player to a team
          // const player: string = 'Player1';
          // if (player in playerTeamMap) {
          // const team: string = playerTeamMap[player];
          //  console.log(`${player} belongs to ${team}`);
          //} else {
          //  console.log(`${player} is not found in the mapping.`);
          //}
        
          // You can use playerTeamMap object to map players to teams as needed



    //fs.writeFile('FILE.txt', JSON.stringify(results), (err: NodeJS.ErrnoException) => {
    //    if (err) throw error;
    //    console.log("File saved!")
    //});

    // console.log(matches[0]);
    // console.log((await splatnet.getBattleHistoryDetail(matches[0].id)).data.vsHistoryDetail);

    // This is the header for the CSV file later
    let header = `
SubmittedBy,SubmittedAt,MatchID,MatchDateTime,Timer,Map,Mode,Team 1 Score,Team2 Score,
P1 Splashtag,P1 UUID,P1 Title,P1 NameplateImageURL,P1 NPBadgeURL1,P1 NPBadgeURL2,P1 NPBadgeURL3,P1 NPTextColor,P1 Species,P1 Weapon,P1 KA,P1 Deaths,P1 Assists,P1 #Specials,P1 Paint,
P1 Head Gear Name,P1 Head Gear Main,P1 Head Gear Sub1,P1 Head Gear Sub2,P1 Head Gear Sub3,P1 Head Gear ImageURL,
P1 Body Gear Name,P1 Body Gear Main,P1 Body Gear Sub1,P1 Body Gear Sub2,P1 Body Gear Sub3,P1 Body Gear ImageURL,
P1 Shoes Gear Name,P1 Shoes Gear Main,P1 Shoes Gear Sub1,P1 Shoes Gear Sub2,P1 Shoes Gear Sub3,P1 Shoes Gear ImageURL,
P2 Splashtag,P2 UUID,P2 Title,P2 NameplateImageURL,P2 NPBadgeURL1,P2 NPBadgeURL2,P2 NPBadgeURL3,P2 NPTextColor,P2 Species,P2 Weapon,P2 KA,P2 Deaths,P2 Assists,P2 #Specials,P2 Paint,
P2 Head Gear Name,P2 Head Gear Main,P2 Head Gear Sub1,P2 Head Gear Sub2,P2 Head Gear Sub3,P2 Head Gear ImageURL,
P2 Body Gear Name,P2 Body Gear Main,P2 Body Gear Sub1,P2 Body Gear Sub2,P2 Body Gear Sub3,P2 Body Gear ImageURL,
P2 Shoes Gear Name,P2 Shoes Gear Main,P2 Shoes Gear Sub1,P2 Shoes Gear Sub2,P2 Shoes Gear Sub3,P2 Shoes Gear ImageURL,
P3 Splashtag,P3 UUID,P3 Title,P3 NameplateImageURL,P3 NPBadgeURL1,P3 NPBadgeURL2,P3 NPBadgeURL3,P3 NPTextColor,P3 Species,P3 Weapon,P3 KA,P3 Deaths,P3 Assists,P3 #Specials,P3 Paint,
P3 Head Gear Name,P3 Head Gear Main,P3 Head Gear Sub1,P3 Head Gear Sub2,P3 Head Gear Sub3,P3 Head Gear ImageURL,
P3 Body Gear Name,P3 Body Gear Main,P3 Body Gear Sub1,P3 Body Gear Sub2,P3 Body Gear Sub3,P3 Body Gear ImageURL,
P3 Shoes Gear Name,P3 Shoes Gear Main,P3 Shoes Gear Sub1,P3 Shoes Gear Sub2,P3 Shoes Gear Sub3,P3 Shoes Gear ImageURL,
P4 Splashtag,P4 UUID,P4 Title,P4 NameplateImageURL,P4 NPBadgeURL1,P4 NPBadgeURL2,P4 NPBadgeURL3,P4 NPTextColor,P4 Species,P4 Weapon,P4 KA,P4 Deaths,P4 Assists,P4 #Specials,P4 Paint,
P4 Head Gear Name,P4 Head Gear Main,P4 Head Gear Sub1,P4 Head Gear Sub2,P4 Head Gear Sub3,P4 Head Gear ImageURL,
P4 Body Gear Name,P4 Body Gear Main,P4 Body Gear Sub1,P4 Body Gear Sub2,P4 Body Gear Sub3,P4 Body Gear ImageURL,
P4 Shoes Gear Name,P4 Shoes Gear Main,P4 Shoes Gear Sub1,P4 Shoes Gear Sub2,P4 Shoes Gear Sub3,P4 Shoes Gear ImageURL,
P5 Splashtag,P5 UUID,P5 Title,P5 NameplateImageURL,P5 NPBadgeURL1,P5 NPBadgeURL2,P5 NPBadgeURL3,P5 NPTextColor,P5 Species,P5 Weapon,P5 KA,P5 Deaths,P5 Assists,P5 #Specials,P5 Paint,
P5 Head Gear Name,P5 Head Gear Main,P5 Head Gear Sub1,P5 Head Gear Sub2,P5 Head Gear Sub3,P5 Head Gear ImageURL,
P5 Body Gear Name,P5 Body Gear Main,P5 Body Gear Sub1,P5 Body Gear Sub2,P5 Body Gear Sub3,P5 Body Gear ImageURL,
P5 Shoes Gear Name,P5 Shoes Gear Main,P5 Shoes Gear Sub1,P5 Shoes Gear Sub2,P5 Shoes Gear Sub3,P5 Shoes Gear ImageURL,
P6 Splashtag,P6 UUID,P6 Title,P6 NameplateImageURL,P6 NPBadgeURL1,P6 NPBadgeURL2,P6 NPBadgeURL3,P6 NPTextColor,P6 Species,P6 Weapon,P6 KA,P6 Deaths,P6 Assists,P6 #Specials,P6 Paint,
P6 Head Gear Name,P6 Head Gear Main,P6 Head Gear Sub1,P6 Head Gear Sub2,P6 Head Gear Sub3,P6 Head Gear ImageURL,
P6 Body Gear Name,P6 Body Gear Main,P6 Body Gear Sub1,P6 Body Gear Sub2,P6 Body Gear Sub3,P6 Body Gear ImageURL,
P6 Shoes Gear Name,P6 Shoes Gear Main,P6 Shoes Gear Sub1,P6 Shoes Gear Sub2,P6 Shoes Gear Sub3,P6 Shoes Gear ImageURL,
P7 Splashtag,P7 UUID,P7 Title,P7 NameplateImageURL,P7 NPBadgeURL1,P7 NPBadgeURL2,P7 NPBadgeURL3,P7 NPTextColor,P7 Species,P7 Weapon,P7 KA,P7 Deaths,P7 Assists,P7 #Specials,P7 Paint,
P7 Head Gear Name,P7 Head Gear Main,P7 Head Gear Sub1,P7 Head Gear Sub2,P7 Head Gear Sub3,P7 Head Gear ImageURL,
P7 Body Gear Name,P7 Body Gear Main,P7 Body Gear Sub1,P7 Body Gear Sub2,P7 Body Gear Sub3,P7 Body Gear ImageURL,
P7 Shoes Gear Name,P7 Shoes Gear Main,P7 Shoes Gear Sub1,P7 Shoes Gear Sub2,P7 Shoes Gear Sub3,P7 Shoes Gear ImageURL,
P8 Splashtag,P8 UUID,P8 Title,P8 NameplateImageURL,P8 NPBadgeURL1,P8 NPBadgeURL2,P8 NPBadgeURL3,P8 NPTextColor,P8 Species,P8 Weapon,P8 KA,P8 Deaths,P8 Assists,P8 #Specials,P8 Paint,
P8 Head Gear Name,P8 Head Gear Main,P8 Head Gear Sub1,P8 Head Gear Sub2,P8 Head Gear Sub3,P8 Head Gear ImageURL,
P8 Body Gear Name,P8 Body Gear Main,P8 Body Gear Sub1,P8 Body Gear Sub2,P8 Body Gear Sub3,P8 Body Gear ImageURL,
P8 Shoes Gear Name,P8 Shoes Gear Main,P8 Shoes Gear Sub1,P8 Shoes Gear Sub2,P8 Shoes Gear Sub3,P8 Shoes Gear ImageURL
`.replace(/\n/g, '') + "\n";
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
    await dm.send("When were the matches played?\n respond with `select [number]` \nexample: `select 2`");
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
        await dm.send("Select matches by responding with\n `select [numbers or ranges]` \nexample: `select 0,2,4-6`");
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
        if (matchIndex == null || matchIndex.length == 0){
            await dm.send("Incorect Format! Please try again or type `select quit`");
            continue
        }
        // console.log(matchIndex)
        break;
    }

    // Try to get Team Names
    let Team1 = "";
    let Team2 = "";
    const firstIndex = matches[matchIndex[0]];
    if (firstIndex == undefined){
        await dm.send("Invalid Index! Please start the process over");
        return;
    } 
    const firstMatch = firstIndex.id
    const firstDetail = (await splatnet.getBattleHistoryDetail(firstMatch)).data.vsHistoryDetail;
    const ourTeamNames = firstDetail.myTeam.players.map(player =>{return player.name + "#" + player.nameId})
    for (let i of ourTeamNames){
        if (i in playerTeamMap) {
            Team1 = playerTeamMap[i];
            console.log(`${i} belongs to ${Team1}`);
            break;
          } else {
            console.log(`${i} is not found in the mapping.`);
            Team1 = "NotFound";
          }
    }

    const otherTeamNames = firstDetail.otherTeams[0].players.map(player =>{return player.name + "#" + player.nameId})
    for (let i of otherTeamNames)
    if (i in playerTeamMap) {
        Team2 = playerTeamMap[i];
        console.log(`${i} belongs to ${Team2}`);
        break;
      } else {
        console.log(`${i} is not found in the mapping.`);
        Team2 = "NotFound";
      }
      


    // obtaining uuid from player.id
    function get_uuid(playerID: string){
        const regex = /:(u-.*$)/;
        const match = atob(playerID).match(regex);
        if (match){
            return match[match.length-1];
        }return '';
    }
    

    // Keep track of score  
    let Team1Wins = 0
    let Team2Wins = 0
    // store relevent matches in 'matches'
    for (let selectionIndex of matchIndex){
        let match = matches[selectionIndex];

        if (match == undefined){
            await dm.send("Invalid Index! Please start the process over");
            return;
        } 
    
        let id = match.id;
        let timePlayed = match.playedTime;
        let mode = match.vsRule.name;
        let stage = match.vsStage.name;
        let result = match.judgement;
        let details = (await splatnet.getBattleHistoryDetail(id)).data.vsHistoryDetail;
        let my_score = details.myTeam.result?.score
        let their_score = details.otherTeams[0].result?.score

        if (result == "WIN"){
            Team1Wins += 1;
        }else if (result == "LOSE"){
            Team2Wins += 1;
        }

        let duration = Math.floor(details.duration / 60) + ":" + String(details.duration % 60).padStart(2, "0")
        let yourTeamDeets = details.myTeam.players.map(player => {
            return '"' + player.name + "#" + player.nameId + '"' + "," +
                '"' + get_uuid(player.id) + '"' + "," + 
                '"' + player.byname + '"' + "," + 
                '"' + (player.nameplate?.background.image.url || '') + '"' + "," +  
                '"' + (player.nameplate?.badges[0]?.image.url || '') + '"' + "," + 
                '"' + (player.nameplate?.badges[1]?.image.url || '') + '"' + "," + 
                '"' + (player.nameplate?.badges[2]?.image.url || '') + '"' + "," + 
                '"' + (Math.round((player.nameplate?.background.textColor.r || 1) * 255) + '|' + Math.round((player.nameplate?.background.textColor.g || 1) * 255) + '|' + Math.round((player.nameplate?.background.textColor.b || 1) * 255) + '|' + Math.round((player.nameplate?.background.textColor.r || 1) * 255)) + '"' + "," + 
                '"' + player.species + '"' + "," + 
                '"' + player.weapon.name + '"' + "," +
                '"' + (player.result?.kill || '') + '"' + "," + 
                '"' + (player.result?.death || '') + '"' + "," + 
                '"' + (player.result?.assist || '') + '"' + "," + 
                '"' + (player.result?.special || '') + '"' + "," + 
                '"' + (player.paint || '') + '"' + "," +
                '"' + player.headGear.name + '"' + "," + 
                '"' + player.headGear.primaryGearPower.name + '"' + "," + 
                '"' + (player.headGear.additionalGearPowers[0]?.name || '') + '"' + "," + 
                '"' + (player.headGear.additionalGearPowers[1]?.name || '') + '"' + "," + 
                '"' + (player.headGear.additionalGearPowers[2]?.name || '') + '"' + "," + 
                '"' + player.headGear.originalImage.url + '"' + "," +
                '"' + player.clothingGear.name + '"' + "," + 
                '"' + player.clothingGear.primaryGearPower.name + '"' + "," + 
                '"' + (player.clothingGear.additionalGearPowers[0]?.name || '') + '"' + "," + 
                '"' + (player.clothingGear.additionalGearPowers[1]?.name || '') + '"' + "," + 
                '"' + (player.clothingGear.additionalGearPowers[2]?.name || '') + '"' + "," + 
                '"' + player.clothingGear.originalImage.url + '"' + "," +
                '"' + player.shoesGear.name + '"' + "," + 
                '"' + player.shoesGear.primaryGearPower.name + '"' + "," + 
                '"' + (player.shoesGear.additionalGearPowers[0]?.name || '') + '"' + "," + 
                '"' + (player.shoesGear.additionalGearPowers[1]?.name || '') + '"' + "," + 
                '"' + (player.shoesGear.additionalGearPowers[2]?.name || '') + '"' + "," + 
                '"' + player.shoesGear.originalImage.url + '"';        
        });
                // console.log(yourTeamDeets[0]);
        
        let p1 = ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,';
        let p2 = ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,';
        let p3 = ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,';
        let p4 = ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,';
        let p5 = ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,';
        let p6 = ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,';
        let p7 = ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,';
        let p8 = ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,';
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
            return '"' + player.name + "#" + player.nameId + '"' + "," +
                '"' + get_uuid(player.id) + '"' + "," + 
                '"' + player.byname + '"' + "," + 
                '"' + (player.nameplate?.background.image.url || '') + '"' + "," +  
                '"' + (player.nameplate?.badges[0]?.image.url || '') + '"' + "," + 
                '"' + (player.nameplate?.badges[1]?.image.url || '') + '"' + "," + 
                '"' + (player.nameplate?.badges[2]?.image.url || '') + '"' + "," + 
                '"' + (Math.round((player.nameplate?.background.textColor.r || 1) * 255) + '|' + Math.round((player.nameplate?.background.textColor.g || 1) * 255) + '|' + Math.round((player.nameplate?.background.textColor.b || 1) * 255) + '|' + Math.round((player.nameplate?.background.textColor.r || 1) * 255)) + '"' + "," + 
                '"' + player.species + '"' + "," + 
                '"' + player.weapon.name + '"' + "," +
                '"' + (player.result?.kill || '') + '"' + "," + 
                '"' + (player.result?.death || '') + '"' + "," + 
                '"' + (player.result?.assist || '') + '"' + "," + 
                '"' + (player.result?.special || '') + '"' + "," + 
                '"' + (player.paint || '') + '"' + "," +
                '"' + player.headGear.name + '"' + "," + 
                '"' + player.headGear.primaryGearPower.name + '"' + "," + 
                '"' + (player.headGear.additionalGearPowers[0]?.name || '') + '"' + "," + 
                '"' + (player.headGear.additionalGearPowers[1]?.name || '') + '"' + "," + 
                '"' + (player.headGear.additionalGearPowers[2]?.name || '') + '"' + "," + 
                '"' + player.headGear.originalImage.url + '"' + "," +
                '"' + player.clothingGear.name + '"' + "," + 
                '"' + player.clothingGear.primaryGearPower.name + '"' + "," + 
                '"' + (player.clothingGear.additionalGearPowers[0]?.name || '') + '"' + "," + 
                '"' + (player.clothingGear.additionalGearPowers[1]?.name || '') + '"' + "," + 
                '"' + (player.clothingGear.additionalGearPowers[2]?.name || '') + '"' + "," + 
                '"' + player.clothingGear.originalImage.url + '"' + "," +
                '"' + player.shoesGear.name + '"' + "," + 
                '"' + player.shoesGear.primaryGearPower.name + '"' + "," + 
                '"' + (player.shoesGear.additionalGearPowers[0]?.name || '') + '"' + "," + 
                '"' + (player.shoesGear.additionalGearPowers[1]?.name || '') + '"' + "," + 
                '"' + (player.shoesGear.additionalGearPowers[2]?.name || '') + '"' + "," + 
                '"' + player.shoesGear.originalImage.url + '"';        
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
        csvString += '"' + username + '"' + "," + currentTime + "," + id + "," + timePlayed + "," + duration + ","+ '"' + stage + '"' + "," + mode + "," + my_score + "," + their_score + "," + p1 + "," + p2 + "," + p3 + "," + p4 + "," + p5 + "," + p6 + "," + p7 + "," + p8 + "\n";
        // Format: SubmittedBy, SubmittedAt, matchID, MatchDateTime, Timer, Map, Mode, Team1(Winner), Team 1 Score, Team 2(Loser), Team2 Score,P1 Splashtag,P1 UUID,P1 Title,P1 Nameplate,P1, NameplateImageURL,P1 NPBadgeURL1,P1 NPBadgeURL2,P1 NPBadgeURL3,P1 NPTextColor,P1 Species,P1 Weapon,P1 KA,P1 Deaths,P1 Assists,P1 #Specials,P1 Paint,
        // P1 Head Gear Name,P1 Head Gear Main,P1 Head Gear Sub1,P1 Head Gear Sub2,P1 Head Gear Sub3,P1 Head Gear ImageURL,P1 Body Gear Main,P1 Body Gear Sub1,P1 Body Gear Sub2,P1 Body Gear Sub3,P1 Body Gear ImageURL,P1 Shoes Gear Main,P1 Shoes Gear Sub1,P1 Shoes Gear Sub2,P1 Shoes Gear Sub3,P1 Shoes Gear ImageURL, P2...


    }
    // console.log(csvString)
    // wait loadMessage.edit("Done!");
    const buffer = Buffer.from(header + csvString, "utf-8");

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
        {content: "Your data has been sent!, We have recieved " + matchIndex.length + " matches from you!" // + "\ntesting Team Detection Feature, this feature assumes matches submitted only between 2 teams and is not used for official scoring for the league"
    // + "\nrecieved " +Team1Wins + " wins from " + Team1 + " and " + Team2Wins + " wins from " + Team2 //+ "\nYou can verify games sent by checking the csv provided\nIf you have more games please run /send-stats again (do not reuse the copy pasted link)",
    // files: [{attachment: buffer, name: "data.csv"}]
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
// TODO Save csv to google drive once per day.
for (let weburl of webhookurl){
        let webhook = new WebhookClient({url:weburl})
        webhook.send({
            content:"User: " + username + " Sent matches at " + "<t:" + Math.floor(new Date().getTime()/1000) + ":F> " + "Timestamp: " + currentTime,
            files: [{
                attachment: buffer,
                name: username + "_" +Date.now() + "_Backup" +".csv"
            }]
            })
            .then()
            .catch(console.error)
    }
}
