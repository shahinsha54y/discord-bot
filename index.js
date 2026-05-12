require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ================= COMMAND =================

const commands = [
  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Send DM to role members")
    .addRoleOption(option =>
      option.setName("role")
        .setDescription("Select role")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("message")
        .setDescription("Message to send")
        .setRequired(true)
    )
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
    console.log(err);
  }
});

// ================= HELPER =================

const delay = ms => new Promise(res => setTimeout(res, ms));

// ================= INTERACTION =================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "dm") {

    const role = interaction.options.getRole("role");
    const msg = interaction.options.getString("message");

    await interaction.reply({
      content: `📨 Sending DM to role: ${role.name}`,
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
        await member.send(`👋 Hello ${member.user.username}\n\n${msg}`);
        success++;

        console.log(`✅ Sent DM to ${member.user.tag}`);

        // 🔥 IMPORTANT: prevent rate limit
        await delay(1500);

      } catch (err) {
        failed++;
        console.log(`❌ Failed DM to ${member.user.tag}`);
      }
    }

    await interaction.followUp({
      content: `✅ Completed\n👥 ${members.size}\n✅ ${success}\n❌ ${failed}`,
      ephemeral: true
    });
  }
});

// ================= LOGIN =================

client.login(process.env.TOKEN);
