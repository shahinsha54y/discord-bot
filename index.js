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
  joinVoiceChannel
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

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    bot: client?.user?.tag || "starting"
  });
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
      option
        .setName("role")
        .setDescription("Select role")
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("Message to send")
        .setRequired(true)
    )

    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .toJSON()
];

// ================= READY =================

client.once("clientReady", async () =>

  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.TOKEN);

  try {

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("✅ Slash commands registered");

    // ================= AUTO VC JOIN =================

    const guild = client.guilds.cache.first();

    if (guild) {

      const channel = guild.channels.cache.find(
        c => c.type === 2
      );

      if (channel) {

        joinVoiceChannel({
          channelId: channel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: false
        });

        console.log(`🔊 Joined VC: ${channel.name}`);
      }
    }

  } catch (err) {

    console.error("❌ Slash command registration failed:", err);

  }
});

// ================= HELPER =================

const delay = ms => new Promise(res => setTimeout(res, ms));

// ================= INTERACTION =================

client.on("interactionCreate", async interaction => {

  try {

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "dm") {

      const role = interaction.options.getRole("role");
      const msg = interaction.options.getString("message");

      await interaction.reply({
        content: `📨 Sending DMs to role: ${role.name}`,
        flags: 64
      });

      await interaction.guild.members.fetch();

      const members = interaction.guild.members.cache.filter(
        m =>
          m.roles.cache.has(role.id) &&
          !m.user.bot
      );

      let success = 0;
      let failed = 0;

      for (const member of members.values()) {

        try {

          await member.send({
            content:
`👋 Hello ${member.user.username},

${msg}

━━━━━━━━━━━━━━━
🤖 Sent via CID Alert Bot`
          });

          success++;

          console.log(`✅ Sent DM to ${member.user.tag}`);

          await delay(2000);

        } catch (err) {

          failed++;

          console.log(`❌ Failed DM to ${member.user.tag}`);

        }
      }

      await interaction.followUp({
        content:
`✅ DM Sending Completed

👥 Total Users: ${members.size}
✅ Success: ${success}
❌ Failed: ${failed}`,
        flags: 64
      });
    }

  } catch (err) {

    console.error("❌ Interaction Error:", err);

  }
});

// ================= ERROR HANDLING =================

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught Exception:", error);
});

// ================= GRACEFUL SHUTDOWN =================

process.on("SIGINT", () => {
  console.log("🛑 Bot shutting down...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("🛑 Railway stopped the container");
  client.destroy();
  process.exit(0);
});

// ================= LOGIN =================

client.login(process.env.TOKEN);
