const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(3000, () => {
  console.log('Web server started');
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

const PREFIX = '!';

client.once('ready', () => {
  console.log(`${client.user.tag} is online!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === '!dmrole') {
    const role = message.mentions.roles.first();

    if (!role) {
      return message.reply(
        'Please mention a role.\nExample: !dmrole @CID war on vc va myre.'
      );
    }

    const dmMessage = message.content
      .replace(/^!dmrole\s+/, '')
      .replace(role.toString(), '')
      .trim();

    if (!dmMessage) {
      return message.reply('Please provide a message to send.');
    }

    await message.guild.members.fetch();

    const members = role.members.filter(member => !member.user.bot);

    let sent = 0;
    let failed = 0;

    for (const member of members.values()) {
      try {
        await member.send(`📢 CID SITUATION Announcement\n\n${dmMessage}`);
        sent++;
      } catch (error) {
        failed++;
        console.log(`Could not DM ${member.user.tag}`);
      }
    }

    await message.reply(
      `✅ Sent DM to ${sent} members.\n❌ Failed to send to ${failed} members.`
    );
  }
});

client.login(process.env.TOKEN);
