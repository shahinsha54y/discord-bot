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

// ================= KEEP ALIVE =================

const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running ✅");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🌍 Web server running");
});

// ================= DISCORD CLIENT =================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
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

client.once("clientReady", async () => {

  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("✅ Slash commands registered");

  } catch (err) {

    console.error("❌ Slash command error:", err);

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
        content: `📨 Sending DM to role: ${role.name}`,
        flags: 64
      });

      await interaction.guild.members.fetch();

      const members = interaction.guild.members.cache.filter(
        m => m.roles.cache.has(role.id) && !m.user.bot
      );

      let success = 0;
      let failed = 0;

      for (const member of members.values()) {

        try {

          await member.send(
            `👋 Hello ${member.user.username}\n\n${msg}`
          );

          success++;

          console.log(`✅ Sent DM to ${member.user.tag}`);

          // Anti rate-limit
          await delay(2000);

        } catch (err) {

          failed++;

          console.log(`❌ Failed DM to ${member.user.tag}`);

        }
      }

      await interaction.followUp({
        content:
          `✅ Completed\n\n👥 Total: ${members.size}\n✅ Success: ${success}\n❌ Failed: ${failed}`,
        flags: 64
      });
    }

  } catch (err) {

    console.error("❌ Interaction Error:", err);

  }
});

// ================= ERROR HANDLING =================

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled promise rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught exception:", error);
});

// ================= LOGIN =================

client.login(process.env.TOKEN);
