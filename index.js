require("dotenv").config();

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection
} = require("@discordjs/voice");

// ================= TOKEN CHECK =================

if (!process.env.TOKEN) {
  console.error("❌ TOKEN is missing in Railway Variables");
  process.exit(1);
}

// ================= KEEP ALIVE =================

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("✅ Bot is running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🌍 Web server running");
});

// ================= DISCORD CLIENT =================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ================= COMMANDS =================

const commands = [
  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Send DM to role members")
    .addRoleOption(option =>
      option.setName("role").setDescription("Select role").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("message").setDescription("Message to send").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  // 🔥 NEW: FLASH JOIN COMMAND
  new SlashCommandBuilder()
    .setName("flashjoin")
    .setDescription("Bot joins YOUR current voice channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON()
];

// ================= READY =================

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Slash command registration failed:", err);
  }
});

// ================= INTERACTION =================

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isChatInputCommand()) return;

    // ================= DM COMMAND =================
    if (interaction.commandName === "dm") {
      const role = interaction.options.getRole("role");
      const msg = interaction.options.getString("message");

      await interaction.reply({
        content: `📨 Sending DMs to role: ${role.name}`,
        ephemeral: true
      });

      await interaction.guild.members.fetch();

      const members = interaction.guild.members.cache.filter(
        m => m.roles.cache.has(role.id) && !m.user.bot
      );

      let success = 0;
      let failed = 0;

      for (const member of members.values()) {
        try {
          await member.send({
            content: `👋 Hello ${member.user.username},

${msg}

━━━━━━━━━━━━━━━
🤖 Sent via CID Alert Bot`
          });

          success++;
        } catch (err) {
          failed++;
        }
      }

      await interaction.followUp({
        content: `✅ DM Completed

👥 Total: ${members.size}
✅ Success: ${success}
❌ Failed: ${failed}`,
        ephemeral: true
      });
    }

    // ================= FLASH JOIN =================
    if (interaction.commandName === "flashjoin") {
      const memberVoice = interaction.member.voice.channel;

      if (!memberVoice) {
        return interaction.reply({
          content: "❌ നീ ഇപ്പോൾ voice channel-ൽ ഇല്ല",
          ephemeral: true
        });
      }

      // disconnect old connection if exists
      const oldConnection = getVoiceConnection(interaction.guild.id);
      if (oldConnection) oldConnection.destroy();

      joinVoiceChannel({
        channelId: memberVoice.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false
      });

      return interaction.reply({
        content: `🔊 Joined your VC: ${memberVoice.name}`,
        ephemeral: true
      });
    }

  } catch (err) {
    console.error("❌ Interaction Error:", err);
  }
});

// ================= LOGIN =================

client.login(process.env.TOKEN);
