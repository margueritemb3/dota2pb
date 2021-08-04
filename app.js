const Discord = require('discord.js');
const fetch = require('node-fetch');

require('dotenv').config();

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();


const client = new Discord.Client();

client.on('ready', () => {
    console.log('Bot is ready');
});

setInterval(async () => {
    try {
        const data = await fetch("http://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=570&count=100&format=json")
        const json = await data.json();
        const newestNews = json.appnews.newsitems.find(n => {
            return n.feed_type === 1;
        });
        const doc = await db.collection('patch').doc('lastPatch').get();
        const lastPatchId = doc.data().last_patch_id;
        if (newestNews.gid !== lastPatchId) {
            const snapshot = await db.collection('channels').get();
            snapshot.forEach((channel) => {
                client.channels.cache.get(channel.data().channel_id)
                    .send("<@&" + channel.data().role_id + "> " + newestNews.url);
            });
            db.collection('patch').doc('lastPatch').set({ last_patch_id: newestNews.gid });
        }
    } catch (e) {
        console.error(e);
    }
}, 120000); //120000 (2 mintues) (5000 for 5 seconds)

client.on('message', async (msg) => {

    //post the most recent Dota 2 update
    if (msg.content === '!patch') {
        try {
            const data = await fetch("http://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=570&count=100&format=json")
            const json = await data.json();
            const newsArr = json.appnews.newsitems;
            const newestNews = newsArr.find(n => {
                return n.feed_type === 1;
            });
            msg.reply(newestNews.url);
        } catch (e) {
            console.error(e);
        }
    }


    //print bot command descriptions
    else if (msg.content === '!patch help') {
        msg.reply("\n!patch subscribe -- subscribes a channel to Dota 2 patch note updates (admins)\n!patch notify -- adds member to a role to recieve patch post alerts\n!patch help -- explains bot commands\n!patch -- gives info on most recent patch");
    }


    //subscribe a channel to recieve Dota 2 updates
    else if (msg.content === '!patch subscribe') {
        if (!msg.member.hasPermission("ADMINISTRATOR")) {
            msg.reply("Server admin must subscribe.");
        } else {
            try {
                //check for existing role
                let botRole = msg.guild.roles.cache.find(role => {
                    return role.name === 'Dota2PatchBotNotification';
                });

                //create new role if it doesn't exist
                if (botRole === undefined) {
                    botRole = await msg.guild.roles.create({
                        data: {
                            name: 'Dota2PatchBotNotification',
                            color: 'RED',
                        },
                        reason: 'role to notify people of Dota 2 patch notes from the Dota 2 Patch Bot',
                    });
                }
                console.log(botRole);
                console.log(botRole.id);
                db.collection('channels').doc(msg.guild.id)
                    .set({
                        channel_id: msg.channel.id,
                        role_id: botRole.id
                    });
                client.channels.cache.get(msg.channel.id).send('Subscribed to #' + msg.channel.name + ' in ' + msg.guild.name);
            }
            catch (e) {
                console.error(e);
            }
        }
    }


    //get notified/alerted/@-ed when a new patch update is posted
    else if (msg.content === '!patch notify') {
        //if not yet subscribed, then error
        try {
            const doc = await db.collection("channels").doc(msg.guild.id).get();
            if (doc.exists) {

                msg.member.roles.add(doc.data().role_id);
                msg.reply("you have subscribed to be notified of Dota2 patch notes and news");

            } else {
                // doc.data() will be undefined in this case
                msg.reply("please subscribe first");
            }
        } catch (e) {
            console.error(e);
        }
    }
})

client.login(process.env.BOT_TOKEN);